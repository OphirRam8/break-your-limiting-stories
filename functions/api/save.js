// functions/api/save.js — POST /api/save
// Body: { type:"state", data:{...} }  → upsert the singleton State row (streaks + habits JSON)
//       { type:"break", data:{ text, date } } → create a Break row (Wall of Broken Stories)
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export async function onRequestPost({ request, env }) {
  try {
    const { NOTION_TOKEN, NOTION_DB_ID } = env;
    if (!NOTION_TOKEN || !NOTION_DB_ID) return json({ error: "Missing env" }, 500);

    const body = await request.json();
    const { type, data } = body;

    if (type === "state") {
      const props = {
        "Name": title("⚙️ State"),
        "Type": selectProp("State"),
        "Data": richText(JSON.stringify(data || {})),
        "Streak": numProp(data && data.dayStreak)
      };
      let pageId = body.notionPageId || await findState(NOTION_TOKEN, NOTION_DB_ID);
      const res = pageId
        ? await fetch(`${NOTION_API}/pages/${pageId}`, { method: "PATCH", headers: headers(NOTION_TOKEN), body: JSON.stringify({ properties: props }) })
        : await fetch(`${NOTION_API}/pages`, { method: "POST", headers: headers(NOTION_TOKEN), body: JSON.stringify({ parent: { database_id: NOTION_DB_ID }, properties: props }) });
      if (!res.ok) return proxyError(res);
      const out = await res.json();
      return json({ notionPageId: out.id });
    }

    if (type === "break") {
      const txt = ((data && data.text) || "").trim();
      const date = data && data.date;
      const props = {
        "Name": title(txt ? ("💥 " + txt.slice(0, 60)) : ("💥 Break · " + (date || ""))),
        "Type": selectProp("Break"),
        "Story": richText(txt)
      };
      if (date) props["Date"] = { date: { start: date } };
      const res = await fetch(`${NOTION_API}/pages`, {
        method: "POST", headers: headers(NOTION_TOKEN),
        body: JSON.stringify({ parent: { database_id: NOTION_DB_ID }, properties: props })
      });
      if (!res.ok) return proxyError(res);
      const out = await res.json();
      return json({ notionPageId: out.id });
    }

    return json({ error: "Unknown type" }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function findState(token, dbId) {
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST", headers: headers(token),
    body: JSON.stringify({ page_size: 1, filter: { property: "Type", select: { equals: "State" } } })
  });
  if (!res.ok) return null;
  const d = await res.json();
  return d.results?.[0]?.id || null;
}

/* ---- property builders ---- */
function rt(s) { return [{ type: "text", text: { content: String(s == null ? "" : s).slice(0, 1990) } }]; }
function title(s) { return { title: rt(s) }; }
function richText(s) { return { rich_text: rt(s) }; }
function selectProp(name) { return name ? { select: { name } } : { select: null }; }
function numProp(n) { return (n == null || isNaN(n)) ? { number: null } : { number: Number(n) }; }

function headers(token) {
  return { "Authorization": `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
async function proxyError(res) {
  const t = await res.text();
  return json({ error: `Notion ${res.status}: ${t.slice(0, 400)}` }, 500);
}
