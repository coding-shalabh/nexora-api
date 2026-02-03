/**
 * Email IMAP Service
 * Fetches emails from IMAP servers (Hostinger, Gmail, etc.)
 * Supports real-time sync and inbox management
 */

import { ImapFlow } from 'imapflow';
import { prisma } from '@crm360/database';
import { simpleParser } from 'mailparser';
import { emailAccountsService } from '../modules/email/email-accounts.service.js';

// IMAP connection cache
const connectionPool = new Map();

/**
 * Get or create IMAP connection for an email account
 */
async function getConnection(accountId) {
  // Check if we have a cached connection
  if (connectionPool.has(accountId)) {
    const cached = connectionPool.get(accountId);
    if (cached.client && !cached.client.destroyed) {
      return cached.client;
    }
    connectionPool.delete(accountId);
  }

  // Get account credentials
  const credentials = await emailAccountsService.getCredentials(accountId);
  if (!credentials || !credentials.smtp) {
    throw new Error('Email account not configured');
  }

  // Determine IMAP settings from provider
  const imapHost = credentials.smtp.host.replace('smtp.', 'imap.');
  const imapPort = 993;

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: {
      user: credentials.email,
      pass: credentials.smtp.password,
    },
    logger: false,
  });

  // Connect
  await client.connect();

  // Cache connection
  connectionPool.set(accountId, { client, lastUsed: Date.now() });

  return client;
}

/**
 * Close IMAP connection
 */
async function closeConnection(accountId) {
  if (connectionPool.has(accountId)) {
    const cached = connectionPool.get(accountId);
    if (cached.client) {
      await cached.client.logout();
    }
    connectionPool.delete(accountId);
  }
}

/**
 * List mailbox folders
 */
export async function listFolders(accountId) {
  const client = await getConnection(accountId);

  try {
    const folders = [];
    for await (const folder of client.listTree()) {
      folders.push({
        name: folder.name,
        path: folder.path,
        delimiter: folder.delimiter,
        specialUse: folder.specialUse,
        flags: folder.flags,
      });
    }
    return folders;
  } finally {
    // Keep connection alive for reuse
  }
}

/**
 * Fetch emails from inbox
 */
export async function fetchEmails(accountId, options = {}) {
  const { folder = 'INBOX', limit = 50, page = 1, since, before, search } = options;

  const client = await getConnection(accountId);

  try {
    // Open mailbox
    const mailbox = await client.mailboxOpen(folder);

    const messages = [];
    let query = { all: true };

    // Build search query
    if (since) {
      query = { since: new Date(since) };
    }
    if (before) {
      query = { ...query, before: new Date(before) };
    }
    if (search) {
      query = { ...query, or: [{ subject: search }, { from: search }, { body: search }] };
    }

    // Calculate range for pagination
    const total = mailbox.exists;
    const start = Math.max(1, total - page * limit + 1);
    const end = Math.max(1, total - (page - 1) * limit);

    // Fetch messages
    for await (const message of client.fetch(`${start}:${end}`, {
      envelope: true,
      bodyStructure: true,
      flags: true,
      uid: true,
      internalDate: true,
      size: true,
    })) {
      messages.push({
        uid: message.uid,
        messageId: message.envelope?.messageId,
        subject: message.envelope?.subject || '(No Subject)',
        from: message.envelope?.from?.[0] || null,
        to: message.envelope?.to || [],
        cc: message.envelope?.cc || [],
        date: message.envelope?.date || message.internalDate,
        flags: Array.from(message.flags || []),
        isRead: message.flags?.has('\\Seen') || false,
        isFlagged: message.flags?.has('\\Flagged') || false,
        hasAttachments: hasAttachments(message.bodyStructure),
        size: message.size,
      });
    }

    // Sort by date descending (newest first)
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      messages,
      total,
      page,
      limit,
      folder,
      totalPages: Math.ceil(total / limit),
    };
  } finally {
    // Keep connection alive
  }
}

/**
 * Fetch a single email with full body
 */
