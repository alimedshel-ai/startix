import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const region = process.env.AWS_REGION ?? 'me-south-1';
const fromAddress = process.env.SES_FROM_ADDRESS;

let client: SESClient | null = null;

function ses(): SESClient {
  if (!client) client = new SESClient({ region });
  return client;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (!fromAddress) {
    console.log('[email-stub] SES_FROM_ADDRESS not set — printing email instead:');
    console.log(`  To: ${msg.to}`);
    console.log(`  Subject: ${msg.subject}`);
    console.log(`  Body:\n${msg.text}`);
    return;
  }
  await ses().send(
    new SendEmailCommand({
      Source: fromAddress,
      Destination: { ToAddresses: [msg.to] },
      Message: {
        Subject: { Data: msg.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: msg.html, Charset: 'UTF-8' },
          Text: { Data: msg.text, Charset: 'UTF-8' },
        },
      },
    })
  );
}

export function verificationEmail(name: string, link: string): EmailMessage {
  const text = `Hi ${name},\n\nVerify your Startix account by visiting:\n${link}\n\nThe link expires in 24 hours.`;
  const html = `<p>Hi ${name},</p><p>Verify your Startix account: <a href="${link}">${link}</a></p><p>The link expires in 24 hours.</p>`;
  return { to: '', subject: 'Verify your Startix account', text, html };
}

export function passwordResetEmail(name: string, link: string): EmailMessage {
  const text = `Hi ${name},\n\nReset your Startix password by visiting:\n${link}\n\nThe link expires in 1 hour. If you didn't request this, ignore this email.`;
  const html = `<p>Hi ${name},</p><p>Reset your Startix password: <a href="${link}">${link}</a></p><p>The link expires in 1 hour. If you didn't request this, ignore this email.</p>`;
  return { to: '', subject: 'Reset your Startix password', text, html };
}
