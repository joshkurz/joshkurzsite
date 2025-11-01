import fs from 'fs/promises';
import path from 'path';
import Head from 'next/head';
import { loadHtml } from '../../lib/htmlLoader.js';
import { parseMatter } from '../../lib/frontMatter.js';

export default function BlogPage({
  title,
  body,
  slugPath,
  metaTags = [],
  linkTags = []
}) {
  const canonicalHref = `https://joshkurz.com/blog${slugPath}`;
  const hasCanonicalLink = linkTags.some(
    (attrs) => typeof attrs.rel === 'string' && attrs.rel.toLowerCase() === 'canonical'
  );

  return (
    <>
      <Head>
        {title ? <title>{title}</title> : null}
        {metaTags.map((attributes, index) => (
          <meta key={`meta-${index}`} {...attributes} />
        ))}
        {linkTags.map((attributes, index) => (
          <link key={`link-${index}`} {...attributes} />
        ))}
        {!hasCanonicalLink ? (
          <link rel="canonical" href={canonicalHref} />
        ) : null}
      </Head>
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}

function formatSlugPath(slug = []) {
  if (!slug.length) {
    return '/';
  }
  return `/${slug.join('/')}/`;
}

function findArticleBodyRange(html = '') {
  const openPattern = /<div[^>]*class=("|')[^"']*blog-article-body[^"']*\1[^>]*>/i;
  const openMatch = openPattern.exec(html);

  if (!openMatch || typeof openMatch.index !== 'number') {
    return null;
  }

  const startIndex = openMatch.index;
  const openTagLength = openMatch[0].length;
  const innerStart = startIndex + openTagLength;
  const search = html.slice(innerStart);
  const tagPattern = /<div\b[^>]*>|<\/div\s*>/gi;
  let depth = 1;
  let match;

  while ((match = tagPattern.exec(search))) {
    const token = match[0];
    const isClosing = /^<\/div/i.test(token);

    if (isClosing) {
      depth -= 1;
      if (depth === 0) {
        const innerEnd = innerStart + match.index;
        const endIndex = innerEnd + token.length;
        return { startIndex, endIndex, innerStart, innerEnd };
      }
    } else {
      depth += 1;
    }
  }

  return null;
}

function stripHtmlComments(html = '') {
  return html.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function extractArticleBody(html) {
  if (!html) {
    return '';
  }

  const range = findArticleBodyRange(html);
  if (!range) {
    return '';
  }

  return html.slice(range.innerStart, range.innerEnd).trim();
}

function hasMeaningfulArticleBody(html) {
  if (!html) {
    return false;
  }

  const trimmed = html.trim();
  if (!trimmed) {
    return false;
  }

  return stripHtmlComments(trimmed).length > 0;
}

function replaceArticleBody(documentHtml, newBodyHtml) {
  if (!documentHtml || !newBodyHtml) {
    return documentHtml;
  }

  const trimmedBody = newBodyHtml.trim();
  if (!trimmedBody) {
    return documentHtml;
  }

  const range = findArticleBodyRange(documentHtml);
  if (range) {
    return (
      documentHtml.slice(0, range.innerStart) +
      trimmedBody +
      documentHtml.slice(range.innerEnd)
    );
  }

  const articlePattern = /<article[^>]*class=("|')[^"']*blog-article[^"']*\1[^>]*>/i;
  const articleMatch = articlePattern.exec(documentHtml);

  if (articleMatch && typeof articleMatch.index === 'number') {
    const insertIndex = articleMatch.index + articleMatch[0].length;
    return (
      documentHtml.slice(0, insertIndex) +
      `<div class="blog-article-body">${trimmedBody}</div>` +
      documentHtml.slice(insertIndex)
    );
  }

  return (
    `${documentHtml}\n<div class="blog-article-body">${trimmedBody}</div>`
  );
}

async function loadPreparedArticleBody(slugParts) {
  if (!Array.isArray(slugParts) || slugParts.length === 0) {
    return '';
  }

  const contentDir = path.join(process.cwd(), 'blog', 'content');
  const targetPath = path.join(contentDir, ...slugParts, 'index.md');

  let raw;
  try {
    raw = await fs.readFile(targetPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  }

  const parsed = parseMatter(raw);
  const content = parsed.content || '';
  const $ = loadHtml(content);
  const preparedBody = $('.blog-article-body').first().html();

  if (typeof preparedBody === 'string' && preparedBody.trim()) {
    return preparedBody.trim();
  }

  const extracted = extractArticleBody(content);
  if (extracted) {
    return extracted;
  }

  return content.trim();
}

async function discoverBlogPaths(baseDir) {
  const paths = new Set();

  async function walk(currentDir, segments = []) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    let hasIndex = false;

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath, [...segments, entry.name]);
      } else if (entry.isFile() && entry.name === 'index.html') {
        hasIndex = true;
      }
    }

    if (segments.length && hasIndex) {
      paths.add(JSON.stringify({ params: { slug: segments } }));
    }
  }

  await walk(baseDir);
  return Array.from(paths, (value) => JSON.parse(value));
}

