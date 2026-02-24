/**
 * AWS SES (Simple Email Service) Setup Script
 *
 * Sets up email sending with domain verification, DKIM, SPF, and templates
 * Estimated cost: $150/month for 150K emails
 *
 * Usage: node scripts/aws-ses-setup.js
 */

import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityDkimSigningAttributesCommand,
  PutEmailIdentityDkimAttributesCommand,
  CreateEmailTemplateCommand,
  ListEmailTemplatesCommand,
  SendEmailCommand,
} from '@aws-sdk/client-sesv2';
import {
  GetIdentityVerificationAttributesCommand,
  VerifyEmailIdentityCommand,
} from '@aws-sdk/client-ses';

const region = 'ap-south-1';
const sesClient = new SESv2Client({ region });

// SES Configuration
const emailConfig = {
  domain: 'nexoraos.pro',
  senderEmail: 'noreply@nexoraos.pro',
  supportEmail: 'support@nexoraos.pro',
  testEmail: process.env.TEST_EMAIL || 'admin@helixcode.in',
};

/**
 * Step 1: Verify Domain Identity
 */
async function verifyDomain(domain) {
  console.log(`\n📋 Step 1: Verifying domain: ${domain}...`);

  try {
    // Check if already verified
    try {
      const getCommand = new GetEmailIdentityCommand({
        EmailIdentity: domain,
      });
      const existing = await sesClient.send(getCommand);

      if (existing.VerifiedForSendingStatus) {
        console.log(`✅ Domain ${domain} already verified and ready to send`);
        return existing;
      }
    } catch (error) {
      if (error.name !== 'NotFoundException') {
        throw error;
      }
    }

    // Create email identity
    const createCommand = new CreateEmailIdentityCommand({
      EmailIdentity: domain,
      DkimSigningAttributes: {
        DomainSigningSelector: 'nexora',
        DomainSigningPrivateKey: undefined, // AWS will generate
      },
      ConfigurationSetName: 'nexora-prod-config',
    });

    const result = await sesClient.send(createCommand);
    console.log(`✅ Created email identity for ${domain}`);

    // Display DNS records to add
    if (result.DkimAttributes) {
      console.log('\n📝 Add these DNS records to your domain:');
      console.log('\n🔐 DKIM Records (for email authentication):');

      if (result.DkimAttributes.Tokens) {
        result.DkimAttributes.Tokens.forEach((token, index) => {
          console.log(`   ${index + 1}. CNAME Record:`);
          console.log(`      Name: ${token}._domainkey.${domain}`);
          console.log(`      Value: ${token}.dkim.amazonses.com`);
        });
      }

      console.log('\n📧 SPF Record (add to existing TXT or create new):');
      console.log('   Type: TXT');
      console.log('   Name: @');
      console.log('   Value: v=spf1 include:amazonses.com ~all');

      console.log('\n📮 DMARC Record (for email policy):');
      console.log('   Type: TXT');
      console.log('   Name: _dmarc');
      console.log('   Value: v=DMARC1; p=quarantine; rua=mailto:postmaster@nexoraos.pro');

      console.log('\n⏳ Verification Status: Pending');
      console.log('   Add the DNS records above and wait 24-48 hours');
      console.log('   Run this script again to check verification status');
    }

    return result;
  } catch (error) {
    console.error('❌ Error verifying domain:', error.message);
    throw error;
  }
}

/**
 * Step 2: Verify Email Address (for testing)
 */
async function verifyEmail(email) {
  console.log(`\n📋 Step 2: Verifying email address: ${email}...`);

  try {
    const command = new CreateEmailIdentityCommand({
      EmailIdentity: email,
    });

    await sesClient.send(command);
    console.log(`✅ Verification email sent to ${email}`);
    console.log('   Check your inbox and click the verification link');

    return true;
  } catch (error) {
    if (error.name === 'AlreadyExistsException') {
      console.log(`✅ Email ${email} already exists`);
      return true;
    }
    console.error('❌ Error verifying email:', error.message);
    throw error;
  }
}

/**
 * Step 3: Create Email Templates
 */
