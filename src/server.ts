import { HEADERS_CORS, nativeTokenLogo } from "./constants.ts";
import { streamThrough, IDENTICON } from "./utils.ts";
import { kv, LOGO_KEY } from "./kv.ts";

export const server = async (req: Request) => {
  const { pathname } = new URL(req.url);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: HEADERS_CORS });
  }
  
  if (pathname.startsWith("/token/")) {
    const parts = pathname.split("/").filter(Boolean); // ["token", chainId, address]
    if (parts.length !== 3) {
      return new Response("Use /token/<chainId>/<address>", {
        status: 400,
        headers: { ...HEADERS_CORS, "Content-Type": "text/plain" },
      });
    }
    
    const chainId = Number(parts[1]);
    const address = parts[2].toLowerCase();
    
    if (!Number.isFinite(chainId) || !/^0x[0-9a-f]{40}$/.test(address)) {
      return new Response("Invalid chainId or address", {
        status: 400,
        headers: { ...HEADERS_CORS, "Content-Type": "text/plain" },
      });
    }
    
    const hit = await kv.get(LOGO_KEY(chainId, address)) as { value?: string | null };
    if (hit.value) return streamThrough(hit.value);
    
    // add default logo for native token
    if (address === "0x0000000000000000000000000000000000000000") {
      return streamThrough(nativeTokenLogo(chainId));
    }
    
    // No on-demand lookup; either it’s indexed or it isn’t.
    return streamThrough(IDENTICON(chainId, address)); // swap to 404 if you prefer strictness
  }
  
  if (pathname === "/" || pathname === "/health") {
    return new Response(
      JSON.stringify(
        { ok: true, routes: ["/token/<chainId>/<address>"], source: "tokens.coingecko.com" },
        null,
        2
      ),
      { headers: { ...HEADERS_CORS, "Content-Type": "application/json" } }
    );
  }
  
  return new Response("Not found", { status: 404, headers: HEADERS_CORS });
}
