import express from 'express'
import * as cheerio from 'cheerio'
import dns from 'node:dns/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const root = path.dirname(fileURLToPath(import.meta.url))
const privateIp = ip => net.isIPv4(ip)
  ? /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
  : ip === '::1' || /^(fc|fd|fe80:)/i.test(ip)

async function safeUrl(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only web links are supported')
  const addresses = await dns.lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => privateIp(address))) throw new Error('That address cannot be fetched')
  return url
}

app.get('/api/metadata', async (req, res) => {
  try {
    let current = await safeUrl(String(req.query.url || ''))
    let response
    for (let redirects = 0; redirects < 4; redirects++) {
      response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; StashBookmarkBot/1.0)', accept: 'text/html,application/xhtml+xml' } })
      if (![301, 302, 303, 307, 308].includes(response.status)) break
      const location = response.headers.get('location')
      if (!location) break
      current = await safeUrl(new URL(location, current).href)
    }
    if (!response?.ok) throw new Error(`Page returned ${response?.status || 'an error'}`)
    if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('This link is not an HTML page')
    const $ = cheerio.load((await response.text()).slice(0, 1500000))
    const meta = selector => $(selector).first().attr('content')?.trim()
    const title = meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]') || $('title').first().text().trim()
    const description = meta('meta[property="og:description"]') || meta('meta[name="description"]') || meta('meta[name="twitter:description"]') || ''
    const icon = new URL($('link[rel~="icon"]').first().attr('href') || '/favicon.ico', current).href
    res.json({ title, description, icon, domain: current.hostname.replace(/^www\./, ''), url: current.href })
  } catch (error) {
    res.status(422).json({ error: error.message || 'Could not read this page' })
  }
})

app.use(express.static(path.join(root, 'dist')))
app.get('*path', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')))
app.listen(4000, '0.0.0.0', () => console.log('Stash listening on http://0.0.0.0:4000'))
