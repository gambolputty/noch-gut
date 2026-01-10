import { weightedRandom } from "../random";
import type { Product } from "./product-loader";
import { loadFile, parseCsv } from "./utils";

export type Rating = {
  text: string;
  weight: number;
  categories: string[];
};

type RawRating = {
  rating: string;
  weight: string;
  categories: string;
};

const parseRatings = (rawRatings: RawRating[]): Rating[] => {
  return rawRatings.map((raw) => ({
    text: raw.rating,
    weight: parseInt(raw.weight, 10) || 1,
    categories: raw.categories
      ? raw.categories.split("|").map((s) => s.trim())
      : [],
  }));
};

export const loadRatings = async (csvUrl: URL | string): Promise<Rating[]> => {
  const csvContent = await loadFile(csvUrl);
  const rawRatings = parseCsv<RawRating>(csvContent);
  return parseRatings(rawRatings);
};

export const getApplicableRatings = (
  ratings: Rating[],
  product: Product
): Rating[] => {
  return ratings.filter((rating) => {
    if (rating.categories.length === 0) return true;
    return rating.categories.some((ratingCat) =>
      product.categories.some((productCat) => productCat.includes(ratingCat))
    );
  });
};

export const pickWeightedRating = (
  ratings: Rating[],
  blocked?: Set<string>
): Rating => {
  const available = blocked
    ? ratings.filter((r) => !blocked.has(r.text))
    : ratings;

  const pool = available.length > 0 ? available : ratings;
  const weights = pool.map((r) => r.weight);
  return weightedRandom(pool, weights);
};

export const getRating = (
  ratings: Rating[],
  product: Product,
  blocked?: Set<string>
): string => {
  const applicable = getApplicableRatings(ratings, product);
  const rating = pickWeightedRating(applicable, blocked);
  return rating.text;
};
