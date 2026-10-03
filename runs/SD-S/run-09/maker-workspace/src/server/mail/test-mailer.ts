import type { Mailer, PasswordResetMail } from "./mailer.js";

export class ConsoleMailer implements Mailer {
  async sendPasswordReset(message: PasswordResetMail): Promise<void> {
    if (process.env.NODE_ENV === "production") throw new Error("Console mail is disabled in production");
    console.info(`[development mail] password reset for ${message.to}: ${message.resetUrl}`);
  }
}
