# smaht-browser

Interactive Vite + React portal for browsing SMaHT epigenomic track files and loading filtered selections into an embedded WashU Epigenome Browser.

## Development

```bash
npm install
npm run dev
```

## Data configuration

Runtime data and parsing rules live in `public/data/portal-config.json`.

- `baseUrl` defines the hosted track file root
- each assay entry defines its track-list file, hosted folder, regex parsing, and browser track type
- metadata and track lists under `public/data/` can be updated without changing app code

## Deployment

GitHub Pages deployment is configured with `.github/workflows/deploy-pages.yml`.
