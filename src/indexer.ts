import { Platform, TokenList } from "./types.ts";
import { kv, ETAG_KEY, LOGO_KEY, PLATFORMMAP_KEY, REVMAP_KEY } from "./kv.ts";
import { fetchJSON, fetchWithRetry, setMany, sleep } from "./utils.ts";

export async function indexPlatform(chainId: number) {
  const chainMap = await kv.get(PLATFORMMAP_KEY) as { value?: Record<string, string> | null };
  const platformId = chainMap.value?.[chainId];
  if (!platformId) {
    console.warn(`Skip ${chainId}: platformId not found`);
    return;
  }

  const prev = (await kv.get(ETAG_KEY(platformId))) as { value?: string | null };
  const etagPrev = prev.value ?? null;
  const url = `https://tokens.coingecko.com/${platformId}/all.json`;

  const init: RequestInit | undefined = etagPrev ? { headers: { "If-None-Match": etagPrev } } : undefined;

  let res: Response;
  try {
    res = await fetchWithRetry(url, init, { attempts: 4, baseDelayMs: 800 });
  } catch (e) {
    console.warn(`Skip ${platformId}: network error after retries`, e);
    return;
  }

  if (res.status === 304) return;
  if (!res.ok) {
    console.warn(`Skip ${platformId}: HTTP ${res.status} after retries`);
    return;
  }

  const etag = res.headers.get("etag") ?? undefined;
  const json = (await res.json()) as TokenList;

  const sets: Array<{ key: ReturnType<typeof LOGO_KEY>; value: string }> = [];
  for (const t of json.tokens || []) {
    const address = t.address?.toLowerCase?.();
    const logo = t.logoURI;
    if (!address || !logo) continue;

    const effectiveChainId =
      typeof t.chainId === "number"
        ? t.chainId
        : typeof t.chainId === "string" && /^\d+$/.test(t.chainId)
        ? Number(t.chainId)
        : chainId;

    sets.push({ key: LOGO_KEY(effectiveChainId, address), value: logo });
  }

  await setMany(sets);
  if (etag) await kv.set(ETAG_KEY(platformId), etag);
  console.log(`Indexed ${platformId} with ${sets.length} logos`);
}

export async function updateIndex() {
  const platforms = await fetchJSON<Platform[]>(
    "https://api.coingecko.com/api/v3/asset_platforms"
  );

  const chainMap: Record<string, string> = {};
  const revMap: Record<string, number> = {};
  for (const p of platforms) {
    if (p.chain_identifier != null) {
      chainMap[String(p.chain_identifier)] = p.id;
      revMap[p.id] = p.chain_identifier;
    }
  }
  await kv.set(PLATFORMMAP_KEY, chainMap);
  await kv.set(REVMAP_KEY, revMap);
}
