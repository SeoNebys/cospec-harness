export async function readJson(request: Request, maxBytes = 32_768): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("CONTENT_TYPE");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const text = await request.text();
  if (Buffer.byteLength(text) > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(text);
}
