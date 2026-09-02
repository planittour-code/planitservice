export const SAMPLE_HOUSE_TOKEN = "maple-14";
export const SAMPLE_SHOP_QUOTE_TOKEN = "maple-paint-draft";

export function isSampleHouseToken(token: string | null | undefined) {
  return token === SAMPLE_HOUSE_TOKEN;
}

export function isSampleShopQuote(token: string | null | undefined) {
  return token === SAMPLE_SHOP_QUOTE_TOKEN;
}
