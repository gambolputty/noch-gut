"""JSONL-Loader für Open Food Facts Export."""

import gzip
import re
from pathlib import Path
from typing import Iterator

import orjson
from lingua import Language, LanguageDetectorBuilder
from tqdm import tqdm

try:
    import isal.igzip as igzip

    HAS_ISAL = True
except ImportError:
    HAS_ISAL = False

# Spracherkennung für Deutsch vs. Englisch (einmalig initialisiert für Performance)
_language_detector = LanguageDetectorBuilder.from_languages(
    Language.GERMAN, Language.ENGLISH
).build()

# ============================================================================
# WHITELIST: Kategorien für essbare Lebensmittel
# Nur Produkte mit mindestens einer dieser Kategorien werden aufgenommen.
# Exakter Match nach Entfernen des "en:" / "de:" Präfix.
# ============================================================================
# fmt: off
ALLOWED_FOOD_CATEGORIES = {
    # === HAUPT-LEBENSMITTELKATEGORIEN ===
    "plant-based-foods",  # NICHT "plant-based-foods-and-beverages"!
    "snacks", "sweet-snacks", "salty-snacks",
    "cereals-and-potatoes", "cereals-and-their-products",
    "dairies", "fermented-milk-products", "fermented-dairy-desserts",
    "condiments", "fruits-and-vegetables-based-foods",
    "fermented-foods", "meats-and-their-products", "meals",
    "desserts", "spreads", "sauces", "cheeses",
    "vegetables-based-foods", "breakfasts", "confectioneries",
    "cocoa-and-its-products", "prepared-meats", "meats",
    "groceries", "biscuits-and-cakes", "frozen-foods", "canned-foods",
    "fruits-based-foods", "dairy-desserts", "pastas", "seeds",
    "plant-based-spreads", "seafood", "breads", "chocolates",
    "legumes-and-their-products", "biscuits-and-crackers", "sweet-spreads",
    "nuts-and-their-products", "canned-plant-based-foods",
    "fishes-and-their-products", "vegetables", "breakfast-cereals",
    "fishes", "dried-products", "biscuits", "fats", "yogurts",
    "chocolate-candies", "fruits", "appetizers", "legumes", "sausages",
    "nuts", "frozen-desserts", "cereal-grains", "meat-alternatives",
    "ice-creams-and-sorbets", "canned-vegetables", "dairy-substitutes",
    "fatty-fishes", "cured-sausages", "candies", "chips-and-fries", "bars",
    "farming-products", "cow-cheeses", "noodles", "salted-spreads",
    "ice-creams", "bonbons", "pickles", "crisps", "meat-analogues",
    "tomatoes-and-their-products", "dried-plant-based-foods", "pasta-dishes",
    "plant-based-pickles", "fruit-and-vegetable-preserves", "legume-seeds",
    "mueslis", "olive-tree-products", "pulses", "cakes", "tomato-sauces",
    "soups", "jams", "prepared-salads", "fish-fillets", "rices", "poultries",

    # === SPEZIFISCHE LEBENSMITTELKATEGORIEN ===
    "milk-chocolates", "pizzas-pies-and-quiches", "cream-cheeses", "pastries",
    "bee-products", "chicken-and-its-products", "honeys", "culinary-plants",
    "fermented-dairy-desserts-with-fruits", "dried-fruits",
    "frozen-plant-based-foods", "hams", "breaded-products", "dark-chocolates",
    "italian-cheeses", "pizzas", "vegan-products", "spreadable-fats",
    "canned-fishes", "potato-crisps", "fruit-yogurts", "eggs",
    "pork-and-its-products", "tomatoes", "pickled-vegetables",
    "stuffed-pastas", "dry-pastas", "durum-wheat-pasta", "creams", "olives",
    "compotes", "quarks", "ketchup", "mustards", "pestos", "broths", "dips",
    "cooking-helpers", "mushrooms-and-their-products", "mushrooms",
    "sandwiches", "bread-rolls", "special-breads", "hummus", "salad-dressings",
    "smoked-fishes", "hot-sauces", "beef-and-its-products", "legume-butters",
    "peanut-butters", "hard-cheeses", "coconut-milks-and-creams",
    "bakery-products", "mayonnaises", "mueslis-with-fruits", "pastry-helpers",
    "fish-preparations", "gherkins", "apple-compotes", "canned-fruits",
    "tropical-fruits", "crustaceans", "shrimps", "prepared-vegetables",
    "hazelnut-spreads", "non-dairy-fermented-foods", "chicken-preparations",
    "non-dairy-yogurts", "ice-cream-bars", "rolled-oats", "flatbreads",
    "waffles", "citrus-jams", "puffed-cereal-cakes", "sliced-breads",
    "fromages-blancs-petit-suisses-and-skyr", "canned-common-beans",
    "flavoured-potato-crisps", "marmalades", "tofu", "toasts", "almonds",
    "dessert-mixes", "sweet-pastries-and-pies", "viennoiseries", "chewing-gum",
    "white-breads", "poultry-meals", "cashew-nuts", "barbecue-sauces",
    "grated-cheese", "dehydrated-soups", "white-hams", "canned-tomatoes",
    "beef", "chickpeas", "green-olives", "onions-and-their-products",
    "margarines", "wafers", "applesauces", "cocoa-and-hazelnuts-spreads",
    "corn-chips", "marzipan", "potato-preparations", "smoked-salmons",
    "crispbreads", "breaded-chicken", "white-chocolates", "roasted-nuts",
    "fresh-eggs", "basmati-rices", "porridge", "rice-dishes", "potatoes",
    "baguettes", "easter-food", "products-without-gluten",  # fresh-fruits entfernt (lose)
    "wheat-breads", "emmentaler", "vegetarian-sausages", "combination-meals",
    "vegetable-soups", "meat-spreads", "fresh-cheeses", "prawns",
    "frozen-ready-made-meals", "cured-liver-sausages", "vegetable-rods",
    "cured-hams", "citrus", "salmon-fillets", "fermented-creams",
    "dried-vegetables", "filled-milk-chocolates", "cheese-spreads", "corn",
    "filled-biscuits", "chicken-breasts", "french-cheeses", "apples",
    "soy-sauces", "tomato-pastes", "ravioli", "dehydrated-broths",
    "canned-soups", "dried-tomatoes", "assorted-chocolate-candies",
    "fermented-vegetables", "vegetable-broths", "meals-with-chicken",
    "german-sausages", "chocolates-with-hazelnuts", "gnocchi", "meals-with-fish",
    "puffed-rice-cakes", "frozen-seafood", "frozen-fried-potatoes",
    "cheese-substitutes", "tortellini", "canned-cereals", "baking-mixes",
    "greek-cheeses", "carrots", "potato-dishes", "curry-pastes",
    "whipped-creams", "canned-corn", "blueberries", "green-pestos",
    "german-bakery-products", "dates", "fries", "sour-creams",
    "greek-style-yogurts", "plain-fermented-dairy-desserts", "wholemeal-breads",
    "goat-cheeses", "poultry-nuggets", "pumpkin-and-squash-plant-products",
    "sugar-free-chewing-gum", "sauerkrauts", "strawberry-jams", "stews",
    "chicken-nuggets", "fruits-in-syrup", "feta", "camemberts", "cake-mixes",
    "skyrs", "chocolate-desserts", "ground-meat-preparations",
    "canned-herrings", "popcorn", "gouda", "mozzarella", "salami", "herring",
    "tunas", "salmons", "puddings", "festive-foods", "christmas-foods-and-drinks",
    "nut-butters", "chocolate-spreads",  # fresh-plant-based-foods, fresh-foods entfernt (lose)

    # === DEUTSCHE KATEGORIENAMEN (aus OFF-Daten) ===
    "pflanzliche-lebensmittel", "susser-snack", "susswaren",
    "frucht-und-gemusebasierte-lebensmittel", "kase",

    # === WEITERE SPEZIFISCHE KATEGORIEN ===
    "cereal-pastas", "oilseed-purees", "gummi-candies", "instant-noodles",
    "mueslis-with-chocolate", "candy-chocolate-bars", "chicken-eggs",
    "aromatic-plants", "berry-jams", "crackers-appetizers", "cheeses-of-the-netherlands",
    "long-grain-rices", "filled-chocolates", "pasta-sauces", "chocolate-cereals",
    "sliced-cheeses", "gingerbreads", "soft-cheeses",  # fresh-vegetables entfernt (lose)
    "stretched-curd-cheeses", "common-beans", "salads", "soft-cheeses-with-bloomy-rind",
    "plant-based-creams", "herbs", "spaghetti", "extruded-cereals", "shelled-nuts",
    "peanuts", "plant-based-creams-for-cooking", "mueslis-with-fruits", "aromatic-rices",
    "meal-sauces", "lentils", "indica-rices", "canned-tunas",
    "uncooked-pressed-cheeses", "animal-fats", "cereal-flakes", "leaf-vegetables",
    "milkfat", "butters", "spice-mix", "pickled-cucumbers", "sunflower-seeds-and-their-products",
    "flakes", "ice-cream-tubs", "homogenized-milks", "pasteurised-products",
    "dairy-spreads", "cereals-with-fruits", "extruded-flakes", "petits-suisses",
    "croissants", "petit-beurre", "brioches", "madeleines", "meringues",
    "nachos", "tacos", "burritos", "wraps", "pita", "ciabatta", "focaccia",
    "pretzels", "bagels", "muffins", "donuts", "cupcakes", "brownies",
    "macarons", "truffles", "pralines", "nougat", "caramel", "toffee",
    "licorice", "gummies", "lollipops", "marshmallows", "fudge",
    "granola", "granola-bars", "energy-balls", "protein-balls",
    "tempeh", "seitan", "jackfruit", "textured-vegetable-protein",
    "veggie-burgers", "plant-based-nuggets", "plant-based-meatballs",
    "antipasti", "tapas", "mezze", "bruschetta", "crostini",
    "pate", "terrine", "rillettes", "foie-gras",
    "sashimi", "sushi", "maki", "nigiri", "temaki",
    "dim-sum", "gyoza", "spring-rolls", "samosas", "empanadas",
    "pierogi", "vareniki", "pelmeni", "dumplings",
    "lasagna", "cannelloni", "manicotti", "penne", "rigatoni", "fusilli",
    "tagliatelle", "fettuccine", "linguine", "bucatini", "orzo", "couscous",
    "risotto", "paella", "biryani", "pilaf",
    "polenta", "grits", "semolina", "bulgur", "quinoa", "amaranth", "millet",
    "buckwheat", "spelt", "kamut", "freekeh", "farro", "teff",
    "cranberries", "raspberries", "blackberries", "strawberries",
    "cherries", "plums", "peaches", "apricots", "nectarines",
    "mangos", "papayas", "pineapples", "bananas", "kiwis", "figs",
    "pomegranates", "passion-fruits", "lychees", "dragon-fruits",
    "avocados", "coconuts", "grapes", "melons", "watermelons",
    "oranges", "lemons", "limes", "grapefruits", "tangerines", "mandarins",
    "broccoli", "cauliflower", "cabbage", "brussels-sprouts", "kale",
    "spinach", "lettuce", "arugula", "chard", "collard-greens",
    "asparagus", "artichokes", "celery", "fennel", "leeks",
    "zucchini", "eggplants", "cucumbers", "bell-peppers", "chili-peppers",
    "peas", "green-beans", "wax-beans", "snap-peas", "snow-peas",
    "beets", "radishes", "turnips", "parsnips", "rutabagas",
    "sweet-potatoes", "yams", "taro", "cassava",
    "walnuts", "pecans", "hazelnuts", "macadamias", "pistachios",
    "brazil-nuts", "pine-nuts", "chestnuts",
    "sunflower-seeds", "pumpkin-seeds", "sesame-seeds", "chia-seeds",
    "flax-seeds", "hemp-seeds", "poppy-seeds",
    "lamb", "mutton", "veal", "venison", "rabbit", "duck", "goose", "turkey",
    "bacon", "pancetta", "prosciutto", "chorizo", "bratwurst", "frankfurter",
    "mortadella", "bologna", "pepperoni", "pastrami", "corned-beef",
    "anchovies", "sardines", "mackerel", "trout", "cod", "haddock", "halibut",
    "sole", "flounder", "sea-bass", "tilapia", "catfish", "carp",
    "lobster", "crab", "mussels", "clams", "oysters", "scallops", "squid", "octopus",
    "caviar", "roe", "fish-roe", "crab-meat",
    "brie", "gruyere", "cheddar", "parmesan", "pecorino", "manchego",
    "roquefort", "gorgonzola", "stilton", "blue-cheese",
    "ricotta", "mascarpone", "cottage-cheese", "quark",
    "creme-fraiche", "clotted-cream", "double-cream",
    "ghee", "lard", "tallow", "schmaltz",
    "pesto", "tapenade", "aioli", "romesco", "chimichurri", "harissa",
    "teriyaki", "hoisin", "oyster-sauce", "fish-sauce", "sriracha", "gochujang",
    "tahini", "miso", "tamari", "ponzu", "wasabi",
    "relish", "chutney", "piccalilli", "cornichons", "capers",
    "maple-syrup", "agave", "molasses", "treacle", "golden-syrup",
    "custard", "creme-anglaise", "zabaglione", "panna-cotta",
    "mousse", "tiramisu", "cheesecake", "trifle", "creme-brulee",
    "sorbet", "gelato", "frozen-yogurt", "ice-cream-sandwiches",
    "pancakes", "crepes", "blinis", "dutch-baby",
    "scones", "crumpets", "english-muffins", "hot-cross-buns",
    "strudel", "baklava", "churros", "beignets", "zeppole",
    "pavlova", "profiteroles", "eclairs", "cream-puffs", "cannoli",
}
# fmt: on

