/**
 * FIFO-based set with automatic truncation.
 * When maxItems is exceeded, oldest entries are removed first.
 */
export class RecencySet extends Set<string> {
  private readonly maxItems: number;

  constructor(maxItems: number, initialValues?: string[]) {
    super();
    this.maxItems = maxItems;

    if (initialValues) {
      for (const value of initialValues) {
        super.add(value);
      }
      this.truncate();
    }
  }

  add(value: string): this {
    super.add(value);
    this.truncate();
    return this;
  }

  addMany(values: string[]): void {
    for (const value of values) {
      this.add(value);
    }
  }

  hasAny(values: string[]): boolean {
    for (const value of values) {
      if (this.has(value)) {
        return true;
      }
    }
    return false;
  }

  private truncate(): void {
    while (this.size > this.maxItems) {
      const oldest = this.values().next().value;
      if (oldest !== undefined) {
        this.delete(oldest);
      }
    }
  }

  getMaxItems(): number {
    return this.maxItems;
  }
}
