import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const blogDir = path.join(projectRoot, 'blog');
const destinationDir = path.join(projectRoot, 'public', 'blog');

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function emptyDir(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await ensureDir(targetPath);
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
  await runCommand('node', [path.join(__dirname, 'prepare-blog.mjs')]);
}

async function buildBlog() {
  await prepareContent();
  const hugoBinary = await findHugoBinary();
  const isServeMode = process.argv.includes('--serve');

  if (!hugoBinary) {
    await ensureDir(destinationDir);
    console.warn('[blog] Hugo binary not found. Skipping static site generation.');
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

buildBlog().catch((error) => {
  console.error('[blog] Failed to build blog:', error);
  process.exitCode = 1;
});
