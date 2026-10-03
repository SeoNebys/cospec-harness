import { config } from "@/lib/config";
import { AppProblem } from "@/lib/http/problem";
import { assertPublicUrl } from "./network-safety";

export async function fetchPage(initial: string) {
  let current = (await assertPublicUrl(initial)).toString();
  const started = Date.now();
  for (let redirects = 0; redirects <= 5; redirects++) {
    const remaining = Math.max(
      1,
      config.metadataTimeoutMs - (Date.now() - started)
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "Kept Bookmark Preview/1.0",
          accept: "text/html,application/xhtml+xml"
        }
      });
    } catch {
      clearTimeout(timer);
      throw new AppProblem(
        504,
        "Page preview timed out",
        "The page could not be inspected in time. You can still enter its details manually."
      );
    }
    clearTimeout(timer);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location)
        throw new AppProblem(
          422,
          "Page could not be inspected",
          "The page returned an invalid redirect."
        );
      current = (
        await assertPublicUrl(new URL(location, current).toString())
      ).toString();
      continue;
    }
    if (!response.ok)
      throw new AppProblem(
        422,
        "Page could not be inspected",
        `The destination returned status ${response.status}. You can still enter details manually.`
      );
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml"))
      throw new AppProblem(
        422,
        "Page has no preview",
        "The destination is not an HTML page. Enter its details manually."
      );
    const reader = response.body?.getReader();
    if (!reader)
      throw new AppProblem(
        422,
        "Page could not be inspected",
        "The destination returned no readable content."
      );
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > config.metadataMaxBytes) {
        await reader.cancel();
        throw new AppProblem(
          422,
          "Page is too large to preview",
          "Enter its details manually."
        );
      }
      chunks.push(value);
    }
    return {
      html: new TextDecoder().decode(Buffer.concat(chunks)),
      finalUrl: current
    };
  }
  throw new AppProblem(
    422,
    "Too many redirects",
    "The destination redirected too many times."
  );
}
