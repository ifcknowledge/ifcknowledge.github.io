# IFC knowledge — free news website

A Hindi + English news website for the **IFC knowledge** YouTube channel
(<https://www.youtube.com/@ifcknowledge1>). It costs nothing to run:

- **Website hosting:** GitHub Pages (free)
- **Admin panel for posting news:** Sveltia CMS at `/admin/` (free, works on a phone)
- **Latest YouTube videos:** read automatically from the channel every 3 hours

---

## 1. Put the website online (one time, about 10 minutes)

All of this is done on github.com, in the browser. A phone works too, but a computer is easier.

1. **Make the repository public.** Free GitHub Pages only works for public repositories.
   Repository → **Settings** → scroll to the bottom (**Danger Zone**) →
   **Change visibility** → **Make public**.
   Only website files are in here, so nothing private is exposed.

2. **(Optional) Give the repository a nicer name.** The repository name is part of the web address:

   | Repository name | Website address |
   | --- | --- |
   | `om` | `https://omkrishna89.github.io/om/` |
   | `ifc-knowledge` | `https://omkrishna89.github.io/ifc-knowledge/` |

   To rename: **Settings** → **General** → **Repository name** → type the new name → **Rename**.

3. **Make the website branch the main branch.** The website must live on a branch called `main`.
   Open the **branches** page (`Code` tab → the branch drop-down → **View all branches**),
   click the ✏️ pencil next to the branch that holds these files, rename it to `main`, and confirm.

4. **Turn on GitHub Pages.** **Settings** → **Pages** → under **Build and deployment**,
   set **Source** to **GitHub Actions**.

5. **Publish for the first time.** **Actions** tab → **Publish website** (left side) →
   **Run workflow** → **Run workflow**. Wait 2–3 minutes until it shows a green ✔.
   The website address is shown on **Settings** → **Pages**.

After this, the website updates by itself:

- every time you save a story in the admin panel (1–3 minutes later),
- every 3 hours (new YouTube videos, and stories you scheduled for a later time).

---

## 2. Log in to the admin panel

The admin panel is your website address + `/admin/`, for example
`https://omkrishna89.github.io/om/admin/`. It logs in with a GitHub **access token**
(a long password that only works for this one repository).

**Make the token (one time):**

1. On GitHub: your photo (top right) → **Settings** → **Developer settings** (at the bottom of the left menu) →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name:** `IFC knowledge admin`. **Expiration:** pick the longest allowed, and make a new token when it runs out.
3. **Repository access:** **Only select repositories** → pick this website's repository.
4. **Permissions** → **Repository permissions** → **Contents** → **Read and write**.
5. **Generate token** and copy it. GitHub shows it only once, so keep it somewhere safe and **never share it**.

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

Admin panel → **सोना-चांदी भाव · Gold rates** → type today's prices (e.g. `₹ 1,25,400`), and for
change something like `+500` or `-300` → **Save**. Until you do this, the box shows `₹ 0`.
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

1. On GitHub: **Settings** → **Pages** → **Custom domain** → `www.ifcknowledge.com` → **Save**.
   GitHub shows the DNS records to add at the domain seller.
   Guide: <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site>
2. When the check turns green, tick **Enforce HTTPS**.
3. **Actions** → **Publish website** → **Run workflow**, so every link switches to the new address.

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
