import { searchRecords } from "../lib/db.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const ALLOWED = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_HISTORY = 10;
const MAX_CHARS = 2000;
const MAX_TOOL_ROUNDS = 4;

const SYSTEM =
  process.env.SYSTEM_PROMPT ||
  `You are the assistant on our website. Answer visitors' questions using only what the search_database tool returns.
If the tool returns nothing relevant, say you couldn't find that and suggest contacting the team.
Keep answers short, friendly and in plain language. Reply in the language the visitor uses.`;

const TOOLS = [
  {
    name: "search_database",
    description: "Search our database for information relevant to the visitor's question. Returns up to 5 records.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Short keyword query" } },
      required: ["query"],
    },
  },
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED.includes("*")) res.setHeader("Access-Control-Allow-Origin", "*");
  else if (origin && ALLOWED.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanMessages(input) {
  if (!Array.isArray(input)) return null;
  const msgs = input
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_HISTORY);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs.length && msgs[msgs.length - 1].role === "user" ? msgs : null;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const origin = req.headers.origin;
  if (!ALLOWED.includes("*") && origin && !ALLOWED.includes(origin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  const messages = cleanMessages(req.body?.messages);
  if (!messages) return res.status(400).json({ error: "Send { messages: [{ role, content }] } ending with a user message" });

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages }),
      });

      if (!r.ok) {
        console.error("Anthropic API error", r.status, await r.text());
        return res.status(502).json({ error: "The assistant is unavailable right now." });
      }

      const data = await r.json();

      if (data.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: data.content });
        const results = [];
        for (const block of data.content.filter((b) => b.type === "tool_use")) {
          try {
            const rows = await searchRecords(block.input?.query ?? "");
            results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(rows) });
          } catch (err) {
            console.error("Database error", err);
            results.push({ type: "tool_result", tool_use_id: block.id, content: "Database error", is_error: true });
          }
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      const reply = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return res.status(200).json({ reply: reply || "Sorry, I couldn't come up with an answer." });
    }
    return res.status(200).json({ reply: "Sorry, I couldn't find an answer. Please try rephrasing." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
