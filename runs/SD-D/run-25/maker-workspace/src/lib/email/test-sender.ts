import fs from "node:fs/promises";
import path from "node:path";
import type { EmailMessage, EmailSender } from "./email-sender";

export class CaptureEmailSender implements EmailSender {
  constructor(private readonly file = path.resolve("data/captured-emails.jsonl")) {}

  async send(message: EmailMessage): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.appendFile(this.file, `${JSON.stringify({ ...message, capturedAt: new Date().toISOString() })}\n`, {
      mode: 0o600,
    });
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email captured] ${message.subject} → ${message.to}`);
    }
  }
}
