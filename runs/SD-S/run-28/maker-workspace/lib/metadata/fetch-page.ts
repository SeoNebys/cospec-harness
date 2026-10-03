import { request, type Dispatcher } from "undici";
import net from "node:net";
import { createSafeDispatcher } from "@/lib/metadata/dispatcher";
import { parsePage } from "@/lib/metadata/parse-page";
import { fetchIcon } from "@/lib/metadata/fetch-icon";
import type { MetadataResult } from "@/lib/bookmarks/types";
import { isPublicAddress } from "@/lib/security/ip";

const USER_AGENT = "LatticeBookmarkBot/1.0 (+metadata preview)";

export async function fetchPageMetadata(startUrl: string, dispatcher: Dispatcher = createSafeDispatcher()): Promise<MetadataResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    let current = new URL(startUrl);
    for (let redirects = 0; redirects <= 5; redirects++) {
      const literalHost=current.hostname.replace(/^\[|\]$/g,"");
      if(net.isIP(literalHost)&&!isPublicAddress(literalHost))return failure("unsafe_destination");
      const response = await request(current, { dispatcher, signal: controller.signal, headers: { accept: "text/html,application/xhtml+xml", "user-agent": USER_AGENT } });
      if ([301,302,303,307,308].includes(response.statusCode)) {
        const location = response.headers.location; response.body.destroy();
        if (!location || redirects === 5) return failure("redirect_loop");
        current = new URL(String(location), current);
        if (!["http:","https:"].includes(current.protocol) || current.username || current.password) return failure("unsafe_destination");
        continue;
      }
      const type = String(response.headers["content-type"] ?? "").split(";")[0].toLowerCase();
      if (response.statusCode < 200 || response.statusCode >= 300) { response.body.destroy(); return failure("unreachable"); }
      if (!new Set(["text/html","application/xhtml+xml"]).has(type)) { response.body.destroy(); return failure("unsupported_content"); }
      const chunks: Buffer[] = []; let total = 0;
      for await (const chunk of response.body) { const part = Buffer.from(chunk); total += part.length; if (total > 1_048_576) { response.body.destroy(); return failure("too_large"); } chunks.push(part); }
      const parsed = parsePage(Buffer.concat(chunks));
      if (!parsed.title) return failure("no_title");
      let icon: MetadataResult["icon"];
      if (parsed.iconHref && !controller.signal.aborted) {
        try { icon = await fetchIcon(new URL(parsed.iconHref, current), dispatcher, controller.signal); } catch { /* icon is optional */ }
      }
      const partial = Boolean(parsed.iconHref && !icon);
      return { title: parsed.title, description: parsed.description, icon, status: partial ? "partial" : "complete", messageCode: partial ? "icon_unavailable" : null };
    }
    return failure("redirect_loop");
  } catch (error) {
    if (controller.signal.aborted) return failure("timeout");
    return failure(hasUnsafeDestination(error) ? "unsafe_destination" : "unreachable");
  } finally { clearTimeout(timeout); }
}

function failure(messageCode: string): MetadataResult { return { title: null, description: null, status: "failed", messageCode }; }

function hasUnsafeDestination(error:unknown):boolean{let current:unknown=error;for(let depth=0;depth<5&&current;depth++){if(current instanceof Error&&current.message.includes("UNSAFE_DESTINATION"))return true;current=current instanceof Error?current.cause:undefined;}return false;}
