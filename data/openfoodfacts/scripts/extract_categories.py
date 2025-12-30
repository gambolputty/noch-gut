#!/usr/bin/env python3
"""Extract all categories from Open Food Facts JSONL and save to text file.

Usage:
    uv run python scripts/extract_categories.py --data openfoodfacts-products.jsonl.gz -o categories.txt
"""

import argparse
import gzip
from collections import Counter
from pathlib import Path

import orjson
from tqdm import tqdm

try:
    import isal.igzip as igzip
    HAS_ISAL = True
except ImportError:
    HAS_ISAL = False


def extract_categories(jsonl_path: Path, output_path: Path, germany_only: bool = True):
    """Extract all categories from JSONL file."""
    categories = Counter()
    products_processed = 0
    products_with_cats = 0

    # Open file
    if jsonl_path.suffix == ".gz":
        open_func = igzip.open if HAS_ISAL else gzip.open
    else:
        open_func = open

    file_size = jsonl_path.stat().st_size

    print(f"Extracting categories from {jsonl_path.name}...")
    if germany_only:
        print("Filtering for German products only.")

    with open_func(jsonl_path, "rb") as f:
        with tqdm(total=file_size, unit="B", unit_scale=True) as pbar:
            for raw_line in f:
                line: bytes = raw_line  # type: ignore[assignment]
                pbar.update(len(line))

                if not line.strip():
                    continue

                # Fast pre-filter for Germany
                if germany_only and b"germany" not in line.lower():
                    continue

                try:
                    product = orjson.loads(line)
                except orjson.JSONDecodeError:
                    continue

                # Check for German market
                if germany_only:
                    countries = product.get("countries_tags", [])
                    if not any("germany" in c.lower() or "deutschland" in c.lower() for c in countries):
                        continue

                products_processed += 1

                # Extract categories
                cats = product.get("categories_tags", [])
                if cats:
                    products_with_cats += 1
                    for cat in cats:
                        # Normalize: lowercase
                        cat = cat.lower().strip()
                        categories[cat] += 1

    print(f"\nProcessed {products_processed:,} products")
    print(f"Products with categories: {products_with_cats:,} ({products_with_cats/products_processed*100:.1f}%)")
    print(f"Unique categories: {len(categories):,}")

    # Write to file
    with open(output_path, "w") as f:
        f.write(f"# Categories from {jsonl_path.name}\n")
        f.write(f"# Total products: {products_processed:,}\n")
        f.write(f"# Products with categories: {products_with_cats:,}\n")
        f.write(f"# Unique categories: {len(categories):,}\n")
        f.write("#\n")
        f.write("# Format: count | category\n")
        f.write("#" + "=" * 60 + "\n\n")

        for cat, count in categories.most_common():
            f.write(f"{count:6d} | {cat}\n")

    print(f"\nSaved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Extract categories from Open Food Facts JSONL")
    parser.add_argument("--data", "-d", type=Path, required=True, help="Path to JSONL file")
    parser.add_argument("--output", "-o", type=Path, default=Path(__file__).parent / "categories.txt", help="Output file")
    parser.add_argument("--all-countries", action="store_true", help="Include all countries, not just Germany")

    args = parser.parse_args()

    if not args.data.exists():
        print(f"Error: {args.data} not found")
        return 1

    extract_categories(args.data, args.output, germany_only=not args.all_countries)
    return 0


if __name__ == "__main__":
    exit(main())
