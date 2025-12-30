const buffer = new ArrayBuffer(8);
const ints = new Int8Array(buffer);
const view = new DataView(buffer);

const engine = (): number => {
  try {
    globalThis.crypto.getRandomValues(ints);
    ints[7] = 63;
    ints[6] |= 0xf0;
    return view.getFloat64(0, true) - 1;
  } catch (_e) {
    return Math.random();
  }
};

export const randomFromRange = (min: number, max: number): number => {
  return Math.floor(engine() * (max - min + 1)) + min;
};

export const randomElement = <T>(array: T[]): T => {
  return array[Math.floor(engine() * array.length)];
};

export const weightedRandom = <T>(items: T[], weights: number[]): T => {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = engine() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }

  return items[items.length - 1];
};

export const shuffle = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(engine() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Seeded random for reproducible results
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  fromRange(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  element<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
