// Routing and history. Every page is a hash route (#/, #/slug, #/slug/child) so the site
// works as static files. history.state.d counts how many entries back the exhibition is
// (-1: none behind us, e.g. the visit started on a shared link), so "back to the records"
// rewinds history instead of piling new entries on top.
import { parseRoute, hashFor, sameRoute } from './router.js';

export function createNavigation({ records, app, transitions, onRoute }) {
  function navigate(route) {
    const hash = hashFor(route, records);
    if (sameRoute(route, app.route) && !app.busy) return;
    const depth = route.view === 'hero' ? 0 : app.depth >= 0 ? app.depth + 1 : -1;
    history.pushState({ d: depth }, '', hash);
    app.depth = depth;
    go(route);
  }

  function requestClose() {
    if (app.view !== 'post') return;
    if (app.depth > 0) history.go(-app.depth);
    else {
      history.pushState({ d: 0 }, '', '#/');
      app.depth = 0;
      go({ view: 'hero' });
    }
  }

  // one transition at a time; a route asked for meanwhile runs right after
  async function go(route, initial = false) {
    if (app.busy) {
      app.pending = route;
      return;
    }
    if (sameRoute(route, app.route) && !initial) return;
    app.busy = true;
    onRoute(route);
    try {
      if (route.view === 'hero') {
        if (app.view === 'post') await transitions.closePost();
      } else if (app.view === 'hero') {
        await transitions.openPost(route, initial);
      } else {
        await transitions.swapPost(route);
      }
      app.route = route;
    } catch (err) {
      console.error(err);
    }
    app.busy = false;
    if (app.pending) {
      const p = app.pending;
      app.pending = null;
      if (!sameRoute(p, app.route)) go(p);
    }
  }

  const onRouteChange = () => {
    const route = parseRoute(location.hash, records);
    app.depth = history.state?.d ?? (route.view === 'hero' ? 0 : -1);
    go(route);
  };
  addEventListener('popstate', onRouteChange);
  addEventListener('hashchange', onRouteChange);

  // in-page record links share the history bookkeeping
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const route = parseRoute(a.getAttribute('href'), records);
    if (route.view === 'hero') requestClose();
    else navigate(route);
  });

  // the page the visit starts on (a shared link opens its article directly)
  function start() {
    const initial = parseRoute(location.hash, records);
    app.depth = initial.view === 'post' ? -1 : 0;
    history.replaceState({ d: app.depth }, '', location.hash || location.pathname + location.search);
    if (initial.view === 'post') go(initial, true);
  }

  return { navigate, requestClose, start };
}
