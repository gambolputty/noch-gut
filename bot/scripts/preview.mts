import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  calculateValidExpiryRange,
  loadProducts,
  loadRatings,
  StandardEntryGenerator,
} from "../lib";
import { RecencyTracker } from "../lib/recency";
import { loadRecencyFromFiles } from "../lib/recency/storage";

const RECENCY_DIR = fileURLToPath(new URL("../.recency", import.meta.url));

const main = async () => {
  const productsPath = new URL("../assets/products.csv", import.meta.url)
    .pathname;
  const ratingsPath = new URL("../assets/ratings.csv", import.meta.url)
    .pathname;

  const products = await loadProducts(productsPath);
  const ratings = await loadRatings(ratingsPath);

  const recencyTracker = new RecencyTracker();
  await loadRecencyFromFiles(recencyTracker, RECENCY_DIR);

  const generator = new StandardEntryGenerator({
    products,
    ratings,
    dateRange: calculateValidExpiryRange(2006, 24),
    recencyTracker,
  });

  const entry = generator.generate();
  if (!entry) {
    console.error("No products available");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("PREVIEW (not posted)");
  console.log("=".repeat(60));
  console.log();
  console.log(entry.text);
  console.log();

  if (entry.product.imageUrl) {
    console.log("-".repeat(60));
    console.log("Image URL:", entry.product.imageUrl);
    console.log();

    // Open image in browser on macOS
    if (process.platform === "darwin") {
      exec(`open "${entry.product.imageUrl}"`, (error) => {
        if (error) {
          console.warn("Could not open image in browser:", error.message);
        }
      });
    } else {
      console.log("(Open the URL above to view the image)");
    }
  } else {
    console.log("-".repeat(60));
    console.log("No image available for this product");
  }

  console.log();
  console.log("=".repeat(60));
  console.log("Product details:");
  console.log("  Name:", entry.product.name);
  console.log("  Brand:", entry.product.brand || "(none)");
  console.log("  Generic:", entry.product.genericName || "(none)");
  console.log("  Categories:", entry.product.categories.slice(0, 3).join(", ") || "(none)");
  console.log("=".repeat(60));
};

main().catch(console.error);
