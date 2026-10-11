// Pages Advanced Mode `_worker.js` (bundled by `build:edge`). Every request is
// served by the static asset handler, unchanged.
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
