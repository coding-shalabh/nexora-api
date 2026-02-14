/**
 * Simple notification utilities for sending emails and SMS
 * Used by reminder system and other background jobs
 */

import nodemailer from 'nodemailer';
import axios from 'axios';
import { logger } from '../logger.js';

/**
 * Send email using SMTP or configured provider
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    // Use environment variable for email service
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

    if (emailProvider === 'smtp') {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        text,
      });

      logger.info({ to, subject }, 'Email sent via SMTP');
    } else if (emailProvider === 'resend') {
      // Resend API integration
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: process.env.RESEND_FROM_EMAIL,
          to,
          subject,
          html,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info({ to, subject }, 'Email sent via Resend');
    } else if (emailProvider === 'msg91') {
      // MSG91 Email integration
      await axios.post(
        'https://control.msg91.com/api/v5/email/send',
        {
          to: [{ email: to }],
          from: { email: process.env.MSG91_FROM_EMAIL },
          subject,
          body: html || text,
        },
        {
          headers: {
            authkey: process.env.MSG91_AUTH_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info({ to, subject }, 'Email sent via MSG91');
    } else {
      throw new Error(`Unsupported email provider: ${emailProvider}`);
    }

    return { success: true };
  } catch (error) {
    logger.error({ error: error.message, to, subject }, 'Failed to send email');
    throw error;
  }
}

/**
 * Send SMS using MSG91 or configured provider
 */
export async function sendSMS({ to, message }) {
  try {
    const smsProvider = process.env.SMS_PROVIDER || 'msg91';

    if (smsProvider === 'msg91') {
      // Remove any non-numeric characters from phone number
      const cleanPhone = to.replace(/\D/g, '');

      await axios.post(
        `https://control.msg91.com/api/v5/flow/`,
        {
          flow_id: process.env.MSG91_SMS_FLOW_ID || 'default',
          mobiles: cleanPhone,
          var1: message,
        },
        {
          headers: {
            authkey: process.env.MSG91_AUTH_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info({ to: cleanPhone }, 'SMS sent via MSG91');
    } else if (smsProvider === 'twilio') {
      // Twilio integration
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        new URLSearchParams({
          From: fromNumber,
          To: to,
          Body: message,
        }),
        {
          auth: {
            username: accountSid,
            password: authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      logger.info({ to }, 'SMS sent via Twilio');
    } else {
      throw new Error(`Unsupported SMS provider: ${smsProvider}`);
    }

    return { success: true };
  } catch (error) {
    logger.error({ error: error.message, to }, 'Failed to send SMS');
    throw error;
  }
}

/**
 * Send WhatsApp message using MSG91
 */
export async function sendWhatsApp({ to, message }) {
  try {
    const cleanPhone = to.replace(/\D/g, '');

    await axios.post(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/',
      {
        integrated_number: process.env.MSG91_WHATSAPP_NUMBER,
        content_type: 'text',
        payload: {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: {
            body: message,
          },
        },
      },
      {
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info({ to: cleanPhone }, 'WhatsApp message sent via MSG91');
    return { success: true };
  } catch (error) {
    logger.error({ error: error.message, to }, 'Failed to send WhatsApp message');
    throw error;
  }
}
