import fs from "node:fs";

import Papa from "papaparse";

import { weightedRandom } from "../random";
import type { Product } from "./product-loader";

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

export const loadRatings = async (csvPath: string): Promise<Rating[]> => {
  const csvContent = fs.readFileSync(csvPath, "utf-8");

  return new Promise((resolve, reject) => {
    Papa.parse<RawRating>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const ratings: Rating[] = results.data.map((raw) => ({
          text: raw.rating,
          weight: parseInt(raw.weight, 10) || 1,
          categories: raw.categories
            ? raw.categories.split("|").map((s) => s.trim())
            : [],
        }));
        resolve(ratings);
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
};

export const getApplicableRatings = (
  ratings: Rating[],
  product: Product,
): Rating[] => {
  return ratings.filter((rating) => {
    if (rating.categories.length === 0) return true;
    // Match if any product category contains the rating category as substring
    // e.g., "en:biscuits" matches "en:biscuits-and-cakes"
    return rating.categories.some((ratingCat) =>
      product.categories.some((productCat) => productCat.includes(ratingCat)),
    );
  });
};

export const pickWeightedRating = (
  ratings: Rating[],
  blocked?: Set<string>,
): Rating => {
  const available = blocked
    ? ratings.filter((r) => !blocked.has(r.text))
    : ratings;

  // Fallback to all ratings if everything is blocked
  const pool = available.length > 0 ? available : ratings;
  const weights = pool.map((r) => r.weight);
  return weightedRandom(pool, weights);
};

export const getRating = (
  ratings: Rating[],
  product: Product,
  blocked?: Set<string>,
): string => {
  const applicable = getApplicableRatings(ratings, product);
  const rating = pickWeightedRating(applicable, blocked);
  return rating.text;
};
