# noch-gut

## Project Overview

A rule-based text generator for conceptual prose. The first-person narrator documents what they eat – exclusively products past their best-before date. Laconic style. No justification, only protocol.

## Architecture

- `data/` - Data pipelines (shared venv, multiple sources)
  - `src/openfoodfacts/` - Open Food Facts extraction code
  - `src/wikidata_extinct/` - Wikidata extinct species extraction code
  - `openfoodfacts/` - Data files and scripts for Open Food Facts
  - `wikidata-extinct/` - Data files and scripts for Wikidata
- `bot/` - TypeScript generator that creates the text
- `web/` - Astro/Preact web application
- `docs/` - Concept documentation

## Data Pipeline: Open Food Facts

```bash
cd data

# Extract all German products to CSV
uv run openfoodfacts process --data openfoodfacts/openfoodfacts-products.jsonl -o openfoodfacts/products.csv

# Test with limited products
uv run openfoodfacts process --data openfoodfacts/openfoodfacts-products.jsonl --max-products 1000 -o test.csv

# Extract categories (standalone script)
uv run python openfoodfacts/scripts/extract_categories.py --data openfoodfacts/openfoodfacts-products.jsonl

# Copy to bot assets
cp openfoodfacts/products.csv ../bot/assets/
```

### Key Files (Python)

- `data/src/openfoodfacts/loader.py` - JSONL streaming, Germany filter, non-food exclusion
- `data/src/openfoodfacts/processor.py` - Field extraction and CSV export
- `data/src/openfoodfacts/models/product.py` - Product dataclass
- `data/openfoodfacts/category_names.csv` - Maps English categories to German generic names
- `data/openfoodfacts/scripts/extract_categories.py` - Standalone script to extract all categories

## Data Pipeline: Wikidata Extinct Species

```bash
cd data

# Extract extinct species
uv run wikidata-extinct -o wikidata-extinct/species.csv
```

### Key Files (Python)

- `data/src/wikidata_extinct/sparql.py` - SPARQL queries for Wikidata
- `data/src/wikidata_extinct/wikipedia.py` - Wikipedia list parsing
- `data/src/wikidata_extinct/processor.py` - Species data processing

## Generator (Bot)

```bash
cd bot

# Development mode (watch)
npm run dev

# Generate book text
npm run book:generate -- --pages 100 --entries-per-page 5

# Post to social media
npm run post:mastodon
npm run post:bluesky
```

### Key Files (TypeScript)

- `lib/generator/standard-entry.ts` - Standard entry generator
- `lib/data/product-loader.ts` - CSV loading
- `lib/data/ratings.ts` - Weighted ratings with category matching
- `lib/date/index.ts` - Date generation and formatting
- `scripts/book/generate-book-text.mts` - Book generation script
- `scripts/post-to-mastodon.mts` - Mastodon posting
- `scripts/post-to-bluesky.mts` - Bluesky posting

## Web Application

```bash
cd web

# Development mode
npm run dev

# Build for production
npm run build
```

The web app uses a sampled subset of products (1/3) to reduce load times:

```bash
cd data

# Generate sampled products.csv for web app (~4 MB instead of 11 MB)
uv run python scripts/sample_products.py
```

### Key Files

- `web/src/components/EntryList.tsx` - Main entry list with infinite scroll
- `web/public/products.csv` - Sampled product data (generated)
- `data/scripts/sample_products.py` - Script to sample 1/3 of products

### Data Fields

**Core (visible in output):**
- `name` - Product name
- `brand` - Brand name
- `quantity` - e.g. "500g"
- `generic_name` - Generic name derived from categories (e.g., "Joghurt", "Käse")

**Extended (for logic/variation):**
- `categories` - For ensuring variety and category-specific ratings
- `labels` - Bio, Vegan (subtly integrated: "Bio-Joghurt")
- `nova_group` - Processing level (affects expiration logic)
- `nutriscore`, `ecoscore`, `allergens`, `origins` - Collected but rarely used

### Ratings

Ratings are loaded from `assets/ratings.csv` with:
- `rating` - The text (e.g., "Einwandfrei.")
- `weight` - Relative frequency
- `categories` - Optional category filter (pipe-separated)

#### Rating Style

When creating new ratings, follow this style:

- **Tone**: Matter-of-fact, bureaucratic, detached - no enthusiasm
- **Content**: Concrete sensory experiences (taste, texture, smell, appearance)
- **Attitude**: Understatement - the bare minimum counts as success ("Nicht steinhart." for 10-year-old bread is almost a compliment)
- **Valence**: Mostly positive but muted. Never enthusiastic ("saftig", "vollmundig"), never too negative
- **Length**: Short, 1-3 words, ending with a period
- **Humor**: Dry, lies in the understatement. The product expired years ago, but the narrator just says "Einwandfrei."
- **Weights**: Positive ratings higher (3-5), neutral/negative lower (2)

Examples of good ratings:
- "Einwandfrei." - the standard positive
- "Schmeckt noch." - the "noch" (still) is typical
- "Kein Problem." - matter-of-fact observation
- "Noch knusprig." - category-specific (biscuits)

## The "Haltung" (Attitude)

> Der Erzähler rechtfertigt sich nicht. Er dokumentiert. Der Ton ist nüchtern, nie triumphierend.

The power is in reduction. Less is more. Don't add metadata to the output unless it serves the laconic style.

## Code Style

- Python: Type hints, dataclasses
- TypeScript: ESM modules, strict mode
- Comments and code in English
- German user-facing text