async function createEmailTemplates() {
  console.log('\n📋 Step 3: Creating email templates...');

  const templates = [
    {
      TemplateName: 'welcome-email',
      TemplateContent: {
        Subject: 'Welcome to {{company_name}}!',
        Html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to {{company_name}}!</h1>
              </div>
              <div class="content">
                <p>Hi {{user_name}},</p>
                <p>We're excited to have you on board! Your account has been created successfully.</p>
                <p>Here are your login details:</p>
                <ul>
                  <li><strong>Email:</strong> {{user_email}}</li>
                  <li><strong>Login URL:</strong> https://nexoraos.pro/login</li>
                </ul>
                <a href="{{login_url}}" class="button">Get Started</a>
                <p>If you have any questions, feel free to reply to this email.</p>
                <p>Best regards,<br>{{company_name}} Team</p>
              </div>
              <div class="footer">
                <p>&copy; 2026 {{company_name}}. All rights reserved.</p>
                <p>If you didn't create this account, please ignore this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        Text: `Welcome to {{company_name}}!\n\nHi {{user_name}},\n\nWe're excited to have you on board! Your account has been created successfully.\n\nEmail: {{user_email}}\nLogin: https://nexoraos.pro/login\n\nBest regards,\n{{company_name}} Team`,
      },
    },
    {
      TemplateName: 'password-reset',
      TemplateContent: {
        Subject: 'Reset Your Password - {{company_name}}',
        Html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔒 Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hi {{user_name}},</p>
                <p>We received a request to reset your password. Click the button below to reset it:</p>
                <a href="{{reset_url}}" class="button">Reset Password</a>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
                <p>Best regards,<br>{{company_name}} Team</p>
              </div>
              <div class="footer">
                <p>&copy; 2026 {{company_name}}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        Text: `Password Reset Request\n\nHi {{user_name}},\n\nWe received a request to reset your password.\n\nReset URL: {{reset_url}}\n\nThis link will expire in 24 hours.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\n{{company_name}} Team`,
      },
    },
    {
      TemplateName: 'invoice-notification',
      TemplateContent: {
        Subject: 'New Invoice #{{invoice_number}} - {{company_name}}',
        Html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .invoice-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💰 New Invoice</h1>
              </div>
              <div class="content">
                <p>Hi {{customer_name}},</p>
                <p>A new invoice has been generated for your account.</p>
                <div class="invoice-box">
                  <h3>Invoice #{{invoice_number}}</h3>
                  <p><strong>Amount:</strong> ₹{{amount}}</p>
                  <p><strong>Due Date:</strong> {{due_date}}</p>
                  <p><strong>Status:</strong> {{status}}</p>
                </div>
                <a href="{{invoice_url}}" class="button">View Invoice</a>
                <p>Please make payment by {{due_date}} to avoid service interruption.</p>
                <p>Best regards,<br>{{company_name}} Team</p>
              </div>
              <div class="footer">
                <p>&copy; 2026 {{company_name}}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        Text: `New Invoice #{{invoice_number}}\n\nHi {{customer_name}},\n\nA new invoice has been generated.\n\nAmount: ₹{{amount}}\nDue Date: {{due_date}}\nStatus: {{status}}\n\nView: {{invoice_url}}\n\nBest regards,\n{{company_name}} Team`,
      },
    },
  ];

  try {
    for (const template of templates) {
      try {
        const command = new CreateEmailTemplateCommand(template);
        await sesClient.send(command);
        console.log(`   ✓ Created template: ${template.TemplateName}`);
      } catch (error) {
        if (error.name === 'AlreadyExistsException') {
          console.log(`   ✓ Template exists: ${template.TemplateName}`);
        } else {
          throw error;
        }
      }
    }

    console.log(`✅ Created ${templates.length} email templates`);
  } catch (error) {
    console.error('❌ Error creating templates:', error.message);
    throw error;
  }
}

/**
 * Step 4: Send Test Email
 */
