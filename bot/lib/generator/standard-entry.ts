import { getRating } from "../data/ratings";
import {
  formatEatenDate,
  formatExpiryDate,
  formatRelativeExpiry,
  formatWeeksDiff,
  generateEatenDate,
  generateExpiryDate,
} from "../date";
import { weightedRandom } from "../random";
import { BaseGenerator, type GeneratedEntry } from "./base-generator";

type EntryVariant = "with-brand" | "name-only" | "short";

type VariantContext = {
  hasBrand: boolean;
};

type VariantConfig = {
  variant: EntryVariant;
  weight: number | ((ctx: VariantContext) => number);
  condition?: (ctx: VariantContext) => boolean;
};

const VARIANT_CONFIGS: VariantConfig[] = [
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
const isBrandRedundant = (name: string, brand: string | null): boolean => {
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

export class StandardEntryGenerator extends BaseGenerator {
  generate(): GeneratedEntry | null {
    const product = this.getUnusedProduct();
    if (!product) return null;

    const expiryDate = generateExpiryDate(this.dateRange);
    const eatenDate = generateEatenDate(expiryDate, this.minMonthsAfterExpiry);

    // Get blocked ratings from recency tracker
    const blockedRatings = this.recencyTracker?.get("ratings");
    const rating = getRating(this.ratings, product, blockedRatings);

    const variant = this.pickVariant(product);
    const text = this.formatEntry(
      product,
      expiryDate,
      eatenDate,
      rating,
      variant,
    );

    // Track used elements for recency
    if (this.recencyTracker) {
      this.recencyTracker.add("ratings", rating);
      this.recencyTracker.add("variants", variant);
      if (product.genericName) {
        this.recencyTracker.add("genericNames", product.genericName);
      }
      if (product.brand) {
        this.recencyTracker.add("brands", product.brand);
      }
    }

    return {
      text,
      product,
      expiryDate,
      eatenDate,
      rating,
    };
  }

  private pickVariant(product: {
    name: string;
    brand: string | null;
    quantity: string | null;
    genericName: string | null;
    labels: string[];
  }): EntryVariant {
    const ctx: VariantContext = {
      hasBrand: !isBrandRedundant(product.name, product.brand),
    };

    // Get blocked variants from recency tracker
    const blockedVariants = this.recencyTracker?.get("variants");

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
    const weights = eligible.map((c) =>
      typeof c.weight === "function" ? c.weight(ctx) : c.weight,
    );

    return weightedRandom(variants, weights);
  }

  private em(text: string): string {
    return this.italic ? `*${text}*` : text;
  }

  private formatEntry(
    product: {
      name: string;
      brand: string | null;
      quantity: string | null;
      genericName: string | null;
    },
    expiryDate: { year: number; month: number },
    eatenDate: Date,
    rating: string,
    variant: EntryVariant,
  ): string {
    const expiryStr = formatExpiryDate(expiryDate);
    const eatenStr = formatEatenDate(eatenDate);

    switch (variant) {
      case "with-brand": {
        // Only with-brand can use genericName (since brand provides identification)
        const productName = product.genericName
          ? weightedRandom([product.genericName, product.name], [70, 30])
          : product.name;
        return `${this.em(productName)} von ${this.em(product.brand!)}. Abgelaufen ${expiryStr}. Gegessen am ${eatenStr}. ${rating}`;
      }

      case "name-only":
        // Always use product.name (never genericName) - it's specific enough without brand
        return `${this.em(product.name)}. Abgelaufen ${expiryStr}. Gegessen am ${eatenStr}. ${rating}`;

      case "short": {
        // Use relative time format with product.name
        const relativeWeeks = formatWeeksDiff(expiryDate, eatenDate);
        const relativeMonths = formatRelativeExpiry(expiryDate, eatenDate);
        const relative =
          relativeWeeks || relativeMonths || `Abgelaufen ${expiryStr}`;
        return `${this.em(product.name)}. ${relative}. ${rating}`;
      }

      default:
        return `${this.em(product.name)}. Abgelaufen ${expiryStr}. ${rating}`;
    }
  }
}
