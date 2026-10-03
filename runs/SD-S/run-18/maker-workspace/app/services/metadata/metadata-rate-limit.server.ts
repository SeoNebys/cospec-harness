type Bucket = { attempts: number[]; active: number };

const users = new Map<string, Bucket>();
const hosts = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

function reserve(store: Map<string, Bucket>, key: string, now: number, maximum: number, concurrency: number) {
  const existing = store.get(key) ?? { attempts: [], active: 0 };
  existing.attempts = existing.attempts.filter((time) => now - time < WINDOW_MS);
  if (existing.attempts.length >= maximum || existing.active >= concurrency) return false;
  existing.attempts.push(now);
  existing.active += 1;
  store.set(key, existing);
  return true;
}

function release(store: Map<string, Bucket>, key: string) {
  const bucket = store.get(key);
  if (!bucket) return;
  bucket.active = Math.max(0, bucket.active - 1);
}

export function reserveMetadataPreview(ownerId: string, hostname: string, now = Date.now()) {
  const host = hostname.toLocaleLowerCase("en-US");
  if (!reserve(users, ownerId, now, 20, 2)) return null;
  if (!reserve(hosts, host, now, 30, 3)) {
    release(users, ownerId);
    return null;
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    release(users, ownerId);
    release(hosts, host);
  };
}

export function resetMetadataLimitsForTests() {
  users.clear();
  hosts.clear();
}
