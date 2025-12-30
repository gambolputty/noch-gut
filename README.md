# Noch gut

Ein Textgenerator. Der Ich-Erzähler dokumentiert, was er isst – ausschließlich Produkte, deren Mindesthaltbarkeitsdatum überschritten ist. Jeder Eintrag ein stiller Beweis, dass das Mindesthaltbarkeitsdatum eine Empfehlung ist, kein Gesetz.

Die Produktdaten (Namen und Bilder) stammen aus der [Open Food Facts](https://world.openfoodfacts.org/) Datenbank.

## Beispiele

```
Apfelmus von Odenwald. Abgelaufen 02.2023. Gegessen am 14. März 2025. Einwandfrei.

Sardinen in Öl von King Oscar. Abgelaufen 11.2019. Gegessen am 14. März 2025. Besser als erwartet.

Honig. Abgelaufen 2008. Hält ewig.

Joghurt von Weihenstephan. Drei Wochen drüber. Gut.
```

Vollständiges Beispiel: [book.md](bot/scripts/book/output/book.md)

## Projektstruktur

```
noch-gut/
├── data/                  # Python-Pipelines (gemeinsame venv)
│   ├── src/               # Python-Packages
│   └── openfoodfacts/     # Daten + Scripts für Open Food Facts
└── bot/                   # TypeScript-Generator (Textgenerierung)
```

## Setup

### Data Pipelines

```bash
cd data
uv sync

# Open Food Facts: Deutsche Lebensmittel extrahieren
uv run openfoodfacts process --data openfoodfacts/openfoodfacts-products.jsonl -o openfoodfacts/products.csv

# Wikidata: Ausgestorbene Arten extrahieren
uv run wikidata-extinct -o wikidata-extinct/species.csv

# CSVs zum Bot kopieren
cp openfoodfacts/products.csv ../bot/assets/
cp wikidata-extinct/species.csv ../bot/assets/extinct-species.csv
```

### Generator (Bot)

```bash
cd bot
npm install

# Entwicklungsmodus (Watch-Mode)
npm run dev

# Buch generieren
npm run book:generate -- --pages 100 --entries-per-page 5

# Social Media posten (erfordert .env)
npm run post:mastodon
npm run post:bluesky
```

### Umgebungsvariablen

Erstelle `bot/.env` basierend auf `bot/.env.example`:

```env
# Mastodon
MASTODON_API_BASE_URL=https://mastodon.social/
MASTODON_ACCESS_TOKEN=...

# Bluesky
BLUESKY_SERVICE=https://bsky.social
BLUESKY_IDENTIFIER=...
BLUESKY_PASSWORD=...
```

## Datenquelle

Download: https://world.openfoodfacts.org/data

## Lizenz

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

Diese Lizenz gilt sowohl für den Quellcode als auch für den generierten Text.
