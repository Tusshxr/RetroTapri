/**
 * Configuration Template — Luxury Rickshaw Music Player
 * 
 * Copy this file to `config.js` and replace the placeholder values below with your own credentials.
 * DO NOT commit `config.js` to GitHub! (It is ignored by `.gitignore`).
 */

window.APP_CONFIG = {
  // YouTube Playlist ID (default/active playlist)
  playlistId: "YOUR_YOUTUBE_PLAYLIST_ID",

  // Optional: Custom Playlist Collection for the OptionWheel selector
  // playlists: [
  //   { id: "PLBKzzWUn97oauQnvPTOpVa2SoRuF2S61y", name: "रेट्रो टपरी", heroTitle: "रेट्रो टपरी" },
  //   { id: "RDCLAK5uy_lHpBhjR3PefMmM-_sCM4cWOY6AcpxtCIk", name: "90s Hits", heroTitle: "90s हिट्स" },
  //   { id: "PLdiU6Sj2X1fUu-qH4n5z5B7P4J-K_tB6P", name: "Chai & Lo-Fi", heroTitle: "चाय और लो-फ़ाई" }
  // ],

  // Devanagari (or custom) hero title displayed in background
  heroTitle: "लग्जरी रिक्शा",
  showHeroTitle: true,

  // External music & social media URLs
  youtubeMusicUrl: "https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID",
  spotifyUrl: "https://open.spotify.com/playlist/YOUR_PLAYLIST_ID",
  instagramUrl: "https://instagram.com/YOUR_HANDLE",
  githubUrl: "https://github.com/YOUR_USERNAME/YOUR_REPO",

  // OpenWeatherMap API Key for weather chip & dynamic rain effect
  weatherApiKey: "YOUR_OPENWEATHERMAP_API_KEY",
  fallbackLocationName: "Manali",
  fallbackLat: 32.2432,
  fallbackLon: 77.1892,

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
