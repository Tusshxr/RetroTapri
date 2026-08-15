/**
 * Configuration Template — Luxury Rickshaw Music Player
 * 
 * Copy this file to `config.js` and replace placeholder values with your credentials.
 * DO NOT commit `config.js` to GitHub! (It is ignored by `.gitignore`).
 */

window.APP_CONFIG = {
  // Hero title displayed in background
  heroTitle: "रेट्रो टपरी",
  showHeroTitle: true,

  // External social media URLs
  spotifyUrl: "https://open.spotify.com/playlist/YOUR_PLAYLIST_ID",
  instagramUrl: "https://instagram.com/YOUR_HANDLE",
  githubUrl: "https://github.com/YOUR_USERNAME/YOUR_REPO",

  // OpenWeatherMap API Key for weather chip & dynamic rain effect
  weatherApiKey: "YOUR_OPENWEATHERMAP_API_KEY",
  fallbackLocationName: "Pune",
  fallbackLat: 18.5196,
  fallbackLon: 73.8567,

  // Firebase Realtime Database Config (for live online count & like count)
  firebaseConfig: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  }
};
