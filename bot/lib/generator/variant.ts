import { weightedRandom } from "../random";
import type { RecencyTracker } from "../recency";

export type EntryVariant = "with-brand" | "name-only" | "short";

export type VariantContext = {
  hasBrand: boolean;
};

export type VariantConfig = {
  variant: EntryVariant;
  weight: number;
  condition?: (ctx: VariantContext) => boolean;
};

export const VARIANT_CONFIGS: VariantConfig[] = [
  {
    variant: "with-brand",
    weight: 60,
    condition: (ctx) => ctx.hasBrand,
  },
  {
    variant: "name-only",
    weight: 20,
  },
  {
    variant: "short",
    weight: 10,
  },
];

/**
 * Normalize text for brand/name comparison.
 * Removes special characters and lowercases for comparison.
 */
const normalizeForComparison = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/ und /g, "")
    .replace(/&/g, "")
    .replace(/['"\s-]/g, "");
};

/**
 * Extract significant words (4+ chars) from text for overlap comparison.
 */
const getSignificantWords = (text: string): Set<string> => {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s\-&,]+/)
      .filter((word) => word.length >= 4)
      .map((word) => word.replace(/[^a-zäöüß]/g, ""))
      .filter((word) => word.length >= 4),
  );
};

/**
 * Check if brand is redundant (already contained in product name).
 * Returns true if brand should not be shown separately.
 */
export const isBrandRedundant = (name: string, brand: string | null): boolean => {
  if (!brand) return true;

  const nameLower = name.toLowerCase();
  const brandLower = brand.toLowerCase();

  // Check if brand is contained in name (case-insensitive)
  if (nameLower.includes(brandLower)) return true;

  // Check if name is contained in brand (e.g., brand is "Haribo" and name is "Haribo Goldbären")
  // Only check if name is short enough to be a sub-brand
  if (nameLower.length <= brandLower.length && brandLower.includes(nameLower)) {
    return true;
  }

  // Check normalized versions (handles "M&M's" vs "M und M's")
  const nameNormalized = normalizeForComparison(name);
  const brandNormalized = normalizeForComparison(brand);

  if (nameNormalized.includes(brandNormalized)) return true;

  // Check for significant word overlap (catches "Unsere Goldstücke" in both name and brand)
  const nameWords = getSignificantWords(name);
  const brandWords = getSignificantWords(brand);
  let overlapCount = 0;
  for (const word of nameWords) {
    if (brandWords.has(word)) overlapCount++;
  }
  // If 2+ significant words overlap, consider it redundant
  if (overlapCount >= 2) return true;

  return false;
};

/**
 * Pick a variant for an entry based on product properties and recency.
 */
export const pickVariant = (
  product: { name: string; brand: string | null },
  recencyTracker?: RecencyTracker,
): EntryVariant => {
  const ctx: VariantContext = {
    hasBrand: !isBrandRedundant(product.name, product.brand),
  };

  const blockedVariants = recencyTracker?.get("variants");

  // Filter eligible variants based on context conditions
  let eligible = VARIANT_CONFIGS.filter(
    (c) => !c.condition || c.condition(ctx),
  );

  // Filter out blocked variants if tracker exists
  if (blockedVariants && blockedVariants.size > 0) {
    const unblocked = eligible.filter((c) => !blockedVariants.has(c.variant));
    // Only use unblocked if some are available
    if (unblocked.length > 0) {
      eligible = unblocked;
    }
  }

  const variants = eligible.map((c) => c.variant);
  const weights = eligible.map((c) => c.weight);

  return weightedRandom(variants, weights);
};
