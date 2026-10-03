export interface MemoryMessage {
  to: string;
  subject: string;
  text: string;
  createdAt: string;
}

const messages: MemoryMessage[] = [];

export function deliverMemoryMessage(message: Omit<MemoryMessage, "createdAt">): void {
  messages.push({ ...message, createdAt: new Date().toISOString() });
}

export function getMemoryMessages(): readonly MemoryMessage[] {
  if (process.env.NODE_ENV === "production") return [];
  return messages;
}

export function clearMemoryMessages(): void {
  messages.length = 0;
}
