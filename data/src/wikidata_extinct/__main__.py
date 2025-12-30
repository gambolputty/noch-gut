"""CLI for extinct species extraction."""

import csv
from pathlib import Path

import click

from .sparql import fetch_extinct_species
from .processor import process_species
from .wikipedia import fetch_all_extinct_species


@click.command()
@click.option(
    "-o", "--output",
    type=click.Path(path_type=Path),
    default=Path("species.csv"),
    help="Output CSV file path.",
)
def cli(output: Path):
    """Extract extinct species from Wikidata and Wikipedia."""
    click.echo("=== Fetching from Wikidata ===")
    raw_wikidata = fetch_extinct_species()
    wikidata_species = process_species(raw_wikidata)
    click.echo(f"Wikidata: {len(wikidata_species)} species")

    click.echo("\n=== Fetching from Wikipedia ===")
    wikipedia_species = fetch_all_extinct_species()
    wikipedia_with_year = [s for s in wikipedia_species if s.year is not None]
    click.echo(f"Wikipedia: {len(wikipedia_with_year)} species")

    # Build merged dataset: Wikipedia as base (has locations), add Wikidata extras
    merged: dict[str, dict] = {}

    # Add Wikipedia entries first (they have locations)
    for s in wikipedia_with_year:
        key = s.name.lower()
        merged[key] = {
            "name": s.name,
            "extinction_year": s.year,
            "location": s.location,
            "scientific_name": s.scientific_name,
        }

    # Add Wikidata entries that are not in Wikipedia
    added_from_wikidata = 0
    for s in wikidata_species:
        key = s.name.lower()
        if key not in merged:
            merged[key] = {
                "name": s.name,
                "extinction_year": s.extinction_year,
                "location": s.location or "",
                "scientific_name": s.scientific_name or "",
            }
            added_from_wikidata += 1

    click.echo("\n=== Result ===")
    click.echo(f"From Wikipedia: {len(wikipedia_with_year)}")
    click.echo(f"Added from Wikidata: {added_from_wikidata}")
    click.echo(f"Total: {len(merged)}")

    with_loc = sum(1 for v in merged.values() if v["location"])
    click.echo(f"With location: {with_loc} ({100*with_loc/len(merged):.0f}%)")

    # Save
    fieldnames = ["name", "extinction_year", "location", "scientific_name"]
    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in sorted(merged.values(), key=lambda x: x["extinction_year"], reverse=True):
            writer.writerow(row)

    click.echo(f"\nSaved to {output}")


if __name__ == "__main__":
    cli()
