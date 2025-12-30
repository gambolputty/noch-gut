import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  calculateValidExpiryRange,
  loadProducts,
  loadRatings,
  StandardEntryGenerator,
} from "../lib";
import {
  createBlueskyPoster,
  createMastodonPoster,
  type Poster,
} from "../lib/posting";
import { RecencyTracker } from "../lib/recency";
import {
  loadRecencyFromFiles,
  saveRecencyToFiles,
} from "../lib/recency/storage";

const RECENCY_DIR = fileURLToPath(new URL("../.recency", import.meta.url));

const PLATFORMS: Record<string, () => Poster> = {
  bluesky: createBlueskyPoster,
  mastodon: createMastodonPoster,
};

interface GeneratedPost {
  text: string;
  imageUrl: string | null;
  imageAlt: string;
}

const buildImageAlt = (product: { name: string; brand: string | null }): string => {
  if (product.brand) {
    return `Produktbild: ${product.name} von ${product.brand}`;
  }
  return `Produktbild: ${product.name}`;
};

const generateEntry = async (
  recencyTracker: RecencyTracker
): Promise<GeneratedPost> => {
  const productsPath = new URL("../assets/products.csv", import.meta.url)
    .pathname;
  const ratingsPath = new URL("../assets/ratings.csv", import.meta.url)
    .pathname;

  const products = await loadProducts(productsPath);
  const ratings = await loadRatings(ratingsPath);

  const generator = new StandardEntryGenerator({
    products,
    ratings,
    dateRange: calculateValidExpiryRange(2006, 24),
    recencyTracker,
  });

  const entry = generator.generate();
  if (!entry) throw new Error("No products available");

  return {
    text: entry.text,
    imageUrl: entry.product.imageUrl,
    imageAlt: buildImageAlt(entry.product),
  };
};

const main = async () => {
  const { positionals } = parseArgs({
    allowPositionals: true,
  });

  const platformNames = positionals.length > 0 ? positionals : [];
  const invalidPlatforms = platformNames.filter((p) => !PLATFORMS[p]);

  if (platformNames.length === 0 || invalidPlatforms.length > 0) {
    console.error(`Usage: post.mts <platform> [platform2] ...`);
    console.error(`Available platforms: ${Object.keys(PLATFORMS).join(", ")}`);
    if (invalidPlatforms.length > 0) {
      console.error(`Unknown platforms: ${invalidPlatforms.join(", ")}`);
    }
    process.exit(1);
  }

  const recencyTracker = new RecencyTracker();
  await loadRecencyFromFiles(recencyTracker, RECENCY_DIR);

  console.log("Generating entry...");
  const { text, imageUrl, imageAlt } = await generateEntry(recencyTracker);
  console.log(`\n${text}\n`);
  if (imageUrl) {
    console.log(`Image: ${imageUrl}\n`);
  }

  for (const platformName of platformNames) {
    const poster = PLATFORMS[platformName]();
    console.log(`Posting to ${poster.name}...`);
    try {
      const result = await poster.post(text, {
        imageUrl: imageUrl ?? undefined,
        imageAlt,
      });
      console.log(`  ✓ ${result.url}`);
    } catch (error) {
      console.error(`  ✗ Failed:`, error);
    }
  }

  await saveRecencyToFiles(recencyTracker, RECENCY_DIR);
};

main().catch(console.error);
