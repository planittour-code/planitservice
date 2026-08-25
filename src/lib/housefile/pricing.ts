/** Contractor shop. Owner is one seat. Extra seats are billed. */
export const SHOP_MONTHLY = 9.99;
export const SHOP_ANNUAL = 99;
export const SEAT_MONTHLY = 5;
export const SEAT_ANNUAL = 50;

/** Homeowner PlanitService — billed per property. */
export const PROPERTY_MONTHLY = 7.99;
export const PROPERTY_ANNUAL = 79.99;
export const PRO_MONTHLY = 9.99;
export const PRO_ANNUAL = 99;

export function dollars(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
