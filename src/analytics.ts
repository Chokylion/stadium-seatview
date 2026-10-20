// Cookieless analytics. Replace DATA_DOMAIN and script src with your provider
// (e.g. Plausible/GoatCounter). No cookies => no PDPA consent banner needed.
export function initAnalytics() {
  const DATA_DOMAIN = ''; // set at deploy time
  if (!DATA_DOMAIN) return;
  const s = document.createElement('script');
  s.defer = true;
  s.setAttribute('data-domain', DATA_DOMAIN);
  s.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(s);
}
