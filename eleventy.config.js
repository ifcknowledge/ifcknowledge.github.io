// Eleventy settings for the IFC knowledge news site.
// Docs: https://www.11ty.dev/docs/
import fs from "node:fs";
import path from "node:path";
import { HtmlBasePlugin } from "@11ty/eleventy";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";

const TZ = "Asia/Kolkata";
const NEWS_PER_CATEGORY_PAGE = 12;
const NOW = new Date();

const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const site = readJSON("src/_data/site.json");

// GitHub Actions passes these in (see .github/workflows/deploy.yml).
// PATH_PREFIX is "/repo-name/" for a project site, "/" for user.github.io or a custom domain.
const PATH_PREFIX = `/${(process.env.PATH_PREFIX || "").replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
const SITE_URL = (process.env.SITE_URL || site.url || process.env.URL || "http://localhost:8080").replace(/\/+$/, "");

// ---------- helpers ----------
const toDate = (value) => (value instanceof Date ? value : new Date(value));
const validDate = (value) => value && !Number.isNaN(toDate(value).getTime());
const fmt = (options, locale = "hi-IN") => new Intl.DateTimeFormat(locale, { timeZone: TZ, ...options });
const dateFmt = fmt({ day: "numeric", month: "long", year: "numeric" });
const weekdayFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = fmt({ hour: "numeric", minute: "2-digit", hour12: true });

const isPublished = (item) => !item.data.draft && item.date <= NOW;
const byNewest = (a, b) => b.date - a.date;

function withPrefix(url = "") {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return url;
  return PATH_PREFIX.replace(/\/$/, "") + url;
}

function absUrl(url = "/") {
  if (!url) return SITE_URL + "/";
  if (/^[a-z]+:/i.test(url) || url.startsWith("//")) return url;
  return SITE_URL + (url.startsWith("/") ? url : `/${url}`);
}

function youtubeId(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  const m = text.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  return m ? m[1] : "";
}

function categoryList() {
  return readJSON("src/_data/categories.json").list || [];
}

function categoryInfo(slug) {
  const found = categoryList().find((c) => c.slug === slug);
  return found || { slug: slug || "news", name: slug || "खबर", name_en: "", color: "#c8102e", description: "" };
}

function stripHtml(html = "") {
  return String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(text = "") {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function liteYoutube(id, label = "YouTube वीडियो") {
  return (
    `<button class="yt-player" type="button" data-yt="${id}" aria-label="वीडियो चलाएं: ${escapeHtml(label)}">` +
    `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" decoding="async">` +
    `<span class="play-badge"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>` +
    `<span class="yt-player__label">▶ वीडियो देखें</span></button>`
  );
}

