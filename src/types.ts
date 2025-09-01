export type Platform = { id: string; chain_identifier: number | null };

export type TokenList = {
  tokens: Array<{ chainId?: number | string; address: string; logoURI?: string }>;
};


