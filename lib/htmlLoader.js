import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let cachedLoader;

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseAttributes(input) {
  const attributes = {};
  const attributePattern = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;

  while ((match = attributePattern.exec(input))) {
    const [, name, , doubleQuoted, singleQuoted] = match;
    const raw = doubleQuoted ?? singleQuoted ?? '';
    attributes[name] = decodeHtmlEntities(raw);
  }

  return attributes;
}

function findElements(markup, selector) {
  const html = String(markup ?? '');
  const headContent = (() => {
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    return headMatch ? headMatch[1] : '';
  })();

  if (selector === 'head > title' || selector === 'title') {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (match) {
      const text = decodeHtmlEntities(match[1]);
      return [{ text, html: match[1] }];
    }
    return [];
  }

  if (selector === 'head > meta' || selector === 'meta') {
    const metaPattern = /<meta\b[^>]*>/gi;
    const elements = [];
    let match;

    while ((match = metaPattern.exec(headContent))) {
      elements.push({ attrs: parseAttributes(match[0]) });
    }

    return elements;
  }

  if (selector === 'meta[name="description"]') {
    const metaPattern = /<meta[^>]*name=(?:"|')description(?:"|')[^>]*>/gi;
    const match = metaPattern.exec(html);
    if (match) {
      const attrs = parseAttributes(match[0]);
      return [{ attrs }];
    }
    return [];
  }

  if (selector === 'head > link' || selector === 'link') {
    const linkPattern = /<link\b[^>]*>/gi;
    const elements = [];
    let match;

    while ((match = linkPattern.exec(headContent))) {
      elements.push({ attrs: parseAttributes(match[0]) });
    }

    return elements;
  }

  if (selector === 'body') {
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (match) {
      return [{ html: match[1] }];
    }
    return [];
  }

  if (selector === '.blog-article-body') {
    const pattern = /<([a-z0-9:-]+)([^>]*)class=("|')[^"']*blog-article-body[^"']*\3([^>]*)>([\s\S]*?)<\/\1>/i;
    const match = pattern.exec(html);
    if (match) {
      const [, , beforeClassAttrs, , afterClassAttrs, inner] = match;
      const attrs = parseAttributes(`${beforeClassAttrs} ${afterClassAttrs}`);
      return [{ html: inner, attrs }];
    }
    return [];
  }

  return [];
}

function createCollection(elements) {
  const collection = {
    length: elements.length,
    first() {
      if (elements.length > 0) {
        return createCollection([elements[0]]);
      }
      return createCollection([]);
    },
    text() {
      if (elements.length === 0) {
        return '';
      }
      return elements.map((element) => element.text ?? element.html ?? '').join('');
    },
    html() {
      if (elements.length === 0) {
        return undefined;
      }
      return elements[0].html ?? '';
    },
    attr(name) {
      if (elements.length === 0) {
        return undefined;
      }
      return elements[0].attrs?.[name];
    },
    toArray() {
      return elements.map((element) => {
        if (element && typeof element === 'object') {
          if (element.attribs || !element.attrs) {
            return element;
          }
          const { attrs, ...rest } = element;
          return { ...rest, attribs: attrs };
        }
        return element;
      });
    }
  };

  return collection;
}

function createFallbackLoader() {
  return function load(markup) {
    return function select(selector) {
      const elements = findElements(markup, selector);
      return createCollection(elements);
    };
  };
}

export function loadHtml(markup) {
  if (!cachedLoader) {
    try {
      const cheerio = require('cheerio');
      const loader = cheerio?.load ?? cheerio;
      if (typeof loader === 'function') {
        cachedLoader = loader;
      } else {
        cachedLoader = createFallbackLoader();
      }
    } catch (error) {
      if (error?.code === 'MODULE_NOT_FOUND' || error?.code === 'ERR_MODULE_NOT_FOUND') {
        cachedLoader = createFallbackLoader();
      } else {
        throw error;
      }
    }
  }

  return cachedLoader(markup ?? '');
}
