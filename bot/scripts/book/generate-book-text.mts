import fs from "node:fs";
import path from "node:path";

import {
  calculateValidExpiryRange,
  type GeneratedEntry,
  loadProducts,
  loadRatings,
  StandardEntryGenerator,
} from "../../lib";
import { RecencyTracker } from "../../lib/recency";

const main = async () => {
  const options = {
    pages: 100,
    entriesPerPage: 5,
    dateRange: calculateValidExpiryRange(2006, 24),
    italic: true,
  };
  const totalEntries = options.pages * options.entriesPerPage;

  console.log("Book Generator");
  console.log("==============");
  console.log(`Pages: ${options.pages}`);
  console.log(`Entries per page: ${options.entriesPerPage}`);
  console.log(`Total entries: ${totalEntries}`);
  console.log();

  // Load data
  const productsPath = new URL("../../assets/products.csv", import.meta.url)
    .pathname;
  const ratingsPath = new URL("../../assets/ratings.csv", import.meta.url)
    .pathname;

  const products = await loadProducts(productsPath);
  const ratings = await loadRatings(ratingsPath);

  console.log(
    `Loaded ${products.length} products and ${ratings.length} ratings`
  );

  // Generate all entries with recency tracking
  const recencyTracker = new RecencyTracker();

  const generator = new StandardEntryGenerator({
    products,
    ratings,
    dateRange: options.dateRange,
    italic: options.italic,
    recencyTracker,
  });

  const allEntries: GeneratedEntry[] = [];

  for (let i = 0; i < totalEntries; i++) {
    const entry = generator.generate();
    if (!entry) break;
    allEntries.push(entry);

    // Progress update every 100 entries
    if ((i + 1) % 100 === 0) {
      console.log(`Generated ${i + 1}/${totalEntries} entries...`);
    }
  }

  console.log(`Generated ${allEntries.length} entries`);

  // Split into pages
  const pages: string[] = [];
  for (let i = 0; i < allEntries.length; i += options.entriesPerPage) {
    const pageEntries = allEntries.slice(i, i + options.entriesPerPage);
    pages.push(pageEntries.map((e) => e.text).join("\n\n"));
  }

  const bookText = pages.join("\n\n---\n\n");

  // Save output
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const outputDir = path.join(scriptDir, "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "book.md");
  fs.writeFileSync(outputPath, bookText, "utf-8");

  console.log();
  console.log(
    `Generated ${allEntries.length} entries across ${pages.length} pages`
  );
  console.log(`Saved to ${outputPath}`);
  console.log(
    `File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`
  );
};

main().catch(console.error);
