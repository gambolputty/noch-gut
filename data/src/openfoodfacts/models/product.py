"""Product data model for food products from Open Food Facts."""

from dataclasses import dataclass, field


@dataclass
class Product:
    """A food product extracted from Open Food Facts.

    Core fields are used directly in text generation.
    Extended fields are collected for variation logic and future use.
    """

    # Core fields (for text generation)
    name: str
    brand: str | None = None
    quantity: str | None = None
    generic_name: str | None = None  # Derived from categories (e.g., "Joghurt")
    image_url: str | None = None  # Front product image URL

    # Extended fields (for variation/logic, not directly visible in output)
    categories: list[str] = field(default_factory=list)
    labels: list[str] = field(default_factory=list)
    nutriscore: str | None = None  # a/b/c/d/e
    nova_group: int | None = None  # 1-4
    ecoscore: str | None = None  # a/b/c/d/e
    origins: str | None = None
    allergens: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization (sparse: omit None/empty)."""
        result: dict = {"name": self.name}

        if self.brand:
            result["brand"] = self.brand
        if self.quantity:
            result["quantity"] = self.quantity
        if self.generic_name:
            result["generic_name"] = self.generic_name
        if self.image_url:
            result["image_url"] = self.image_url
        if self.categories:
            result["categories"] = self.categories
        if self.labels:
            result["labels"] = self.labels
        if self.nutriscore:
            result["nutriscore"] = self.nutriscore
        if self.nova_group is not None:
            result["nova_group"] = self.nova_group
        if self.ecoscore:
            result["ecoscore"] = self.ecoscore
        if self.origins:
            result["origins"] = self.origins
        if self.allergens:
            result["allergens"] = self.allergens

        return result

    @classmethod
    def from_dict(cls, data: dict) -> "Product":
        """Create Product from dictionary."""
        return cls(
            name=data["name"],
            brand=data.get("brand"),
            quantity=data.get("quantity"),
            generic_name=data.get("generic_name"),
            image_url=data.get("image_url"),
            categories=data.get("categories", []),
            labels=data.get("labels", []),
            nutriscore=data.get("nutriscore"),
            nova_group=data.get("nova_group"),
            ecoscore=data.get("ecoscore"),
            origins=data.get("origins"),
            allergens=data.get("allergens", []),
        )
