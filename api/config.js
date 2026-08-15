/**
 * Serverless Config Bridge — Luxury Rickshaw Music Player
 *
 * `config.js` is gitignored, so it never reaches a Vercel deployment — the
 * production site would otherwise silently fall back to whatever defaults
 * are hardcoded in script.js. This function fills that gap: it reads the
 * real credentials from the project's Environment Variables and serves them
 * as a plain JS file, so the site "just works" in production without a
 * secrets file that can't be committed.
 *
 * `vercel.json` rewrites requests for /config.js to this function ONLY on
 * Vercel. Locally (or on GitHub Pages) there's no rewrite engine, so the
 * literal static config.js file is served instead — nothing here changes
 * that workflow.
 *
 * Only env vars that are actually set (non-empty) are included. Anything
 * left out falls through to script.js's own built-in defaults, so a
 * partially-configured project never ends up with a half-broken object.
 */

module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const env = process.env;
  const has = (v) => typeof v === "string" && v.trim().length > 0;

  const config = {};

  if (has(env.PLAYLIST_ID)) config.playlistId = env.PLAYLIST_ID;
  if (has(env.OPENWEATHER_API_KEY)) config.weatherApiKey = env.OPENWEATHER_API_KEY;

  // Only ship a firebaseConfig object when the fields required for the
  // Realtime Database connection are all present — a partial object would
  // silently break presence/likes instead of falling back cleanly.
  const firebaseRequired = [
    env.FIREBASE_API_KEY,
    env.FIREBASE_DATABASE_URL,
    env.FIREBASE_PROJECT_ID,
  ];
  if (firebaseRequired.every(has)) {
    config.firebaseConfig = {
      apiKey: env.FIREBASE_API_KEY,
      authDomain: env.FIREBASE_AUTH_DOMAIN,
      databaseURL: env.FIREBASE_DATABASE_URL,
      projectId: env.FIREBASE_PROJECT_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
      appId: env.FIREBASE_APP_ID,
    };
  }

  res.status(200).send(
    "window.APP_CONFIG = Object.assign({}, window.APP_CONFIG, " +
      JSON.stringify(config) +
      ");"
  );
};
