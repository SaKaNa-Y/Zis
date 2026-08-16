// PROTOTYPE — throwaway. Polite fetch + on-disk cache so reruns cost nothing.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const UA =
  'ZisPrototype/0.1 (clustering spike; +https://github.com/SaKaNa-Y/Zis/issues/6)';

const CACHE = join(import.meta.dirname, 'cache');
mkdirSync(CACHE, { recursive: true });

const lastHit = new Map();
const MIN_GAP_MS = 700; // serial, one host at a time — the map's polite-fetch rule

const stats = { hits: 0, misses: 0, errors: 0, bytes: 0 };
export const netStats = () => ({ ...stats });

function key(url, method) {
  return createHash('sha1').update(`${method} ${url}`).digest('hex').slice(0, 20);
}

async function gap(host) {
  const prev = lastHit.get(host) || 0;
  const wait = prev + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}

/**
 * Returns {ok, status, headers, body, contentType, fromCache}.
 * `redirect: 'manual'` is honoured so the unwrapper sees each hop.
 */
export async function fetchWithPolicy(url, opts = {}) {
  const { method = 'GET', redirect = 'follow', maxBytes = 8 * 1024 * 1024, accept } = opts;
  const f = join(CACHE, `${key(url, method + redirect)}.json`);
  if (existsSync(f)) {
    stats.hits++;
    const c = JSON.parse(readFileSync(f, 'utf8'));
    return { ...c, headers: new Headers(c.headerObj || {}), fromCache: true };
  }
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, status: 0, body: '', headers: new Headers(), error: 'bad-url' };
  }
  await gap(host);
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000);
    const r = await fetch(url, {
      method,
      redirect,
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: accept || '*/*', 'accept-encoding': 'gzip, deflate' },
    });
    clearTimeout(t);
    const ct = r.headers.get('content-type') || '';
    let body = '';
    if (method !== 'HEAD') {
      const buf = Buffer.from(await r.arrayBuffer());
      stats.bytes += buf.length;
      body = buf.subarray(0, maxBytes).toString('utf8');
    }
    const headerObj = Object.fromEntries(r.headers.entries());
    const out = { ok: r.ok, status: r.status, body, contentType: ct, headerObj, finalUrl: r.url };
    writeFileSync(f, JSON.stringify(out));
    stats.misses++;
    return { ...out, headers: r.headers, fromCache: false };
  } catch (e) {
    stats.errors++;
    const out = { ok: false, status: 0, body: '', contentType: '', headerObj: {}, error: String(e.message || e) };
    writeFileSync(f, JSON.stringify(out));
    return { ...out, headers: new Headers() };
  }
}
