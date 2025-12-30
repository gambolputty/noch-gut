"""Parse extinct species lists from German Wikipedia."""

import re
import urllib.request
import urllib.parse
import json
from dataclasses import dataclass

WIKIPEDIA_API = "https://de.wikipedia.org/w/api.php"
USER_AGENT = "WikidataExtinctBot/1.0 (noch-gut project)"

# Wikipedia pages with extinct species lists
EXTINCT_PAGES = [
    "Liste_der_neuzeitlich_ausgestorbenen_Säugetiere",
    "Liste_der_neuzeitlich_ausgestorbenen_Vögel",
]


@dataclass
class WikipediaSpecies:
    """Species parsed from Wikipedia."""

    name: str
    scientific_name: str
    location: str
    year: int | None
    raw_year: str  # Original text like "vermutlich 1960"


def fetch_wikipedia_page(page_title: str) -> str:
    """Fetch wikitext content of a Wikipedia page."""
    encoded_title = urllib.parse.quote(page_title, safe="")
    url = f"{WIKIPEDIA_API}?action=parse&page={encoded_title}&format=json&prop=wikitext"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    with urllib.request.urlopen(req, timeout=60) as response:
        data = json.loads(response.read().decode("utf-8"))
        return data.get("parse", {}).get("wikitext", {}).get("*", "")


def parse_extinct_species(wikitext: str) -> list[WikipediaSpecies]:
    """
    Parse species entries from Wikipedia wikitext.

    Expected format:
    * [[Name]] (''Scientific name'') (Location, Year)
    * [[Name|Display]] (''Scientific name'') (Location, Year)
    """
    species_list: list[WikipediaSpecies] = []

    # Pattern for: * [[Name]] (''Scientific'') (Location, Year)
    # Also handles [[Name|Display]] and [[Name#Section]]
    pattern = r"\*\s*\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]\s*\(''([^']+)''\)\s*\(([^,)]+),\s*([^)]+)\)"

    for match in re.finditer(pattern, wikitext):
        name = match.group(1).strip()
        scientific = match.group(2).strip()
        location = match.group(3).strip()
        raw_year = match.group(4).strip()

        # Extract numeric year from text
        year = _extract_year(raw_year)

        # Clean up name (remove section links)
        name = name.split("#")[0].strip()

        # Clean location from wiki markup
        location = _clean_location(location)

        # Skip if name is empty or looks invalid
        if not name or len(name) < 3:
            continue

        species_list.append(
            WikipediaSpecies(
                name=name,
                scientific_name=scientific,
                location=location,
                year=year,
                raw_year=raw_year,
            )
        )

    return species_list


def _extract_year(text: str) -> int | None:
    """Extract a 4-digit year from text like '1890' or 'vermutlich 1960'."""
    # Find all 4-digit years
    years = re.findall(r"\b(\d{4})\b", text)
    if years:
        # If multiple years (e.g., "zwischen 1940 und 1960"), take the later one
        return max(int(y) for y in years)
    return None


def _clean_location(location: str) -> str:
    """Clean wiki markup from location string."""
    # Remove [[...]] wiki links, keeping the text
    location = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", location)  # [[Link|Text]] -> Text
    location = re.sub(r"\[\[([^\]]+)\]\]", r"\1", location)  # [[Link]] -> Link
    # Remove other markup
    location = re.sub(r"''([^']+)''", r"\1", location)  # ''italic'' -> italic
    location = location.strip()

    # Filter known non-location text
    if "nur drei Schädel bekannt" in location:
        return ""

    return location


def fetch_all_extinct_species() -> list[WikipediaSpecies]:
    """Fetch and parse all extinct species from Wikipedia lists."""
    all_species: list[WikipediaSpecies] = []
    seen_names: set[str] = set()

    for page in EXTINCT_PAGES:
        try:
            print(f"Fetching {page}...")
            wikitext = fetch_wikipedia_page(page)
            species = parse_extinct_species(wikitext)
            print(f"  Found {len(species)} species")

            for s in species:
                # Deduplicate by name
                if s.name.lower() not in seen_names:
                    seen_names.add(s.name.lower())
                    all_species.append(s)
        except Exception as e:
            print(f"  Error: {e}")

    return all_species
