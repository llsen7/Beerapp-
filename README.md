# BrewDex 🍺

A Pokédex for beers and drinks. Catch every style, log what you drink, and track your collection.

## Features
- **Dex**: 56 drink styles across 12 types (Lager, Hoppy, Malty, Dark, Wheat, Sour, Belgian, Cider, Wine, Spirit, Cocktail, Other). Styles you haven't caught stay hidden as `???`.
- **Catch**: log a drink with photo, name, maker, style, ABV, rating, place, date and tasting notes.
- **My Drinks**: your collection, numbered in the order you caught each drink, with search, type filters and sorting.
- **Stats**: Dex completion, progress by type, and a Hall of Fame of your top-rated drinks.
- **Data**: export and import JSON backups. Everything is stored locally on your device.
- Installable PWA that works offline.

## Running it
No build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

On a phone, open the hosted URL and use **Add to Home Screen** to install it. The app works well on GitHub Pages.

## Files
- `index.html`: app shell
- `styles.css`: styling (supports light and dark mode)
- `data.js`: drink types and the style Dex. Edit this file to add styles.
- `app.js`: app logic and storage (`localStorage`)
- `sw.js`, `manifest.webmanifest`: offline support and install
