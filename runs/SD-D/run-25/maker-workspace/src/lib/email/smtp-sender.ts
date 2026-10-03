import nodemailer from "nodemailer";
import { getConfig } from "@/lib/config";
import type { EmailMessage, EmailSender } from "./email-sender";

export class SmtpEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    const config = getConfig();
    if (!config.SMTP_URL) throw new Error("SMTP_URL is required for EMAIL_TRANSPORT=smtp");
    const transport = nodemailer.createTransport(config.SMTP_URL);
    await transport.sendMail({ from: config.EMAIL_FROM, ...message });
  }
}
