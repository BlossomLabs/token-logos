import { HEADERS_CORS } from "./constants.ts";
import { kv } from "./kv.ts";

export const IDENTICON = (chainId: number, address: string) =>
  `https://avatars.z52da5wt.xyz/${chainId}:${address.toLowerCase()}`;

export function ipfsToHttp(url: string): string {
  if (!url.startsWith("ipfs://")) return url;
  const cidPath = url.slice("ipfs://".length);
  return `https://cloudflare-ipfs.com/ipfs/${cidPath}`;
}

export async function streamThrough(url: string): Promise<Response> {
  const res = await fetch(ipfsToHttp(url), { redirect: "follow" });
  if (!res.ok) {
    return new Response(`Upstream ${res.status}`, {
      status: 502,
      headers: { ...HEADERS_CORS, "Content-Type": "text/plain" },
    });
  }
  const h = new Headers(res.headers);
  h.set("Cache-Control", "public, max-age=604800, immutable");
  Object.entries(HEADERS_CORS).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: 200, headers: h });
}

export async function setMany<K extends readonly unknown[]>(
  entries: Array<{ key: K; value: unknown }>
) {
  const CONCURRENCY = 25;
  const queue = entries.slice();
  const workers = Array.from({ length: CONCURRENCY }).map(async () => {
    for (;;) {
      const item = queue.pop();
      if (!item) break;
      await kv.set(item.key, item.value);
    }
  });
  await Promise.all(workers);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseRetryAfter(h: string | null): number | null {
  if (!h) return null;
  const s = Number(h);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const when = Date.parse(h);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return null;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts: { attempts?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  const attempts = opts.attempts ?? 4;
  const base = opts.baseDelayMs ?? 500;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || res.status === 304) return res;

      const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (!retriable) return res;

      const ra = parseRetryAfter(res.headers.get("retry-after"));
      const delay = ra ?? Math.floor(base * 2 ** i + Math.random() * 250);
      if (i < attempts - 1) await sleep(delay);
      else return res;
    } catch (_err) {
      const delay = Math.floor(base * 2 ** i + Math.random() * 250);
      if (i < attempts - 1) await sleep(delay);
      else throw _err;
    }
  }
  throw new Error("fetchWithRetry: exhausted attempts");
}

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithRetry(url, init, { attempts: 4, baseDelayMs: 800 });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}