# ============================================================================
# LOSES OBST/GEMÜSE-BLACKLIST: Typischerweise unverpackt verkauft
# Diese Kategorien werden ausgeschlossen, da wir nur verpackte Produkte wollen.
# Ausgenommen sind verpackte Frischeprodukte (Käse, Eier, Pasta, Fleisch).
# ============================================================================
# fmt: off
EXCLUDED_FRESH_PRODUCE_CATEGORIES = {
    # === OBERKATEGORIEN (zu breit, enthält loses Obst/Gemüse) ===
    "fresh-foods", "fresh-plant-based-foods",

    # === LOSES OBST ===
    "fresh-fruits",
    "fresh-apples", "fresh-apricots", "fresh-bananas", "fresh-blackberries",
    "fresh-blueberries", "fresh-cherries", "fresh-clementines", "fresh-clementine-oranges",
    "fresh-figs", "fresh-grapes", "fresh-kiwifruits", "fresh-lemons",
    "fresh-mandarin-oranges", "fresh-oranges", "fresh-peaches", "fresh-pears",
    "fresh-pineapple", "fresh-plums", "fresh-raspberries", "fresh-strawberries",
    "fresh-ripe-coconut-kernel",

    # === LOSES GEMÜSE ===
    "fresh-vegetables",
    "fresh-asparagus", "fresh-belgian-endives", "fresh-broccoli", "fresh-brussels-sprouts",
    "fresh-carrots", "fresh-cauliflowers", "fresh-corn", "fresh-cucumbers",
    "fresh-garlic", "fresh-ginger-rhizomes", "fresh-green-beans", "fresh-horseradish",
    "fresh-leeks", "fresh-legumes", "fresh-mixed-vegetables", "fresh-onions",
    "fresh-red-onions", "fresh-shallots", "fresh-spinachs", "fresh-sweet-peppers",
    "fresh-sweet-potatoes", "fresh-tomatoes", "fresh-zucchini", "fresh-broad-beans",

    # === FRISCHE PILZE ===
    "fresh-mushrooms",

    # === FRISCHE KRÄUTER ===
    "fresh-aromatic-plants", "fresh-herbs",
    "fresh-basil", "fresh-chervil", "fresh-chives", "fresh-coriander-leaves",
    "fresh-dill", "fresh-mint", "fresh-parsley", "fresh-stevia",

    # === SPROSSEN ===
    "fresh-sprouts", "fresh-legume-sprouts", "fresh-mung-bean-sprouts",

    # === BULK/LOSE ===
    "bulk",

    # === DEUTSCHE VARIANTEN ===
    "frisches-obst", "frisches-gemuse", "frische-fruchte",
    "frische-salate", "frischer-salat",
    "frische-paprika", "frische-kartoffeln", "frische-radieschen",
    "frische-brombeeren", "frische-beeren", "frische-pfirsiche", "frische-nektarinen",
    "frische-blutorangen", "frische-limetten", "frische-mandarinen", "frische-avocados",
    "frische-feigen", "frische-zwetschgen", "frische-gemüsemischungen",
    "frische-shiitake-pilze", "pilze-frisch", "rosenkohl-frisch",
    "basilikum-frisch", "frischer-thymian", "frischer-koriander",
    "frische-pfirsische",  # Tippfehler für frische-pfirsiche
}
# fmt: on