export default function (eleventyConfig) {
  // Root-relative links like href="/news/" get the GitHub Pages path prefix automatically.
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Markdown: auto-link plain URLs. Posts are plain Markdown (no template code), so
  // typing "{{" in a news story can never break the build.
  eleventyConfig.amendLibrary("md", (md) => md.set({ linkify: true, breaks: true }));

  // ---------- files copied as-is ----------
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  // Admin panel page (Sveltia CMS). Its config.yml is generated from src/admin/config.yml.njk.
  eleventyConfig.addPassthroughCopy({ "src/admin/index.html": "admin/index.html" });

  // ---------- collections ----------
  eleventyConfig.addCollection("news", (api) =>
    api.getFilteredByGlob("src/news/*.md").filter(isPublished).sort(byNewest),
  );

  // Same stories oldest-first: the feed plugin reverses its collection to put the newest first.
  eleventyConfig.addCollection("newsOldestFirst", (api) =>
    api.getFilteredByGlob("src/news/*.md").filter(isPublished).sort((a, b) => a.date - b.date),
  );

  eleventyConfig.addCollection("sitePages", (api) =>
    api
      .getFilteredByGlob("src/pages/*.md")
      .filter((p) => !p.data.draft)
      .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99)),
  );

  // One entry per category page: /category/<slug>/, /category/<slug>/page/2/, …
  eleventyConfig.addCollection("categoryPages", (api) => {
    const news = api.getFilteredByGlob("src/news/*.md").filter(isPublished).sort(byNewest);
    const pages = [];
    for (const cat of categoryList()) {
      const posts = news.filter((p) => p.data.category === cat.slug);
      const total = Math.max(1, Math.ceil(posts.length / NEWS_PER_CATEGORY_PAGE));
      for (let i = 0; i < total; i++) {
        pages.push({
          cat,
          posts: posts.slice(i * NEWS_PER_CATEGORY_PAGE, (i + 1) * NEWS_PER_CATEGORY_PAGE),
          pageNumber: i,
          totalPages: total,
          base: `/category/${cat.slug}/`,
        });
      }
    }
    return pages;
  });

  // ---------- filters ----------
  eleventyConfig.addFilter("hiDate", (d) => (validDate(d) ? dateFmt.format(toDate(d)) : ""));
  eleventyConfig.addFilter("hiWeekdayDate", (d) => (validDate(d) ? weekdayFmt.format(toDate(d)) : ""));
  eleventyConfig.addFilter("hiDateTime", (d) =>
    validDate(d) ? `${dateFmt.format(toDate(d))}, ${timeFmt.format(toDate(d))}` : "",
  );
  eleventyConfig.addFilter("isoDate", (d) => (validDate(d) ? toDate(d).toISOString() : ""));

  eleventyConfig.addFilter("absUrl", absUrl);
  // The same page translated to English by Google Translate (the "English" button at the top).
  // ifcknowledge.github.io -> ifcknowledge-github-io.translate.goog
  eleventyConfig.addFilter("englishUrl", (url) => {
    const u = new URL(absUrl(url));
    if (!/\./.test(u.hostname) || u.hostname === "localhost") return u.toString();
    u.hostname = u.hostname.replace(/-/g, "--").replace(/\./g, "-") + ".translate.goog";
    for (const [k, v] of [["_x_tr_sl", "hi"], ["_x_tr_tl", "en"], ["_x_tr_hl", "en"], ["_x_tr_pto", "wapp"]]) u.searchParams.set(k, v);
    return u.toString();
  });
  eleventyConfig.addFilter("withPrefix", withPrefix);
  eleventyConfig.addFilter("pageHref", (base, n) => (n > 0 ? `${base}page/${n + 1}/` : base));
  eleventyConfig.addFilter("youtubeId", youtubeId);
  eleventyConfig.addFilter("categoryInfo", categoryInfo);

  eleventyConfig.addFilter("head", (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : []));
  eleventyConfig.addFilter("slice2", (arr, start, end) => (Array.isArray(arr) ? arr.slice(start, end) : []));
  eleventyConfig.addFilter("without", (arr, item) => (Array.isArray(arr) ? arr.filter((p) => p !== item) : []));
  eleventyConfig.addFilter("inCategory", (arr, slug) => (arr || []).filter((p) => p.data.category === slug));

  // Lead story on the home page: newest "featured" story from the last 3 days, else the newest story.
  eleventyConfig.addFilter("featured", (arr) => {
    if (!arr || !arr.length) return null;
    const recent = NOW.getTime() - 3 * 24 * 3600 * 1000;
    return arr.find((p) => p.data.featured && p.date.getTime() >= recent) || arr[0];
  });

  // Breaking ticker: stories marked "breaking" from the last 2 days, else the latest headlines.
  eleventyConfig.addFilter("breaking", (arr, n = 6) => {
    if (!arr) return [];
    const recent = NOW.getTime() - 2 * 24 * 3600 * 1000;
    const marked = arr.filter((p) => p.data.breaking && p.date.getTime() >= recent);
    return (marked.length ? marked : arr).slice(0, n);
  });

  eleventyConfig.addFilter("related", (arr, url, category, n = 5) => {
    if (!arr) return [];
    const same = arr.filter((p) => p.url !== url && p.data.category === category);
    const others = arr.filter((p) => p.url !== url && p.data.category !== category);
    return [...same, ...others].slice(0, n);
  });

  eleventyConfig.addFilter("readingTime", (html) => {
    const words = stripHtml(html).split(" ").filter(Boolean).length;
    return `${Math.max(1, Math.round(words / 200))} मिनट`;
  });

  eleventyConfig.addFilter("splitName", (name = "") => {
    const parts = String(name).trim().split(/\s+/);
    return [parts[0] || "", parts.slice(1).join(" ")];
  });

  // Polishes story HTML: lazy images, external links open in a new tab,
  // and a YouTube link on its own line becomes a video player.
  eleventyConfig.addFilter("enhanceContent", (html = "") =>
    String(html)
      .replace(/<p>\s*(?:<a [^>]*href="([^"]+)"[^>]*>[^<]*<\/a>|(https?:\/\/[^\s<]+))\s*<\/p>/g, (match, href, bare) => {
        const id = youtubeId(href || bare);
        return id ? liteYoutube(id) : match;
      })
      .replace(/<img (?![^>]*\bloading=)/g, '<img loading="lazy" decoding="async" ')
      .replace(/<a href="(https?:\/\/[^"]+)"(?![^>]*\btarget=)/g, (match, href) =>
        href.startsWith(SITE_URL) ? match : `<a href="${href}" target="_blank" rel="noopener"`,
      ),
  );

  // JSON for <script type="application/ld+json"> — "<" is escaped so a headline can't end the script tag.
  eleventyConfig.addFilter("jsonLd", (obj) => JSON.stringify(obj).replace(/</g, "\\u003c"));

  // Small search index used by /search/ (title, summary, category, date, link, picture).
  eleventyConfig.addFilter("searchIndex", (arr = []) =>
    JSON.stringify(
      arr.map((p) => {
        const cat = categoryInfo(p.data.category);
        const ytid = youtubeId(p.data.youtube);
        return {
          t: p.data.title || "",
          s: p.data.summary || "",
          c: cat.name,
          ce: cat.name_en || "",
          cc: cat.color,
          d: dateFmt.format(p.date),
          u: withPrefix(p.url),
          i: p.data.image ? withPrefix(p.data.image) : ytid ? `https://i.ytimg.com/vi/${ytid}/hqdefault.jpg` : "",
        };
      }),
    ),
  );

  // ---------- global data ----------
  eleventyConfig.addGlobalData("build", {
    now: NOW,
    year: NOW.getFullYear(),
    version: NOW.getTime().toString(36),
    siteUrl: SITE_URL,
    pathPrefix: PATH_PREFIX,
    repo: process.env.CMS_REPO || process.env.GITHUB_REPOSITORY || "",
    branch: process.env.CMS_BRANCH || process.env.GITHUB_REF_NAME || "main",
  });

  // ---------- RSS / Atom feed at /feed.xml ----------
  eleventyConfig.addPlugin(feedPlugin, {
    type: "atom",
    outputPath: "/feed.xml",
    collection: { name: "newsOldestFirst", limit: 30 },
    metadata: {
      language: "hi",
      title: site.name,
      subtitle: site.description,
      // The feed plugin adds the path prefix itself, so it only needs the origin here.
      base: new URL(SITE_URL).origin + "/",
      author: { name: site.author || site.name },
    },
  });

  eleventyConfig.addWatchTarget("src/assets/");
}

export const config = {
  dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
  pathPrefix: PATH_PREFIX,
  markdownTemplateEngine: false,
  htmlTemplateEngine: "njk",
  templateFormats: ["md", "njk"],
};
