import { getRating } from "../data/ratings";
import {
  type ExpiryDate,
  formatExpiryDate,
  formatRelativeExpiry,
  formatWeeksDiff,
} from "../date";
import { randomFromRange, weightedRandom } from "../random";
import {
  BaseGenerator,
  type GeneratedEntry,
  type GeneratorConfig,
} from "./base-generator";
import { type EntryVariant, pickVariant } from "./variant";

/**
 * A day in the protocol with its entries.
 */
export type ProtocolDay = {
  date: Date;
  entries: ProtocolEntry[];
};

/**
 * An entry in the protocol format (without "Gegessen am").
 */
export type ProtocolEntry = GeneratedEntry;

/**
 * The complete protocol with metadata.
 */
export type Protocol = {
  startDate: Date;
  endDate: Date;
  days: ProtocolDay[];
};

export type ProtocolGeneratorConfig = GeneratorConfig & {
  /** Start date of the protocol (first possible eating day) */
  protocolStartDate: Date;
  /** End date of the protocol (last possible eating day, defaults to today) */
  protocolEndDate?: Date;
  /** Ratio of days that have entries (0.0 - 1.0, default 0.15) */
  activeDayRatio?: number;
  /** Min/max entries per active day (default [1, 4]) */
  entriesPerDay?: { min: number; max: number; weights?: number[] };
  /** Sort order: 'asc' starts from protocolStartDate, 'desc' starts from protocolEndDate (default 'asc') */
  sortOrder?: "asc" | "desc";
};

/**
 * Generator for protocol-style output.
 * Generates entries grouped by day, without "Gegessen am" text.
 */
export class ProtocolGenerator extends BaseGenerator {
  private protocolStartDate: Date;
  private protocolEndDate: Date;
  private activeDayRatio: number;
  private entriesPerDayMin: number;
  private entriesPerDayMax: number;
  private entriesPerDayWeights: number[];
  private sortOrder: "asc" | "desc";

  constructor(config: ProtocolGeneratorConfig) {
    super(config);
    this.protocolStartDate = config.protocolStartDate;
    this.protocolEndDate = config.protocolEndDate ?? new Date();
    this.activeDayRatio = config.activeDayRatio ?? 0.15;
    this.entriesPerDayMin = config.entriesPerDay?.min ?? 1;
    this.entriesPerDayMax = config.entriesPerDay?.max ?? 4;
    this.entriesPerDayWeights = config.entriesPerDay?.weights ?? [40, 35, 20, 5];
    this.sortOrder = config.sortOrder ?? "asc";
  }

  /**
   * Generate a single entry (required by BaseGenerator).
   * For protocol mode, prefer using generateDay() or generateProtocol().
   */
  generate(): GeneratedEntry | null {
    return this.generateEntry(new Date());
  }

  /**
   * Generate entries for a specific day.
   */
  generateDay(date: Date): ProtocolDay | null {
    const entryCount = this.pickEntryCount();
    const entries: ProtocolEntry[] = [];

    for (let i = 0; i < entryCount; i++) {
      const entry = this.generateEntry(date);
      if (!entry) break;
      entries.push(entry);
    }

    if (entries.length === 0) return null;

    return { date, entries };
  }

