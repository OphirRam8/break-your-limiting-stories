# Break Your Limiting Stories — Andrea's tracker

Fun, experiential habit/streak dashboard for coaching client Andrea.

- Static front-end in `public/index.html` (Claude Design, wired to the backend).
- Cloudflare Pages Functions in `functions/api/` proxy to a Notion database.
- Env vars (set in the Pages project): `NOTION_TOKEN`, `NOTION_DB_ID`.

Daily action: "Break a Story" (optional text → Wall of Broken Stories) drives a
once-per-day streak. Plus a Habits tab with per-item streaks. Notion-backed.
