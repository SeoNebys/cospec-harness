import type { MetadataResult } from '../../shared/contracts/types.js';
import { canonicalizeUrl } from '../../shared/normalization/index.js';
import { AppError } from '../api/errors.js';
import type { IconStore } from './icon-store.js';
import { extractMetadata } from './extractor.js';
import { FetchFailure, isRejectedFetch, safeFetch } from './safe-fetch.js';
import { UrlPolicyError } from './url-policy.js';

export class MetadataService {
  constructor(private icons: IconStore, private fetcher = safeFetch) {}
  async retrieve(requestId:string, rawUrl:string): Promise<MetadataResult> {
    let normalizedUrl: string;
    try { normalizedUrl = canonicalizeUrl(rawUrl); } catch { throw new AppError(422,'invalid_url','Enter a complete web address.'); }
    const fallback = () => ({ value: new URL(normalizedUrl).hostname, source: 'fallback' as const });
    try {
      const page = await this.fetcher(normalizedUrl, { kind:'html' });
      const extracted = extractMetadata(page.body, page.finalUrl, page.contentType);
      let iconUploadToken: string|null = null; const warnings: MetadataResult['warnings'] = [];
      if (extracted.iconUrl) {
        try { const icon = await this.fetcher(extracted.iconUrl, { kind:'icon' }); iconUploadToken = this.icons.stage(icon.body); if (!iconUploadToken) warnings.push({code:'icon_unavailable',field:'icon'}); }
        catch { warnings.push({code:'icon_unavailable',field:'icon'}); }
      }
      return { requestId, status: warnings.length ? 'partial':'success', requestedUrl:rawUrl, normalizedUrl, finalUrl:page.finalUrl,
        metadata:{ title:{value:extracted.title,source:extracted.titleSource}, description:extracted.description ? {value:extracted.description,source:extracted.descriptionSource!}:null, iconUploadToken }, warnings };
    } catch (error) {
      if (isRejectedFetch(error) || (error instanceof UrlPolicyError && error.code !== 'dns_failure')) throw new AppError(422, (error as UrlPolicyError).code, error instanceof Error ? error.message : 'Unsafe destination.');
      const code = error instanceof FetchFailure ? error.code : error instanceof UrlPolicyError ? error.code : 'parse_error';
      const safeCode = ['dns_failure','timeout','tls_error','http_status','unsupported_content_type','response_too_large','parse_error'].includes(code) ? code : 'parse_error';
      return { requestId,status:'unavailable',requestedUrl:rawUrl,normalizedUrl,finalUrl:null,metadata:{title:fallback(),description:null,iconUploadToken:null},warnings:[{code:safeCode as MetadataResult['warnings'][number]['code'],field:'page'}] };
    }
  }
}
