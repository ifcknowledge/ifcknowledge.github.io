// Turns new videos from the YouTube channel into news stories (src/news/*.md).
// The publish workflow runs this every few hours, just before the site is built, and saves the
// new stories to the repository. Each video becomes a story once; after that it is a normal story
// that can be edited or deleted in the admin panel (a deleted story is not added again).
// Settings (admin panel → सेटिंग्स → वेबसाइट): "YouTube वीडियो से अपने-आप खबर" and "Shorts से भी".
//
// With a Google Gemini API key (GitHub secret GEMINI_API_KEY), Gemini watches and listens to each
// video and writes the story from what is said in it. Without a key, or when Gemini fails, the
// video's own description is used as the text. Stories made from a description are rewritten by
// Gemini later, a few per run, as long as nobody has edited them.
//
//   node scripts/youtube-to-news.mjs            fetch the channel's feed
//   node scripts/youtube-to-news.mjs feed.xml   use a saved feed (for testing)
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const NEWS_DIR = path.join(ROOT, "src/news");
const STATE_FILE = path.join(ROOT, "data/youtube-news.json");
const SAMPLE_MARK = "यह एक नमूना (sample) खबर है";

const readJSON = (f, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return fallback;
  }
};
const site = readJSON(path.join(ROOT, "src/_data/site.json"), {});
const categories = (readJSON(path.join(ROOT, "src/_data/categories.json"), {}).list || []).map((c) => c.slug);

// ---------- feed ----------
const decode = (s = "") =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
const pick = (block, re) => {
  const m = block.match(re);
  return m ? m[1].trim() : "";
};

export function parseFeed(xml) {
  return xml
    .split("<entry>")
    .slice(1)
    .map((block) => {
      const id = pick(block, /<yt:videoId>([^<]+)<\/yt:videoId>/);
      const link = pick(block, /<link rel="alternate" href="([^"]+)"/);
      return {
        id,
        title: decode(pick(block, /<title>([^<]*)<\/title>/)),
        published: pick(block, /<published>([^<]+)<\/published>/),
        description: decode(pick(block, /<media:description>([\s\S]*?)<\/media:description>/)),
        isShort: link.includes("/shorts/"),
      };
    })
    .filter((v) => /^[\w-]{11}$/.test(v.id) && v.title && !isNaN(Date.parse(v.published)));
}

// ---------- category from the title ----------
const RULES = [
  ["top-news", /mukhya samachar|मुख्य समाचार|bulletin|बुलेटिन|headlines|सुर्खियां|taaja khabar|ताज़ा खबर|ताजा खबर|breaking news|ब्रेकिंग न्यूज़/i],
  ["gold-silver", /सोन[ाे]|चांदी|चाँदी|gold|silver|sone|sona|chandi|chaandi|bullion/i],
  ["cricket", /क्रिकेट|cricket|\bipl\b|\bt20\b|\bodi\b|ind\s*vs|टीम इंडिया|team india|world cup|वर्ल्ड कप/i],
  ["weather", /मौसम|बारिश|mausam|weather|\bimd\b|ठंड|गर्मी|आंधी|तूफान|cyclone|baarish|barish/i],
  ["sarkari-yojana", /योजना|yojana|scheme|किसान|kisan|pm kisan|ladli|पेंशन|pension|राशन|ration/i],
  ["bank-money", /बैंक|\bbank|\brbi\b|पैसा|paisa|loan|लोन|\bemi\b|upi|सैलरी|salary|टैक्स|\btax|शेयर|sensex|nifty|ipo/i],
  ["new-rules", /नियम|niyam|rule|लागू|बदलाव|badlav|new rules|1 तारीख/i],
  ["tech", /मोबाइल|mobile|फ़ोन|फोन|phone|\b5g\b|सिम|\bsim\b|jio|airtel|internet|whatsapp|ऐप|\bapp\b|गूगल|google/i],
  ["states", /उत्तर प्रदेश|बिहार|राजस्थान|मध्य प्रदेश|हरियाणा|पंजाब|महाराष्ट्र|गुजरात|\bup\b|bihar|rajasthan/i],
];
export function guessCategory(title) {
  for (const [slug, re] of RULES) if (categories.includes(slug) && re.test(title)) return slug;
  return categories.includes("top-news") ? "top-news" : categories[0] || "top-news";
}

