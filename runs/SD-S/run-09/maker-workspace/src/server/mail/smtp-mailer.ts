import nodemailer from "nodemailer";
import type { AppConfig } from "../config.js";
import type { Mailer, PasswordResetMail } from "./mailer.js";

export class SmtpMailer implements Mailer {
  private readonly transporter;
  constructor(private readonly config: AppConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.password }
    });
  }
  async sendPasswordReset({ to, resetUrl }: PasswordResetMail): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.smtp.from,
      to,
      subject: "Reset your bookmark library password",
      text: `Open this link to reset your password: ${resetUrl}`
    });
  }
}
