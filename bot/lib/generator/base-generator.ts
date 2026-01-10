import type { Product } from "../data/product-loader";
import type { Rating } from "../data/ratings";
import type { DateRange, ExpiryDate } from "../date";
import { randomElement } from "../random";
import type { RecencyTracker } from "../recency";
import type { EntryVariant } from "./variant";

const DEFAULT_MIN_MONTHS_AFTER_EXPIRY = 24; // 2 years

export type GeneratorConfig = {
  products: Product[];
  ratings: Rating[];
  dateRange: DateRange;
  minMonthsAfterExpiry?: number;
  italic?: boolean;
  recencyTracker?: RecencyTracker;
};

export type GeneratedEntry = {
  text: string;
  product: Product;
  expiryDate: ExpiryDate;
  eatenDate: Date;
  rating: string;
};

export abstract class BaseGenerator {
  protected products: Product[];
  protected ratings: Rating[];
  protected dateRange: DateRange;
  protected minMonthsAfterExpiry: number;
  protected italic: boolean;
  protected usedProducts: Set<string> = new Set();
  protected recencyTracker?: RecencyTracker;

  constructor(config: GeneratorConfig) {
    this.products = config.products;
    this.ratings = config.ratings;
    this.dateRange = config.dateRange;
    this.minMonthsAfterExpiry =
      config.minMonthsAfterExpiry ?? DEFAULT_MIN_MONTHS_AFTER_EXPIRY;
    this.italic = config.italic ?? false;
    this.recencyTracker = config.recencyTracker;
  }

  abstract generate(): GeneratedEntry | null;

  protected getUnusedProduct(): Product | null {
    const available = this.products.filter(
      (p) => !this.usedProducts.has(p.name)
    );
    if (available.length === 0) return null;
    const product = randomElement(available);
    this.usedProducts.add(product.name);
    return product;
  }

  protected markProductUsed(product: Product): void {
    this.usedProducts.add(product.name);
  }

  public reset(): void {
    this.usedProducts.clear();
  }

  public getRemainingProductCount(): number {
    return this.products.length - this.usedProducts.size;
  }

  /**
   * Wrap text in italic markers if italic mode is enabled.
   */
  protected em(text: string): string {
    return this.italic ? `*${text}*` : text;
  }

  /**
   * Track used elements for recency to avoid repetition.
   */
  protected trackRecency(
    product: Product,
    rating: string,
    variant: EntryVariant,
  ): void {
    if (!this.recencyTracker) return;

    this.recencyTracker.add("ratings", rating);
    this.recencyTracker.add("variants", variant);
    if (product.genericName) {
      this.recencyTracker.add("genericNames", product.genericName);
    }
    if (product.brand) {
      this.recencyTracker.add("brands", product.brand);
    }
  }
}
