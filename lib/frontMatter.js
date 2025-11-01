import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function parseFrontMatterHeader(header) {
  const lines = header.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const data = {};

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    data[key] = parseFrontMatterValue(rawValue);
  }

  return data;
}

function parseFrontMatterValue(rawValue) {
  if (!rawValue) {
    return '';
  }

  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1).replace(/\\"/g, '"');
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  const numeric = Number(rawValue);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return rawValue;
}

function formatFrontMatterValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  const stringValue = String(value);
  const escaped = stringValue.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function createFallbackMatter() {
  function matter(input) {
    const raw = typeof input === 'string' ? input : String(input ?? '');
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);

    if (!match) {
      return { data: {}, content: raw };
    }

    const header = match[1];
    const body = raw.slice(match[0].length);
    const data = parseFrontMatterHeader(header);

    return { data, content: body };
  }

  matter.stringify = (content, data) => {
    const normalizedContent = content ?? '';
    const lines = ['---'];

    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        lines.push(`${key}: ${formatFrontMatterValue(value)}`);
      }
    }

    lines.push('---');

    if (normalizedContent) {
      return `${lines.join('\n')}\n${normalizedContent}`;
    }

    return `${lines.join('\n')}\n`;
  };

  return matter;
}

let cachedMatter;

export function getMatter() {
  if (cachedMatter) {
    return cachedMatter;
  }

  try {
    const grayMatterModule = require('gray-matter');
    cachedMatter = grayMatterModule?.default ?? grayMatterModule;
  } catch (error) {
    if (error?.code === 'MODULE_NOT_FOUND' || error?.code === 'ERR_MODULE_NOT_FOUND') {
      cachedMatter = createFallbackMatter();
    } else {
      throw error;
    }
  }

  return cachedMatter;
}

export function parseMatter(input) {
  const matter = getMatter();
  return matter(input);
}

export function stringifyMatter(content, data) {
  const matter = getMatter();
  return matter.stringify(content, data);
}
