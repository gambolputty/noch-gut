"""SPARQL queries to Wikidata for extinct species."""

import time
from SPARQLWrapper import SPARQLWrapper, JSON
from SPARQLWrapper.SPARQLExceptions import QueryBadFormed, EndPointInternalError

WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "WikidataExtinctBot/1.0 (noch-gut project)"

# Query for extinct species with extinction date
# P8556 = extinction date (required)
# P225 = taxon name (scientific name) - used to identify biological taxa
# P276 = location
# P105 = taxon rank (species, genus, etc.)
EXTINCT_SPECIES_QUERY = """
SELECT DISTINCT ?item ?itemLabel ?extinctionDate ?location ?locationLabel ?scientificName
WHERE {{
  ?item wdt:P8556 ?extinctionDate .
  ?item wdt:P225 ?scientificName .

  OPTIONAL {{ ?item wdt:P276 ?location . }}

  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "de,en". }}
}}
ORDER BY DESC(?extinctionDate)
{limit_clause}
"""


def fetch_extinct_species(limit: int | None = None, retries: int = 3) -> list[dict]:
    """
    Fetch extinct species from Wikidata.

    Args:
        limit: Maximum number of species to fetch. None for all.
        retries: Number of retry attempts on failure.

    Returns:
        List of species dictionaries with keys:
        - item: Wikidata URI
        - itemLabel: German or English name
        - extinctionDate: ISO date string
        - location: Wikidata URI (optional)
        - locationLabel: German or English location name (optional)
        - scientificName: Binomial name (optional)
    """
    limit_clause = f"LIMIT {limit}" if limit else ""
    query = EXTINCT_SPECIES_QUERY.format(limit_clause=limit_clause)

    sparql = SPARQLWrapper(WIKIDATA_ENDPOINT)
    sparql.setQuery(query)
    sparql.setReturnFormat(JSON)
    sparql.addCustomHttpHeader("User-Agent", USER_AGENT)
    sparql.setTimeout(120)  # 2 minutes timeout

    last_error = None
    for attempt in range(retries):
        try:
            results = sparql.query().convert()
            bindings = results.get("results", {}).get("bindings", [])
            return [_parse_binding(b) for b in bindings]
        except (QueryBadFormed, EndPointInternalError) as e:
            last_error = e
            wait_time = 2 ** attempt  # Exponential backoff
            print(f"Query failed (attempt {attempt + 1}/{retries}): {e}")
            if attempt < retries - 1:
                print(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
        except Exception as e:
            last_error = e
            print(f"Unexpected error: {e}")
            break

    raise RuntimeError(f"Failed to fetch species after {retries} attempts: {last_error}")


def _parse_binding(binding: dict) -> dict:
    """Parse a SPARQL result binding into a simpler dict."""
    return {
        "item": binding.get("item", {}).get("value", ""),
        "itemLabel": binding.get("itemLabel", {}).get("value", ""),
        "extinctionDate": binding.get("extinctionDate", {}).get("value", ""),
        "location": binding.get("location", {}).get("value", ""),
        "locationLabel": binding.get("locationLabel", {}).get("value", ""),
        "scientificName": binding.get("scientificName", {}).get("value", ""),
    }


def extract_wikidata_id(uri: str) -> str:
    """Extract Q-number from Wikidata URI."""
    # http://www.wikidata.org/entity/Q123 -> Q123
    if "/entity/" in uri:
        return uri.split("/entity/")[-1]
    return uri
