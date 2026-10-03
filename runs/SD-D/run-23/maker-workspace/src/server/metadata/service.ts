import { normalizeBookmarkUrl } from '../../shared/url.js';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { extractMetadata } from './extract-metadata.js';
import { FetchBlockedError, FetchTimeoutError, safeFetch } from './safe-fetch.js';

export async function previewMetadata(input: string) {
  const normalized = normalizeBookmarkUrl(input);
  try {
    const fetched = await safeFetch(normalized.url, { allowedTypes: /^(text\/html|application\/xhtml\+xml)$/i });
    const details = extractMetadata(fetched.body.toString('utf8'), fetched.finalUrl);
    const present = [details.description, details.siteIconUrl, details.previewImageUrl].filter(Boolean).length;
    return { normalizedUrl: normalized.url, finalUrl: fetched.finalUrl, ...details, previewImageProxyUrl: details.previewImageUrl ? signedPreviewAssetUrl(details.previewImageUrl) : null, status: present === 3 ? 'complete' : 'partial', warnings: present === 3 ? [] : ['Some publisher details were unavailable.'] };
  } catch (error) {
    const status = error instanceof FetchBlockedError ? 'blocked' : error instanceof FetchTimeoutError ? 'timeout' : 'unavailable';
    return { normalizedUrl: normalized.url, finalUrl: normalized.url, title: new URL(normalized.url).hostname, description: null, siteIconUrl: null, previewImageUrl: null, previewImageProxyUrl: null, status, warnings: [error instanceof Error ? error.message : 'Page details were unavailable.'] };
  }
}

export function signedPreviewAssetUrl(url:string):string{const token=crypto.createHmac('sha256',config.sessionKey).update(url).digest('base64url');return `/api/metadata-preview-asset?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;}
export function verifyPreviewAsset(url:string,token:string):boolean{const expected=crypto.createHmac('sha256',config.sessionKey).update(url).digest();try{return crypto.timingSafeEqual(expected,Buffer.from(token,'base64url'));}catch{return false;}}
