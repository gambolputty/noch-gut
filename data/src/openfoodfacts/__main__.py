"""CLI for Open Food Facts data extraction."""

from collections import Counter
from pathlib import Path

import click

from .loader import load_german_products
from .processor import ProductProcessor, save_products_csv


@click.group()
def cli():
    """Extract German food products from Open Food Facts."""
    pass


@cli.command()
@click.option(
    "--data",
    "-d",
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help="Path to Open Food Facts JSONL(.gz) file",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(path_type=Path),
    default=Path("products.csv"),
    help="Output CSV file path",
)
@click.option(
    "--max-products",
    "-m",
    type=int,
    default=None,
    help="Maximum number of products to extract (default: unlimited)",
)
@click.option(
    "--category-names",
    "-c",
    type=click.Path(exists=True, path_type=Path),
    default=None,
    help="Path to category_names.csv for generic name mapping",
)
def process(data: Path, output: Path, max_products: int | None, category_names: Path | None):
    """Process Open Food Facts dump and extract German products to CSV."""
    # Auto-detect category_names.csv in same directory as data file
    if category_names is None:
        default_path = data.parent / "category_names.csv"
        if default_path.exists():
            category_names = default_path
            click.echo(f"Using category names from {category_names}")

    click.echo(f"Loading products from {data}...")

    raw_products = load_german_products(data, max_products=max_products)

    processor = ProductProcessor(category_names_path=category_names)
    products = processor.process(raw_products)

    click.echo(f"\nExtracted {len(products)} unique German products")

    # Show category distribution
    category_counts: Counter[str] = Counter()
    for p in products:
        for cat in p.categories[:1]:  # Count primary category only
            category_counts[cat] += 1

    click.echo("\nTop 10 categories:")
    for cat, count in category_counts.most_common(10):
        click.echo(f"  {cat}: {count}")

    # Show field availability
    with_brand = sum(1 for p in products if p.brand)
    with_quantity = sum(1 for p in products if p.quantity)
    with_generic = sum(1 for p in products if p.generic_name)
    with_nutriscore = sum(1 for p in products if p.nutriscore)
    with_nova = sum(1 for p in products if p.nova_group)

    click.echo("\nField availability:")
    click.echo(f"  brand:        {with_brand:>6} ({with_brand / len(products) * 100:5.1f}%)")
    click.echo(f"  quantity:     {with_quantity:>6} ({with_quantity / len(products) * 100:5.1f}%)")
    click.echo(f"  generic_name: {with_generic:>6} ({with_generic / len(products) * 100:5.1f}%)")
    click.echo(f"  nutriscore:   {with_nutriscore:>6} ({with_nutriscore / len(products) * 100:5.1f}%)")
    click.echo(f"  nova_group:   {with_nova:>6} ({with_nova / len(products) * 100:5.1f}%)")

    save_products_csv(products, output)


if __name__ == "__main__":
    cli()