// ---------- web address (slug) from the title: Hindi is written in English letters ----------
const CONS = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n", ट: "t", ठ: "th", ड: "d",
  ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n", प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y",
  र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h", क़: "q", ख़: "kh", ग़: "g", ज़: "z", ड़: "r", ढ़: "rh", फ़: "f",
};
const VOWELS = { अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au" };
const SIGNS = { "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o" };
export function romanize(text) {
  const chars = [...text.normalize("NFC")];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i];
    if (chars[i + 1] === "़") ch += chars[++i];
    if (CONS[ch]) {
      out += CONS[ch];
      const next = chars[i + 1];
      if (next === "्") i++;
      else if (SIGNS[next]) (out += SIGNS[next]), i++;
      else if (next && /[ऀ-ॿ]/.test(next) && !"ंँः".includes(next)) out += "a";
    } else if (VOWELS[ch]) out += VOWELS[ch];
    else if (SIGNS[ch]) out += SIGNS[ch];
    else if ("ंँ".includes(ch)) out += "n";
    else if (/[ऀ-ॿ]/.test(ch)) continue;
    else out += ch;
  }
  return out;
}
export function makeSlug(title, id) {
  const words = romanize(title.split("|")[0])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7);
  const tail = id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  return (words.length >= 2 ? `${words.join("-")}-${tail}` : `video-${tail}`).replace(/-+/g, "-");
}

// ---------- story text from the video description ----------
const escapeText = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[{}]/g, (c) => (c === "{" ? "&#123;" : "&#125;"));
export function storyBody(description) {
  const lines = description
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !/^(https?:\/\/\S+\s*)+$/i.test(l)) // bare links (subscribe, other videos)
    .filter((l) => !/^(#\S+\s*)+$/.test(l)); // hashtag-only lines
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
  return escapeText(text).replace(/\n(?!\n)/g, "  \n");
}
export function storySummary(description, title) {
  const line = description
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 20 && !/^https?:\/\//i.test(l) && !/^#/.test(l));
  const s = (line || title).replace(/\s+/g, " ");
  return s.length > 240 ? s.slice(0, 240).replace(/\s+\S*$/, "") + "…" : s;
}

// ---------- story written by Google Gemini from the video itself ----------
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE = process.env.GEMINI_BASE || "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODELS = (process.env.GEMINI_MODEL || "gemini-3.8-flash,gemini-flash-latest,gemini-flash-lite-latest").split(",").map((m) => m.trim());
const GEMINI_PAUSE = Number(process.env.GEMINI_PAUSE_MS ?? 12000); // stay under the free per-minute limit
const AI_PER_RUN = Number(process.env.GEMINI_PER_RUN || 3);

class QuotaError extends Error {}

const PROMPT = (video) => `तुम "${site.name || "IFC knowledge"}" न्यूज़ वेबसाइट के हिंदी पत्रकार हो। यह हमारे YouTube चैनल का वीडियो है।
वीडियो को देखो और सुनो, और उसमें जो बोला और दिखाया गया है उसी के आधार पर एक हिंदी समाचार लेख लिखो।

नियम:
- सिर्फ़ वही तथ्य लिखो जो वीडियो में बोले या दिखाए गए हैं। अपनी तरफ़ से कोई नया तथ्य, आंकड़ा, नाम या तारीख मत जोड़ो।
- आसान, साफ़ हिंदी (देवनागरी) में लिखो, जैसे अख़बार की खबर। अंग्रेज़ी शब्द जैसे IPL, GST, UPI चल सकते हैं।
- "इस वीडियो में", "सब्सक्राइब करें", "लाइक करें", "बेल आइकन" जैसी बातें मत लिखो।
- अगर वीडियो में कई अलग खबरें हैं (जैसे बुलेटिन), तो हर खबर के लिए "## " से छोटा शीर्षक और 1-3 वाक्य लिखो।
- अगर वीडियो में सोना-चांदी के भाव, तारीखें या नियम बताए गए हैं, तो उन्हें सही-सही लिखो।

वीडियो का YouTube शीर्षक: ${video.title}
वीडियो के विवरण की शुरुआत: ${(video.description || "").slice(0, 600)}

JSON में जवाब दो:
- title: खबर का साफ़ हिंदी शीर्षक (100 अक्षरों तक, | या # के बिना)
- summary: 1-2 वाक्य का सार (220 अक्षरों तक)
- body: पूरी खबर Markdown में (150-700 शब्द; पैराग्राफ़, "## " उपशीर्षक और "- " सूची चल सकती है; लिंक नहीं)
- category: इनमें से एक: ${categories.join(", ")}`;

// POST that may wait up to 10 minutes for the answer (fetch() gives up after 5 minutes of waiting
// for the first byte, and Gemini can take longer for a long video).
function postJSON(url, headers, body, timeoutMs = 600000) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = (u.protocol === "http:" ? http : https).request(u, { method: "POST", headers: { ...headers, "content-length": Buffer.byteLength(body) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({ status: res.statusCode, ok: res.statusCode < 300, text }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`no answer after ${timeoutMs / 60000} minutes`)));
    req.on("error", reject);
    req.end(body);
  });
}

