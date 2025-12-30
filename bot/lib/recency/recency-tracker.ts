import { RecencySet } from "./recency-set";

export type BinName = "ratings" | "variants" | "genericNames" | "brands";

export type BinConfig = {
  maxItems: number;
};

export type RecencyConfig = {
  [K in BinName]: BinConfig;
};

const DEFAULT_CONFIG: RecencyConfig = {
  ratings: { maxItems: 25 },
  variants: { maxItems: 3 },
  genericNames: { maxItems: 12 },
  brands: { maxItems: 15 },
};

/**
 * Tracks recently used elements across multiple bins.
 * Each bin has its own FIFO set with configurable max size.
 */
export class RecencyTracker {
  private readonly bins: Map<BinName, RecencySet>;
  private readonly config: RecencyConfig;

  constructor(config?: Partial<RecencyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bins = new Map();
    this.initBins();
  }

  private initBins(): void {
    for (const [name, binConfig] of Object.entries(this.config)) {
      this.bins.set(name as BinName, new RecencySet(binConfig.maxItems));
    }
  }

  get(bin: BinName): RecencySet {
    const set = this.bins.get(bin);
    if (!set) {
      throw new Error(`Unknown bin: ${bin}`);
    }
    return set;
  }

  add(bin: BinName, value: string): void {
    this.get(bin).add(value);
  }

  has(bin: BinName, value: string): boolean {
    return this.get(bin).has(value);
  }

  hasAny(bin: BinName, values: string[]): boolean {
    return this.get(bin).hasAny(values);
  }

  reset(): void {
    this.bins.clear();
    this.initBins();
  }

  getConfig(): RecencyConfig {
    return this.config;
  }

  getBinNames(): BinName[] {
    return Array.from(this.bins.keys());
  }

  /**
   * Load bin contents from a record of arrays.
   * Used for restoring state from storage.
   */
  loadFromData(data: Partial<Record<BinName, string[]>>): void {
    for (const [binName, values] of Object.entries(data)) {
      const bin = this.bins.get(binName as BinName);
      if (bin && values) {
        for (const value of values) {
          bin.add(value);
        }
      }
    }
  }

  /**
   * Export bin contents as a record of arrays.
   * Used for persisting state to storage.
   */
  toData(): Record<BinName, string[]> {
    const data: Record<string, string[]> = {};
    for (const [name, set] of this.bins.entries()) {
      data[name] = Array.from(set);
    }
    return data as Record<BinName, string[]>;
  }
}
