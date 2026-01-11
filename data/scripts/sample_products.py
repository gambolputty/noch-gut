#!/usr/bin/env python3
"""
Sample 1/3 of products.csv for the web application.

This creates a smaller CSV file to reduce browser load times.
"""

import csv
import random
from pathlib import Path

# Paths relative to repo root
REPO_ROOT = Path(__file__).parent.parent.parent
INPUT_FILE = REPO_ROOT / "bot" / "assets" / "products.csv"
OUTPUT_FILE = REPO_ROOT / "web" / "public" / "products.csv"

SAMPLE_RATIO = 1 / 8
RANDOM_SEED = 42  # For reproducibility


def main():
    random.seed(RANDOM_SEED)

    # Read all products
    with open(INPUT_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        if fieldnames is None:
            raise ValueError("CSV file has no headers")
        products = list(reader)

    total = len(products)
    sample_size = int(total * SAMPLE_RATIO)

    # Random sample
    sampled = random.sample(products, sample_size)

    # Ensure output directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Write sampled products
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sampled)

    print(f"Sampled {sample_size} of {total} products ({SAMPLE_RATIO:.0%})")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Size: {OUTPUT_FILE.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
