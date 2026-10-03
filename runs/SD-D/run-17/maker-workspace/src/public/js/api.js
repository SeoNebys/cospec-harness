// Thin HTTP helpers. Throws Error(message) on non-2xx with the server's message.
async function handle(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (url) => fetch(url).then(handle),
  post: (url, body) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  }).then(handle),
  patch: (url, body) => fetch(url, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  }).then(handle),
  del: (url) => fetch(url, { method: 'DELETE' }).then(handle),
  upload: (url, formData) => fetch(url, { method: 'POST', body: formData }).then(handle),
};
