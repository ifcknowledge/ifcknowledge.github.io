// Settings shared by every news story in this folder.
// A story's web address comes from its file name, e.g.
//   src/news/2026-10-23-gold-rate-today.md  ->  /news/2026-10-23-gold-rate-today/
// Drafts and stories with a future date are not published (the site rebuilds every few hours,
// so a scheduled story goes live on the first rebuild after its time).
import path from "node:path";

const NOW = new Date();

export default {
  layout: "layouts/post.njk",
  author: "",
  lang: "hi",
  eleventyComputed: {
    permalink: (data) => {
      if (data.draft) return false;
      if (data.page.date > NOW) return false;
      return `/news/${path.basename(data.page.inputPath, path.extname(data.page.inputPath))}/`;
    },
  },
};