# ============================================================================
# GETRÄNKE-BLACKLIST: Kategorien für Getränke (der Erzähler isst, trinkt nicht)
# Ein Produkt mit Food-Kategorie könnte AUCH eine Getränke-Kategorie haben.
# ============================================================================
# Exakter Kategorie-Match (nach Entfernen des en:/de: Präfix)
# Kategorien verifiziert gegen OFF-Daten mit Häufigkeitsangaben
# fmt: off
EXCLUDED_BEVERAGE_CATEGORIES = {
    # Haupt-Getränkekategorien (Englisch)
    "beverages", "beverages-and-beverages-preparations",
    "plant-based-beverages", "alcoholic-beverages", "non-alcoholic-beverages",
    "hot-beverages", "beverage-preparations", "instant-beverages",
    "sweetened-beverages", "unsweetened-beverages", "artificially-sweetened-beverages",
    "fruit-based-beverages", "tea-based-beverages", "cereal-based-drinks",
    # Haupt-Getränkekategorien (Deutsch - aus OFF-Daten)
    "getranke",  # 93x
    "getranke-und-getrankezubereitungen",  # 34x
    "pflanzliche-getranke",  # 20x
    "alkoholische-getranke", "alkoholfreie-getranke",  # 4x, 3x
    "kohlensaurehaltige-getranke",  # 7x
    "heissgetranke", "heissgetranke-zum-aufgliessen",  # 2x, 9x
    "kaffeegetranke",  # 2x
    "getränk", "getrank", "getränke",  # 6x, 2x
    # Wasser (Englisch)
    "waters", "mineral-waters", "natural-mineral-waters", "spring-waters",
    "carbonated-waters", "flavored-waters",
    # Wasser (Deutsch - aus OFF-Daten)
    "wasser",  # 10x
    "mineralwasser", "quellwasser", "selterswasser",  # 6x, 6x, 2x
    "naturliches-mineralwasser",  # 2x
    # Säfte (Englisch)
    "juices-and-nectars", "fruit-juices", "fruit-nectars", "vegetable-juices",
    # Säfte (Deutsch - aus OFF-Daten)
    "saft", "safte-und-nektare",  # 13x, 14x
    "fruchsafte", "fruchtsafte",  # 10x (Tippfehler in Daten)
    "gemüsesaft", "gemusesaft",  # 3x
    "orangensafte", "zitronensafte", "zitronensaft",  # je 2x
    "karottensafte", "multifruchtsafte",  # 2x, 3x
    # Schorle / Limo (Deutsch - aus OFF-Daten)
    "schorle", "fruchtsaftschorle",  # 2x, 1x
    "limonaden",  # 1x
    "erfrischungsgetranke", "fruchtgetranke",  # 5x, 15x
    # Softdrinks
    "sodas", "carbonated-drinks", "colas", "fruit-sodas",
    # Alkohol
    "beers", "lagers", "ales", "stouts", "wheat-beers",
    "wines", "red-wines", "white-wines", "rose-wines", "sparkling-wines",
    "distilled-beverages", "spirits", "hard-liquors", "whisky", "vodka", "rum", "gin",
    # Kaffee & Tee (Englisch)
    "coffees", "ground-coffees", "coffee-beans", "instant-coffees",
    "teas", "black-teas", "green-teas", "herbal-teas", "fruit-teas",
    # Tee (Deutsch)
    "tee", "tees", "krautertees", "fruchtetees", "teegetranke",
    # Milchgetränke (Englisch)
    "milks", "milks-liquid-and-powder", "whole-milks", "semi-skimmed-milks",
    "skimmed-milks", "flavored-milks", "flavoured-milks", "dairy-drinks",
    "milk-substitutes", "plant-based-milk-alternatives",
    "uht-milks", "homogenized-milks", "fresh-milks", "esl-milks",
    "pasteurised-milks", "cow-milks", "lactose-free-milk", "chocolate-milks",
    "fermented-milk-drinks",
    # Pflanzenmilch-Getränke
    "oat-based-drinks", "soy-based-drinks", "nut-based-drinks",
    "almond-based-drinks", "coconut-based-drinks", "legume-based-drinks",
    "wheat-based-drinks", "spelt-based-drinks", "mixed-plant-milks",
    # Milchgetränke (Deutsch - aus OFF-Daten)
    "milch",  # 3x (Trinkmilch, nicht Joghurt/Käse)
    "frische-milch", "frische-vollmilch", "frische-bio-vollmilch", "frische-fettarme-milch",
    "milchgetranke", "milchmixgetränke", "milchmischgetränk-mit-kakao",  # je 2x
    "pflanzenmilch", "hafermilch", "kokosmilch",  # Pflanzenmilch
    # Sonstige Getränke
    "energy-drinks", "sports-drinks", "smoothies", "shakes",
    "coconut-waters", "kombucha", "compotes-to-drink", "baby-drinks",
    "fermented-drinks", "coffee-drinks", "mixed-drinks",
    # Sonstige Getränke (Deutsch - aus OFF-Daten)
    "energydrink", "milchdrink", "milchgetränk", "proteindrink",
    "softgetränk", "erfrischungsgetränk", "pausendrink",
    "früchtetee", "kräutertee", "eistee", "schwarzer-tee",
    "löslicher-kaffee", "malzkaffee", "getreidekaffee", "lupinenkaffee",
    "glühwein", "perlwein", "schaumweine", "rotwein", "rotweine", "weißweine",
    "aromatisiertes-wasser", "vitaminwasser",
    "ingwer-bier", "malzbier", "biermischgetränke",
    # Sirupe und Zubereitungen
    "getränkesirup", "getrankesirup",  # 2x
}
# fmt: on

