// Turns new videos from the YouTube channel into news stories (src/news/*.md).
// The publish workflow runs this every few hours, just before the site is built, and saves the
// new stories to the repository. Each video becomes a story once; after that it is a normal story
// that can be edited or deleted in the admin panel (a deleted story is not added again).
// Settings (admin panel → सेटिंग्स → वेबसाइट): "YouTube वीडियो से अपने-आप खबर" and "Shorts से भी".
//
//   node scripts/youtube-to-news.mjs            fetch the channel's feed
//   node scripts/youtube-to-news.mjs feed.xml   use a saved feed (for testing)
import fs from "node:fs";
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

const istDay = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
const yaml = (s) => JSON.stringify(String(s));

export function storyFile(video) {
  const slug = makeSlug(video.title, video.id);
  const fields = [
    ["title", yaml(video.title.replace(/\s+/g, " ").trim())],
    ["slug", slug],
    ["date", video.published],
    ["category", guessCategory(video.title)],
    ["summary", yaml(storySummary(video.description, video.title))],
    ["youtube", `https://www.youtube.com/watch?v=${video.id}`],
    ["author", yaml(site.author || site.name || "")],
    ["lang", "hi"],
    ["featured", "false"],
    ["breaking", "false"],
    ["draft", "false"],
    ["source", "youtube"],
  ];
  const front = fields.map(([k, v]) => `${k}: ${v}`).join("\n");
  const body = storyBody(video.description);
  return { name: `${istDay(video.published)}-${slug}.md`, text: `---\n${front}\n---\n${body}\n` };
}

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

  for (const v of fresh) {
    const { name, text } = storyFile(v);
    fs.writeFileSync(path.join(NEWS_DIR, name), text);
    if (samples.has(v.id)) {
      fs.rmSync(path.join(NEWS_DIR, samples.get(v.id)));
      console.log(`[youtube-news] replaced sample story ${samples.get(v.id)}`);
    }
    known.add(v.id);
    console.log(`[youtube-news] + ${name}`);
  }

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ imported: [...known].sort() }, null, 2) + "\n");
  console.log(`[youtube-news] ${fresh.length} new stories from ${videos.length} videos in the feed`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[youtube-news] failed: ${err.message}`);
    process.exit(1);
  });
}
