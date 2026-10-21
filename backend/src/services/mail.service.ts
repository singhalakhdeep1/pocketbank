import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { unavailable } from '../lib/errors.js';

let transport: Transporter | null = null;

export const mailEnabled = () => Boolean(config.smtpUrl);

export async function sendMail(to: string, subject: string, text: string, attachments: { filename: string; content: Buffer }[] = []) {
  if (!config.smtpUrl) throw unavailable('Email is not configured (SMTP_URL)');
  transport ??= nodemailer.createTransport(config.smtpUrl);
  const info = await transport.sendMail({ from: config.mailFrom, to, subject, text, attachments });
  return info.messageId;
}