export async function getStaticPaths() {
  const baseDir = path.join(process.cwd(), 'public', 'blog');
  let discoveredPaths = [];
  try {
    discoveredPaths = await discoverBlogPaths(baseDir);
  } catch (error) {
    console.warn('[blog] Unable to discover static blog paths:', error);
  }

  discoveredPaths.push({ params: { slug: [] } });

  return {
    paths: discoveredPaths,
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const slug = params?.slug ?? [];
  const slugPath = formatSlugPath(slug);
  const baseDir = path.join(process.cwd(), 'public', 'blog');
  const relativePath = slug.length ? path.join(...slug, 'index.html') : 'index.html';
  const filePath = path.join(baseDir, relativePath);

  let html;
  try {
    html = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      if (slug.length === 0) {
        const fallbackBody = [
          '<div class="blog-page">',
          '  <article class="blog-article">',
          '    <div class="blog-article-body">',
          '      <p>The blog will be back shortly. Run <code>npm run build:blog</code> locally to regenerate the static output before deploying.</p>',
          '      <p>Getting that on the page.</p>',
          '    </div>',
          '  </article>',
          '</div>'
        ].join('\n');

        return {
          props: {
            title: 'Blog',
            body: fallbackBody,
            slugPath,
            metaTags: [],
            linkTags: []
          }
        };
      }

      return {
        notFound: true
      };
    }

    throw error;
  }

  const $ = loadHtml(html);
  const title = $('head > title').first().text() || 'Blog';
  const metaTags = $('head > meta')
    .toArray()
    .map((element) => normalizeAttributes(element.attribs ?? {}));
  const linkTags = $('head > link')
    .toArray()
    .map((element) => normalizeAttributes(element.attribs ?? {}));
  let body = $('body').html() || '';

  if (slug.length && slug[0] === 'posts') {
    const articleBody = extractArticleBody(body);

    if (!hasMeaningfulArticleBody(articleBody)) {
      const preparedBody = await loadPreparedArticleBody(slug);
      if (preparedBody) {
        body = replaceArticleBody(body, preparedBody);
      }
    }
  }

  return {
    props: {
      title,
      body,
      slugPath,
      metaTags,
      linkTags
    }
  };
}

function normalizeAttributes(attributes = {}) {
  const normalized = {};
  for (const [rawKey, value] of Object.entries(attributes)) {
    const key = normalizeAttributeName(rawKey);
    if (typeof value !== 'undefined') {
      normalized[key] = value;
    }
  }
  return normalized;
}

function normalizeAttributeName(name) {
  if (name === 'class') {
    return 'className';
  }
  if (name === 'charset') {
    return 'charSet';
  }
  if (name === 'http-equiv') {
    return 'httpEquiv';
  }
  return name;
}
