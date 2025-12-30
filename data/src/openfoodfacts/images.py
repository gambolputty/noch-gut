"""Image URL generation for Open Food Facts products."""


def format_product_code(code: str) -> str:
    """Format product code for image URL path.

    Open Food Facts URL pattern:
    - Pad barcode to 13 digits with leading zeros
    - Split first 9 digits into 3 groups of 3
    - Use remaining digits as last folder
    - Codes <9 digits: use as-is

    e.g., 20143541 -> 0000020143541 -> 000/002/014/3541
    e.g., 4000521423285 -> 400/052/142/3285
    """
    if len(code) < 9:
        return code
    # Pad to 13 digits
    padded = code.zfill(13)
    return f"{padded[:3]}/{padded[3:6]}/{padded[6:9]}/{padded[9:]}"


def get_front_image_url(product: dict, size: int = 400) -> str | None:
    """Extract front image URL from product data.

    Tries front_de first, then falls back to front or front_en.

    Args:
        product: Raw product dict from Open Food Facts
        size: Image size (100, 200, 400)

    Returns:
        Full image URL or None if no front image exists
    """
    images = product.get("images", {})
    if not images:
        return None

    # Try front_de first, then fallbacks
    front = None
    for key in ("front_de", "front", "front_en"):
        if key in images:
            front = images[key]
            break

    if not front:
        return None

    imgid = front.get("imgid")
    if not imgid:
        return None

    code = product.get("code")
    if not code:
        return None

    formatted_code = format_product_code(code)

    return f"https://images.openfoodfacts.org/images/products/{formatted_code}/{imgid}.{size}.jpg"
