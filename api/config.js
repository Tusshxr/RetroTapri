/**
 * Serverless Config Bridge — Luxury Rickshaw Music Player (Vercel)
 *
 * `config.js` is gitignored, so it never reaches a Vercel deployment.
 * This serverless route dynamically reads environment variables set in
 * Vercel / Netlify dashboard and provides them to the client.
 *
 * Playlists are defined directly in `script.js`, so you do NOT need any playlist
 * environment variable by default. If you want to override all playlists from Vercel,
 * you can optionally set `PLAYLISTS_JSON`.
 */

module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const env = process.env;
  const has = (v) => typeof v === "string" && v.trim().length > 0;

  const config = {};

  // Optional Hero Title Override
  if (has(env.HERO_TITLE)) config.heroTitle = env.HERO_TITLE.trim();

  // Social URLs
  if (has(env.SPOTIFY_URL)) config.spotifyUrl = env.SPOTIFY_URL.trim();
  if (has(env.INSTAGRAM_URL)) config.instagramUrl = env.INSTAGRAM_URL.trim();
  if (has(env.GITHUB_URL)) config.githubUrl = env.GITHUB_URL.trim();

  // Weather configuration
  if (has(env.OPENWEATHER_API_KEY)) config.weatherApiKey = env.OPENWEATHER_API_KEY.trim();
  if (has(env.FALLBACK_LOCATION_NAME)) config.fallbackLocationName = env.FALLBACK_LOCATION_NAME.trim();
  if (has(env.FALLBACK_LAT)) config.fallbackLat = parseFloat(env.FALLBACK_LAT);
  if (has(env.FALLBACK_LON)) config.fallbackLon = parseFloat(env.FALLBACK_LON);

  // Optional: Complete playlists override as JSON string
  if (has(env.PLAYLISTS_JSON)) {
    try {
      const parsed = JSON.parse(env.PLAYLISTS_JSON);
      if (Array.isArray(parsed) && parsed.length > 0) {
        config.playlists = parsed;
      }
    } catch (e) {
      console.warn("Invalid PLAYLISTS_JSON environment variable:", e);
    }
  }

  // Firebase Configuration (for live online listener count & like count)
  const firebaseRequired = [
    env.FIREBASE_API_KEY,
    env.FIREBASE_DATABASE_URL,
    env.FIREBASE_PROJECT_ID,
  ];
  if (firebaseRequired.every(has)) {
    config.firebaseConfig = {
      apiKey: env.FIREBASE_API_KEY.trim(),
      authDomain: env.FIREBASE_AUTH_DOMAIN ? env.FIREBASE_AUTH_DOMAIN.trim() : "",
      databaseURL: env.FIREBASE_DATABASE_URL.trim(),
      projectId: env.FIREBASE_PROJECT_ID.trim(),
      storageBucket: env.FIREBASE_STORAGE_BUCKET ? env.FIREBASE_STORAGE_BUCKET.trim() : "",
      messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID ? env.FIREBASE_MESSAGING_SENDER_ID.trim() : "",
      appId: env.FIREBASE_APP_ID ? env.FIREBASE_APP_ID.trim() : "",
    };
  }

  res.status(200).send(
    "window.APP_CONFIG = Object.assign({}, window.APP_CONFIG, " +
      JSON.stringify(config) +
      ");"
  );
};
