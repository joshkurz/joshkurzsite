/** @jest-environment node */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { collectPreparedPosts } from '../../scripts/build-blog.mjs';

async function createTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('collectPreparedPosts', () => {
  it('extracts metadata and body content from markdown bundles', async () => {
    const tmpRoot = await createTempDir('blog-md-');
    const postsDir = path.join(tmpRoot, 'posts');
    const postDir = path.join(postsDir, 'hello-world');
    await fs.mkdir(postDir, { recursive: true });

    const fileContent = [
      '---',
      'title: "Hello World"',
      'date: 2025-10-31T12:00:00Z',
      'description: "Example description"',
      '---',
      '',
      '<div class="blog-article-body">',
      '<p>Example body</p>',
      '</div>',
      ''
    ].join('\n');

    await fs.writeFile(path.join(postDir, 'index.md'), fileContent, 'utf8');

    try {
      const posts = await collectPreparedPosts(postsDir);
      expect(posts).toHaveLength(1);

      const [post] = posts;
      expect(post.slug).toBe('hello-world');
      expect(post.slugParts).toEqual(['hello-world']);
      expect(post.title).toBe('Hello World');
      expect(post.description).toBe('Example description');
      expect(post.isoDate).toBe('2025-10-31T12:00:00.000Z');
      expect(post.humanDate).toBe('October 31, 2025');
      expect(post.body).toBe('<p>Example body</p>');
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('falls back to html bundles when markdown is unavailable', async () => {
    const tmpRoot = await createTempDir('blog-html-');
    const postsDir = path.join(tmpRoot, 'posts');
    const postDir = path.join(postsDir, 'hello-hugo');
    await fs.mkdir(postDir, { recursive: true });

    const fileContent = [
      '---',
      'title: "Hello Hugo"',
      'date: 2025-10-30T12:00:00Z',
      'description: "Example HTML description"',
      '---',
      '',
      '<div class="blog-article-body">',
      '<p>Legacy body</p>',
      '</div>',
      ''
    ].join('\n');

    await fs.writeFile(path.join(postDir, 'index.html'), fileContent, 'utf8');

    try {
      const posts = await collectPreparedPosts(postsDir);
      expect(posts).toHaveLength(1);

      const [post] = posts;
      expect(post.slug).toBe('hello-hugo');
      expect(post.slugParts).toEqual(['hello-hugo']);
      expect(post.title).toBe('Hello Hugo');
      expect(post.description).toBe('Example HTML description');
      expect(post.isoDate).toBe('2025-10-30T12:00:00.000Z');
      expect(post.humanDate).toBe('October 30, 2025');
      expect(post.body).toBe('<p>Legacy body</p>');
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
