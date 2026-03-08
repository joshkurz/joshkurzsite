/**
 * Analytics abstraction — swap providers here without touching any page code.
 *
 * Current provider: Google Analytics 4 (gtag.js)
 * The gtag script itself is loaded in pages/_document.js.
 */

const GA_MEASUREMENT_ID = 'G-K99L7ED0FB';

function gtag(...args) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag(...args);
}

export function pageview(url) {
  gtag('config', GA_MEASUREMENT_ID, { page_path: url });
}

export function event({ action, category, label, value } = {}) {
  gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}
