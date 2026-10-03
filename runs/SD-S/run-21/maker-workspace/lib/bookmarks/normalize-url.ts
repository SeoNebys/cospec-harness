import { AppProblem } from "@/lib/http/problem";

export function parseWebUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AppProblem(
      422,
      "Invalid web address",
      "Enter a complete HTTP or HTTPS address.",
      { url: ["Enter a valid web address."] }
    );
  }
  if (
    !(["http:", "https:"] as string[]).includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new AppProblem(
      422,
      "Unsupported web address",
      "Only public HTTP and HTTPS addresses without embedded credentials are supported.",
      { url: ["Use an HTTP or HTTPS address."] }
    );
  return url;
}

export function normalizeUrl(value: string) {
  const url = parseWebUrl(value);
  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  )
    url.port = "";
  if (!url.pathname) url.pathname = "/";
  return url.toString();
}
