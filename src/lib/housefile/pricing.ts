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

/** Property manager portfolio. Base includes 10 houses. Extra houses are billed. */
export const MANAGE_TRIAL_DAYS = 14;
export const MANAGE_INCLUDED = 10;
export const MANAGE_MONTHLY = 39.99;
export const MANAGE_ANNUAL = 399;
export const MANAGE_EXTRA_MONTHLY = 3.99;
export const MANAGE_EXTRA_ANNUAL = 39.99;
/** Owner is one office seat. Extra seats are billed like extra houses. */
export const MANAGE_SEAT_MONTHLY = 5;
export const MANAGE_SEAT_ANNUAL = 50;

export function dollars(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
