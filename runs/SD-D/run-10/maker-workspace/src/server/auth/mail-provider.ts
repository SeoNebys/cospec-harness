import nodemailer from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';
import type { AppConfig } from '../config/schema.js';

export type PasswordResetMessage = { to: string; resetUrl: string; expiresAt: number };

export interface MailProvider {
  sendPasswordReset(message: PasswordResetMessage): Promise<void>;
}

class LogMailProvider implements MailProvider {
  constructor(private readonly logger: FastifyBaseLogger) {}

  async sendPasswordReset(message: PasswordResetMessage): Promise<void> {
    this.logger.info(
      { to: message.to, resetUrl: message.resetUrl, expiresAt: message.expiresAt },
      'Development password reset',
    );
  }
}

class SmtpMailProvider implements MailProvider {
  private readonly transporter;

  constructor(smtpUrl: string) {
    this.transporter = nodemailer.createTransport(smtpUrl);
  }

  async sendPasswordReset(message: PasswordResetMessage): Promise<void> {
    await this.transporter.sendMail({
      to: message.to,
      from: 'Keepwell <no-reply@keepwell.local>',
      subject: 'Reset your Keepwell password',
      text: `Use this link to reset your password: ${message.resetUrl}\n\nThis link expires at ${new Date(message.expiresAt).toISOString()}.`,
    });
  }
}

export function createMailProvider(config: AppConfig, logger: FastifyBaseLogger): MailProvider {
  if (config.mailTransport === 'smtp' && config.smtpUrl) return new SmtpMailProvider(config.smtpUrl);
  return new LogMailProvider(logger);
}