# ============================================================================
# TRANSPARENTE VERPACKUNG: Fisch/Fleisch nur mit "sicherer" Kategorie erlauben
# Diese Kategorien sind typischerweise in transparenter Folie/Tray verpackt.
# Sie werden NUR akzeptiert, wenn das Produkt AUCH eine "sichere" Kategorie hat.
# ============================================================================
# fmt: off
RISKY_TRANSPARENT_CATEGORIES = {
    # Frischer Fisch (oft in Folie/Tray)
    # Verifiziert gegen openfoodfacts/scripts/categories.txt
    "fish-fillets", "salmon-fillets", "fishes", "seafood",
    "prawns", "shrimps", "crustaceans",
    "herring", "mackerel", "tilapia",
    "crab", "mussels", "squid", "anchovies", "sardines",
    "tunas", "salmons",

    # Frisches Fleisch (oft in Folie/Tray)
    "meats", "beef", "pork-and-its-products", "beef-and-its-products",
    "chicken-breasts", "ground-meat-preparations",
    "venison", "fresh-meat-preparations", "fresh-meats", "fresh-pork",
    "fresh-beef-preparations", "fresh-ground-meat-preparations",
    "fresh-ground-beef-preparations", "fresh-ground-steaks",
    "fresh-ground-beef-steaks",
}

