# StockFlow SEO & AI discovery

## Public routes
- `/` homepage, `/features`, `/pricing`, `/about`, `/contact`
- `/resources` + article slugs, `/industries/retail-shops`, `/industries/minimarkets`
- `/privacy`, `/terms`

## App (noindex via robots.txt)
- POS at `/pos` (authenticated)
- All other operational routes under RequireAuth

## Config
- `VITE_SITE_URL` — canonical domain (update when custom domain is live)
- `VITE_CONTACT_ENDPOINT` — optional POST URL for demo form JSON

## Manual steps after deploy
1. Google Search Console — verify domain, submit `https://YOUR_DOMAIN/sitemap.xml`
2. Bing Webmaster Tools — same sitemap
3. Confirm `robots.txt` and `sitemap.xml` return 200 without SPA shell
4. Replace illustrative homepage sample figures if needed; keep “sample data” label