export async function fetchEmail(accountId, uid, folder = 'INBOX') {
  const client = await getConnection(accountId);

  try {
    await client.mailboxOpen(folder);

    // Fetch full message
    const message = await client.fetchOne(uid, {
      envelope: true,
      bodyStructure: true,
      flags: true,
      uid: true,
      internalDate: true,
      source: true, // Get raw email source
    });

    if (!message) {
      return null;
    }

    // Parse the email source
    const parsed = await simpleParser(message.source);

    return {
      uid: message.uid,
      messageId: message.envelope?.messageId,
      subject: message.envelope?.subject || '(No Subject)',
      from: message.envelope?.from?.[0] || null,
      to: message.envelope?.to || [],
      cc: message.envelope?.cc || [],
      bcc: message.envelope?.bcc || [],
      replyTo: message.envelope?.replyTo || [],
      inReplyTo: message.envelope?.inReplyTo,
      date: message.envelope?.date || message.internalDate,
      flags: Array.from(message.flags || []),
      isRead: message.flags?.has('\\Seen') || false,
      isFlagged: message.flags?.has('\\Flagged') || false,
      // Parsed content
      textBody: parsed.text || '',
      htmlBody: parsed.html || '',
      attachments: (parsed.attachments || []).map((att) => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        contentId: att.contentId,
      })),
      headers: Object.fromEntries(parsed.headers),
    };
  } finally {
    // Keep connection alive
  }
}

/**
 * Mark email as read/unread
 */
export async function markAsRead(accountId, uid, folder = 'INBOX', read = true) {
  const client = await getConnection(accountId);

  try {
    await client.mailboxOpen(folder);

    if (read) {
      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
    } else {
      await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
    }

    return { success: true };
  } finally {
    // Keep connection alive
  }
}

/**
 * Flag/unflag email (star)
 */
export async function flagEmail(accountId, uid, folder = 'INBOX', flagged = true) {
  const client = await getConnection(accountId);

  try {
    await client.mailboxOpen(folder);

    if (flagged) {
      await client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
    } else {
      await client.messageFlagsRemove(uid, ['\\Flagged'], { uid: true });
    }

    return { success: true };
  } finally {
    // Keep connection alive
  }
}

/**
 * Move email to folder
 */
export async function moveEmail(accountId, uid, fromFolder, toFolder) {
  const client = await getConnection(accountId);

  try {
    await client.mailboxOpen(fromFolder);
    await client.messageMove(uid, toFolder, { uid: true });

    return { success: true };
  } finally {
    // Keep connection alive
  }
}

/**
 * Delete email (move to trash)
 */
export async function deleteEmail(accountId, uid, folder = 'INBOX') {
  const client = await getConnection(accountId);

  try {
    await client.mailboxOpen(folder);

    // Try to move to Trash folder
    try {
      await client.messageMove(uid, 'Trash', { uid: true });
    } catch {
      // If Trash doesn't exist, mark as deleted
      await client.messageFlagsAdd(uid, ['\\Deleted'], { uid: true });
      await client.messageDelete(uid, { uid: true });
    }

    return { success: true };
  } finally {
    // Keep connection alive
  }
}

/**
 * Sync emails to database
 */
