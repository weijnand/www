# Personal website

This project maintains Wijnand van Woerkom's personal academic website at wijnand.de. It is a static site built with plain HTML, CSS, and JavaScript, with no build step.

## Structure

- `index.html`: Homepage with biography, recent news and events, publications, and talks.
- `news.html` and `events.html`: Full news and event listings.
- `styles.css`: Shared layout, typography, responsive styling, and light/dark themes.
- `scripts/`: Theme handling (`theme.js`), shared interactions (`site.js`), and image viewing (`lightbox.js`).
- `assets/`: Portraits, publication PDFs, icons, pronunciation audio, and thumbnails; `thumbnails/full/` contains enlarged images.
- `work/previews/`: Local design experiments and previews, excluded from version control.
- `CNAME`: Custom domain configuration. `favicon.ico`: Site favicon.

## Working here

- Edit the static files directly; keep changes focused and follow the existing design and markup.
- When updating news or events, add entries at the top of the relevant listing and keep its first three entries in sync with the homepage.
- Preserve responsive layouts, accessibility, and both light and dark themes. Check affected pages in a browser after visual or interaction changes.
