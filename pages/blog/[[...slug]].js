import fs from 'fs/promises';
import path from 'path';
import Head from 'next/head';
import { load as loadHtml } from 'cheerio';
import Header from '../../components/Header';
import styles from '../../styles/BlogPage.module.css';

function buildNavLinks() {
  return [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/speak', label: 'Speak' },
    { href: '/blog', label: 'Blog' }
  ];
}

export default function BlogPage({ title, description, body, slugPath }) {
  const navLinks = buildNavLinks();
  return (
    <>
      <Head>
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        <link rel="stylesheet" href="/blog/styles.css" />
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

  const html = await fs.readFile(filePath, 'utf8');
  const $ = loadHtml(html);
  const title = $('head > title').text() || 'Blog';
  const description = $('meta[name="description"]').attr('content') || null;
  const body = $('body').html() || '';

  return {
    props: {
      title,
      description,
      body,
      slugPath
    }
  };
}
