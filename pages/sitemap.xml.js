import { CATEGORIES } from '../lib/categories'

const SITE_URL = 'https://joshkurz.net'

const STATIC_PAGES = [
  { url: '/',        changefreq: 'daily',   priority: '1.0' },
  { url: '/best-dad-jokes', changefreq: 'daily', priority: '0.9' },
  { url: '/weekly',  changefreq: 'weekly',  priority: '0.85' },
  { url: '/submit',  changefreq: 'monthly', priority: '0.75' },
  { url: '/dashboard', changefreq: 'daily', priority: '0.8' },
  { url: '/guide',   changefreq: 'monthly', priority: '0.7' },
  { url: '/about',   changefreq: 'monthly', priority: '0.6' },
  { url: '/speak',   changefreq: 'monthly', priority: '0.5' },
]

const CATEGORY_PAGES = CATEGORIES.map(cat => ({
  url: `/jokes/${cat}`,
  changefreq: 'weekly',
  priority: '0.8',
}))

function buildSitemap(pages) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(({ url, changefreq, priority }) => `  <url>
    <loc>${SITE_URL}${url}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>`
}

export default function Sitemap() {}

export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate')
  res.write(buildSitemap([...STATIC_PAGES, ...CATEGORY_PAGES]))
  res.end()
  return { props: {} }
}