async function geminiOnce(model, video, retry = true) {
  const res = await postJSON(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
    JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            // One frame every 5 seconds at low resolution, full audio: long bulletins stay quick and within the free limits
            { file_data: { file_uri: `https://www.youtube.com/watch?v=${video.id}` }, video_metadata: { fps: 0.2 } },
            { text: PROMPT(video) },
          ],
        },
      ],
      generationConfig: {
        mediaResolution: "MEDIA_RESOLUTION_LOW",
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            summary: { type: "STRING" },
            body: { type: "STRING" },
            category: { type: "STRING", enum: categories.length ? categories : ["top-news"] },
          },
          required: ["title", "summary", "body", "category"],
        },
      },
    }),
  );
  const text = res.text;
  if (res.status === 429) throw new QuotaError(`${model}: free limit reached (429) ${text.slice(0, 300)}`);
  if (res.status === 503 && retry) {
    // "high demand" at Google: wait a little and try once more
    await new Promise((r) => setTimeout(r, Number(process.env.GEMINI_RETRY_MS ?? 30000)));
    return geminiOnce(model, video, false);
  }
  if (!res.ok) throw new Error(`${model}: HTTP ${res.status} ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  const out = JSON.parse(json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}");
  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const story = { title: clean(out.title).replace(/[|#]/g, " ").replace(/\s+/g, " "), summary: clean(out.summary), body: String(out.body || "").trim(), category: out.category };
  if (story.title.length < 8 || story.body.length < 200) throw new Error(`${model}: answer too short`);
  return story;
}

// Each model has its own free limit: a model that hit it is skipped for the rest of the run.
const outOfQuota = new Set();

export async function writeWithGemini(video) {
  let lastErr;
  for (const model of GEMINI_MODELS) {
    if (outOfQuota.has(model)) continue;
    try {
      return await geminiOnce(model, video);
    } catch (err) {
      if (err instanceof QuotaError) outOfQuota.add(model);
      console.warn(`[youtube-news]   ${err.message.replace(/\s+/g, " ").slice(0, 400)}`);
      lastErr = err;
    }
  }
  if (GEMINI_MODELS.every((m) => outOfQuota.has(m))) throw new QuotaError("every model reached its free limit");
  throw lastErr;
}

const aiBody = (md) =>
  escapeText(md.replace(/\r/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/https?:\/\/\S+/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 9000));

const istDay = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
const yaml = (s) => JSON.stringify(String(s));

export function storyFile(video, ai = null, slug = makeSlug(video.title, video.id)) {
  const category = ai && categories.includes(ai.category) ? ai.category : guessCategory(video.title);
  const fields = [
    ["title", yaml(ai ? ai.title : video.title.replace(/\s+/g, " ").trim())],
    ["slug", slug],
    ["date", video.published],
    ["category", category],
    ["summary", yaml(ai ? ai.summary : storySummary(video.description, video.title))],
    ["youtube", `https://www.youtube.com/watch?v=${video.id}`],
    ["author", yaml(site.author || site.name || "")],
    ["lang", "hi"],
    ["featured", "false"],
    ["breaking", "false"],
    ["draft", "false"],
    ["source", "youtube"],
    ["text_from", ai ? "video" : "description"],
  ];
  const front = fields.map(([k, v]) => `${k}: ${v}`).join("\n");
  const body = ai ? aiBody(ai.body) : storyBody(video.description);
  return { name: `${istDay(video.published)}-${slug}.md`, text: `---\n${front}\n---\n${body}\n`, body };
}

const hash = (s) => crypto.createHash("sha1").update(s.trim()).digest("hex").slice(0, 16);
const bodyOf = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "");

// ---------- run ----------
const ytId = (s = "") => (s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/) || [])[1];

