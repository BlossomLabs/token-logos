declare const Deno: any;

export const supportedChainIds: number[] =
  Deno.env.get("SUPPORTED_CHAIN_IDS")?.split(",").map(Number) ?? [];

export const HEADERS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function nativeTokenLogo(chainId: number) {
  switch (chainId) {
    case 137:
      return "https://assets.coingecko.com/coins/images/32440/standard/polygon.png";
    default:
      return "https://assets.coingecko.com/coins/images/279/standard/ethereum.png";
  }
}
