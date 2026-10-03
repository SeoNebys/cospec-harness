import { randomBytes } from 'node:crypto';
import type { NormalizedIcon } from './icon-normalizer.js';

interface Entry { userId: string; icon?: NormalizedIcon; expires: number }
export class PreviewStore {
  private entries = new Map<string, Entry>();
  put(userId: string, icon?: NormalizedIcon): string {
    this.cleanup(); const token = randomBytes(24).toString('base64url'); const entry: Entry = { userId, expires: Date.now() + 10 * 60_000 }; if (icon) entry.icon = icon; this.entries.set(token, entry); return token;
  }
  consume(userId: string, token?: string): NormalizedIcon | undefined {
    if (!token) return undefined; const entry = this.entries.get(token); this.entries.delete(token); if (!entry || entry.userId !== userId || entry.expires < Date.now()) return undefined; return entry.icon;
  }
  private cleanup() { const now = Date.now(); for (const [key, value] of this.entries) if (value.expires < now) this.entries.delete(key); }
}
