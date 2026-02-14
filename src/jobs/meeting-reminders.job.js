/**
 * Meeting Reminders Job - Send email/SMS reminders for upcoming meetings
 */

import { Queue, Worker } from 'bullmq';
import { prisma } from '@crm360/database';
import { redis } from '../config/redis.js';
import { logger } from '../common/logger.js';
import { sendEmail, sendSMS } from '../common/utils/notifications.js';

// Create queue for meeting reminders
export const meetingRemindersQueue = new Queue('meeting-reminders', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 7 days
    },
  },
});

/**
 * Process meeting reminder jobs
 */
export const meetingRemindersWorker = new Worker(
  'meeting-reminders',
  async (job) => {
    const { reminderId } = job.data;

    try {
      // Get reminder details
      const reminder = await prisma.meetingReminder.findUnique({
        where: { id: reminderId },
        include: {
          bookingSlot: {
            include: {
              bookingPage: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!reminder) {
        logger.warn({ reminderId }, 'Meeting reminder not found');
        return { success: false, error: 'Reminder not found' };
      }

      if (reminder.status !== 'PENDING') {
        logger.info({ reminderId, status: reminder.status }, 'Reminder already processed');
        return { success: true, skipped: true };
      }

      const results = { email: null, sms: null };

      // Send email reminder
      if (reminder.sendEmail && reminder.recipientEmail) {
        try {
          await sendEmailReminder(reminder);
          results.email = { success: true };
        } catch (error) {
          logger.error({ error, reminderId }, 'Failed to send email reminder');
          results.email = { success: false, error: error.message };
        }
      }

      // Send SMS reminder
      if (reminder.sendSms && reminder.recipientPhone) {
        try {
          await sendSMSReminder(reminder);
          results.sms = { success: true };
        } catch (error) {
          logger.error({ error, reminderId }, 'Failed to send SMS reminder');
          results.sms = { success: false, error: error.message };
        }
      }

      // Update reminder status
      const allSuccess =
        (reminder.sendEmail ? results.email?.success : true) &&
        (reminder.sendSms ? results.sms?.success : true);

      await prisma.meetingReminder.update({
        where: { id: reminderId },
        data: {
          status: allSuccess ? 'SENT' : 'FAILED',
          sentAt: new Date(),
          failureReason: allSuccess ? null : JSON.stringify(results),
        },
      });

      return { success: allSuccess, results };
    } catch (error) {
      logger.error({ error, reminderId }, 'Meeting reminder job failed');

      // Update reminder as failed
      await prisma.meetingReminder.update({
        where: { id: reminderId },
        data: {
          status: 'FAILED',
          failureReason: error.message,
        },
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

/**
 * Send email reminder
 */
async function sendEmailReminder(reminder) {
  const { bookingSlot } = reminder;
  const hostName = bookingSlot.bookingPage.user.name;
  const meetingTitle = reminder.meetingTitle || bookingSlot.bookingPage.title;

  const meetingDate = new Date(reminder.meetingTime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const meetingTime = new Date(reminder.meetingTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: bookingSlot.bookingPage.timezone,
  });

  const emailContent = `
    <h2>Reminder: Upcoming Meeting</h2>
    <p>Hi ${bookingSlot.guestName},</p>
    <p>This is a friendly reminder about your upcoming meeting:</p>

    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">${meetingTitle}</h3>
      <p><strong>With:</strong> ${hostName}</p>
      <p><strong>Date:</strong> ${meetingDate}</p>
      <p><strong>Time:</strong> ${meetingTime} (${bookingSlot.bookingPage.timezone})</p>
      ${reminder.meetingLink ? `<p><strong>Join:</strong> <a href="${reminder.meetingLink}">${reminder.meetingLink}</a></p>` : ''}
    </div>

    ${bookingSlot.notes ? `<p><strong>Notes:</strong> ${bookingSlot.notes}</p>` : ''}

    <p>Looking forward to our meeting!</p>
    <p>Best regards,<br>${hostName}</p>
  `;

  await sendEmail({
    to: reminder.recipientEmail,
    subject: `Reminder: ${meetingTitle} - ${meetingDate} at ${meetingTime}`,
    html: emailContent,
  });

  logger.info({ reminderId: reminder.id, email: reminder.recipientEmail }, 'Email reminder sent');
}

/**
 * Send SMS reminder
 */
async function sendSMSReminder(reminder) {
  const { bookingSlot } = reminder;
  const meetingDate = new Date(reminder.meetingTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const meetingTime = new Date(reminder.meetingTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const message = `Reminder: Meeting "${reminder.meetingTitle || bookingSlot.bookingPage.title}" on ${meetingDate} at ${meetingTime}${reminder.meetingLink ? `. Join: ${reminder.meetingLink}` : ''}`;

  await sendSMS({
    to: reminder.recipientPhone,
    message: message.slice(0, 160), // SMS character limit
  });

  logger.info({ reminderId: reminder.id, phone: reminder.recipientPhone }, 'SMS reminder sent');
}

/**
 * Schedule a meeting reminder
 */
export async function scheduleMeetingReminder(reminderId, sendAt) {
  const delay = new Date(sendAt).getTime() - Date.now();

  if (delay <= 0) {
    // Send immediately if the time has already passed
    await meetingRemindersQueue.add('send-reminder', { reminderId });
  } else {
    // Schedule for future
    await meetingRemindersQueue.add('send-reminder', { reminderId }, { delay });
  }

  logger.info({ reminderId, sendAt }, 'Meeting reminder scheduled');
}

/**
 * Cron job to check for pending reminders every 5 minutes
 */
export async function checkPendingReminders() {
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

  const pendingReminders = await prisma.meetingReminder.findMany({
    where: {
      status: 'PENDING',
      sendAt: {
        lte: fiveMinutesFromNow,
      },
    },
    take: 100, // Process in batches
  });

  for (const reminder of pendingReminders) {
    await scheduleMeetingReminder(reminder.id, reminder.sendAt);
  }

  if (pendingReminders.length > 0) {
    logger.info({ count: pendingReminders.length }, 'Scheduled pending meeting reminders');
  }
}

// Worker event handlers
meetingRemindersWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Meeting reminder job completed');
});

meetingRemindersWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Meeting reminder job failed');
});

meetingRemindersWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Meeting reminders worker error');
});

logger.info('Meeting reminders worker started');
