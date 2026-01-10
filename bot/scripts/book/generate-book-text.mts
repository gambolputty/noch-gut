import fs from "node:fs";
import path from "node:path";

import {
  calculateValidExpiryRange,
  formatProtocolDateRange,
  formatProtocolDayHeader,
  loadProducts,
  loadRatings,
  type Protocol,
  ProtocolGenerator,
} from "../../lib";
import { RecencyTracker } from "../../lib/recency";

/**
 * Format a protocol as markdown book text.
 * Groups entries by day with date headers.
 */
const formatProtocolAsBook = (protocol: Protocol): string => {
  const { start, end } = formatProtocolDateRange(
    protocol.startDate,
    protocol.endDate,
  );

  const lines: string[] = [
    "# Protokoll",
    "",
    `Beginn: ${start}`,
    `Ende: ${end}`,
    "",
  ];

  for (const day of protocol.days) {
    const dayHeader = formatProtocolDayHeader(day.date);
    const dayEntries = day.entries.map((e) => e.text);
    lines.push(`**${dayHeader}**\n\n${dayEntries.join("\n\n")}`);
    lines.push("");
  }

  return lines.join("\n");
};

const main = async () => {
  const options = {
    // Protocol time range
    protocolStartDate: new Date(2016, 0, 1), // 1. Januar 2016
    protocolEndDate: new Date(), // heute
    // How often entries appear
    activeDayRatio: 0.02, // ~7 days per year with entries
    entriesPerDay: { min: 1, max: 4, weights: [40, 35, 20, 5] },
    // Expiry date range
    dateRange: calculateValidExpiryRange(2006, 24),
    italic: true,
  };

  console.log("Book Generator (Protocol Format)");
  console.log("=================================");
  console.log(`Protocol: ${options.protocolStartDate.toLocaleDateString("de-DE")} - ${options.protocolEndDate.toLocaleDateString("de-DE")}`);
  console.log(`Active day ratio: ${(options.activeDayRatio * 100).toFixed(1)}%`);
  console.log();

  // Load data
  const productsPath = new URL("../../assets/products.csv", import.meta.url)
    .pathname;
  const ratingsPath = new URL("../../assets/ratings.csv", import.meta.url)
    .pathname;

  const products = await loadProducts(productsPath);
  const ratings = await loadRatings(ratingsPath);

  console.log(
    `Loaded ${products.length} products and ${ratings.length} ratings`,
  );

  // Generate protocol
  const recencyTracker = new RecencyTracker();

  const generator = new ProtocolGenerator({
    products,
    ratings,
    dateRange: options.dateRange,
    protocolStartDate: options.protocolStartDate,
    protocolEndDate: options.protocolEndDate,
    activeDayRatio: options.activeDayRatio,
    entriesPerDay: options.entriesPerDay,
    italic: options.italic,
    recencyTracker,
  });

  console.log("Generating protocol...");
  const protocol = generator.generateProtocol();

  const totalEntries = protocol.days.reduce(
    (sum, day) => sum + day.entries.length,
    0,
  );
  console.log(
    `Generated ${totalEntries} entries across ${protocol.days.length} days`,
  );

  // Format as book
  const bookText = formatProtocolAsBook(protocol);

  // Save output
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const outputDir = path.join(scriptDir, "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "book.md");
  fs.writeFileSync(outputPath, bookText, "utf-8");

  console.log();
  console.log(`Saved to ${outputPath}`);
  console.log(
    `File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`,
  );
};

main().catch(console.error);
