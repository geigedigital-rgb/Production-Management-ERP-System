/**
 * Comment 2: fixed commercial price by quantity ladder (like cut tiers, without optimal cap).
 * Manager-facing price comes from this list; internal cost uses the calc engine separately.
 */

export type CommercialPriceTier = {
  minQuantity: number;
  pricePerUnit: number;
};

export function resolveCommercialPricePerUnit(args: {
  quantity: number;
  tiers: CommercialPriceTier[];
  fallbackPrice?: number | null;
}): number | null {
  const qty = Math.max(0, Math.floor(args.quantity));
  if (qty <= 0) return args.fallbackPrice ?? null;

  const tiers = [...args.tiers]
    .filter((tier) => tier.minQuantity > 0 && Number.isFinite(tier.pricePerUnit))
    .sort((a, b) => a.minQuantity - b.minQuantity);

  if (tiers.length === 0) return args.fallbackPrice ?? null;

  let price = args.fallbackPrice ?? tiers[0]!.pricePerUnit;
  for (const tier of tiers) {
    if (tier.minQuantity <= qty) price = tier.pricePerUnit;
    else break;
  }
  return price;
}

export type CommercialPriceProduct = {
  isBaseModel?: boolean;
  commercialPriceTiers: Array<{ minQuantity: number; pricePerUnit: unknown }>;
};

export function commercialPriceTiersFromProduct(
  product: CommercialPriceProduct | null | undefined,
): CommercialPriceTier[] {
  // Selling price comes from the saved ladder whenever it exists.
  // isBaseModel is only a catalog flag («базова модель»), not a gate for pricing.
  if (!product?.commercialPriceTiers?.length) return [];
  return product.commercialPriceTiers
    .map((tier) => ({
      minQuantity: tier.minQuantity,
      pricePerUnit: Number(tier.pricePerUnit),
    }))
    .filter((tier) => tier.minQuantity > 0 && Number.isFinite(tier.pricePerUnit) && tier.pricePerUnit > 0);
}
