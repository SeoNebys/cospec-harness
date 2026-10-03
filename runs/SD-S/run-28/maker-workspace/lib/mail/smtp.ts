import nodemailer from "nodemailer";
import { env } from "@/lib/config/env";

export async function deliverSmtpMessage(message: { to: string; subject: string; text: string }): Promise<void> {
  const config = env();
  if (!config.SMTP_HOST) throw new Error("SMTP_HOST is required for smtp mail transport");
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: config.SMTP_FROM, ...message });
}
