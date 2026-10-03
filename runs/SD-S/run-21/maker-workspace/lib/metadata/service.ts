import { fetchPage } from "./fetch-page";
import { extractMetadata } from "./extract";
export async function previewMetadata(url: string) {
  const page = await fetchPage(url);
  return extractMetadata(page.html, url, page.finalUrl);
}
