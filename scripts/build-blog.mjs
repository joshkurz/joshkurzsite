import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const blogDir = path.join(projectRoot, 'blog');

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

async function prepareContent() {
  await runCommand('node', [path.join(__dirname, 'prepare-blog.mjs')]);
}

async function findHugoBinary() {
  if (process.env.HUGO_PATH) {
    return process.env.HUGO_PATH;
  }
  try {
    await runCommand('hugo', ['version'], { stdio: 'ignore' });
    return 'hugo';
  } catch (error) {
    return null;
  }
}

async function buildBlog() {
  await prepareContent();
  const hugoBinary = await findHugoBinary();
  const isServeMode = process.argv.includes('--serve');

  if (!hugoBinary) {
    console.warn('[blog] Hugo binary not found. Skipping static site generation.');
    return;
  }

  const args = isServeMode
    ? ['server', '--source', blogDir, '--buildDrafts', '--disableFastRender']
    : ['--source', blogDir];

  if (isServeMode) {
    args.push('--renderToDisk', '--destination', path.join(projectRoot, 'public', 'blog'));
  }

  await runCommand(hugoBinary, args, { cwd: projectRoot });
}

buildBlog().catch((error) => {
  console.error('[blog] Failed to build blog:', error);
  process.exitCode = 1;
});
