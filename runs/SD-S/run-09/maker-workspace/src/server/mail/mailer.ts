export type PasswordResetMail = { to: string; resetUrl: string };

export interface Mailer {
  sendPasswordReset(message: PasswordResetMail): Promise<void>;
}

export class MemoryMailer implements Mailer {
  readonly messages: PasswordResetMail[] = [];
  async sendPasswordReset(message: PasswordResetMail): Promise<void> {
    this.messages.push(message);
  }
}