  /**
   * Generate multiple days (for infinite scroll).
   * Returns days in sort order (asc or desc based on config).
   */
  generateDays(count: number, continueFrom?: Date): ProtocolDay[] {
    const days: ProtocolDay[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const step = this.sortOrder === "asc" ? dayMs : -dayMs;

    let currentDate: Date;
    if (continueFrom) {
      currentDate = new Date(continueFrom.getTime() + step);
    } else {
      currentDate =
        this.sortOrder === "asc"
          ? new Date(this.protocolStartDate)
          : new Date(this.protocolEndDate);
    }

    let attempts = 0;
    const maxAttempts = count * 100;

    while (days.length < count && attempts < maxAttempts) {
      // Check bounds based on direction
      if (this.sortOrder === "asc" && currentDate > this.protocolEndDate) break;
      if (this.sortOrder === "desc" && currentDate < this.protocolStartDate)
        break;

      if (Math.random() < this.activeDayRatio) {
        const day = this.generateDay(currentDate);
        if (day) {
          days.push(day);
        }
      }

      currentDate = new Date(currentDate.getTime() + step);
      attempts++;
    }

    return days;
  }

  /**
   * Generate the complete protocol.
   * Always returns days in ascending order (for book output).
   */
  generateProtocol(): Protocol {
    const days: ProtocolDay[] = [];
    let currentDate = new Date(this.protocolStartDate);

    while (currentDate <= this.protocolEndDate) {
      if (Math.random() < this.activeDayRatio) {
        const day = this.generateDay(currentDate);
        if (day) {
          days.push(day);
        }
      }

      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

      if (this.getRemainingProductCount() === 0) break;
    }

    return {
      startDate: this.protocolStartDate,
      endDate: this.protocolEndDate,
      days,
    };
  }

  private generateEntry(eatenDate: Date): ProtocolEntry | null {
    const product = this.getUnusedProduct();
    if (!product) return null;

    const expiryDate = this.generateExpiryForEatenDate(eatenDate);
    const blockedRatings = this.recencyTracker?.get("ratings");
    const rating = getRating(this.ratings, product, blockedRatings);

    const variant = pickVariant(product, this.recencyTracker);
    const text = this.formatEntry(product, expiryDate, rating, variant);

    this.trackRecency(product, rating, variant);

    return {
      text,
      product,
      expiryDate,
      eatenDate,
      rating,
    };
  }

  /**
   * Generate an expiry date that makes sense for the given eaten date.
   */
  private generateExpiryForEatenDate(eatenDate: Date): ExpiryDate {
    const eatenMonths = eatenDate.getFullYear() * 12 + eatenDate.getMonth();
    const maxExpiryMonths = eatenMonths - this.minMonthsAfterExpiry;

    const startMonths =
      this.dateRange.startYear * 12 + (this.dateRange.startMonth - 1);
    const endMonths = Math.min(
      this.dateRange.endYear * 12 + (this.dateRange.endMonth - 1),
      maxExpiryMonths,
    );

    if (startMonths > endMonths) {
      return {
        year: this.dateRange.startYear,
        month: this.dateRange.startMonth,
      };
    }

    const randomMonths = randomFromRange(startMonths, endMonths);
    const year = Math.floor(randomMonths / 12);
    const month = (randomMonths % 12) + 1;
    return { year, month };
  }

  private pickEntryCount(): number {
    const counts = Array.from(
      { length: this.entriesPerDayMax - this.entriesPerDayMin + 1 },
      (_, i) => this.entriesPerDayMin + i,
    );
    const weights = this.entriesPerDayWeights.slice(0, counts.length);

    while (weights.length < counts.length) {
      weights.push(5);
    }

    return weightedRandom(counts, weights);
  }

  /**
   * Format entry WITHOUT "Gegessen am" - the date comes from the day header.
   */
  private formatEntry(
    product: {
      name: string;
      brand: string | null;
      genericName: string | null;
    },
    expiryDate: ExpiryDate,
    rating: string,
    variant: EntryVariant,
  ): string {
    const expiryStr = formatExpiryDate(expiryDate);

    switch (variant) {
      case "with-brand": {
        const productName = product.genericName
          ? weightedRandom([product.genericName, product.name], [70, 30])
          : product.name;
        return `${this.em(productName)} (${product.brand!}). Abgelaufen ${expiryStr}. ${rating}`;
      }

      case "name-only":
        return `${this.em(product.name)}. Abgelaufen ${expiryStr}. ${rating}`;

      case "short": {
        const now = new Date();
        const relativeWeeks = formatWeeksDiff(expiryDate, now);
        const relativeMonths = formatRelativeExpiry(expiryDate, now);
        const relative =
          relativeWeeks || relativeMonths || `Abgelaufen ${expiryStr}`;
        return `${this.em(product.name)}. ${relative}. ${rating}`;
      }

      default:
        return `${this.em(product.name)}. Abgelaufen ${expiryStr}. ${rating}`;
    }
  }
}