SAFE_OPAQUE_CATEGORIES = {
    # Dosen - verifiziert gegen openfoodfacts/scripts/categories.txt
    "canned-foods", "canned-fishes", "canned-tunas", "canned-herrings",
    "canned-meats", "canned-vegetables", "canned-fruits",

    # Geräuchert (meist Vakuum, undurchsichtig)
    "smoked-fishes", "smoked-salmons",

    # Tiefkühl (Karton/undurchsichtige Verpackung)
    "frozen-foods", "frozen-seafood", "frozen-plant-based-foods",
    "frozen-ready-made-meals", "frozen-fried-potatoes", "frozen-desserts",
    "frozen-vegetables",

    # Wurst/Aufschnitt (meist Vakuum oder Dose)
    "sausages", "cured-sausages", "german-sausages",
    "salami", "bratwurst", "frankfurter", "mortadella", "pepperoni",
    "chorizo",

    # Schinken (meist Vakuum)
    "hams", "white-hams", "cured-hams", "prosciutto",
    "bacon", "pancetta", "pastrami",

    # Fleischkonserven
    "corned-beef", "meat-spreads", "cured-liver-sausages",

    # Fertiggerichte (meist undurchsichtig)
    "meals", "combination-meals",
    "meals-with-fish", "meals-with-chicken", "poultry-meals",

    # Paniert (meist Karton)
    "breaded-products", "breaded-chicken", "chicken-nuggets", "poultry-nuggets",

    # Glaskonserven
    "pickled-vegetables", "pickles",
}
# fmt: on

