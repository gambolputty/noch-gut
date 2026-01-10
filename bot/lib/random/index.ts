const buffer = new ArrayBuffer(8);
const ints = new Int8Array(buffer);
const view = new DataView(buffer);

// Seeded random state (null = use crypto random)
let seededState: number | null = null;

/**
 * Set a seed for reproducible random results.
 * Call with null to return to crypto random.
 */
export const setSeed = (seed: number | null): void => {
  seededState = seed;
};

const engine = (): number => {
  // Use seeded random if seed is set
  if (seededState !== null) {
    seededState = (seededState * 1103515245 + 12345) & 0x7fffffff;
    return seededState / 0x7fffffff;
  }

  // Default: crypto random
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
