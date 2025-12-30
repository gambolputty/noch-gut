import { randomFromRange } from "../random";

export type DateRange = {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
};

export type ExpiryDate = {
  year: number;
  month: number;
};

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export const dateToMonths = (year: number, month: number): number => {
  return year * 12 + month;
};

export const monthsToDate = (totalMonths: number): ExpiryDate => {
  const year = Math.floor((totalMonths - 1) / 12);
  const month = ((totalMonths - 1) % 12) + 1;
  return { year, month };
};

export const generateExpiryDate = (range: DateRange): ExpiryDate => {
  const startMonths = dateToMonths(range.startYear, range.startMonth);
  const endMonths = dateToMonths(range.endYear, range.endMonth);
  const randomMonths = randomFromRange(startMonths, endMonths);
  return monthsToDate(randomMonths);
};

/**
 * Calculate a valid expiry date range where the end date is constrained
 * so that eaten dates (expiry + minMonthsAfterExpiry) never fall in the future.
 */
export const calculateValidExpiryRange = (
  startYear: number,
  minMonthsAfterExpiry: number,
): DateRange => {
  const now = new Date();
  const nowMonths = now.getFullYear() * 12 + now.getMonth() + 1;

  // Max expiry = now - minOffset (so eaten date is never in future)
  const maxExpiryMonths = nowMonths - minMonthsAfterExpiry;
  const maxExpiry = monthsToDate(maxExpiryMonths);

  return {
    startYear,
    startMonth: 1,
    endYear: maxExpiry.year,
    endMonth: maxExpiry.month,
  };
};

export const formatExpiryDate = (
  date: ExpiryDate,
  options?: { yearOnly?: boolean },
): string => {
  const currentYear = new Date().getFullYear();
  const yearsAgo = currentYear - date.year;

  // Very old items (> 10 years) just show the year
  if (yearsAgo > 10 || options?.yearOnly) {
    return `${date.year}`;
  }

  // Format as MM.YYYY
  const monthStr = date.month.toString().padStart(2, "0");
  return `${monthStr}.${date.year}`;
};

export const formatEatenDate = (date: Date): string => {
  const day = date.getDate();
  const month = MONTHS_DE[date.getMonth()];
  const year = date.getFullYear();
  return `${day}. ${month} ${year}`;
};

export const formatRelativeExpiry = (
  expiry: ExpiryDate,
  eaten: Date,
): string | null => {
  const eatenYear = eaten.getFullYear();
  const eatenMonth = eaten.getMonth() + 1;

  const expiryMonths = dateToMonths(expiry.year, expiry.month);
  const eatenMonths = dateToMonths(eatenYear, eatenMonth);

  const diffMonths = eatenMonths - expiryMonths;

  if (diffMonths < 1) return null;
  if (diffMonths === 1) return "Einen Monat drüber";
  if (diffMonths === 2) return "Zwei Monate drüber";
  if (diffMonths === 3) return "Drei Monate drüber";
  if (diffMonths < 6) return `${diffMonths} Monate drüber`;
  if (diffMonths < 12) return "Ein halbes Jahr drüber";
  if (diffMonths < 18) return "Ein Jahr drüber";
  if (diffMonths < 24) return "Über ein Jahr drüber";

  const years = Math.floor(diffMonths / 12);
  return `${years} Jahre drüber`;
};


/**
 * Generate an eaten date based on expiry date and minimum offset.
 * The eaten date will be between minMonths after expiry and now.
 *
 * Requires: Use calculateValidExpiryRange() to ensure expiry + minMonths <= now.
 */
export const generateEatenDate = (
  expiry: ExpiryDate,
  minMonthsAfterExpiry: number,
): Date => {
  const now = new Date();
  const nowMonths = now.getFullYear() * 12 + now.getMonth();
  const expiryMonths = expiry.year * 12 + (expiry.month - 1);

  const minEatenMonths = expiryMonths + minMonthsAfterExpiry;
  const targetMonths = randomFromRange(minEatenMonths, nowMonths);

  const year = Math.floor(targetMonths / 12);
  const month = targetMonths % 12;

  // For current month, limit day to today
  if (year === now.getFullYear() && month === now.getMonth()) {
    const day = randomFromRange(1, Math.min(28, now.getDate()));
    return new Date(year, month, day);
  }

  const day = randomFromRange(1, 28);
  return new Date(year, month, day);
};

// Calculate weeks difference for short-form entries
export const formatWeeksDiff = (
  expiry: ExpiryDate,
  eaten: Date,
): string | null => {
  // Approximate: assume expiry is end of that month
  const expiryDate = new Date(expiry.year, expiry.month - 1, 28);
  const diffMs = eaten.getTime() - expiryDate.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

  if (diffWeeks < 1) return null;
  if (diffWeeks === 1) return "Eine Woche drüber";
  if (diffWeeks === 2) return "Zwei Wochen drüber";
  if (diffWeeks === 3) return "Drei Wochen drüber";
  if (diffWeeks === 4) return "Vier Wochen drüber";

  return null; // Use month format instead
};