async function loadFeed(arg) {
  if (arg) return fs.readFileSync(arg, "utf8");
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(site.youtube_channel_id)}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 3) throw err;
      console.warn(`[youtube-news] attempt ${attempt} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

async function main() {
  if (site.youtube_news === false) return console.log("[youtube-news] switched off in settings");
  if (!site.youtube_channel_id) return console.log("[youtube-news] no YouTube channel id in settings");

  const videos = parseFeed(await loadFeed(process.argv[2]));
  const state = readJSON(STATE_FILE, { imported: [] });
  const known = new Set(state.imported);

  // Videos that already have a real story. Untouched sample stories are replaced by the real one.
  const samples = new Map();
  for (const f of fs.readdirSync(NEWS_DIR).filter((f) => f.endsWith(".md"))) {
    const text = fs.readFileSync(path.join(NEWS_DIR, f), "utf8");
    const id = ytId(text.match(/^youtube:\s*(.+)$/m)?.[1]);
    if (!id) continue;
    if (text.includes(SAMPLE_MARK)) samples.set(id, f);
    else known.add(id);
  }

  const fresh = videos
    .filter((v) => !known.has(v.id) && (site.youtube_news_shorts || !v.isShort))
    .sort((a, b) => Date.parse(a.published) - Date.parse(b.published));

  state.hashes ||= {};
  const save = () => {
    state.imported = [...known].sort();
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  };
  // Gemini can take minutes per video: start no new request after this long, so the run ends in time
  const aiUntil = Date.now() + Number(process.env.GEMINI_BUDGET_MS ?? 20 * 60e3);
  let aiLeft = GEMINI_KEY ? AI_PER_RUN : 0;
  let failures = 0;
  let calls = 0;
  const tryAI = async (video) => {
    if (aiLeft <= 0 || Date.now() > aiUntil) return null;
    if (calls++ > 0) await new Promise((r) => setTimeout(r, GEMINI_PAUSE));
    try {
      const story = await writeWithGemini(video);
      aiLeft--;
      failures = 0;
      return story;
    } catch (err) {
      console.warn(`[youtube-news] Gemini could not write ${video.id}: ${err.message.replace(/\s+/g, " ").slice(0, 200)}`);
      // On the free limit, or after two failures in a row, stop asking Gemini in this run.
      if (err instanceof QuotaError || ++failures >= 2) aiLeft = 0;
      return null;
    }
  };

  let added = 0;
  for (const v of fresh) {
    const ai = await tryAI(v);
    // Without Gemini's text, wait for a later run while the video is new; after a day use the description.
    if (!ai && GEMINI_KEY && Date.now() - Date.parse(v.published) < 24 * 3600e3) {
      console.log(`[youtube-news] later: ${v.id} (waiting for Gemini)`);
      continue;
    }
    const { name, text, body } = storyFile(v, ai);
    fs.writeFileSync(path.join(NEWS_DIR, name), text);
    if (samples.has(v.id)) {
      fs.rmSync(path.join(NEWS_DIR, samples.get(v.id)));
      console.log(`[youtube-news] replaced sample story ${samples.get(v.id)}`);
    }
    known.add(v.id);
    state.hashes[v.id] = hash(body);
    save();
    added++;
    console.log(`[youtube-news] + ${name}${ai ? " (written from the video)" : ""}`);
  }

  // Rewrite stories that still have the description as text (newest first), if nobody edited them.
  if (aiLeft > 0) {
    const feedById = new Map(videos.map((v) => [v.id, v]));
    const candidates = fs
      .readdirSync(NEWS_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ f, text: fs.readFileSync(path.join(NEWS_DIR, f), "utf8") }))
      .filter(({ text }) => /^source: youtube$/m.test(text) && !/^text_from: video$/m.test(text))
      .sort((a, b) => b.f.localeCompare(a.f));
    for (const { f, text } of candidates) {
      if (aiLeft <= 0) break;
      const id = ytId(text.match(/^youtube:\s*(.+)$/m)?.[1]);
      const saved = state.hashes[id];
      const untouched = saved ? saved === hash(bodyOf(text)) : !/^text_from:/m.test(text); // stories made before hashes were kept
      if (!id || !untouched) continue;
      const fm = (k) => (text.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1] || "";
      const unq = (v) => (v.startsWith('"') ? JSON.parse(v) : v);
      const video = feedById.get(id) || { id, title: unq(fm("title")), description: "", published: fm("date") };
      video.published = fm("date") || video.published;
      const ai = await tryAI(video);
      if (!ai) continue;
      const { text: newText, body } = storyFile(video, ai, fm("slug") || makeSlug(video.title, id));
      fs.writeFileSync(path.join(NEWS_DIR, f), newText);
      state.hashes[id] = hash(body);
      save();
      console.log(`[youtube-news] rewritten from the video: ${f}`);
    }
  }

  save();
  console.log(`[youtube-news] ${added} new stories from ${videos.length} videos in the feed${GEMINI_KEY ? "" : " (no Gemini key: text from descriptions)"}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[youtube-news] failed: ${err.message}`);
    process.exit(1);
  });
}
