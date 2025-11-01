import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let cachedConverter;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createFallbackConverter() {
  return function convert(input) {
    const lines = String(input ?? '').split(/\r?\n/);
    const output = [];
    let paragraphBuffer = [];
    let inList = false;

    function flushParagraph() {
      if (paragraphBuffer.length > 0) {
        output.push(`<p>${escapeHtml(paragraphBuffer.join(' '))}</p>`);
        paragraphBuffer = [];
      }
    }

    function closeList() {
      if (inList) {
        output.push('</ul>');
        inList = false;
      }
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        closeList();
        continue;
      }

      if (line.startsWith('=== ')) {
        flushParagraph();
        closeList();
        output.push(`<h3>${escapeHtml(line.slice(4).trim())}</h3>`);
        continue;
      }

      if (line.startsWith('== ')) {
        flushParagraph();
        closeList();
        output.push(`<h2>${escapeHtml(line.slice(3).trim())}</h2>`);
        continue;
      }

      if (line.startsWith('= ')) {
        flushParagraph();
        closeList();
        output.push(`<h1>${escapeHtml(line.slice(2).trim())}</h1>`);
        continue;
      }

      if (line.startsWith('* ')) {
        flushParagraph();
        if (!inList) {
          inList = true;
          output.push('<ul>');
        }
        output.push(`<li>${escapeHtml(line.slice(2).trim())}</li>`);
        continue;
      }

      if (inList) {
        closeList();
      }

      paragraphBuffer.push(line);
    }

    flushParagraph();
    closeList();

    return output.join('\n');
  };
}

export function convertAsciiDoc(source) {
  if (!cachedConverter) {
    try {
      const asciidoctorFactory = require('@asciidoctor/core');
      const asciidoctor = typeof asciidoctorFactory === 'function'
        ? asciidoctorFactory()
        : asciidoctorFactory?.default?.();

      if (asciidoctor && typeof asciidoctor.convert === 'function') {
        cachedConverter = (input) =>
          asciidoctor.convert(input, { safe: 'safe', doctype: 'article' });
      } else {
        cachedConverter = createFallbackConverter();
      }
    } catch (error) {
      if (error?.code === 'MODULE_NOT_FOUND' || error?.code === 'ERR_MODULE_NOT_FOUND') {
        cachedConverter = createFallbackConverter();
      } else {
        throw error;
      }
    }
  }

  return cachedConverter(source);
}