export async function syncEmails(tenantId, accountId, options = {}) {
  const { folder = 'INBOX', since, fullSync = false } = options;

  const account = await prisma.emailAccount.findFirst({
    where: { id: accountId, tenantId },
  });

  if (!account) {
    throw new Error('Email account not found');
  }

  const client = await getConnection(accountId);

  try {
    const mailbox = await client.mailboxOpen(folder);

    // Determine sync range
    let query = {};
    if (!fullSync && account.lastSyncAt) {
      query = { since: new Date(account.lastSyncAt) };
    } else if (since) {
      query = { since: new Date(since) };
    } else {
      // Default: last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = { since: thirtyDaysAgo };
    }

    const synced = [];
    let count = 0;
    const maxEmails = options.limit || 100;

    // Search for messages
    for await (const message of client.fetch(
      { ...query },
      {
        envelope: true,
        bodyStructure: true,
        flags: true,
        uid: true,
        internalDate: true,
        source: true,
      }
    )) {
      if (count >= maxEmails) break;

      // Check if email already exists
      const existing = await prisma.email.findFirst({
        where: {
          tenantId,
          accountId,
          externalId: String(message.uid),
        },
      });

      if (existing) {
        // Update flags only
        await prisma.email.update({
          where: { id: existing.id },
          data: {
            isRead: message.flags?.has('\\Seen') || false,
            isFlagged: message.flags?.has('\\Flagged') || false,
          },
        });
        continue;
      }

      // Parse the email
      const parsed = await simpleParser(message.source);
      const fromAddress = message.envelope?.from?.[0]?.address || '';
      const toAddresses = (message.envelope?.to || []).map((t) => t.address);

      // Find or create contact
      let contactId = null;
      if (fromAddress) {
        const contact = await prisma.contact.findFirst({
          where: { tenantId, email: fromAddress },
        });
        contactId = contact?.id || null;
      }

      // Create email record
      const email = await prisma.email.create({
        data: {
          tenantId,
          accountId,
          accountType: 'personal',
          externalId: String(message.uid),
          messageId: message.envelope?.messageId,
          fromEmail: fromAddress,
          fromName: message.envelope?.from?.[0]?.name || fromAddress,
          toEmails: JSON.stringify(toAddresses),
          ccEmails: message.envelope?.cc
            ? JSON.stringify(message.envelope.cc.map((c) => c.address))
            : null,
          subject: message.envelope?.subject || '(No Subject)',
          bodyText: parsed.text || '',
          bodyHtml: parsed.html || '',
          status: 'RECEIVED',
          direction: 'INBOUND',
          receivedAt: message.envelope?.date || message.internalDate,
          isRead: message.flags?.has('\\Seen') || false,
          isFlagged: message.flags?.has('\\Flagged') || false,
          hasAttachments: (parsed.attachments || []).length > 0,
          folder,
          contactId,
        },
      });

      synced.push(email.id);
      count++;
    }

    // Update last sync time
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastSyncAt: new Date() },
    });

    return {
      success: true,
      synced: synced.length,
      folder,
      total: mailbox.exists,
    };
  } finally {
    // Keep connection alive
  }
}

/**
 * Get email statistics for an account
 */
export async function getEmailStats(accountId) {
  const client = await getConnection(accountId);

  try {
    const stats = {};

    // Get INBOX stats
    const inbox = await client.mailboxOpen('INBOX');
    stats.inbox = {
      total: inbox.exists,
      unread: inbox.unseen || 0,
    };

    // Try to get other folder stats
    const folders = ['Sent', 'Drafts', 'Trash', 'Spam', 'Junk'];
    for (const folderName of folders) {
      try {
        const folder = await client.mailboxOpen(folderName);
        stats[folderName.toLowerCase()] = {
          total: folder.exists,
        };
      } catch {
        // Folder doesn't exist
      }
    }

    return stats;
  } finally {
    // Keep connection alive
  }
}

/**
 * Test IMAP connection
 */
export async function testConnection(accountId) {
  try {
    const client = await getConnection(accountId);
    const folders = await listFolders(accountId);
    await closeConnection(accountId);

    return {
      success: true,
      message: 'IMAP connection successful',
      folders: folders.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Helper function to check if message has attachments
function hasAttachments(bodyStructure) {
  if (!bodyStructure) return false;

  if (bodyStructure.disposition === 'attachment') {
    return true;
  }

  if (bodyStructure.childNodes) {
    return bodyStructure.childNodes.some((child) => hasAttachments(child));
  }

  return false;
}

// Cleanup old connections periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  for (const [accountId, cached] of connectionPool.entries()) {
    if (now - cached.lastUsed > maxAge) {
      closeConnection(accountId).catch(() => {});
    }
  }
}, 60 * 1000); // Check every minute

export const emailImapService = {
  listFolders,
  fetchEmails,
  fetchEmail,
  markAsRead,
  flagEmail,
  moveEmail,
  deleteEmail,
  syncEmails,
  getEmailStats,
  testConnection,
  closeConnection,
};

export default emailImapService;
