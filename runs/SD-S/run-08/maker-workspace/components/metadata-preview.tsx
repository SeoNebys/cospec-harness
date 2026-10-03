"use client";

import type { Preview } from "./types";

export function MetadataPreview({ preview }: { preview: Preview }) {
  const icon = preview.iconToken ? `/icons/${encodeURIComponent(preview.iconToken)}` : "/generic-site-icon.svg";
  return (
    <div className="preview-panel" aria-label="Link preview">
      <img src={icon} width="42" height="42" alt="" onError={(e) => { e.currentTarget.src = "/generic-site-icon.svg"; }} />
      <div><span className="eyebrow">Preview ready</span><p>{preview.normalizedUrl}</p></div>
      {preview.warning && <p className="notice warning">{preview.warning} You can still edit and save this bookmark.</p>}
    </div>
  );
}
