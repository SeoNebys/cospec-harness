import { env } from "@/lib/config/env";
import { deliverMemoryMessage } from "@/lib/mail/memory";
import { deliverSmtpMessage } from "@/lib/mail/smtp";

export async function sendPasswordReset(to: string, resetUrl: string): Promise<void> {
  const message = {
    to,
    subject: "Reset your Bookmark Manager password",
    text: `Use this one-time link to reset your password: ${resetUrl}`,
  };
  if (env().MAIL_TRANSPORT === "memory") {
    deliverMemoryMessage(message);
    return;
  }
  await deliverSmtpMessage(message);
}
