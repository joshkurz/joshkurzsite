/** @jest-environment node */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { getStaticPaths, getStaticProps } from '../../pages/blog/[[...slug]].js';

async function createTempProject() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-test-'));
  const blogDir = path.join(tmpRoot, 'public', 'blog');
  await fs.mkdir(blogDir, { recursive: true });
  return { tmpRoot, blogDir };
}

async function cleanupTempProject(tmpRoot) {
  await fs.rm(tmpRoot, { recursive: true, force: true });
}

describe('blog catch-all page data fetching', () => {

  it('includes the blog root in getStaticPaths even when the Hugo output is missing', async () => {
    const { tmpRoot } = await createTempProject();
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmpRoot);

    try {
      const { paths, fallback } = await getStaticPaths();

      expect(fallback).toBe(false);
      expect(paths).toContainEqual({ params: { slug: [] } });
    } finally {
      cwdSpy.mockRestore();
      await cleanupTempProject(tmpRoot);
    }
  });

  it('discovers nested index.html routes for generated content', async () => {
    const { tmpRoot, blogDir } = await createTempProject();
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmpRoot);

    try {
      const directories = [
        ['posts', 'hello-hugo'],
        ['posts'],
        ['categories'],
        ['tags'],
      ];

      await Promise.all(
        directories.map(async (segments) => {
          const targetDir = path.join(blogDir, ...segments);
          await fs.mkdir(targetDir, { recursive: true });
          await fs.writeFile(path.join(targetDir, 'index.html'), '<html></html>');
        })
      );

      const { paths } = await getStaticPaths();

      expect(paths).toEqual(
        expect.arrayContaining([
          { params: { slug: [] } },
          { params: { slug: ['posts'] } },
          { params: { slug: ['posts', 'hello-hugo'] } },
          { params: { slug: ['categories'] } },
          { params: { slug: ['tags'] } },
        ])
      );
    } finally {
      cwdSpy.mockRestore();
      await cleanupTempProject(tmpRoot);
    }
  });

  it('returns helpful fallback props for the blog root when the static file is missing', async () => {
    const { tmpRoot } = await createTempProject();
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmpRoot);

    try {
      const result = await getStaticProps({ params: { slug: [] } });

      expect(result).toEqual(
        expect.objectContaining({
          props: expect.objectContaining({
            title: 'Blog',
            slugPath: '/',
          }),
        }),
      );
      expect(result.props.body).toContain('The blog will be back shortly');
      expect(result.props.body).toContain('Getting that on the page.');
    } finally {
      cwdSpy.mockRestore();
      await cleanupTempProject(tmpRoot);
    }
  });

  it('marks nested paths as notFound when their static file is missing', async () => {
    const { tmpRoot } = await createTempProject();
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmpRoot);

    try {
      const result = await getStaticProps({ params: { slug: ['posts', 'missing-post'] } });

      expect(result).toEqual({ notFound: true });
    } finally {
      cwdSpy.mockRestore();
      await cleanupTempProject(tmpRoot);
    }
  });

  it('parses the generated HTML when the static file exists', async () => {
    const { tmpRoot, blogDir } = await createTempProject();
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmpRoot);

    try {
      await fs.mkdir(path.join(blogDir, 'posts', 'hello-hugo'), { recursive: true });
      await fs.writeFile(
        path.join(blogDir, 'index.html'),
        `<!doctype html>
        <html>
          <head>
            <title>Hello Hugo</title>
            <meta name="description" content="Test description" />
          </head>
          <body>
            <main><p>Welcome to the blog</p></main>
          </body>
        </html>`
      );

      const result = await getStaticProps({ params: { slug: [] } });

      expect(result).toEqual(
        expect.objectContaining({
          props: expect.objectContaining({
            title: 'Hello Hugo',
            description: 'Test description',
          }),
        })
      );
      expect(result.props.body).toContain('<main><p>Welcome to the blog</p></main>');
    } finally {
      cwdSpy.mockRestore();
      await cleanupTempProject(tmpRoot);
    }
  });
});
