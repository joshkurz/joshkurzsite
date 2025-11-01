import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { loadHtml } from '../lib/htmlLoader.js';
import { parseMatter } from '../lib/frontMatter.js';

const scriptFilename = fileURLToPath(import.meta.url);
const scriptDirname = path.dirname(scriptFilename);
const projectRoot = path.join(scriptDirname, '..');
const blogDir = path.join(projectRoot, 'blog');
const destinationDir = path.join(projectRoot, 'public', 'blog');
const postsDir = path.join(blogDir, 'content', 'posts');
const indexMarkdownPath = path.join(blogDir, 'content', '_index.md');
const staticAssetsDir = path.join(blogDir, 'static');
const allowedIndexFiles = new Set(['index.html', 'index.md']);

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function emptyDir(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await ensureDir(targetPath);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function formatDateParts(input) {
  if (!input) {
    return { iso: null, human: null };
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return { iso: null, human: null };
  }

  const human = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return { iso: date.toISOString(), human };
}

async function copyStaticAssets() {
  try {
    await fs.cp(staticAssetsDir, destinationDir, { recursive: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn('[blog] Unable to copy static assets:', error.message);
    }
  }
}

function wrapDocument({ title, description, body }) {
  const safeTitle = escapeHtml(title || 'Blog');
  const descriptionMeta = description
    ? `  <meta name="description" content="${escapeAttribute(description)}" />\n`
    : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    `  <title>${safeTitle}</title>`,
    descriptionMeta.trimEnd(),
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <link rel="stylesheet" href="/blog/styles.css" />',
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>'
  ]
    .filter(Boolean)
    .join('\n');
}

function renderIntroMarkdown(markdown) {
  const trimmed = (markdown || '').trim();
  if (!trimmed) {
    return '';
  }

  const paragraphs = trimmed.split(/\r?\n\s*\r?\n/);
  return paragraphs
    .map((paragraph) => {
      const safe = escapeHtml(paragraph.replace(/\r?\n/g, ' ').trim());
      return safe ? `<p>${safe}</p>` : '';
    })
    .filter(Boolean)
    .join('\n');
}

async function collectPreparedPosts(baseDir, rootDir = baseDir) {
  const posts = new Map();
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(baseDir, entry.name);
      if (entry.isDirectory()) {
        const nested = await collectPreparedPosts(entryPath, rootDir);
        for (const nestedPost of nested) {
          if (!posts.has(nestedPost.slug)) {
            posts.set(nestedPost.slug, nestedPost);
          }
        }
      } else if (entry.isFile() && allowedIndexFiles.has(entry.name)) {
        const raw = await fs.readFile(entryPath, 'utf8');
        const parsed = parseMatter(raw);
        const slugParts = path
          .relative(rootDir, path.dirname(entryPath))
          .split(path.sep)
          .filter(Boolean);
        const slug = slugParts.join('/');
        const { iso, human } = formatDateParts(parsed.data?.date);
        const $ = loadHtml(parsed.content);
        const existingBody = $('.blog-article-body').first();
        const bodyHtml = existingBody.length ? existingBody.html() || '' : parsed.content;

        const postRecord = {
          slug,
          slugParts,
          title: parsed.data?.title || 'Untitled post',
          description: parsed.data?.description || '',
          isoDate: iso,
          humanDate: human,
          sortDate: iso ? new Date(iso).getTime() : 0,
          body: bodyHtml?.trim() || ''
        };

        const existing = posts.get(slug);
        if (!existing || entry.name === 'index.md') {
          posts.set(slug, postRecord);
        }
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  return Array.from(posts.values());
}

async function renderFallbackStaticSite() {
  await emptyDir(destinationDir);
  await copyStaticAssets();

  let indexData = { data: {}, content: '' };
  try {
    const rawIndex = await fs.readFile(indexMarkdownPath, 'utf8');
    indexData = parseMatter(rawIndex);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn('[blog] Unable to read blog index markdown:', error.message);
    }
  }

  const posts = await collectPreparedPosts(postsDir);
  const sortedPosts = posts.sort((a, b) => b.sortDate - a.sortDate);

  const postsListHtml = sortedPosts
    .map((post) => {
      const lines = [
        '<article class="blog-card">',
        `  <h2 class="blog-card-title"><a href="/blog/posts/${post.slug}/">${escapeHtml(post.title)}</a></h2>`
      ];
      if (post.description) {
        lines.push(`  <p class="blog-card-description">${escapeHtml(post.description)}</p>`);
      }
      if (post.isoDate && post.humanDate) {
        lines.push(
          `  <p class="blog-card-date"><time datetime="${escapeAttribute(post.isoDate)}">${escapeHtml(post.humanDate)}</time></p>`
        );
      }
      lines.push('</article>');
      return lines.join('\n');
    })
    .join('\n');

  const introHtml = renderIntroMarkdown(indexData.content);
  const indexBody = [
    '<div class="blog-page">',
    '  <header class="blog-header">',
    `    <h1 class="blog-title">${escapeHtml(indexData.data?.title || 'Blog')}</h1>`,
    indexData.data?.description
      ? `    <p class="blog-intro">${escapeHtml(indexData.data.description)}</p>`
      : '',
    '  </header>',
    introHtml ? `  <div class="blog-article-body">${introHtml}</div>` : '',
    postsListHtml ? '  <section class="blog-list">' : '',
    postsListHtml,
    postsListHtml ? '  </section>' : '',
    '</div>'
  ]
    .filter(Boolean)
    .join('\n');

  const indexHtml = wrapDocument({
    title: indexData.data?.title || 'Blog',
    description: indexData.data?.description || null,
    body: indexBody
  });

  await fs.writeFile(path.join(destinationDir, 'index.html'), indexHtml, 'utf8');

  if (sortedPosts.length) {
    const postsListingBody = [
      '<div class="blog-page">',
      '  <header class="blog-header">',
      '    <h1 class="blog-title">Posts</h1>',
      '  </header>',
      '  <section class="blog-list">',
      postsListHtml,
      '  </section>',
      '</div>'
    ].join('\n');

    const postsListingHtml = wrapDocument({
      title: 'Posts',
      description: indexData.data?.description || null,
      body: postsListingBody
    });

    const postsDestination = path.join(destinationDir, 'posts');
    await ensureDir(postsDestination);
    await fs.writeFile(path.join(postsDestination, 'index.html'), postsListingHtml, 'utf8');
  }

  await Promise.all(
    sortedPosts.map(async (post) => {
      const postBody = [
        '<div class="blog-page">',
        '  <nav class="blog-breadcrumb"><a href="/blog/">Blog</a></nav>',
        '  <article class="blog-article">',
        `    <h1 class="blog-article-title">${escapeHtml(post.title)}</h1>`,
        post.description
          ? `    <p class="blog-article-description">${escapeHtml(post.description)}</p>`
          : '',
        post.isoDate && post.humanDate
          ? `    <p class="blog-article-date"><time datetime="${escapeAttribute(post.isoDate)}">${escapeHtml(post.humanDate)}</time></p>`
          : '',
        '    <div class="blog-article-body">',
        post.body,
        '    </div>',
        '  </article>',
        '</div>'
      ]
        .filter(Boolean)
        .join('\n');

      const postHtml = wrapDocument({
        title: post.title,
        description: post.description || null,
        body: postBody
      });

      const targetDir = path.join(destinationDir, 'posts', ...post.slugParts);
      await ensureDir(targetDir);
      await fs.writeFile(path.join(targetDir, 'index.html'), postHtml, 'utf8');
    })
  );
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

let cachedBundledHugo;

async function loadBundledHugo() {
  if (cachedBundledHugo !== undefined) {
    return cachedBundledHugo;
  }

  try {
    const module = await import('hugo-bin');
    cachedBundledHugo = module.default ?? module;
  } catch (error) {
    cachedBundledHugo = null;
  }

  return cachedBundledHugo;
}

async function findHugoBinary() {
  if (process.env.HUGO_PATH) {
    return process.env.HUGO_PATH;
  }

  const bundled = await loadBundledHugo();
  if (bundled) {
    try {
      await runCommand(bundled, ['version'], { stdio: 'ignore' });
      return bundled;
    } catch (error) {
      console.warn('[blog] Bundled hugo binary failed self-check:', error.message);
    }
  }

  try {
    await runCommand('hugo', ['version'], { stdio: 'ignore' });
    return 'hugo';
  } catch (error) {
    return null;
  }
}

async function prepareContent() {
  await runCommand('node', [path.join(scriptDirname, 'prepare-blog.mjs')]);
}

async function buildBlog() {
  await prepareContent();
  const hugoBinary = await findHugoBinary();
  const isServeMode = process.argv.includes('--serve');

  if (!hugoBinary) {
    console.warn('[blog] Hugo binary not found. Falling back to Node renderer.');
    await renderFallbackStaticSite();
    return;
  }

  if (isServeMode) {
    await ensureDir(destinationDir);
  } else {
    await emptyDir(destinationDir);
  }

  const args = isServeMode
    ? [
        'server',
        '--source',
        blogDir,
        '--destination',
        destinationDir,
        '--renderToDisk',
        '--buildDrafts',
        '--disableFastRender'
      ]
    : ['--source', blogDir, '--destination', destinationDir];

  await runCommand(hugoBinary, args, { cwd: projectRoot });
}

if (process.argv[1] === scriptFilename) {
  buildBlog().catch((error) => {
    console.error('[blog] Failed to build blog:', error);
    process.exitCode = 1;
  });
}

export { collectPreparedPosts, renderFallbackStaticSite, buildBlog };
