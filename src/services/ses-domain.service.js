import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  ListEmailIdentitiesCommand,
} from '@aws-sdk/client-sesv2';
import { prisma } from '@crm360/database';

// Initialize SES v2 client
const sesClient = new SESv2Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Add a new domain for verification
 */
export async function addDomain(tenantId, domain, options = {}) {
  const { fromEmail, fromName } = options;

  // Check if domain already exists for this tenant
  const existing = await prisma.tenantEmailDomain.findUnique({
    where: { tenantId_domain: { tenantId, domain } },
  });

  if (existing) {
    throw new Error('Domain already added for this tenant');
  }

  // Create email identity in AWS SES
  const command = new CreateEmailIdentityCommand({
    EmailIdentity: domain,
    DkimSigningAttributes: {
      NextSigningKeyLength: 'RSA_2048_BIT',
    },
  });

  let sesResponse;
  try {
    sesResponse = await sesClient.send(command);
  } catch (error) {
    // If identity already exists in SES, get its details
    if (error.name === 'AlreadyExistsException') {
      sesResponse = await getIdentityDetails(domain);
    } else {
      throw error;
    }
  }

  // Extract DKIM tokens
  const dkimTokens = sesResponse.DkimAttributes?.Tokens || [];
  const dkimRecords = dkimTokens.map((token) => ({
    name: `${token}._domainkey.${domain}`,
    value: `${token}.dkim.amazonses.com`,
    type: 'CNAME',
  }));

  // Create domain record in database
  const domainRecord = await prisma.tenantEmailDomain.create({
    data: {
      tenantId,
      domain,
      fromEmail: fromEmail || `noreply@${domain}`,
      fromName: fromName || null,
      status: 'PENDING',
      verificationToken: sesResponse.VerificationToken || null,
      dkimTokens: {
        tokens: dkimTokens,
        records: dkimRecords,
      },
      dkimStatus: sesResponse.DkimAttributes?.Status || 'PENDING',
    },
  });

  return {
    id: domainRecord.id,
    domain: domainRecord.domain,
    status: domainRecord.status,
    dnsRecords: [
      // Domain verification TXT record (if available)
      ...(sesResponse.VerificationToken
        ? [
            {
              type: 'TXT',
              name: `_amazonses.${domain}`,
              value: sesResponse.VerificationToken,
              purpose: 'Domain Verification',
            },
          ]
        : []),
      // DKIM CNAME records
      ...dkimRecords.map((r) => ({
        type: 'CNAME',
        name: r.name,
        value: r.value,
        purpose: 'DKIM Signing',
      })),
    ],
    instructions: `Add these DNS records to your domain registrar to verify ownership and enable email signing.`,
  };
}

/**
 * Get identity details from AWS SES
 */
async function getIdentityDetails(domain) {
  const command = new GetEmailIdentityCommand({
    EmailIdentity: domain,
  });

  return sesClient.send(command);
}

/**
 * Check domain verification status
 */
export async function checkDomainStatus(tenantId, domainId) {
  const domainRecord = await prisma.tenantEmailDomain.findFirst({
    where: { id: domainId, tenantId },
  });

  if (!domainRecord) {
    throw new Error('Domain not found');
  }

  // Get current status from AWS SES
  const sesDetails = await getIdentityDetails(domainRecord.domain);

  const identityType = sesDetails.IdentityType;
  const verificationStatus = sesDetails.VerificationStatus;
  const dkimStatus = sesDetails.DkimAttributes?.Status;
  const dkimTokens = sesDetails.DkimAttributes?.Tokens || [];

  // Determine overall status
  let newStatus = domainRecord.status;
  let verifiedAt = domainRecord.verifiedAt;

  if (verificationStatus === 'SUCCESS' && dkimStatus === 'SUCCESS') {
    newStatus = 'VERIFIED';
    verifiedAt = verifiedAt || new Date();
  } else if (verificationStatus === 'FAILED' || dkimStatus === 'FAILED') {
    newStatus = 'FAILED';
  } else if (verificationStatus === 'PENDING' || dkimStatus === 'PENDING') {
    newStatus = 'VERIFYING';
  }

  // Update database record
  const updated = await prisma.tenantEmailDomain.update({
    where: { id: domainId },
    data: {
      status: newStatus,
      dkimStatus,
      verifiedAt,
      lastCheckedAt: new Date(),
      dkimTokens: {
        tokens: dkimTokens,
        records: dkimTokens.map((token) => ({
          name: `${token}._domainkey.${domainRecord.domain}`,
          value: `${token}.dkim.amazonses.com`,
          type: 'CNAME',
        })),
      },
    },
  });

  return {
    id: updated.id,
    domain: updated.domain,
    status: updated.status,
    verificationStatus,
    dkimStatus,
    verifiedAt: updated.verifiedAt,
    lastCheckedAt: updated.lastCheckedAt,
  };
}

/**
 * Get all domains for a tenant
 */
