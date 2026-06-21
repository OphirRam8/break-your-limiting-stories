// functions/api/state.js — GET /api/state
// Builds the app state from the Notion "Break Your Limiting Stories — Data" DB:
//   • one Type="State" row holds streaks + habits as a JSON blob (Data prop)
//   • Type="Break" rows are her story-breaks (the Wall of Broken Stories)
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function rtPlain(rt) { return (rt || []).map(r => r.plain_text || "").join(""); }
function headers(token) {
  return { "Authorization": `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
async function proxyError(res) {
  const t = await res.text();
  return json({ error: `Notion ${res.status}: ${t.slice(0, 400)}` }, 500);
}

export async function onRequestGet({ env }) {
  try {
    const { NOTION_TOKEN, NOTION_DB_ID } = env;
    if (!NOTION_TOKEN || !NOTION_DB_ID) return json({ error: "Missing NOTION_TOKEN or NOTION_DB_ID" }, 500);

    const pages = [];
    let cursor;
    do {
      const res = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}/query`, {
        method: "POST", headers: headers(NOTION_TOKEN),
        body: JSON.stringify({ page_size: 100, start_cursor: cursor })
      });
      if (!res.ok) return proxyError(res);
      const data = await res.json();
      pages.push(...(data.results || []));
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    let st = { dayStreak: 0, longestStreak: 0, totalCheckins: 0, milestoneEvery: 7,
               lastBreakDate: null, last7: [0,0,0,0,0,0,0], habits: [] };
    const stories = [];

    for (const p of pages) {
      const props = p.properties || {};
      const type = props.Type?.select?.name;
      if (type === "State") {
        let parsed = {};
        try { parsed = JSON.parse(rtPlain(props.Data?.rich_text) || "{}"); } catch { parsed = {}; }
        st = { ...st, ...parsed, _notionPageId: p.id };
      } else if (type === "Break") {
        const text = rtPlain(props.Story?.rich_text);
        const when = props.When?.created_time;
        const date = props.Date?.date?.start;
        const ts = when ? Date.parse(when) : (date ? Date.parse(date) : Date.now());
        if (text) stories.push({ id: p.id, text, ts });
      }
    }

    stories.sort((a, b) => b.ts - a.ts);
    return json({ ...st, stories, storiesBroken: stories.length });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
