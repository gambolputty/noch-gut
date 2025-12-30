/**
 * Node.js file-based storage for RecencyTracker.
 * Do not import this in browser environments.
 */

import fs from "node:fs";
import path from "node:path";

import type { BinName, RecencyTracker } from "./recency-tracker";

/**
 * Load recency data from text files in a directory.
 * Each bin is stored as a separate file (e.g., ratings.txt).
 * Lines are separated by newlines.
 */
export async function loadRecencyFromFiles(
  tracker: RecencyTracker,
  directory: string,
): Promise<void> {
  if (!fs.existsSync(directory)) {
    return;
  }

  const binNames = tracker.getBinNames();
  const data: Partial<Record<BinName, string[]>> = {};

  for (const binName of binNames) {
    const filePath = path.join(directory, `${binName}.txt`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const values = content.trim().split("\n").filter(Boolean);
      data[binName] = values;
    }
  }

  tracker.loadFromData(data);
}

/**
 * Save recency data to text files in a directory.
 * Creates the directory if it doesn't exist.
 */
export async function saveRecencyToFiles(
  tracker: RecencyTracker,
  directory: string,
): Promise<void> {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const data = tracker.toData();

  for (const [binName, values] of Object.entries(data)) {
    const filePath = path.join(directory, `${binName}.txt`);
    fs.writeFileSync(filePath, values.join("\n"));
  }
}
