
/**
 * CoinGecko logo proxy (Deno Deploy)
 * - Startup: updateIndex() once (with KV lock)
 * - Cron: every 10 min refresh (with KV lock)
 * - GET /token/<chainId>/<address> -> proxy the image from KV (handles ipfs://)
 *
 * KV schema:
 *   ["platformMap","byChainId"] -> Record<string, string>  // chainId -> platformId
 *   ["platformMap","byPlatformId"] -> Record<string, number> // platformId -> chainId
 *   ["etag", <platformId>] -> string                       // ETag for all.json
 *   ["logo", <chainId>, <address>] -> string               // logoURI
 */

declare const Deno: any;
import { updateIndex } from "./src/indexer.ts";
import { server } from "./src/server.ts";

await updateIndex();

Deno.serve(server);

Deno.cron("coingecko-indexer", "*/10 * * * *", async () => {
  try {
    await updateIndex();
    console.log("Index updated");
  } catch (e) {
    console.error("Index update failed:", e);
  }
});

export {};