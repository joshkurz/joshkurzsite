import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import asciidoctorFactory from '@asciidoctor/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const sourceDir = path.join(projectRoot, 'blog', 'posts-src');
const contentDir = path.join(projectRoot, 'blog', 'content', 'posts');

const asciidoctor = asciidoctorFactory();

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function emptyDir(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await ensureDir(targetPath);
}

async function collectAdocFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectAdocFiles(entryPath);
      files.push(...nested);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.adoc')) {
      files.push(entryPath);
    }
  }
  return files;
}

function slugFromPath(filePath) {
  const relative = path.relative(sourceDir, filePath);
  const withoutExt = relative.replace(/\.adoc$/i, '');
  return withoutExt.split(path.sep).map((segment) => segment.replace(/\s+/g, '-').toLowerCase());
}

async function convertAdocFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = matter(raw);
  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    throw new Error(`Missing front matter metadata in ${path.relative(sourceDir, filePath)}`);
  }
  const html = asciidoctor.convert(parsed.content, {
    safe: 'safe',
    doctype: 'article'
  });
  const slugParts = slugFromPath(filePath);
  const targetDir = path.join(contentDir, ...slugParts);
  await ensureDir(targetDir);
  const frontMatter = matter.stringify('', parsed.data);
  const wrappedHtml = `<div class="blog-article-body">\n${html.trim()}\n</div>\n`;
  const output = `${frontMatter}\n${wrappedHtml}`;
  const outputPath = path.join(targetDir, 'index.html');
  await fs.writeFile(outputPath, output, 'utf8');
}

async function main() {
  try {
    await ensureDir(sourceDir);
    await emptyDir(contentDir);
    const adocFiles = await collectAdocFiles(sourceDir);
    if (adocFiles.length === 0) {
      console.warn('No AsciiDoc posts found to compile.');
      return;
    }
    await Promise.all(adocFiles.map(convertAdocFile));
  } catch (error) {
    console.error('[blog:prepare] Failed to compile blog posts:', error);
    process.exitCode = 1;
  }
}

await main();
