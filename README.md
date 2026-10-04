# SAMAR-MD Complete

The-RUDE-x Cyber Team WhatsApp bot.

## Deploy
1. Upload this folder to GitHub.
2. Render -> New Web Service.
3. Build command: `npm install`
4. Start command: `npm start`
5. Node 20+.
6. Add the variables from `.env.example`.
7. Open the Render URL and pair the WhatsApp number.

## Important
- `sessions/` is ignored by Git. Render's free filesystem is not durable; use persistent storage or re-pair after a fresh instance/deploy if the session disappears.
- Status reaction uses Baileys multi-device status events. If WhatsApp changes its protocol, no third-party bot can guarantee permanent compatibility.
- The supplied RUDE Cyber Team logo is included as `public/logo.jpg`.

## SEO setup
Set `SITE_URL` in Render to your real public website URL (for example `https://your-domain.example`). The bot now serves `robots.txt`, `sitemap.xml`, a web manifest, Open Graph/Twitter metadata and Schema.org structured data.

SEO note: these changes make the site crawlable and strongly branded for searches such as **SAMAR-MD**, but no code can honestly guarantee a #1 Google ranking. For the best chance, verify the domain in Google Search Console and submit `/sitemap.xml`, keep the site public/fast, and build genuine links/mentions to the official SAMAR-MD site.
