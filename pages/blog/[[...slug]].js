import fs from 'fs/promises';
import path from 'path';
import Head from 'next/head';
import Header from '../../components/Header';
import { loadHtml } from '../../lib/htmlLoader.js';
import { parseMatter } from '../../lib/frontMatter.js';
import styles from '../../styles/BlogPage.module.css';

function buildNavLinks() {
  return [
    { href: '/', label: 'Live Jokes' },
    { href: '/speak', label: 'Speak' },
    { href: '/blog', label: 'Blog' },
    { href: '/dashboard', label: 'Dashboard' }
  ];
}

export default function BlogPage({ title, description, body, slugPath }) {
  const navLinks = buildNavLinks();
  return (
    <>
      <Head>
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        <link rel="canonical" href={`https://joshkurz.com/blog${slugPath}`} />
      </Head>
      <Header navLinks={navLinks} />
      <div className={styles.blogWrapper}>
        <div
          className={styles.blogContent}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
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
          '<div class="blog-article-body">',
          '  <p>The blog will be back shortly. Run <code>npm run build:blog</code> locally to regenerate the static output before deploying.</p>',
          '  <p>Getting that on the page.</p>',
          '</div>'
        ].join('\n');

        return {
          props: {
            title: 'Blog',
            description: null,
            body: fallbackBody,
            slugPath
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
  const title = $('head > title').text() || 'Blog';
  const description = $('meta[name="description"]').attr('content') || null;
  let body = $('body').html() || '';

  if (slug.length && slug[0] === 'posts') {
    const articleBody = extractArticleBody(body);

    if (!articleBody) {
      const preparedBody = await loadPreparedArticleBody(slug);
      if (preparedBody) {
        body = replaceArticleBody(body, preparedBody);
      }
    }
  }

  return {
    props: {
      title,
      description,
      body,
      slugPath
    }
  };
}
