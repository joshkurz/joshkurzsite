# SEO Plan — JoshKurz.net Dad Jokes

## Current State (as of March 2026)

### Pages live
| Page | Title | Notes |
|------|-------|-------|
| `/` | Dad Jokes - Vote, Rate & Hear Funny Dad Jokes | FAQ + WebSite schema, OG tags |
| `/top` | Top Rated Dad Jokes - Community Hall of Fame | ItemList schema, ISR |
| `/dashboard` | Highest Rated Dad Jokes - Community Rankings | OG tags |
| `/about` | About - Dad Jokes Website | Feature overview, source list |
| `/speak` | Listen to Dad Jokes Aloud - Text-to-Speech | OG tags |
| `/sitemap.xml` | Dynamic sitemap | Submitted to Search Console |
| `/robots.txt` | Allow all, points to sitemap | Live |

### Joke inventory
- ~50 from fatherhood.gov
- ~420 from icanhazdadjoke.com
- ~466 from reddit.com/r/dadjokes
- Community submissions (growing)

---

## Phase 2 — Content Expansion (Next)

### 1. Category Pages (`/jokes/[category]`)
**Priority: HIGH** — biggest SEO surface area, each page targets a unique long-tail keyword cluster.

Target categories and their keywords:
| Category | URL | Target Keywords |
|----------|-----|-----------------|
| Animals | `/jokes/animals` | animal dad jokes, funny animal jokes, cat jokes, dog jokes |
| Food | `/jokes/food` | food dad jokes, cooking jokes, pizza jokes |
| Science | `/jokes/science` | science jokes, chemistry jokes, biology jokes |
| Technology | `/jokes/technology` | tech jokes, programmer jokes, computer jokes |
| Sports | `/jokes/sports` | sports dad jokes, baseball jokes, football jokes |
| Work | `/jokes/work` | office jokes, work humor, boss jokes |
| School | `/jokes/school` | school jokes, teacher jokes, homework jokes |
| Weather | `/jokes/weather` | weather jokes, rain jokes, winter jokes |

**Implementation plan:**
1. Tag each joke in the dataset with 1-2 categories (do this in the fetch scripts or a separate tagging script)
2. Add `category` field to `fatherhood_jokes.json` and `external_jokes.json`
3. Create `/pages/jokes/[category].js` — static pages via `getStaticPaths` + `getStaticProps` with ISR
4. Add category filter to the homepage random joke button (optional)

---

### 2. "This Week's Best" Page (`/weekly`)
**Priority: MEDIUM** — fresh content signal, encourages repeat visits

- Dynamically shows the top-rated jokes from the past 7 days
- Rebuilt weekly via ISR (`revalidate: 3600`)
- Target keywords: "best dad jokes this week", "funniest dad jokes 2026", "top dad jokes"
- Add to sitemap with `changefreq: weekly`

---

### 3. Submit Page (`/submit`)
**Priority: MEDIUM** — dedicated landing page for user submissions

Currently: submission is a modal on the homepage (not indexable)
Goal: full `/submit` page with:
- Tips for writing a great dad joke
- Examples of top-rated community submissions
- The submission form
- Target keywords: "submit a dad joke", "share your dad joke", "add your own joke"

---

## Phase 3 — Authority Building

### 4. "What Makes a Great Dad Joke?" Guide
**Priority: MEDIUM** — topical authority, link magnet

Long-form content (~1,000 words) covering:
- The anatomy of a dad joke (setup, punchline, groan factor)
- Why bad jokes are psychologically satisfying
- Tips for writing your own
- Examples from the top-rated collection

Target keywords: "how to write a dad joke", "what makes a good dad joke", "dad joke formula"

URL: `/guide` or `/blog/what-makes-a-great-dad-joke`

---

### 5. API Documentation Page (`/api-docs`)
**Priority: LOW-MEDIUM** — developer backlinks, brand mentions

Expose a public `/api/random-joke` endpoint (already exists) with docs:
- How to fetch a random joke
- Response format
- Rate limits
- Example integrations (Slack, Discord, etc.)

Why it matters: developer communities link to APIs. icanhazdadjoke gets significant traffic from devs. Positions joshkurz.net as an alternative/complement.

---

### 6. "Dad Jokes Hall of Fame" Social Sharing
**Priority: LOW** — viral potential, backlinks

- Generate shareable image cards for top-rated jokes (OG image per joke)
- Add Twitter/X share button on the joke UI
- Dynamic OG image per joke via `/api/og?joke=...` (using `@vercel/og`)

---

## Technical SEO Checklist

| Item | Status |
|------|--------|
| Page titles on all pages | ✅ Done |
| Meta descriptions on all pages | ✅ Done |
| Canonical URLs | ✅ Done |
| Open Graph tags | ✅ Done |
| Twitter Card tags | ✅ Done |
| robots.txt | ✅ Done |
| sitemap.xml | ✅ Done |
| FAQ schema (homepage) | ✅ Done |
| WebSite schema (homepage) | ✅ Done |
| ItemList schema (/top) | ✅ Done |
| Submit sitemap to Search Console | ⬜ Do this |
| Verify site in Search Console | ⬜ Do this |
| Core Web Vitals baseline | ⬜ Check in Search Console after deploy |
| Image alt text audit | ⬜ Low priority (minimal images) |
| Internal linking audit | ⬜ Category pages will help significantly |
| Mobile-friendly test | ⬜ Run after next deploy |

---

## Keywords Tracking List

Monitor these in Google Search Console → Performance:

**Primary:**
- dad jokes
- funny dad jokes
- best dad jokes
- dad joke website
- vote on dad jokes
- rate dad jokes

**Secondary:**
- dad joke generator
- AI dad joke generator
- listen to dad jokes
- dad jokes text to speech
- best rated dad jokes
- top dad jokes
- funniest dad jokes

**Long-tail targets (after category pages):**
- animal dad jokes
- food dad jokes
- science jokes for kids
- funny dad jokes about [category]

---

## Recommended Next Actions (in order)

1. ⬜ **Submit sitemap** to Google Search Console: `https://joshkurz.net/sitemap.xml`
2. ⬜ **Request indexing** on homepage, /top, /about via Search Console URL Inspect
3. ⬜ **Validate schemas** at https://search.google.com/test/rich-results
4. ⬜ **Tag jokes by category** (can start with a script that keyword-matches joke text)
5. ⬜ **Build category pages** (`/jokes/[category]`)
6. ⬜ **Add /weekly page** for fresh content signal
7. ⬜ **Add /submit as standalone page**
8. ⬜ **Write the "What Makes a Great Dad Joke?" guide**
