"""Process raw Open Food Facts data into Product objects."""

import csv
import re
from pathlib import Path
from typing import Iterator

from .images import get_front_image_url
from .models import Product


def load_category_names(path: Path) -> dict[str, str]:
    """Load category to generic name mapping from CSV."""
    mapping: dict[str, str] = {}
    if not path.exists():
        return mapping

    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            category = row["category"].strip()
            generic_name = row["generic_name"].strip()
            if category and generic_name:
                mapping[category] = generic_name

    return mapping


def find_generic_name(categories: list[str], mapping: dict[str, str]) -> str | None:
    """Find the most specific generic name for a product's categories.

    More specific categories (appearing later in the list or with more path segments)
    are preferred over generic ones.
    """
    if not categories or not mapping:
        return None

    # Score categories by specificity (more path segments = more specific)
    best_match: str | None = None
    best_score = -1

    for category in categories:
        if category in mapping:
            # Count path segments as specificity score
            score = category.count("-")
            if score > best_score:
                best_score = score
                best_match = mapping[category]

    return best_match


class ProductProcessor:
    """Convert raw Open Food Facts data to Product objects."""

    def __init__(self, category_names_path: Path | None = None):
        self.seen_names: set[str] = set()
        self.category_mapping: dict[str, str] = {}
        if category_names_path:
            self.category_mapping = load_category_names(category_names_path)

    def process(self, raw_products: Iterator[dict]) -> list[Product]:
        """Process raw products into Product objects."""
        products = []

        for raw in raw_products:
            product = self._process_product(raw)
            if product:
                products.append(product)

        return products

    def _process_product(self, raw: dict) -> Product | None:
        """Process a single product dictionary into a Product."""
        # Get cleaned name
        name = raw.get("_clean_name") or raw.get("product_name_de", "")
        if not name or name in self.seen_names:
            return None

        self.seen_names.add(name)

        # Extract brand (take first if comma-separated, remove parenthetical info)
        brand = raw.get("brands")
        if brand:
            brand = brand.split(",")[0].strip()
            # Remove parenthetical suffixes like "(Lidl)" or "(GmbH & Co.)"
            brand = re.sub(r"\s*\([^)]*\)\s*$", "", brand).strip()
            if not brand:
                brand = None

        # Extract quantity
        quantity = raw.get("quantity")
        if quantity:
            quantity = quantity.strip()
            if not quantity:
                quantity = None

        # Extract categories
        categories = raw.get("categories_tags", [])

        # Extract labels
        labels = raw.get("labels_tags", [])

        # Extract nutriscore (a/b/c/d/e)
        nutriscore = raw.get("nutriscore_grade")
        if nutriscore in ("not-applicable", "unknown", ""):
            nutriscore = None

        # Extract nova group (1-4)
        nova_group = None
        nova_tags = raw.get("nova_groups_tags", [])
        for tag in nova_tags:
            # Tags are like "en:4-ultra-processed-food-and-drink-products"
            tag_clean = tag.split(":")[-1] if ":" in tag else tag
            if tag_clean and tag_clean[0].isdigit():
                try:
                    nova_group = int(tag_clean[0])
                    break
                except ValueError:
                    pass

        # Extract ecoscore (a/b/c/d/e)
        ecoscore = None
        eco_tags = raw.get("ecoscore_tags", [])
        for tag in eco_tags:
            tag_clean = tag.split(":")[-1] if ":" in tag else tag
            if tag_clean in ("a", "b", "c", "d", "e"):
                ecoscore = tag_clean
                break

        # Extract origins
        origins = raw.get("origins")
        if origins:
            origins = origins.strip()
            if not origins:
                origins = None

        # Extract allergens
        allergens = raw.get("allergens_tags", [])

        # Find generic name from categories
        generic_name = find_generic_name(categories, self.category_mapping)

        # Extract front image URL
        image_url = get_front_image_url(raw)

        return Product(
            name=name,
            brand=brand,
            quantity=quantity,
            generic_name=generic_name,
            image_url=image_url,
            categories=categories,
            labels=labels,
            nutriscore=nutriscore,
            nova_group=nova_group,
            ecoscore=ecoscore,
            origins=origins,
            allergens=allergens,
        )


def save_products_csv(products: list[Product], output_path: Path) -> None:
    """Save processed products to CSV file."""
    fieldnames = [
        "name", "brand", "quantity", "generic_name", "image_url",
        "categories", "labels", "allergens",
        "nutriscore", "nova_group", "ecoscore", "origins",
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(fieldnames)
        for p in products:
            writer.writerow([
                p.name,
                p.brand or "",
                p.quantity or "",
                p.generic_name or "",
                p.image_url or "",
                "|".join(p.categories) if p.categories else "",
                "|".join(p.labels) if p.labels else "",
                "|".join(p.allergens) if p.allergens else "",
                p.nutriscore or "",
                p.nova_group if p.nova_group is not None else "",
                p.ecoscore or "",
                p.origins or "",
            ])

    size_mb = output_path.stat().st_size / 1024 / 1024
    print(f"Saved {len(products)} products to {output_path} ({size_mb:.1f} MB)")
