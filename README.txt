日序 · Stock Observer

Public frontend source only. Market data and personal settings require an invited
Supabase account and are never committed here. GitHub Pages builds the web app.

Development: cd web && npm ci && npm run dev
Production: configure SUPABASE_URL and SUPABASE_ANON_KEY repository variables;
set PAGES_ENABLED=true and run the Website workflow. These are public connection
parameters, never a service-role key. Database credentials belong in the private
backend repository only.

TradingView Lightweight Charts attribution and license: web/public/licenses.txt
