// Latest videos from the YouTube channel, read from YouTube's public RSS feed
// every time the site is built (GitHub rebuilds the site every few hours).
// YouTube's feed sometimes fails for a while, so the last good list is kept in
// .cache/ and reused. If there is nothing at all, the site still builds — the
// video boxes are simply hidden.
import fs from "node:fs";
import Fetch from "@11ty/eleventy-fetch";

const site = JSON.parse(fs.readFileSync(new URL("./site.json", import.meta.url), "utf8"));
const LAST_GOOD = ".cache/channel-videos.json";

function decode(text = "") {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function pick(block, re) {
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function parseFeed(xml) {
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
        url: link || `https://www.youtube.com/watch?v=${id}`,
        thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        isShort: link.includes("/shorts/"),
      };
    })
    .filter((v) => /^[\w-]{11}$/.test(v.id));
}

async function load(feedUrl) {
  const xml = await Fetch(feedUrl, {
    duration: "1h",
    type: "text",
    fetchOptions: { signal: AbortSignal.timeout(20000) },
  });
  const videos = parseFeed(xml);
  if (!videos.length) throw new Error("the feed had no videos");
  return videos;
}

function readLastGood() {
  try {
    return JSON.parse(fs.readFileSync(LAST_GOOD, "utf8"));
  } catch {
    return [];
  }
}

export default async function () {
  const channelId = (site.youtube_channel_id || "").trim();
  if (site.show_videos === false || !channelId) return { videos: [] };

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const videos = await load(feedUrl);
      fs.mkdirSync(".cache", { recursive: true });
      fs.writeFileSync(LAST_GOOD, JSON.stringify(videos));
      console.log(`[channel] loaded ${videos.length} YouTube videos`);
      return { videos };
    } catch (err) {
      console.warn(`[channel] YouTube feed attempt ${attempt} failed: ${err.message}`);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const videos = readLastGood();
  console.warn(`[channel] using ${videos.length} videos saved from an earlier build`);
  return { videos };
}
