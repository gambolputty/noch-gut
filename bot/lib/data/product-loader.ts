import { loadFile, parseCsv } from "./utils";

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

const parseProducts = (rawProducts: RawProduct[]): Product[] => {
  return rawProducts.map((raw) => ({
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
};

export const loadProducts = async (
  csvUrl: URL | string
): Promise<Product[]> => {
  const csvContent = await loadFile(csvUrl);
  const rawProducts = parseCsv<RawProduct>(csvContent);
  return parseProducts(rawProducts);
};
