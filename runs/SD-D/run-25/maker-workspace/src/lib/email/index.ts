import { getConfig } from "@/lib/config";
import type { EmailSender } from "./email-sender";
import { CaptureEmailSender } from "./test-sender";
import { SmtpEmailSender } from "./smtp-sender";

let sender: EmailSender | undefined;

export function getEmailSender(): EmailSender {
  const config = getConfig();
  if (config.NODE_ENV === "production" && config.EMAIL_TRANSPORT === "capture" && !config.ALLOW_CAPTURE_EMAIL) {
    throw new Error("EMAIL_TRANSPORT=capture is forbidden in production unless explicitly enabled for review");
  }
  sender ??= config.EMAIL_TRANSPORT === "smtp" ? new SmtpEmailSender() : new CaptureEmailSender();
  return sender;
}

export type { EmailMessage, EmailSender } from "./email-sender";
