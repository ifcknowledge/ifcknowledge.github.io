// Settings shared by the simple pages in this folder (About, Contact, Privacy…).
export default {
  layout: "layouts/page.njk",
  eleventyComputed: {
    permalink: (data) => (data.draft ? false : `/${data.page.fileSlug}/`),
  },
};
