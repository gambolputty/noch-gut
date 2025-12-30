import {
  calculateValidExpiryRange,
  loadProducts,
  loadRatings,
  StandardEntryGenerator,
} from "./lib";

const PRODUCTS_PATH = new URL("./assets/products.csv", import.meta.url)
  .pathname;
const RATINGS_PATH = new URL("./assets/ratings.csv", import.meta.url).pathname;

const main = async () => {
  console.log("Loading data...");
  const products = await loadProducts(PRODUCTS_PATH);
  const ratings = await loadRatings(RATINGS_PATH);

  console.log(
    `Loaded ${products.length} products and ${ratings.length} ratings\n`
  );

  const generator = new StandardEntryGenerator({
    products,
    ratings,
    dateRange: calculateValidExpiryRange(2006, 24),
  });

  // Generate a few entries for testing
  console.log("Generated entries:\n");
  for (let i = 0; i < 10; i++) {
    const entry = generator.generate();
    if (!entry) break;
    console.log(entry.text);
    console.log();
  }

  console.log(`\nRemaining products: ${generator.getRemainingProductCount()}`);
};

main().catch(console.error);