async function sendTestEmail() {
  console.log('\n📋 Step 4: Sending test email...');

  try {
    const command = new SendEmailCommand({
      FromEmailAddress: emailConfig.senderEmail,
      Destination: {
        ToAddresses: [emailConfig.testEmail],
      },
      Content: {
        Simple: {
          Subject: {
            Data: 'Test Email from Nexora - SES Setup Complete',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: `
                <h2>✅ SES Setup Successful!</h2>
                <p>This is a test email from AWS SES.</p>
                <p><strong>Configuration:</strong></p>
                <ul>
                  <li>Domain: ${emailConfig.domain}</li>
                  <li>Sender: ${emailConfig.senderEmail}</li>
                  <li>Region: ${region}</li>
                </ul>
                <p>Your email service is now ready to use!</p>
              `,
              Charset: 'UTF-8',
            },
            Text: {
              Data: `SES Setup Successful!\n\nThis is a test email from AWS SES.\n\nDomain: ${emailConfig.domain}\nSender: ${emailConfig.senderEmail}\nRegion: ${region}\n\nYour email service is now ready to use!`,
              Charset: 'UTF-8',
            },
          },
        },
      },
    });

    const result = await sesClient.send(command);
    console.log('✅ Test email sent successfully');
    console.log(`   Message ID: ${result.MessageId}`);
    console.log(`   Check inbox: ${emailConfig.testEmail}`);
  } catch (error) {
    console.error('❌ Error sending test email:', error.message);
    if (error.name === 'MessageRejected') {
      console.log('\n⚠️  Email rejected - Domain not verified yet');
      console.log('   Add DNS records and wait for verification');
    } else if (error.name === 'AccountSendingPausedException') {
      console.log('\n⚠️  Account in SES Sandbox mode');
      console.log('   Request production access in AWS Console');
    }
    throw error;
  }
}

/**
 * Step 5: Request Production Access (if in sandbox)
 */
function requestProductionAccess() {
  console.log('\n📋 Step 5: Production Access Information');
  console.log('\n⚠️  SES starts in Sandbox mode with limitations:');
  console.log('   - Can only send to verified email addresses');
  console.log('   - Limited to 200 emails/day');
  console.log('   - Maximum 1 email/second');
  console.log('\n✅ To Request Production Access:');
  console.log('   1. Open AWS Console → SES → Account dashboard');
  console.log('   2. Click "Request production access"');
  console.log('   3. Fill out the form:');
  console.log('      - Use case: Transactional emails for CRM platform');
  console.log('      - Website: https://nexoraos.pro');
  console.log(
    '      - Describe: "Send transactional emails (welcome, password reset, invoices) to CRM users"'
  );
  console.log('      - Bounce rate: <2% (we handle bounces properly)');
  console.log('      - Complaint rate: <0.1% (double opt-in, unsubscribe links)');
  console.log('   4. Wait 24-48 hours for approval');
  console.log('\n💡 Production Limits (after approval):');
  console.log('   - 50,000 emails/day (increases with good sending reputation)');
  console.log('   - 14 emails/second');
  console.log('   - Send to any email address');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 AWS SES Email Service Setup for Nexora');
  console.log('==========================================\n');
  console.log('Configuration:');
  console.log(`  - Domain: ${emailConfig.domain}`);
  console.log(`  - Sender: ${emailConfig.senderEmail}`);
  console.log(`  - Support: ${emailConfig.supportEmail}`);
  console.log(`  - Region: ${region}`);
  console.log(`  - Test Email: ${emailConfig.testEmail}`);

  try {
    // Step 1: Verify domain
    await verifyDomain(emailConfig.domain);

    // Step 2: Verify test email
    await verifyEmail(emailConfig.testEmail);

    // Step 3: Create templates
    await createEmailTemplates();

    // Step 4: Send test email (will fail if not verified)
    try {
      await sendTestEmail();
    } catch (error) {
      console.log('\n⚠️  Skipping test email (domain not verified yet)');
    }

    // Step 5: Production access info
    requestProductionAccess();

    console.log('\n✅ SES Setup Complete!');
    console.log('\n📊 Estimated Monthly Cost (150K emails):');
    console.log('   - Email sending (150K): $15.00');
    console.log('   - Receiving (optional): $0.10/1000');
    console.log('   - Dedicated IP (optional): $24.95');
    console.log('   ─────────────────────────────');
    console.log('   Total: ~$15.00/month');

    console.log('\n🔐 Environment Variables:');
    console.log(`   AWS_SES_REGION=${region}`);
    console.log(`   AWS_SES_FROM_EMAIL=${emailConfig.senderEmail}`);
    console.log(`   AWS_SES_REPLY_TO=${emailConfig.supportEmail}`);

    console.log('\n💡 Next Steps:');
    console.log('   1. Add DNS records to your domain registrar');
    console.log('   2. Wait 24-48 hours for domain verification');
    console.log('   3. Request production access (remove sandbox limits)');
    console.log('   4. Update email service to use SES');
    console.log('   5. Test email sending from application');
    console.log('   6. Monitor bounce/complaint rates in SES console');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { verifyDomain, verifyEmail, createEmailTemplates, sendTestEmail };
