declare const Deno: any;
export const kv = await Deno.openKv();

export const LOGO_KEY = (chainId: number, address: string) =>
    ["logo", String(chainId), address.toLowerCase()] as const;
  
export const ETAG_KEY = (platformId: string) => ["etag", platformId] as const;

export const PLATFORMMAP_KEY = ["platformMap", "byChainId"] as const;
export const REVMAP_KEY = ["platformMap", "byPlatformId"] as const;
