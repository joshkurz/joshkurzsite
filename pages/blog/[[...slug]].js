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

function extractArticleBody(html) {
  if (!html) {
    return '';
  }

  const match = html.match(
    /<div[^>]*class=("|')[^"']*blog-article-body[^"']*\1[^>]*>([\s\S]*?)<\/div>/i
  );

  if (!match) {
    return '';
  }

  return match[2].trim();
}

function replaceArticleBody(documentHtml, newBodyHtml) {
  if (!documentHtml || !newBodyHtml) {
    return documentHtml;
  }

  const bodyPattern = /(<div[^>]*class=("|')[^"']*blog-article-body[^"']*\2[^>]*>)([\s\S]*?)(<\/div>)/i;

  if (bodyPattern.test(documentHtml)) {
    return documentHtml.replace(bodyPattern, `$1${newBodyHtml}$4`);
  }

  const articlePattern = /(<article[^>]*class=("|')[^"']*blog-article[^"']*\2[^>]*>[\s\S]*?)(<\/article>)/i;

  if (articlePattern.test(documentHtml)) {
    return documentHtml.replace(
      articlePattern,
      `$1<div class="blog-article-body">${newBodyHtml}</div>$3`
    );
  }

  return `${documentHtml}\n<div class="blog-article-body">${newBodyHtml}</div>`;
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
