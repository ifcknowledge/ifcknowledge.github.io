# IFC knowledge — free news website

A Hindi + English news website for the **IFC knowledge** YouTube channel
(<https://www.youtube.com/@ifcknowledge1>). It costs nothing to run:

- **Website hosting:** GitHub Pages (free)
- **Admin panel for posting news:** Sveltia CMS at `/admin/` (free, works on a phone)
- **Latest YouTube videos:** read automatically from the channel every 3 hours

---

## 1. Where everything is

| What | Link |
| --- | --- |
| Website | <https://ifcknowledge.github.io/> |
| Admin panel (post news) | <https://ifcknowledge.github.io/admin/> |
| Website files (GitHub repository) | <https://github.com/ifcknowledge/ifcknowledge.github.io> |
| Publish runs (green ✔ = published) | <https://github.com/ifcknowledge/ifcknowledge.github.io/actions> |
| GitHub Pages settings | <https://github.com/ifcknowledge/ifcknowledge.github.io/settings/pages> |

The files live in the free GitHub organization **ifcknowledge**, in a public repository named
`ifcknowledge.github.io`. That name is what gives the website the address `https://ifcknowledge.github.io/`.
Pages is set to **Source: GitHub Actions**, and the website is built from the `main` branch.

**Publish by hand** (normally not needed): open the publish runs link above → **Publish website** (left side) →
**Run workflow** (right side) → green **Run workflow**. Wait 2–3 minutes for the green ✔.

The website updates by itself:

- every time you save a story in the admin panel (1–3 minutes later),
- every 3 hours (new YouTube videos, and stories you scheduled for a later time).

---

## 2. Log in to the admin panel

The admin panel is <https://ifcknowledge.github.io/admin/>. It logs in with a GitHub **access token**
(a long password that only works for this one repository).

**Make the token (one time, and again when it expires):**

1. Open <https://github.com/settings/personal-access-tokens/new>
   (this one *is* in your account settings: your photo → **Settings** → **Developer settings**
   at the bottom of the left menu → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**).
2. **Token name:** any name you haven't used before, e.g. `IFC knowledge admin 2`.
3. **Resource owner:** `ifcknowledge`. **Expiration:** the longest allowed (366 days).
4. **Repository access:** **Only select repositories** → `ifcknowledge/ifcknowledge.github.io`.
5. **Permissions** → **Add permissions** → **Contents** → **Read and write**.
6. **Generate token** and copy it. GitHub shows it only once, so keep it somewhere safe and **never share it**
   (not in screenshots or WhatsApp).
7. If GitHub says the token is **pending approval**, approve it at
   <https://github.com/organizations/ifcknowledge/settings/personal-access-token-requests>.

GitHub emails you before a token expires. Then make a new one the same way and sign in again with it.

**Log in:** open `/admin/` → **Sign In Using Access Token** → paste the token → sign in.
The phone or computer remembers you, so you only do this once per device.

---

## 3. Post news (from phone or computer)

1. Admin panel → **खबरें · News** → **New**.
2. Fill in:
   - **शीर्षक · Headline**
   - **वेब पता · Web address**: 2–5 English words with `-`, e.g. `gold-rate-today`. The date is added automatically.
   - **छोटा सार · Short summary**: 1–2 lines. This is what shows when the story is shared on WhatsApp/Facebook.
   - **श्रेणी · Category**
   - **YouTube वीडियो लिंक**: paste the video link and the story gets a video player. A photo is then optional.
   - **पूरी खबर · Full story**
3. **Save.** The story is on the website 1–3 minutes later.

Useful switches on each story:

- **ब्रेकिंग** — shows the headline in the red Breaking ticker.
- **होम पेज की सबसे बड़ी खबर** — makes it the big lead story on the home page.
- **ड्राफ्ट** — saves without publishing.
- **छपने का समय** — set a future time to publish it automatically later (it goes live at the next 3-hourly update after that time).

The 7 stories already on the site are **samples** (each one says so at the top). Edit or delete them from the admin panel.

### Gold & silver rates box

The box fills itself. Every time the website updates (every 3 hours), it reads the official
**IBJA** rates from <https://ibjarates.com>: gold 999 (24 carat) and 916 (22 carat) per 10 g, and
silver 999 per kg. It shows the newest rate of the day — AM (around noon) or PM (evening) — with
▲/▼ for the change from the previous day's evening rate. If IBJA is down, the last good rates stay.

To type rates by hand instead: admin panel → **सोना-चांदी भाव · Gold rates** → switch off
**अपने-आप भाव (IBJA)** → fill in the rates (e.g. `₹ 1,25,400`, change `+500` or `-300`) → **Save**.
To hide the box, switch off **वेबसाइट पर दिखाएं**.

### Settings

Admin panel → **सेटिंग्स · Settings** → **वेबसाइट**: site name, tagline, contact email,
Facebook / Instagram / X / Telegram / WhatsApp channel links. Under **श्रेणियां** you can add or rename menu categories.

---

## 4. Own domain like www.ifcknowledge.com (optional — this one costs money)

Everything above is free. A `.com` name costs about ₹800–1,200 per year at a domain seller
(GoDaddy, Hostinger, Namecheap, Cloudflare, etc.).
On 23 Oct 2026, `ifcknowledge.com` was not registered yet.

After buying it:

1. At the domain seller, add these DNS records (and delete any other `A` records for `@`):

   | Type | Name / Host | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `ifcknowledge.github.io` |

2. Open <https://github.com/ifcknowledge/ifcknowledge.github.io/settings/pages> →
   **Custom domain** → `ifcknowledge.com` → **Save**. The DNS check can take up to 24 hours.
   Guide: <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site>
3. When the check turns green, tick **Enforce HTTPS**.
4. Run **Publish website** once by hand (see section 1), so every link switches to the new address.
   The admin panel moves to `https://ifcknowledge.com/admin/`; sign in there once more.

---

## For developers

Built with [Eleventy](https://www.11ty.dev/) 3. Needs Node.js 20 or newer.

```sh
npm install
npm start        # preview at http://localhost:8080
npm run build    # output in _site/
```

| Path | What it is |
| --- | --- |
| `src/news/*.md` | News stories (file name = web address) |
| `src/pages/*.md` | About, Contact, Privacy Policy, Disclaimer |
| `src/_data/site.json` | Site name, links, settings |
| `src/_data/categories.json` | Menu categories |
| `src/_data/rates.json` | Gold & silver rates box |
| `src/_data/channel.js` | Loads the latest YouTube videos at build time |
| `src/admin/` | Admin panel page and its settings (`config.yml.njk`) |
| `src/_includes/` | Page layouts and reusable parts |
| `src/assets/` | CSS, JavaScript, icons |
| `eleventy.config.js` | Build settings |
| `.github/workflows/deploy.yml` | Builds and publishes to GitHub Pages |

The build reads `SITE_URL` and `PATH_PREFIX` from GitHub Pages automatically, so the same files
work at `username.github.io/repo/` and on a custom domain.
