import fs from "node:fs";

import Papa from "papaparse";

export type Product = {
  name: string;
  brand: string | null;
  quantity: string | null;
  genericName: string | null;
  imageUrl: string | null;
  categories: string[];
  labels: string[];
  allergens: string[];
  nutriscore: string | null;
  nova_group: number | null;
  ecoscore: string | null;
  origins: string | null;
};

type RawProduct = {
  name: string;
  brand: string;
  quantity: string;
  generic_name: string;
  image_url: string;
  categories: string;
  labels: string;
  allergens: string;
  nutriscore: string;
  nova_group: string;
  ecoscore: string;
  origins: string;
};

const parseArrayField = (value: string): string[] => {
  if (!value || value.trim() === "") return [];
  return value.split("|").map((s) => s.trim());
};

const parseStringField = (value: string): string | null => {
  if (!value || value.trim() === "") return null;
  return value.trim();
};

const parseIntField = (value: string): number | null => {
  if (!value || value.trim() === "") return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
};

export const loadProducts = async (csvPath: string): Promise<Product[]> => {
  const csvContent = fs.readFileSync(csvPath, "utf-8");

  return new Promise((resolve, reject) => {
    Papa.parse<RawProduct>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const products: Product[] = results.data.map((raw) => ({
          name: raw.name,
          brand: parseStringField(raw.brand),
          quantity: parseStringField(raw.quantity),
          genericName: parseStringField(raw.generic_name),
          imageUrl: parseStringField(raw.image_url),
          categories: parseArrayField(raw.categories),
          labels: parseArrayField(raw.labels),
          allergens: parseArrayField(raw.allergens),
          nutriscore: parseStringField(raw.nutriscore),
          nova_group: parseIntField(raw.nova_group),
          ecoscore: parseStringField(raw.ecoscore),
          origins: parseStringField(raw.origins),
        }));
        resolve(products);
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
};

export const loadProductsFromUrl = async (csvUrl: URL): Promise<Product[]> => {
  return loadProducts(csvUrl.pathname);
};
