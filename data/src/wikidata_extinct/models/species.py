"""Extinct species data model."""

from dataclasses import dataclass


@dataclass
class ExtinctSpecies:
    """Represents an extinct species from Wikidata."""

    name: str  # German name (required)
    extinction_year: int  # Year of extinction (required)
    wikidata_id: str  # Q-number for deduplication
    location: str | None = None  # Location in German (optional)
    scientific_name: str | None = None  # Binomial name (optional)

    def to_dict(self) -> dict:
        """Convert to dictionary for CSV export."""
        return {
            "name": self.name,
            "extinction_year": self.extinction_year,
            "location": self.location or "",
            "wikidata_id": self.wikidata_id,
            "scientific_name": self.scientific_name or "",
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ExtinctSpecies":
        """Create from dictionary."""
        return cls(
            name=data["name"],
            extinction_year=int(data["extinction_year"]),
            wikidata_id=data["wikidata_id"],
            location=data.get("location") or None,
            scientific_name=data.get("scientific_name") or None,
        )
