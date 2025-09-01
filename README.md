## Token Logos (CoinGecko proxy on Deno)

Lightweight HTTP service that proxies token logos from CoinGecko, with on-start indexing into Deno KV and a cron-based refresher. It exposes a single image endpoint that serves cached logos (including ipfs:// via HTTP gateway) and falls back to an identicon when unavailable. Designed for Deno Deploy but works locally too.

### Features

- Indexes CoinGecko token lists into Deno KV on startup and every 10 minutes via cron
- Serves token logos by `chainId` and `address` with CORS and long-lived cache headers
- Converts `ipfs://` logo URIs to HTTP via Cloudflare IPFS gateway
- Deterministic identicon fallback when a logo is missing
- Optional environment filter for supported chains

### Endpoints

- GET `/` or `/health`
  - Returns a small JSON payload and available routes.

- GET `/token/<chainId>/<address>`
  - Returns the token logo as an image stream if found in KV.
  - If the address is the zero address, a native token logo is returned (chain-aware; e.g. Polygon on 137, Ethereum otherwise).
  - If not found, returns an identicon image based on `<chainId>:<address>`.
  - Validation: `chainId` must be a finite number, `address` must match `^0x[0-9a-f]{40}$` (case-insensitive; normalized to lowercase).

Response headers include:
- `Access-Control-Allow-Origin: *` (CORS enabled)
- `Cache-Control: public, max-age=604800, immutable` on successful upstream fetches

### How it works

On start and then every 10 minutes:
1. Fetches asset platforms from CoinGecko to build mappings between `chainId` and `platformId`.
2. For each platform, downloads `https://tokens.coingecko.com/<platformId>/all.json` using conditional requests via ETag.
3. Stores `logoURI` entries into Deno KV keyed by `["logo", chainId, address]`.

KV schema (keys):
- `["platformMap","byChainId"] -> Record<string, string>`   // chainId -> platformId
- `["platformMap","byPlatformId"] -> Record<string, number>` // platformId -> chainId
- `["etag", <platformId>] -> string`                           // ETag for all.json
- `["logo", <chainId>, <address>] -> string`                   // logoURI

### Requirements

- Deno (latest stable). Local runs require permissions for KV, net, and env.

### Quick start (local)

```bash
deno task dev
```

By default the server listens on port 8000. Example request after startup:

```bash
curl -i "http://localhost:8000/token/1/0x6b175474e89094c44da98b954eedeac495271d0f" # DAI
```

### Configuration

- `SUPPORTED_CHAIN_IDS`: comma-separated list of chain IDs to index. If unset or empty, indexes all platforms CoinGecko provides a numeric `chain_identifier` for.

Examples:

```bash
export SUPPORTED_CHAIN_IDS="1,10,137,8453"
deno task dev
```

### Deployment (Deno Deploy)

- Entry point: `main.ts`
- `Deno.serve` provides the HTTP server; `Deno.cron` schedules the 10-minute refresh.
- Set `SUPPORTED_CHAIN_IDS` in project settings if you want to restrict indexing.
- Ensure Cron is enabled for the project. The schedule is defined in code: `*/10 * * * *`.

### Notes & behavior

- Addresses are normalized to lowercase for KV keys.
- IPFS logos are proxied through Cloudflare: `ipfs://...` -> `https://cloudflare-ipfs.com/ipfs/...`.
- Fallback identicons come from `https://avatars.z52da5wt.xyz/<chainId>:<address>`.
- Native token (zero address) returns a chain-specific default logo. Currently, Polygon (137) uses Polygon; all others default to Ethereum.
- No on-demand CoinGecko lookups on cache miss; the service either finds it in KV, serves native, or falls back to identicon.

### Project layout

- `main.ts` — bootstraps initial index, starts HTTP server, registers cron
- `src/indexer.ts` — CoinGecko fetch + KV writes (with ETag and retries)
- `src/server.ts` — HTTP routes and response behavior
- `src/utils.ts` — helpers (retry, identicon URL, IPFS conversion, KV batch set)
- `src/constants.ts` — CORS headers, native token defaults, chain filter
- `src/kv.ts` — Deno KV instance and key helpers

### Troubleshooting

- Local run fails with permissions: use `-A` or specify `--allow-net --allow-env --allow-read --allow-write --unstable` as needed.
- Seeing 502 with `Upstream <status>`: the upstream logo URL failed; the service returns a 502 rather than caching an error.
- Empty responses for a token you expect: wait for the initial index to complete, or restrict `SUPPORTED_CHAIN_IDS` to speed up initial indexing.