export async function getTenantDomains(tenantId) {
  const domains = await prisma.tenantEmailDomain.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return domains.map((d) => ({
    id: d.id,
    domain: d.domain,
    fromEmail: d.fromEmail,
    fromName: d.fromName,
    status: d.status,
    dkimStatus: d.dkimStatus,
    isDefault: d.isDefault,
    verifiedAt: d.verifiedAt,
    createdAt: d.createdAt,
  }));
}

/**
 * Get domain details with DNS records
 */
export async function getDomainDetails(tenantId, domainId) {
  const domain = await prisma.tenantEmailDomain.findFirst({
    where: { id: domainId, tenantId },
  });

  if (!domain) {
    throw new Error('Domain not found');
  }

  const dkimTokens = domain.dkimTokens || { tokens: [], records: [] };

  return {
    id: domain.id,
    domain: domain.domain,
    fromEmail: domain.fromEmail,
    fromName: domain.fromName,
    status: domain.status,
    dkimStatus: domain.dkimStatus,
    isDefault: domain.isDefault,
    verifiedAt: domain.verifiedAt,
    lastCheckedAt: domain.lastCheckedAt,
    createdAt: domain.createdAt,
    dnsRecords: [
      ...(domain.verificationToken
        ? [
            {
              type: 'TXT',
              name: `_amazonses.${domain.domain}`,
              value: domain.verificationToken,
              purpose: 'Domain Verification',
            },
          ]
        : []),
      ...dkimTokens.records.map((r) => ({
        type: 'CNAME',
        name: r.name,
        value: r.value,
        purpose: 'DKIM Signing',
      })),
    ],
  };
}

/**
 * Set a domain as default for the tenant
 */
export async function setDefaultDomain(tenantId, domainId) {
  const domain = await prisma.tenantEmailDomain.findFirst({
    where: { id: domainId, tenantId },
  });

  if (!domain) {
    throw new Error('Domain not found');
  }

  if (domain.status !== 'VERIFIED') {
    throw new Error('Only verified domains can be set as default');
  }

  // Unset all other defaults
  await prisma.tenantEmailDomain.updateMany({
    where: { tenantId, isDefault: true },
    data: { isDefault: false },
  });

  // Set this one as default
  const updated = await prisma.tenantEmailDomain.update({
    where: { id: domainId },
    data: { isDefault: true },
  });

  return updated;
}

/**
 * Update domain settings
 */
export async function updateDomain(tenantId, domainId, data) {
  const domain = await prisma.tenantEmailDomain.findFirst({
    where: { id: domainId, tenantId },
  });

  if (!domain) {
    throw new Error('Domain not found');
  }

  const { fromEmail, fromName } = data;

  const updated = await prisma.tenantEmailDomain.update({
    where: { id: domainId },
    data: {
      ...(fromEmail && { fromEmail }),
      ...(fromName !== undefined && { fromName }),
    },
  });

  return updated;
}

/**
 * Delete a domain
 */
export async function deleteDomain(tenantId, domainId) {
  const domain = await prisma.tenantEmailDomain.findFirst({
    where: { id: domainId, tenantId },
  });

  if (!domain) {
    throw new Error('Domain not found');
  }

  // Delete from AWS SES
  try {
    const command = new DeleteEmailIdentityCommand({
      EmailIdentity: domain.domain,
    });
    await sesClient.send(command);
  } catch (error) {
    // Ignore if already deleted from SES
    console.warn('Failed to delete from SES:', error.message);
  }

  // Delete from database
  await prisma.tenantEmailDomain.delete({
    where: { id: domainId },
  });

  return { deleted: true };
}

/**
 * Get the sending domain for a tenant (verified custom or default)
 */
export async function getSendingDomain(tenantId) {
  // First try to get default custom domain
  const customDomain = await prisma.tenantEmailDomain.findFirst({
    where: {
      tenantId,
      status: 'VERIFIED',
      isDefault: true,
    },
  });

  if (customDomain) {
    return {
      domain: customDomain.domain,
      fromEmail: customDomain.fromEmail,
      fromName: customDomain.fromName,
      isCustom: true,
    };
  }

  // Fall back to any verified domain
  const anyVerified = await prisma.tenantEmailDomain.findFirst({
    where: {
      tenantId,
      status: 'VERIFIED',
    },
  });

  if (anyVerified) {
    return {
      domain: anyVerified.domain,
      fromEmail: anyVerified.fromEmail,
      fromName: anyVerified.fromName,
      isCustom: true,
    };
  }

  // Fall back to platform default
  return {
    domain: '72orionx.com',
    fromEmail: process.env.SES_FROM_EMAIL || 'noreply@72orionx.com',
    fromName: 'Nexora CRM',
    isCustom: false,
  };
}

export const sesDomainService = {
  addDomain,
  checkDomainStatus,
  getTenantDomains,
  getDomainDetails,
  setDefaultDomain,
  updateDomain,
  deleteDomain,
  getSendingDomain,
};
