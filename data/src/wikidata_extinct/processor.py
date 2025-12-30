"""Process raw Wikidata results into ExtinctSpecies objects."""

import csv
import re
from pathlib import Path

from .models import ExtinctSpecies
from .sparql import extract_wikidata_id


def process_species(raw_data: list[dict]) -> list[ExtinctSpecies]:
    """
    Process raw SPARQL results into ExtinctSpecies objects.

    Handles:
    - Extracting year from date string
    - Cleaning up names
    - Deduplication by Wikidata ID
    """
    seen_ids: set[str] = set()
    species_list: list[ExtinctSpecies] = []

    for item in raw_data:
        wikidata_id = extract_wikidata_id(item["item"])

        # Skip duplicates
        if wikidata_id in seen_ids:
            continue
        seen_ids.add(wikidata_id)

        # Extract year from date (e.g., "1768-01-01T00:00:00Z" -> 1768)
        year = _extract_year(item["extinctionDate"])
        if year is None:
            continue  # Skip if no valid year

        # Get name - prefer German, skip if only Q-number
        name = item["itemLabel"]
        if not name or name.startswith("Q"):
            continue

        # Clean up name
        name = _clean_name(name)
        if not name:
            continue

        # Skip if name is just the scientific name (no German translation)
        scientific_name = item.get("scientificName") or ""
        if name.lower() == scientific_name.lower():
            continue

        # Skip names that look like scientific names (two latin words)
        if _looks_like_scientific_name(name):
            continue

        # Get location (optional)
        location = item.get("locationLabel", "")
        if location and not location.startswith("Q"):
            location = _clean_location(location)
        else:
            location = None

        # Get scientific name (optional)
        scientific_name = item.get("scientificName") or None

        species_list.append(
            ExtinctSpecies(
                name=name,
                extinction_year=year,
                wikidata_id=wikidata_id,
                location=location,
                scientific_name=scientific_name,
            )
        )

    return species_list


def _extract_year(date_str: str) -> int | None:
    """Extract year from ISO date string or year-only string."""
    if not date_str:
        return None

    # Handle full ISO date: 1768-01-01T00:00:00Z
    if "T" in date_str:
        try:
            return int(date_str.split("-")[0])
        except (ValueError, IndexError):
            return None

    # Handle year only or other formats
    match = re.search(r"(\d{4})", date_str)
    if match:
        return int(match.group(1))

    return None


def _clean_name(name: str) -> str:
    """Clean up species name."""
    # Remove trailing parentheses with taxonomic info
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name)
    # Normalize whitespace
    name = " ".join(name.split())
    return name.strip()


def _looks_like_scientific_name(name: str) -> bool:
    """Check if name looks like a scientific binomial name (Latin two-word name)."""
    words = name.split()
    if len(words) != 2:
        return False

    # Both words should be capitalized correctly for binomial names
    # e.g., "Genus species" or both lowercase
    first, second = words

    # Check for typical binomial pattern: Capitalized + lowercase
    if first[0].isupper() and first[1:].islower() and second.islower():
        # Additional check: no German characters
        german_chars = set("äöüßÄÖÜ")
        if not any(c in german_chars for c in name):
            return True

    return False


def _clean_location(location: str) -> str:
    """Clean up location name."""
    # Normalize whitespace
    location = " ".join(location.split())
    return location.strip()


def save_species_csv(species_list: list[ExtinctSpecies], output_path: Path) -> None:
    """Save species list to CSV file."""
    fieldnames = ["name", "extinction_year", "location", "wikidata_id", "scientific_name"]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for species in species_list:
            writer.writerow(species.to_dict())


def print_statistics(species_list: list[ExtinctSpecies]) -> None:
    """Print statistics about extracted species."""
    total = len(species_list)
    with_location = sum(1 for s in species_list if s.location)
    with_scientific = sum(1 for s in species_list if s.scientific_name)

    # Year distribution
    years = [s.extinction_year for s in species_list]
    if years:
        min_year = min(years)
        max_year = max(years)
    else:
        min_year = max_year = 0

    print(f"\n=== Statistics ===")
    print(f"Total species: {total}")
    print(f"With location: {with_location} ({100 * with_location / total:.1f}%)" if total else "")
    print(f"With scientific name: {with_scientific} ({100 * with_scientific / total:.1f}%)" if total else "")
    print(f"Year range: {min_year} - {max_year}" if total else "")
