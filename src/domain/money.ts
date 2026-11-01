/** All money is stored as integer piastres (100 piastres = 1 EGP) to avoid float drift. */
export type Piastres = number;

export interface MoneyRange {
  low: Piastres;
  high: Piastres;
}

export const egp = (pounds: number): Piastres => Math.round(pounds * 100);

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const toPoundsLabel = (amount: Piastres): string => numberFormat.format(Math.round(amount / 100));

/** "1,250 EGP" */
export const formatEgp = (amount: Piastres): string => `${toPoundsLabel(amount)} EGP`;

/** "1,100–1,400 EGP", or "1,250 EGP" when both ends round to the same value. */
export function formatEgpRange({ low, high }: MoneyRange): string {
  const lowLabel = toPoundsLabel(low);
  const highLabel = toPoundsLabel(high);
  return lowLabel === highLabel ? `${lowLabel} EGP` : `${lowLabel}–${highLabel} EGP`;
}

export const formatQuantity = (quantity: number): string => numberFormat.format(quantity);