# ============================================================================
# GETRÄNKE-NAMENSMUSTER: Erkennt Getränke anhand des Produktnamens
# Auch wenn ein Produkt eine Food-Kategorie hat, kann der Name ein Getränk verraten.
# ============================================================================
# fmt: off
EXCLUDED_BEVERAGE_NAME_PATTERN = re.compile(
    r"""
    # Milchgetränke (der Erzähler isst, trinkt nicht)
    ^(bio[- ]?)?(voll|frisch|h-|haltbare|fett|mager|roh|weide|alpen|land|berg|laktosefreie[- ]?)?milch(\s|,|$)
    |\bh[- ]?milch\b  # H-Milch auch in Mitte des Namens (z.B. "Laktosefreie H-Milch")
    |butter[- ]?milch|dickmilch|^kefir|^molke
    |^(soja|hafer|mandel|reis|kokos|dinkel)milch
    |^(kakao|schoko|vanille|erdbeer)milch
    |^(hafer|soja|mandel|reis|kokos|dinkel|erbsen).?(milch|drink)$
    |^milch.?shake$
    # Tee (Getränke - aber nicht Teewurst/Teebutter, die sind Lebensmittel)
    |tee$|tee,|^tee\s|eistee
    |^(bio.?)?(grüner?|schwarzer?|weißer?|kräuter|früchte|rooibos|chai|ingwer|pfefferminz|kamille|fenchel|brennnessel|hibiskus|mate).?tee$
    |^früchtetee|^kräutertee|teegetränk
    # Kaffee
    |^(bio.?)?(filter|instant|löslicher?).?kaffee$|^espresso$|^cappuccino$
    |^kaffee.?(bohnen|pulver|pads)$|kaffeekapseln
    # Säfte
    |schorle|apfelschorle|orangenschorle
    |(apfel|orangen?|trauben|multivitamin|kirsch|birnen?|ananas|maracuja|mango|acerola)saft
    |fruchtsaft|gemüsesaft|direktsaft|mehrfruchtsaft
    |^(bio.?)?(apfel|orangen?|trauben|multivitamin|kirsch|birnen?|ananas|maracuja|mango|tomaten?|gemüse|karotten?|rote.?bete|cranberry|granatapfel|johannisbeer|holunder).?saft$
    |^(frucht|direkt|multi|gemüse).?saft$|^saft$
    |^(apfel|trauben|orangen?|johannisbeer)?.?schorle$
    # Limonade / Brause
    |limonade|limo\b|brause
    |nektar\b|fruchtnektar
    |^(bio.?)?(zitronen?|orangen?)?.?limonade$|^limo$|^brause$
    # Wasser
    |^mineral.?wasser|^tafel.?wasser|^quell.?wasser|^sprudel
    |^baby.?wasser|^birken.?wasser|^klar.?wasser
    |^stilles.?wasser|^wasser\s|^wasser,
    |^(mineral|tafel|quell|still|stilles|sprudel|heil).?wasser$|^wasser$
    # Smoothies
    |^smoothie$|^(obst|frucht|gemüse|grüner?).?smoothie$
    # Alkohol
    |^(pils|weizen|helles?|dunkles|lager|export|alt|kölsch|radler|bock).?bier$|^bier$
    |^(rot|weiß|rosé).?wein$|^wein$
    |^(sekt|prosecco|champagner|cremant)$
    |^(whisky|whiskey|wodka|vodka|rum|gin|likör|schnaps|cognac|brandy|grappa|obstler|williams)$
    |^glühwein$|^glüh.?punsch$|^kinder.?punsch$
    # Energy-Drinks
    |^energy.?drink$|energydrink
    |^isoton
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Hygieneprodukte (falsch kategorisiert in OFF)
EXCLUDED_HYGIENE_NAME_PATTERN = re.compile(
    r"mundspülung|mundwasser|zahnpasta|zahncreme|zahnpflege",
    re.IGNORECASE,
)
# fmt: on


def is_valid_product_name(name: str) -> bool:
    """Prüft ob der Produktname für unseren Anwendungsfall gültig ist.

    Lehnt ab:
    - Namen kürzer als 4 Zeichen
    - Namen länger als 50 Zeichen
    - Namen mit nicht-lateinischen Zeichen (Kyrillisch, Chinesisch, etc.)
    - Namen die abgeschnitten wirken (enden mit ... oder ,)
    - Namen die hauptsächlich Zahlen/Codes sind
    - Namen mit Klammern (oft störende Mengenangaben)
    - Nicht-deutsche Namen (erkannt via lingua)
    - Code-artige Namen mit Multiplikatoren (6x0,5l)
    """
    name = name.strip()

    if len(name) < 4 or len(name) > 50:
        return False

    # Lehne GROSSBUCHSTABEN-Namen ab (unleserlich, oft schlechte Datenqualität)
    if name.isupper() and len(name) > 4:
        return False

    # Lehne Datenmüll ab (URL-Fragmente, Zutaten, Nährwertangaben)
    if re.search(r"www\.|zutaten:|pro 100|kj/|\dkcal", name, re.IGNORECASE):
        return False

    # Lehne abgeschnittene/unvollständige Namen ab
    if name.endswith("...") or name.endswith(".."):
        return False
    if re.search(r"[,\-]\s*$", name):
        return False

    # Nur ASCII-Buchstaben + deutsche/französische Akzentzeichen erlauben
    latin_pattern = re.compile(
        r"^[a-zA-Z0-9\sÄÖÜäöüßéèêëàâçîïôûùœæÉÈÊËÀÂÇÎÏÔÛÙŒÆ\-'\.,&/()\+!%°]+$"
    )
    if not latin_pattern.match(name):
        return False

    # Lehne ab wenn mehr als 25% Ziffern (wahrscheinlich Produktcode)
    digit_ratio = sum(c.isdigit() for c in name) / len(name)
    if digit_ratio > 0.25:
        return False

    # Lehne code-artige Namen mit Multiplikatoren ab (6x0,5l, 4x100g)
    if re.search(r"\dx\d", name, re.IGNORECASE):
        return False

    # Lehne Namen mit Klammern ab (enthalten meist Menge, Verpackung oder Rauschen)
    if "(" in name:
        return False

    # Lehne Namen mit Mengenangaben-Suffixen ab (500ml, 250g, 170kcal, 80%)
    if re.search(r"\d+(ml|cl|g|kg|mg|kcal|l)\b", name, re.IGNORECASE):
        return False
    if re.search(r"\d+%", name):
        return False

    # Lehne unvollständige Namen ab wie "Eiweiß 50%" oder "Protein 32g"
    incomplete_pattern = re.compile(r"^[A-Za-zÄÖÜäöüß]+\s+\d+[%g]?$")
    if incomplete_pattern.match(name):
        return False

    # Lehne nicht-deutsche Namen ab mittels Spracherkennung
    detected = _language_detector.detect_language_of(name)
    if detected != Language.GERMAN:
        return False

    # Lehne Namen mit kleingeschriebenen deutschen Substantiven ab (Datenqualitätsproblem)
    lowercase_nouns = re.search(
        r" [a-zäöü]*(sauce|soße|gemüse|möhren|curry|käse|salat|suppe|wurst|brot|"
        r"nudeln|reis|fleisch|fisch|sahne|creme|butter|joghurt|schinken|"
        r"hähnchen|pute|rind|schwein|kartoffel|zwiebel|tomate|paprika|gurke|"
        r"pilz|spinat|erbsen|bohnen|linsen|schokolade|kuchen|keks|torte|eis|"
        r"müsli|haferflocken|cornflakes|marmelade|honig|senf|ketchup|essig|öl|trauben|bärlauch)\b",
        name,
        re.IGNORECASE,
    )
    if lowercase_nouns and lowercase_nouns.group(0)[1].islower():
        return False

    # Lehne abgekürzte Namen ab (Wörter ohne Vokale wie "Schw", "Br")
    words = name.split()
    for word in words:
        # Überspringe kurze Wörter (könnten Artikel/Präpositionen sein)
        if len(word) <= 2:
            continue
        # Prüfe ob Wort keine Vokale hat (wahrscheinlich Abkürzung)
        if not re.search(r"[aeiouäöü]", word, re.IGNORECASE):
            return False

    return True


def clean_product_name(name: str) -> str:
    """Bereinigt und normalisiert den Produktnamen."""
    name = name.strip()
    name = re.sub(r"\s+", " ", name)
    # Entferne Produktcodes am Ende (z.B. "Product 4306188047254")
    name = re.sub(r"\s+\d{8,}$", "", name)
    # Großschreibung des ersten Buchstabens wenn klein
    if name and name[0].islower():
        name = name[0].upper() + name[1:]
    return name


def is_food_product(product: dict) -> bool:
    """Prüft ob das Produkt tatsächlich Essen ist (keine Kosmetik, Tierfutter, Getränke, etc.).

    Verwendet einen WHITELIST-Ansatz: Produkt muss mindestens eine Kategorie aus
    ALLOWED_FOOD_CATEGORIES haben. Getränke, loses Obst/Gemüse und transparent
    verpackte Produkte werden ausgeschlossen.
    """
    categories = product.get("categories_tags", [])
    name = product.get("product_name_de", "")

    # Normalisiere alle Kategorien einmalig
    cat_names = {
        cat.lower().removeprefix("en:").removeprefix("de:").removeprefix("fr:")
        for cat in categories
    }

    # === WHITELIST-PRÜFUNG ===
    # Produkt muss mindestens eine erlaubte Lebensmittel-Kategorie haben
    if not cat_names & ALLOWED_FOOD_CATEGORIES:
        return False

    # === GETRÄNKE-BLACKLIST ===
    # Ein Produkt könnte sowohl Food- als auch Getränke-Kategorien haben
    if cat_names & EXCLUDED_BEVERAGE_CATEGORIES:
        return False

    # === LOSES OBST/GEMÜSE-BLACKLIST ===
    # Wir wollen nur verpackte Produkte (keine losen Äpfel, Karotten, etc.)
    if cat_names & EXCLUDED_FRESH_PRODUCE_CATEGORIES:
        return False

    # === TRANSPARENTE VERPACKUNG ===
    # Fisch/Fleisch nur erlauben wenn auch eine "sichere" Kategorie dabei ist
    # (canned, smoked, frozen, sausages, etc.)
    if cat_names & RISKY_TRANSPARENT_CATEGORIES:
        if not cat_names & SAFE_OPAQUE_CATEGORIES:
            return False

    # Prüfe Namen auf Getränke-Muster (fängt Getränke ohne richtige Kategorien)
    if EXCLUDED_BEVERAGE_NAME_PATTERN.search(name):
        return False

    # Prüfe Namen auf Hygieneprodukte (falsch kategorisiert in OFF)
    if EXCLUDED_HYGIENE_NAME_PATTERN.search(name):
        return False

    return True


def load_jsonl(
    filepath: Path, prefilter: bytes | None = None, show_progress: bool = True
) -> Iterator[dict]:
    """Streamt JSONL-Datei Zeile für Zeile.

    Unterstützt sowohl .jsonl als auch gzipped .jsonl.gz Dateien.
    Nutzt isal für schnellere gzip-Dekompression wenn verfügbar.

    Args:
        filepath: Pfad zur JSONL-Datei
        prefilter: Wenn gesetzt, überspringe Zeilen ohne diesen Byte-String (schneller Vorfilter)
        show_progress: Zeige tqdm-Fortschrittsbalken (byte-basiert für genaue Anzeige)
    """
    if filepath.suffix == ".gz":
        # Nutze isal für ~2-3x schnellere gzip-Dekompression
        open_func = igzip.open if HAS_ISAL else gzip.open
    else:
        open_func = open

    file_size = filepath.stat().st_size

    with open_func(filepath, "rb") as f:
        with tqdm(
            total=file_size,
            unit="B",
            unit_scale=True,
            desc=filepath.name,
            disable=not show_progress,
        ) as pbar:
            for line_num, raw_line in enumerate(f, 1):
                line: bytes = raw_line  # type: ignore[assignment]
                pbar.update(len(line))
                if not line.strip():
                    continue
                # Schneller Vorfilter: überspringe Zeilen ohne Keyword (vor JSON-Parsing)
                if prefilter and prefilter not in line.lower():
                    continue
                try:
                    yield orjson.loads(line)
                except orjson.JSONDecodeError as e:
                    print(f"Warnung: Konnte Zeile {line_num} nicht parsen: {e}")
                    continue


def load_german_products(
    jsonl_path: Path,
    max_products: int | None = None,
) -> Iterator[dict]:
    """Streamt JSONL und filtert deutsche Lebensmittelprodukte.

    Args:
        jsonl_path: Pfad zum Open Food Facts JSONL-Export
        max_products: Maximale Anzahl zu liefernder Produkte (None = unbegrenzt)

    Yields:
        Produkt-Dictionaries die den Deutschland-Filter mit gültigen deutschen Namen erfüllen
    """
    yielded = 0

    # Vorfilter: nur Zeilen parsen die "germany" enthalten (überspringt ~93% der Zeilen)
    for product in load_jsonl(jsonl_path, prefilter=b"germany"):
        # Prüfe auf deutschen Markt
        countries = product.get("countries_tags", [])
        if not any(
            "germany" in c.lower() or "deutschland" in c.lower()
            for c in countries
        ):
            continue

        # Muss einen deutschen Produktnamen haben
        name = product.get("product_name_de")
        if not name:
            continue

        # Validiere und bereinige den Namen
        if not is_valid_product_name(name):
            continue

        # Filtere Nicht-Lebensmittel
        if not is_food_product(product):
            continue

        product["_clean_name"] = clean_product_name(name)

        yielded += 1
        yield product

        if max_products and yielded >= max_products:
            break

    print(f"{yielded:,} deutsche Produkte gefunden.")
