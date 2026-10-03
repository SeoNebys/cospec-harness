import { decode } from 'html-entities';
import { urlKey } from '@shared/url.js';
export type ParsedImport = {
  url: string;
  title: string | null;
  description: string | null;
  tags: string[];
  noteMarkdown: string;
  isRead: boolean;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  icon: { mime: string; bytes: Buffer; width: number; height: number } | null;
};
const attributes = (s: string) =>
  Object.fromEntries(
    [...s.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => [
      m[1]!.toLowerCase(),
      decode(m[2] ?? m[3] ?? m[4] ?? '')
    ])
  );
export function parseBookmarkHtml(html: string): {
  entries: (ParsedImport | { error: string; rawUrl?: string })[];
  appExport: boolean;
} {
  const entries: (ParsedImport | { error: string; rawUrl?: string })[] = [];
  const folders: string[] = [];
  let pendingFolder: string | null = null;
  let appExport = /LARDER-EXPORT-VERSION="1"/i.test(html);
  const tokens =
    html.match(/<H3\b[^>]*>[\s\S]*?<\/H3\s*>|<A\b[^>]*>[\s\S]*?<\/A\s*>|<DL\b[^>]*>|<\/DL\s*>/gi) ??
    [];
  for (const token of tokens) {
    if (/^<H3/i.test(token)) {
      pendingFolder = decode(token.replace(/<[^>]+>/g, '')).trim();
      continue;
    }
    if (/^<DL/i.test(token)) {
      if (pendingFolder) {
        folders.push(pendingFolder);
        pendingFolder = null;
      } else folders.push('');
      continue;
    }
    if (/^<\/DL/i.test(token)) {
      folders.pop();
      continue;
    }
    const open = token.match(/^<A\b([^>]*)>/i);
    if (!open) continue;
    const a = attributes(open[1]!);
    const title =
      decode(
        token
          .replace(/^<A\b[^>]*>/i, '')
          .replace(/<\/A\s*>$/i, '')
          .replace(/<[^>]+>/g, '')
      ).trim() || null;
    try {
      const url = urlKey(a.href ?? '');
      const extra = (a.tags ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      let path = folders.filter(Boolean);
      let meta: any = null;
      if (appExport && a['data-bookmark-manager-meta']) {
        try {
          meta = JSON.parse(
            Buffer.from(a['data-bookmark-manager-meta'], 'base64url').toString('utf8')
          );
          if (meta?.v !== 1) meta = null;
        } catch {
          meta = null;
        }
      }
      if (meta) path = path.filter((x) => x !== 'Active' && x !== 'Archive');
      const appTags = Array.isArray(meta?.tags)
        ? meta.tags.filter((x: unknown) => typeof x === 'string')
        : [];
      let icon: null | { mime: string; bytes: Buffer; width: number; height: number } = null;
      if (
        meta?.icon &&
        ['image/png', 'image/webp'].includes(meta.icon.mime) &&
        typeof meta.icon.data === 'string' &&
        Number.isInteger(meta.icon.width) &&
        Number.isInteger(meta.icon.height) &&
        meta.icon.width > 0 &&
        meta.icon.width <= 512 &&
        meta.icon.height > 0 &&
        meta.icon.height <= 512
      ) {
        const bytes = Buffer.from(meta.icon.data, 'base64'),
          png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          webp = bytes.subarray(8, 12).toString() === 'WEBP';
        if (
          bytes.length <= 524288 &&
          ((meta.icon.mime === 'image/png' && png) || (meta.icon.mime === 'image/webp' && webp))
        )
          icon = { mime: meta.icon.mime, bytes, width: meta.icon.width, height: meta.icon.height };
      }
      entries.push({
        url,
        title,
        description: typeof meta?.description === 'string' ? meta.description : null,
        tags: [...new Set([...path, ...extra, ...appTags])],
        noteMarkdown: typeof meta?.note === 'string' ? meta.note : '',
        isRead: meta?.read === true,
        archivedAt: typeof meta?.archivedAt === 'string' ? meta.archivedAt : null,
        createdAt:
          typeof meta?.createdAt === 'string'
            ? meta.createdAt
            : a.add_date
              ? new Date(Number(a.add_date) * 1000).toISOString()
              : null,
        updatedAt:
          typeof meta?.updatedAt === 'string'
            ? meta.updatedAt
            : a.last_modified
              ? new Date(Number(a.last_modified) * 1000).toISOString()
              : null,
        icon
      });
    } catch {
      entries.push({ error: 'invalid_url', rawUrl: a.href });
    }
  }
  return { entries, appExport };
}
