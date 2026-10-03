import { randomBytes } from 'node:crypto';
export type StoredProposal = {
  url: string;
  title: string | null;
  description: string | null;
  iconAssetId: string | null;
  expires: number;
};
export class ProposalStore {
  private values = new Map<string, StoredProposal>();
  put(value: Omit<StoredProposal, 'expires'>) {
    this.cleanup();
    const token = randomBytes(24).toString('base64url');
    this.values.set(token, { ...value, expires: Date.now() + 10 * 60_000 });
    return token;
  }
  take(token: string | undefined, url: string) {
    if (!token) return null;
    const value = this.values.get(token);
    if (!value || value.expires < Date.now() || value.url !== url) return null;
    this.values.delete(token);
    return value;
  }
  get(token: string | undefined) {
    const v = token ? this.values.get(token) : undefined;
    return v && v.expires > Date.now() ? v : null;
  }
  private cleanup() {
    for (const [k, v] of this.values) if (v.expires < Date.now()) this.values.delete(k);
  }
}
