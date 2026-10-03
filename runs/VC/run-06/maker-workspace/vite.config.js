import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dns from 'node:dns/promises'
import net from 'node:net'

const decodeEntities = (text = '') => text
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ').trim()

const metaContent = (html, key) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return decodeEntities(match[1])
  }
  return ''
}

const isPrivateAddress = address => {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  return address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')
}

async function validatePublicUrl(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP links are supported.')
  const addresses = await dns.lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('That address cannot be fetched.')
  return url
}

async function fetchMetadata(value) {
  let url = await validatePublicUrl(value)
  let response
  for (let redirects = 0; redirects < 4; redirects++) {
    response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; GatherBookmarkBot/1.0)', accept: 'text/html,application/xhtml+xml' },
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = response.headers.get('location')
    if (!location) break
    url = await validatePublicUrl(new URL(location, url).href)
  }
  if (!response?.ok) throw new Error(`The page responded with ${response?.status || 'an error'}.`)
  const type = response.headers.get('content-type') || ''
  if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('This link is not an HTML page.')
  const html = (await response.text()).slice(0, 1_500_000)
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''
  return {
    title: metaContent(html, 'og:title') || metaContent(html, 'twitter:title') || decodeEntities(titleTag),
    description: metaContent(html, 'og:description') || metaContent(html, 'twitter:description') || metaContent(html, 'description'),
    domain: url.hostname.replace(/^www\./, ''),
    url: url.href,
  }
}

function metadataApi() {
  return {
    name: 'gather-metadata-api',
    configureServer(server) {
      server.middlewares.use('/api/metadata', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const requestUrl = new URL(req.url || '/', 'http://gather.local')
          const value = requestUrl.searchParams.get('url')
          if (!value) throw new Error('A URL is required.')
          res.end(JSON.stringify(await fetchMetadata(value)))
        } catch (error) {
          res.statusCode = 422
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Could not read this page.' }))
        }
      })
    },
  }
}

export default defineConfig({ plugins: [react(), metadataApi()] })
