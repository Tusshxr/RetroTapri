/**
 * Configuration Template — Luxury Rickshaw Music Player
 * 
 * Copy this file to `config.js` and replace the placeholder values below with your own credentials.
 * DO NOT commit `config.js` to GitHub! (It is ignored by `.gitignore`).
 */

window.APP_CONFIG = {
  // =========================================================================
  // 1. PLAYLISTS (Single source of truth — manage all your playlists here)
  // =========================================================================
  playlists: [
    {
      id: "YOUR_YOUTUBE_PLAYLIST_ID_1",
      name: "रेट्रो टपरी",
      subtitle: "Classic Nostalgia",
      heroTitle: "रेट्रो टपरी",
      youtubeMusicUrl: "https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID_1"
    },
    {
      id: "YOUR_YOUTUBE_PLAYLIST_ID_2",
      name: "90s Hits",
      subtitle: "Golden Bollywood",
      heroTitle: "90s हिट्स",
      youtubeMusicUrl: "https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID_2"
    },
    {
      id: "YOUR_YOUTUBE_PLAYLIST_ID_3",
      name: "Chai & Lo-Fi",
      subtitle: "Midnight Chill Beats",
      heroTitle: "चाय और लो-फ़ाई",
      youtubeMusicUrl: "https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID_3"
    }
  ],

  // Default active playlist index on load (0 = first playlist above)
  defaultPlaylistIndex: 0,

  // Display background hero title
  showHeroTitle: true,

  // External music & social media URLs
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
