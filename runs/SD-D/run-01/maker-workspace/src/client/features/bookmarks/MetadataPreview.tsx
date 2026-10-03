import type { MetadataPreview as Preview } from './bookmark-api';
export function MetadataPreview({preview}:{preview:Preview}){return <div className={`metadata-status ${preview.status}`}><strong>{preview.status==='retrieved'?'Details found':'Ready with fallbacks'}</strong>{preview.iconAvailable&&<span>Site icon found</span>}{preview.warnings.map(message=><p key={message}>{message}</p>)}</div>}
