/**
 * Comment 2: fixed commercial price by quantity ladder (like cut tiers, without optimal cap).
 * Manager-facing price comes from this list; internal cost uses the calc engine separately.
 */

export type CommercialPriceTier = {
  minQuantity: number;
  pricePerUnit: number;
  showOnCard?: boolean;
  sewingMultiplier?: number | null;
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

/** Ladder × for quantity — same step rule as price tiers. */
export function resolveSewingMultiplierFromTiers(
  quantity: number,
  tiers: Array<{ minQuantity: number; sewingMultiplier?: number | null }>,
): number | null {
  const qty = Math.max(0, Math.floor(quantity));
  if (qty <= 0) return null;
  const sorted = [...tiers]
    .filter(
      (tier) =>
        tier.minQuantity > 0 &&
        tier.sewingMultiplier != null &&
        Number.isFinite(Number(tier.sewingMultiplier)) &&
        Number(tier.sewingMultiplier) > 0,
    )
    .sort((a, b) => a.minQuantity - b.minQuantity);
  if (sorted.length === 0) return null;
  let mult: number | null = null;
  for (const tier of sorted) {
    if (tier.minQuantity <= qty) mult = Number(tier.sewingMultiplier);
    else break;
  }
  return mult;
}

export type CommercialPriceProduct = {
  isBaseModel?: boolean;
  commercialPriceTiers: Array<{
    minQuantity: number;
    pricePerUnit: unknown;
    showOnCard?: boolean | null;
    sewingMultiplier?: unknown;
  }>;
};

export function commercialPriceTiersFromProduct(
  product: CommercialPriceProduct | null | undefined,
): CommercialPriceTier[] {
  // Selling price comes from the saved ladder whenever it exists.
  // isBaseModel is only a catalog flag («базова модель»), not a gate for pricing.
  if (!product?.commercialPriceTiers?.length) return [];
  return product.commercialPriceTiers
    .map((tier) => {
      const sewingRaw = tier.sewingMultiplier;
      const sewingMultiplier =
        sewingRaw != null && Number.isFinite(Number(sewingRaw)) && Number(sewingRaw) > 0
          ? Number(sewingRaw)
          : null;
      return {
        minQuantity: tier.minQuantity,
        pricePerUnit: Number(tier.pricePerUnit),
        showOnCard: tier.showOnCard === true,
        sewingMultiplier,
      };
    })
    .filter((tier) => tier.minQuantity > 0 && Number.isFinite(tier.pricePerUnit) && tier.pricePerUnit > 0);
}

/** Tiers marked for product cards in «Вироби»; falls back to full ladder if none checked. */
export function cardCommercialPriceTiersFromProduct(
  product: CommercialPriceProduct | null | undefined,
): CommercialPriceTier[] {
  const all = commercialPriceTiersFromProduct(product);
  const marked = all.filter((tier) => tier.showOnCard);
  return marked.length > 0 ? marked : all;
}
