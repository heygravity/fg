// URL rewrite helper: client-side
// If the current address is `/fg`, `/fg/` or `/fg/index.html` rewrite the
// browser URL to `/the-office-games` while preserving search and hash.
// This uses history.replaceState so the page doesn't reload.

(function () {
  try {
    const { pathname, search, hash } = window.location;

    // Normalize path (remove duplicate slashes)
    const normalized = pathname.replace(/\/+/g, '/');

    // Paths we want to rewrite
    const shouldRewrite = /^\/fg(?:\/index\.html)?\/?$/.test(normalized);

    // If already on the target path, do nothing
    if (shouldRewrite && normalized !== '/the-office-games') {
      const newUrl = '/the-office-games' + (search || '') + (hash || '');

      // Only replaceState if the current location is different to avoid loops
      if (window.location.pathname + window.location.search + window.location.hash !== newUrl) {
        // Replace the address bar without navigating
        history.replaceState(history.state, document.title, newUrl);
        // Optional: update any in-page links, meta tags, or breadcrumbs here if needed
        // console.info('Rewrote URL to', newUrl);
      }
    }
  } catch (err) {
    // Fail silently in older browsers/environment without breaking the page
    // console.warn('URL rewrite error', err);
  }
})();
