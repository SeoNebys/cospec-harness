import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api-client.js';

export type MetadataResult =
  | { kind: 'existing'; bookmark: { id: string; title: string; archived: boolean } }
  | { kind: 'metadata'; status: 'complete'|'partial'|'unavailable'; draftId: string|null; finalUrl: string|null; title: string|null; description: string|null; iconUrl: string|null; previewImageUrl: string|null; warnings: string[] };

export function useMetadataPreview(url: string, enabled = true) {
  const [state,setState] = useState<{ loading: boolean; data: MetadataResult|null; error: string|null }>({ loading:false,data:null,error:null });
  const requestId = useRef(0);
  useEffect(() => {
    if (!enabled || !/^https?:\/\//iu.test(url.trim())) { setState({loading:false,data:null,error:null}); return; }
    const id = ++requestId.current; const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((old) => ({...old,loading:true,error:null}));
      try { const data = await api<MetadataResult>('/api/metadata/preview',{method:'POST',body:JSON.stringify({url:url.trim()}),signal:controller.signal}); if (id === requestId.current) setState({loading:false,data,error:null}); }
      catch (error) { if (id === requestId.current && !controller.signal.aborted) setState({loading:false,data:null,error:error instanceof Error ? error.message : 'Page details are unavailable.'}); }
    },500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  },[url,enabled]);
  return state;
}
