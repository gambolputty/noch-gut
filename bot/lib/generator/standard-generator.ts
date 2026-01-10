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
import { type EntryVariant, pickVariant } from "./variant";

export class StandardEntryGenerator extends BaseGenerator {
  generate(): GeneratedEntry | null {
    const product = this.getUnusedProduct();
    if (!product) return null;

    const expiryDate = generateExpiryDate(this.dateRange);
    const eatenDate = generateEatenDate(expiryDate, this.minMonthsAfterExpiry);

    const blockedRatings = this.recencyTracker?.get("ratings");
    const rating = getRating(this.ratings, product, blockedRatings);

    const variant = pickVariant(product, this.recencyTracker);
    const text = this.formatEntry(product, expiryDate, eatenDate, rating, variant);

    this.trackRecency(product, rating, variant);

    return {
      text,
      product,
      expiryDate,
      eatenDate,
      rating,
    };
  }

  private formatEntry(
    product: {
      name: string;
      brand: string | null;
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
        return `${this.em(product.name)}. Abgelaufen ${expiryStr}. Gegessen am ${eatenStr}. ${rating}`;

      case "short": {
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
