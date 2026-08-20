/* ==========================================================================
   लग्जरी रिक्शा — cinematic music player
   Vanilla JS. No frameworks, no build step. Firebase Realtime Database is
   used only for two live counters (online presence, playlist likes).
   OpenWeatherMap is used only for the weather chip + rain effect.

   Architecture:
     initializeApp            – boots everything on DOMContentLoaded
     loadYouTubeAPI            – injects the IFrame API script once
     createYouTubePlayer       – instantiates the hidden YT.Player
     handlePlayerReady         – first-load bookkeeping
     handlePlayerStateChange   – reacts to play/pause/buffer/end/cue
     handlePlayerError         – user-friendly error states
     updateSongMetadata        – title / subtitle / artist / thumbnail
     updateProgress            – rAF-driven waveform fill + time labels
     seekTo / togglePlayPause / playNext / playPrevious
     updateUI                  – small DOM sync helpers
     updateBackground          – optional per-song background wash
     formatTime                 – mm:ss helper
     initPresence               – real "online now" count via Firebase
     initLikes                  – real "likes" count via Firebase
     initWeather                – geolocation + OpenWeatherMap + rain effect
     initQueue                  – swipeable "up next" drawer
     initArtSwipe              – drag/swipe on album art for prev/next
   ========================================================================== */

/* ==========================================================================
   1. CONFIGURATION & PLAYLISTS
   ========================================================================== */

const appEnv = window.APP_CONFIG || {};

/* ── Playlists ────────────────────────────────────────────────────────────
 *  To add a new playlist:
 *    1. Open the playlist on YouTube Music / YouTube.
 *    2. Copy the "list=" parameter from the URL.
 *    3. Add a new entry below with: id, name, route, bg, bgMobile, youtubeMusicUrl
 *       - route: the hash segment, e.g. "honey-singh" → site.com/#/honey-singh
 *       - bg: desktop background image path (e.g. "assets/bg-p7.webp")
 *       - bgMobile: mobile background image path
 *    4. The sidebar will pick up the new playlist automatically.
 * ────────────────────────────────────────────────────────────────────────── */
const PLAYLISTS = [
  {
    id: "RDCLAK5uy_kr3pcLM0Dc_A9wvxCj0vVjob3maWg1WgA",
    name: "Honey Singh",
    route: "honey-singh",
    bg: "assets/bg.webp",
    bgMobile: "assets/bg-mobile.webp",
    youtubeMusicUrl: "https://music.youtube.com/playlist?list=RDCLAK5uy_kr3pcLM0Dc_A9wvxCj0vVjob3maWg1WgA&playnext=1&si=dBmgtq1crRbfSzHJ"
  },
  {
    id: "OLAK5uy_mC3mlANeMzHXt0NXx4n_Yt1ZZyZRM3AbA",
    name: "alka yagnik",
    route: "alka-yagnik",
    bg: "assets/bg.webp",
    bgMobile: "assets/bg-mobile.webp",
    youtubeMusicUrl: "https://music.youtube.com/playlist?list=OLAK5uy_mC3mlANeMzHXt0NXx4n_Yt1ZZyZRM3AbA&si=9w767l3tdqa9yxbN"
  },
  {
    id: "RDCLAK5uy_not6oaCYghpBvL86A9_e2hmsqwolSO3_s",
    name: "Kumar sanu",
    route: "kumar-sanu",
    bg: "assets/bg.webp",
    bgMobile: "assets/bg-mobile.webp",
    youtubeMusicUrl: "https://music.youtube.com/playlist?list=RDCLAK5uy_not6oaCYghpBvL86A9_e2hmsqwolSO3_s&playnext=1&si=gekT1MJdWVWREsar"
  },
  {
    id: "OLAK5uy_mzpVwrCgdSx1-g2_4TKUQ6kt8skWHDlB0",
    name: "Kishor Kumar",
    route: "kishor-kumar",
    bg: "assets/bg.webp",
    bgMobile: "assets/bg-mobile.webp",
    youtubeMusicUrl: "https://music.youtube.com/playlist?list=OLAK5uy_mzpVwrCgdSx1-g2_4TKUQ6kt8skWHDlB0&si=0XnR3t7CG0ksdMF0"
  },
  // {
  //   id: "PLM9TSDk-uGcU",
  //   name: "5",
  //   route: "5",
  //   bg: "assets/bg.webp",
  //   bgMobile: "assets/bg-mobile.webp",
  //   youtubeMusicUrl: "https://music.youtube.com/playlist?list=PLM9TSDk-uGcU&si=aPy7_lcHH9NM0IGE"
  // },
  // {
  //   id: "PLGgr07aatIVk",
  //   name: "6",
  //   route: "6",
  //   bg: "assets/bg.webp",
  //   bgMobile: "assets/bg-mobile.webp",
  //   youtubeMusicUrl: "https://music.youtube.com/playlist?list=PLGgr07aatIVk&si=kWzSsdPn3xY5uA0P"
  // }
];

const CONFIG = {
  playlists: PLAYLISTS,
  defaultPlaylistIndex: 0,
  playlistId: PLAYLISTS[0].id,

  heroTitle: appEnv.heroTitle || "Vibe with Me",
  showHeroTitle: appEnv.showHeroTitle ?? true,

  youtubeMusicUrl: PLAYLISTS[0].youtubeMusicUrl || "",
  spotifyUrl: appEnv.spotifyUrl || "",
  instagramUrl: appEnv.instagramUrl || "",
  githubUrl: appEnv.githubUrl || "",

  showOnlineCount: appEnv.showOnlineCount ?? true,
  onlineCount: appEnv.onlineCount ?? 462,

  backgroundImage: appEnv.backgroundImage || "assets/bg.webp",
  backgroundImageMobile: appEnv.backgroundImageMobile || "assets/bg-mobile.webp",
  dynamicBackground: appEnv.dynamicBackground ?? false,

  autoplay: appEnv.autoplay ?? false,

  weatherApiKey: appEnv.weatherApiKey || "",
  fallbackLocationName: appEnv.fallbackLocationName || "Pune",
  fallbackLat: appEnv.fallbackLat ?? 18.5204,
  fallbackLon: appEnv.fallbackLon ?? 73.8567,
  useGeolocation: appEnv.useGeolocation ?? true,
  weatherRefreshMinutes: appEnv.weatherRefreshMinutes ?? 20,

  waveformBarCount: appEnv.waveformBarCount ?? 56,
};

/* ==========================================================================
   1b. FIREBASE — presence count + like count (Fetched from Environment / config.js)
   ========================================================================== */

const firebaseConfig = appEnv.firebaseConfig || null;

/* ==========================================================================
   2. STATE
   ========================================================================== */

const state = {
  player: null,
  playerReady: false,
  isPlaying: false,
  userWantsPlayback: false,
  duration: 0,
  currentVideoId: null,
  isSeeking: false,
  metadataRetryTimer: null,
  queueIds: [],
  queueMeta: {},
  playlistPopupOpen: false,
  shuffleOn: false,
  consecutiveErrors: 0,
  hasLiked: false,
  likeRef: null,
  currentLikeRef: null,
  likeCountListener: null,
  firebaseApp: null,
  currentPlaylistId: null,
  currentPlaylistIndex: 0,
  optionWheel: null,
  playlistDrawerOpen: false,
  playlistSwitchToken: 0,
  playlistSwitchWatchdog: null,
};

// --- Mobile Background Audio Session Bridge ---
// iOS Safari & Android Chrome suspend video iframes when going to Home Screen unless
// an HTML5 audio element with an active MediaSession is running in the background.
const bgAudioSession = new Audio();
bgAudioSession.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
bgAudioSession.loop = true;
bgAudioSession.volume = 0.01;

function enableBackgroundAudioSession() {
  try {
    const playPromise = bgAudioSession.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        /* browser user-gesture policy */
      });
    }
  } catch (e) { }
}

function pauseBackgroundAudioSession() {
  try {
    bgAudioSession.pause();
  } catch (e) { }
}

/* ==========================================================================
   3. DOM REFERENCES
   ========================================================================== */

const el = {};

function cacheDom() {
  el.clock = document.getElementById("clock");
  el.weatherIcon = document.getElementById("weatherIcon");
  el.rainLayer = document.getElementById("rainLayer");

  el.likeBtn = document.getElementById("likeBtn");
  el.likeCount = document.getElementById("likeCount");
  el.onlinePill = document.getElementById("onlinePill");
  el.onlineCount = document.getElementById("onlineCount");
  el.instagramLink = document.getElementById("instagramLink");
  el.githubLink = document.getElementById("githubLink");
  el.heroTitle = document.getElementById("heroTitle");
  el.statusBanner = document.getElementById("statusBanner");
  el.toast = document.getElementById("toast");

  el.bgPhoto = document.getElementById("bgPhoto");
  el.bgPhotoMobile = document.getElementById("bgPhotoMobile");
  el.bgPhotoDynamic = document.getElementById("bgPhotoDynamic");
  el.rowFar = document.getElementById("rowFarBuildings");
  el.rowMid = document.getElementById("rowMidBuildings");
  el.rowNear = document.getElementById("rowNearBuildings");
  el.stringBulbs = document.querySelector(".string-bulbs");

  el.player = document.getElementById("player");
  el.albumArt = document.getElementById("albumArt");

  el.trackTitle = document.getElementById("trackTitle");
  el.trackArtist = document.getElementById("trackArtist");
  el.playingDots = document.getElementById("playingDots");

  el.currentTime = document.getElementById("currentTime");
  el.durationTime = document.getElementById("durationTime");
  el.progressBar = document.getElementById("progressBar");

  el.prevBtn = document.getElementById("prevBtn");
  el.playBtn = document.getElementById("playBtn");
  el.nextBtn = document.getElementById("nextBtn");
  el.iconPlay = document.getElementById("iconPlay");
  el.iconPause = document.getElementById("iconPause");

  el.playlistPopup = document.getElementById("playlistPopup");
  el.playlistPopupBackdrop = document.getElementById("playlistPopupBackdrop");
  el.playlistPopupCloseBtn = document.getElementById("playlistPopupCloseBtn");
  el.playlistPopupList = document.getElementById("playlistPopupList");
  el.playlistPopupTitle = document.getElementById("playlistPopupTitle");
}


/* ==========================================================================
   4. BOOT
   ========================================================================== */

function initializeApp() {
  cacheDom();
  initClock();
  initServiceLinks();
  initHeroTitle();
  initOnlinePill();
  initPresence();
  initLikes();
  initRouter();     // sets state.currentPlaylistIndex from URL pathname
  initSidebar();    // builds left sidebar nav
  initWeather();
  initBackgroundPhoto(); // uses current playlist's bg fields
  generateIllustration();
  generateWaveform();
  initControls();
  initProgressBarInteraction();
  initKeyboardControls();
  initPlaylistPopup();
  initFullscreen();
  initMediaSession();

  showStatus("Loading playlist…", { loading: true });
  loadYouTubeAPI();
}

document.addEventListener("DOMContentLoaded", initializeApp);

/* ==========================================================================
   5. CLOCK
   ========================================================================== */

function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  el.clock.textContent = `${hours}:${minutes} ${period}`;
}

/* ==========================================================================
   6. SERVICE / SOCIAL LINKS
   ========================================================================== */

function initServiceLinks() {
  if (el.ytMusicLink && CONFIG.youtubeMusicUrl) el.ytMusicLink.href = CONFIG.youtubeMusicUrl;
  if (el.instagramLink && CONFIG.instagramUrl) el.instagramLink.href = CONFIG.instagramUrl;
}

function initOnlinePill() {
  if (!CONFIG.showOnlineCount) {
    el.onlinePill.style.display = "none";
    return;
  }
  el.onlineCount.textContent = CONFIG.onlineCount;
}

/* ==========================================================================
   6b. PRESENCE — real "online now" count via Firebase Realtime Database
   ========================================================================== */

function getFirebaseApp() {
  if (state.firebaseApp) return state.firebaseApp;
  if (typeof firebase === "undefined" || !firebaseConfig || !firebaseConfig.apiKey) {
    return null;
  }
  state.firebaseApp = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  return state.firebaseApp;
}

function initPresence() {
  if (!CONFIG.showOnlineCount) return;
  try {
    const app = getFirebaseApp();
    if (!app) return;

    const db = firebase.database();
    const myPresenceRef = db.ref("presence").push();
    const connectedRef = db.ref(".info/connected");

    connectedRef.on("value", (snap) => {
      if (snap.val() === true) {
        myPresenceRef.onDisconnect().remove();
        myPresenceRef.set(true);
      }
    });

    db.ref("presence").on("value", (snap) => {
      if (el.onlineCount) el.onlineCount.textContent = snap.numChildren();
    });
  } catch (err) {
    console.warn("[firebase] Presence count init failed:", err);
  }
}

/* ==========================================================================
   6c. LIKES — real "like this playlist" count via Firebase
   ========================================================================== */

function bindPlaylistLikes(playlistId) {
  const localKey = "rickshaw_liked_" + playlistId;
  const countKey = "rickshaw_likes_count_" + playlistId;
  state.hasLiked = localStorage.getItem(localKey) === "1";
  updateLikeButtonUI();

  try {
    const app = getFirebaseApp();
    if (!app) {
      const localCount = parseInt(localStorage.getItem(countKey) || "0", 10);
      if (el.likeCount) el.likeCount.textContent = localCount;
      return;
    }

    const db = firebase.database();
    if (state.currentLikeRef && state.likeCountListener) {
      state.currentLikeRef.off("value", state.likeCountListener);
    }

    const countRef = db.ref("likes/" + playlistId + "/count");
    state.currentLikeRef = countRef;

    state.likeCountListener = (snap) => {
      const value = snap.val();
      const num = typeof value === "number" ? value : 0;
      if (el.likeCount) el.likeCount.textContent = num;
      localStorage.setItem(countKey, String(num));
    };
    countRef.on("value", state.likeCountListener);
  } catch (err) {
    console.warn("[firebase] Likes bind failed:", err);
    const localCount = parseInt(localStorage.getItem(countKey) || "0", 10);
    if (el.likeCount) el.likeCount.textContent = localCount;
  }
}

function initLikes() {
  bindPlaylistLikes(CONFIG.playlistId);

  if (el.likeBtn) {
    el.likeBtn.addEventListener("click", () => {
      const playlistId = CONFIG.playlistId || (PLAYLISTS[state.currentPlaylistIndex] && PLAYLISTS[state.currentPlaylistIndex].id) || "main";
      const localKey = "rickshaw_liked_" + playlistId;
      const countKey = "rickshaw_likes_count_" + playlistId;

      try {
        const app = getFirebaseApp();
        if (app && state.currentLikeRef) {
          if (state.hasLiked) {
            state.currentLikeRef.transaction((current) => Math.max(0, (current || 0) - 1));
            localStorage.removeItem(localKey);
            state.hasLiked = false;
          } else {
            state.currentLikeRef.transaction((current) => (current || 0) + 1);
            localStorage.setItem(localKey, "1");
            state.hasLiked = true;
          }
        } else {
          // Fallback when Firebase is not active
          let curCount = parseInt(localStorage.getItem(countKey) || "0", 10);
          if (state.hasLiked) {
            curCount = Math.max(0, curCount - 1);
            localStorage.removeItem(localKey);
            state.hasLiked = false;
          } else {
            curCount += 1;
            localStorage.setItem(localKey, "1");
            state.hasLiked = true;
          }
          localStorage.setItem(countKey, String(curCount));
          if (el.likeCount) el.likeCount.textContent = curCount;
        }
        updateLikeButtonUI();
      } catch (err) {
        console.warn("[firebase] Like action failed:", err);
      }
    });
  }
}

function updateLikeButtonUI() {
  if (!el.likeBtn) return;
  el.likeBtn.classList.toggle("is-liked", state.hasLiked);
  el.likeBtn.setAttribute("aria-pressed", String(state.hasLiked));
  el.likeBtn.title = state.hasLiked ? "Unlike this playlist" : "Like this playlist";
}

/* ==========================================================================
   6c-2. ROUTER — pathname-based playlist routing (/honey-singh, /alka-yagnik, …)
   ========================================================================== */

function getRouteFromPath() {
  // Strip leading slash, e.g. "/honey-singh" → "honey-singh"
  const path = window.location.pathname.replace(/^\//, "").trim();
  return path || null;
}

function resolvePlaylistFromRoute(route) {
  if (!route) return PLAYLISTS[0];
  const found = PLAYLISTS.find((p) => p.route === route);
  return found || PLAYLISTS[0];
}

function navigateToPlaylist(playlist, pushState) {
  if (!playlist) return;
  const newPath = "/" + playlist.route;

  if (pushState) {
    if (window.location.pathname !== newPath) {
      history.pushState({ route: playlist.route }, "", newPath);
    }
    const index = PLAYLISTS.indexOf(playlist);
    onPlaylistChange(index, playlist);
    updateSidebarActiveItem(playlist.route);
    switchPlaylistBackground(playlist);
    return;
  }

  const index = PLAYLISTS.indexOf(playlist);
  onPlaylistChange(index, playlist);
  updateSidebarActiveItem(playlist.route);
  switchPlaylistBackground(playlist);
}

function initRouter() {
  // Redirect bare root URL to the first playlist route
  if (window.location.pathname === "/" || window.location.pathname === "") {
    history.replaceState({ route: PLAYLISTS[0].route }, "", "/" + PLAYLISTS[0].route);
  }

  const route = getRouteFromPath();
  const playlist = resolvePlaylistFromRoute(route);
  const index = PLAYLISTS.indexOf(playlist);

  state.currentPlaylistIndex = index;
  state.currentPlaylistId = playlist.id;
  CONFIG.playlistId = playlist.id;

  // Listen for back/forward navigation
  window.addEventListener("popstate", () => {
    const r = getRouteFromPath();
    const p = resolvePlaylistFromRoute(r);
    navigateToPlaylist(p, false);
  });
}

/* ==========================================================================
   6c-3. SIDEBAR — left-edge playlist navigator
   ========================================================================== */

function initSidebar() {
  const sidebar = document.getElementById("playlistSidebar");
  if (!sidebar) return;

  const list = document.getElementById("sidebarList");
  const toggle = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!list || !toggle || !backdrop) return;

  PLAYLISTS.forEach((playlist, idx) => {
    const btn = document.createElement("button");
    btn.className = "sidebar-item";
    btn.setAttribute("data-route", playlist.route);
    btn.setAttribute("aria-label", "Playlist " + playlist.name);
    btn.style.setProperty("--stagger-index", String(idx));
    btn.innerHTML = `
      <span class="sidebar-item-num">${playlist.name}</span>
      <span class="sidebar-item-label">Playlist ${playlist.name}</span>
    `;
    if (playlist.id === state.currentPlaylistId) {
      btn.classList.add("is-active");
    }
    btn.addEventListener("click", () => {
      closeSidebar();
      navigateToPlaylist(playlist, true);
    });
    list.appendChild(btn);
  });

  toggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.contains("is-open");
    if (isOpen) closeSidebar(); else openSidebar();
  });

  backdrop.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });
}

function openSidebar() {
  const sidebar = document.getElementById("playlistSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!sidebar) return;
  sidebar.classList.add("is-open");
  if (backdrop) backdrop.classList.add("is-open");
  document.getElementById("sidebarToggle")?.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  const sidebar = document.getElementById("playlistSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!sidebar) return;
  sidebar.classList.remove("is-open");
  if (backdrop) backdrop.classList.remove("is-open");
  document.getElementById("sidebarToggle")?.setAttribute("aria-expanded", "false");
}

function updateSidebarActiveItem(route) {
  const items = document.querySelectorAll(".sidebar-item");
  items.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.route === route);
  });
}

function onPlaylistChange(index, playlist) {
  if (!playlist) return;

  const isSamePlaylist = playlist.id === state.currentPlaylistId;
  state.currentPlaylistIndex = index;
  state.currentPlaylistId = playlist.id;
  CONFIG.playlistId = playlist.id;

  if (playlist.youtubeMusicUrl && el.ytMusicLink) {
    el.ytMusicLink.href = playlist.youtubeMusicUrl;
  }

  bindPlaylistLikes(playlist.id);

  // If player is not ready yet, the IDs are synced above and the
  // player will use CONFIG.playlistId when it boots — nothing else to do.
  if (!state.player || !state.playerReady) return;

  // Same playlist is already playing — nothing to do.
  if (isSamePlaylist) return;

  showToast("Playing: " + playlist.name);

  const switchToken = ++state.playlistSwitchToken;
  clearPlaylistSwitchWatchdog();
  resetNowPlayingForSwitch();

  showStatus("Loading " + playlist.name + "\u2026", { loading: true });
  state.consecutiveErrors = 0;
  state.queueIds = [];
  state.queueMeta = {};
  if (el.playlistPopupList) el.playlistPopupList.replaceChildren();

  // Force-stop the current track so the old audio definitely ends.
  try { state.player.stopVideo(); } catch (e) { }

  // Give the player a brief moment to settle after stopping before we
  // ask it to load a completely new playlist context.
  setTimeout(() => {
    if (state.playlistSwitchToken !== switchToken) return; // superseded

    try {
      // Always use the object form — passing a bare string treats it as a
      // single video ID, which silently fails for playlist IDs.
      state.player.loadPlaylist({
        list: playlist.id,
        listType: "playlist",
        index: 0
      });
    } catch (e) {
      console.warn("[player] loadPlaylist failed:", e);
      showStatus("Couldn't load \u201c" + playlist.name + "\u201d.", { error: true });
      return;
    }

    state.userWantsPlayback = true;
    enableBackgroundAudioSession();

    // Nudge playVideo after the playlist has had time to queue up.
    setTimeout(() => {
      if (state.playlistSwitchToken !== switchToken) return;
      try { state.player.playVideo(); } catch (err) { }
    }, 600);
  }, 200);

  // Watchdog: if no metadata arrives within 10 s, surface an error.
  state.playlistSwitchWatchdog = setTimeout(() => {
    if (switchToken !== state.playlistSwitchToken) return;
    if (state.currentVideoId) return; // metadata arrived — all good
    const loadedList = state.player && state.player.getPlaylist ? state.player.getPlaylist() : null;
    if (!loadedList || loadedList.length === 0) {
      showStatus("Couldn't load \u201c" + playlist.name + "\u201d. It may be private or unavailable.", { error: true });
    } else {
      showStatus("\u201c" + playlist.name + "\u201d isn't playable right now.", { error: true });
    }
  }, 10000);
}

/* ==========================================================================
   6c-3. PLAYLIST SWITCH HELPERS
   ========================================================================== */

function clearPlaylistSwitchWatchdog() {
  if (state.playlistSwitchWatchdog) {
    clearTimeout(state.playlistSwitchWatchdog);
    state.playlistSwitchWatchdog = null;
  }
}

function resetNowPlayingForSwitch() {
  state.currentVideoId = null;
  state.isPlaying = false;
  state.duration = 0;
  clearTimeout(state.metadataRetryTimer);
  state.metadataRetryTimer = null;
  stopProgressLoop();
  stopWaveformPulse();
  updateUI();

  if (el.trackTitle) el.trackTitle.textContent = "Loading…";
  if (el.trackSubtitle) el.trackSubtitle.textContent = "";
  if (el.trackArtist) el.trackArtist.textContent = "Please wait";
  if (el.albumArt) el.albumArt.removeAttribute("src");
  if (el.currentTime) el.currentTime.textContent = "0:00";
  if (el.durationTime) el.durationTime.textContent = "0:00";
  if (el.progressFillMask) el.progressFillMask.style.width = "0%";
  if (el.progressHandle) el.progressHandle.style.left = "0%";
  if (el.progressTrack) el.progressTrack.setAttribute("aria-valuenow", "0");
}

/* ==========================================================================
   6d. WEATHER — geolocation + OpenWeatherMap + rain effect
   ========================================================================== */

// OpenWeatherMap "id" ranges: 2xx thunderstorm, 3xx drizzle, 5xx rain,
// 6xx snow, 7xx atmosphere/mist, 800 clear, 80x clouds.
function weatherIconFor(id, isNight) {
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 400) return "🌦️";
  if (id >= 500 && id < 600) return "🌧️";
  if (id >= 600 && id < 700) return "❄️";
  if (id >= 700 && id < 800) return "🌫️";
  if (id === 800) return isNight ? "🌙" : "☀️";
  if (id > 800) return "⛅";
  return "⛅";
}

function isRainyCondition(id) {
  return (id >= 200 && id < 600) || (id >= 200 && id < 300);
}

const LOCATION_STORAGE_KEY = "rickshaw_manual_location";

function initWeather() {
  if (!CONFIG.weatherApiKey) return;

  try {
    const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.lat === "number" && typeof parsed.lon === "number") {
        state.manualLocation = parsed;
      }
    }
  } catch (err) {
    /* corrupt or unavailable storage — fall back to geolocation */
  }

  refreshWeather();
  setInterval(refreshWeather, CONFIG.weatherRefreshMinutes * 60 * 1000);
}

function refreshWeather() {
  if (state.manualLocation) {
    fetchWeather(state.manualLocation.lat, state.manualLocation.lon, state.manualLocation.name);
    return;
  }

  if (CONFIG.useGeolocation && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, null),
      () => fetchWeather(CONFIG.fallbackLat, CONFIG.fallbackLon, CONFIG.fallbackLocationName),
      { timeout: 6000, maximumAge: 10 * 60 * 1000 }
    );
  } else {
    fetchWeather(CONFIG.fallbackLat, CONFIG.fallbackLon, CONFIG.fallbackLocationName);
  }
}

function fetchWeather(lat, lon, knownName) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${CONFIG.weatherApiKey}`;

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("weather request failed: " + res.status);
      return res.json();
    })
    .then((data) => {
      const id = data.weather && data.weather[0] ? data.weather[0].id : 800;
      const isNight = data.weather && data.weather[0] ? data.weather[0].icon.endsWith("n") : false;
      const desc = data.weather && data.weather[0] ? data.weather[0].description : "";
      const temp = data.main ? Math.round(data.main.temp) : null;
      const tooltip = (knownName || data.name || "") + (temp !== null ? ` (${temp}°C, ${desc})` : ` (${desc})`);

      if (el.weatherIcon) {
        el.weatherIcon.textContent = weatherIconFor(id, isNight);
        el.weatherIcon.title = tooltip;
      }
      toggleRain(isRainyCondition(id));
    })
    .catch((err) => {
      console.warn("[weather] Could not fetch weather:", err.message);
    });
}

let rainBuilt = false;

function toggleRain(shouldShow) {
  if (shouldShow && !rainBuilt) buildRain();
  el.rainLayer.classList.toggle("is-active", shouldShow);
}

function buildRain() {
  rainBuilt = true;
  const dropCount = 90;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < dropCount; i++) {
    const drop = document.createElement("div");
    drop.className = "raindrop";
    const left = Math.random() * 100;
    const duration = 0.6 + Math.random() * 0.7;
    const delay = Math.random() * 2;
    const height = 40 + Math.random() * 50;
    drop.style.left = left + "%";
    drop.style.height = height + "px";
    drop.style.animationDuration = duration + "s";
    drop.style.animationDelay = delay + "s";
    frag.appendChild(drop);
  }
  el.rainLayer.appendChild(frag);
}



/* ==========================================================================
   7. HERO TITLE
   ========================================================================== */

function initHeroTitle() {
  if (!CONFIG.showHeroTitle) {
    el.heroTitle.classList.add("is-hidden");
    return;
  }
  el.heroTitle.classList.remove("is-hidden");
  const img = el.heroTitle.querySelector(".hero-title-img");
  if (img && CONFIG.heroTitle) {
    img.alt = CONFIG.heroTitle;
  }
}

/* ==========================================================================
   8. BACKGROUND — static photo + procedural illustration
   ========================================================================== */

let bgSlideshowTimer = null;
let currentBgIndex = 0;

function getPlaylistBgs(playlist, isMobileVP) {
  if (!playlist) return [];
  const val = isMobileVP ? (playlist.bgMobile || playlist.bg) : playlist.bg;
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function getCurrentPlaylistBg(isMobileVP) {
  const playlist = PLAYLISTS[state.currentPlaylistIndex] || PLAYLISTS[0];
  const bgs = getPlaylistBgs(playlist, isMobileVP);
  if (bgs.length === 0) return "";
  return bgs[currentBgIndex % bgs.length];
}

const _mobileQuery = window.matchMedia("(max-width: 620px)");

function loadBgInto(targetEl, src) {
  if (!src || !targetEl) return;
  if (targetEl.dataset.loadedSrc === src) {
    targetEl.classList.add("is-visible");
    return;
  }
  const img = new Image();
  img.onload = () => {
    targetEl.style.backgroundImage = `url("${src}")`;
    targetEl.dataset.loadedSrc = src;
    targetEl.classList.add("is-visible");
    const ill = document.getElementById("bgIllustration");
    if (ill) ill.style.opacity = "0";
  };
  img.onerror = () => console.warn(`[bg] Could not load "${src}".`);
  img.src = src;
}

function startBgSlideshow() {
  clearTimeout(bgSlideshowTimer);
  const playlist = PLAYLISTS[state.currentPlaylistIndex];
  if (!playlist) return;
  const useMobile = _mobileQuery.matches;
  const bgs = getPlaylistBgs(playlist, useMobile);
  if (bgs.length <= 1) return;

  bgSlideshowTimer = setTimeout(() => {
    currentBgIndex++;
    const targetEl = useMobile ? el.bgPhotoMobile : el.bgPhoto;
    if (targetEl) {
      targetEl.style.transition = "opacity 1.5s ease-in-out";
      targetEl.style.opacity = "0";
      setTimeout(() => {
        const nextSrc = getCurrentPlaylistBg(useMobile);
        targetEl.style.backgroundImage = `url("${nextSrc}")`;
        targetEl.style.opacity = "1";
        startBgSlideshow();
      }, 1500);
    } else {
      startBgSlideshow();
    }
  }, 12000);
}

function applyBackgroundForViewport() {
  const useMobile = _mobileQuery.matches;
  const src = getCurrentPlaylistBg(useMobile);
  const targetEl = useMobile ? el.bgPhotoMobile : el.bgPhoto;
  const otherEl = useMobile ? el.bgPhoto : el.bgPhotoMobile;
  if (otherEl) otherEl.classList.remove("is-visible");
  loadBgInto(targetEl, src);
  startBgSlideshow();
}

function initBackgroundPhoto() {
  applyBackgroundForViewport();
  _mobileQuery.addEventListener("change", applyBackgroundForViewport);
}

function switchPlaylistBackground(playlist) {
  clearTimeout(bgSlideshowTimer);
  currentBgIndex = 0;
  if (playlist) {
    CONFIG.backgroundImage = playlist.bg || CONFIG.backgroundImage;
    CONFIG.backgroundImageMobile = playlist.bgMobile || playlist.bg || CONFIG.backgroundImageMobile;
  }
  [el.bgPhoto, el.bgPhotoMobile].forEach((ph) => {
    if (ph) ph.style.opacity = "0";
  });
  setTimeout(() => {
    [el.bgPhoto, el.bgPhotoMobile].forEach((ph) => {
      if (ph) { ph.dataset.loadedSrc = ""; ph.style.opacity = ""; }
    });
    applyBackgroundForViewport();
  }, 350);
}

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateBuildingRow(group, rand, opts) {
  if (!group) return;
  const { baseline, minH, maxH, minW, maxW, gap, windows } = opts;
  let x = -20;
  const svgNS = "http://www.w3.org/2000/svg";
  while (x < 1620) {
    const w = minW + rand() * (maxW - minW);
    const h = minH + rand() * (maxH - minH);
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", x.toFixed(1));
    rect.setAttribute("y", (baseline - h).toFixed(1));
    rect.setAttribute("width", w.toFixed(1));
    rect.setAttribute("height", (h + 40).toFixed(1));
    rect.setAttribute("rx", "2");
    group.appendChild(rect);

    if (windows) {
      const cols = Math.max(1, Math.floor(w / 22));
      const rows = Math.max(1, Math.floor(h / 26));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rand() > 0.45) continue;
          const wx = x + 8 + c * 22;
          const wy = baseline - h + 12 + r * 26;
          const win = document.createElementNS(svgNS, "rect");
          win.setAttribute("x", wx.toFixed(1));
          win.setAttribute("y", wy.toFixed(1));
          win.setAttribute("width", "6");
          win.setAttribute("height", "9");
          win.setAttribute("rx", "1");
          win.setAttribute("fill", "#f3b25a");
          win.setAttribute("opacity", (0.25 + rand() * 0.35).toFixed(2));
          group.appendChild(win);
        }
      }
    }

    x += w + gap + rand() * gap;
  }
}

function generateStringBulbs() {
  if (!el.stringBulbs) return;
  const svgNS = "http://www.w3.org/2000/svg";
  const count = 26;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const x = t * 1600;
    const y = 90 + 70 * Math.sin(Math.PI * t) + 20 * Math.sin(Math.PI * t * 2);
    const bulb = document.createElementNS(svgNS, "circle");
    bulb.setAttribute("cx", x.toFixed(1));
    bulb.setAttribute("cy", y.toFixed(1));
    bulb.setAttribute("r", "3.2");
    el.stringBulbs.appendChild(bulb);
  }
}

function generateIllustration() {
  const rand = seededRandom(1337);
  generateBuildingRow(el.rowFar, rand, { baseline: 620, minH: 90, maxH: 190, minW: 50, maxW: 110, gap: 6, windows: false });
  generateBuildingRow(el.rowMid, rand, { baseline: 700, minH: 130, maxH: 260, minW: 60, maxW: 130, gap: 8, windows: true });
  generateBuildingRow(el.rowNear, rand, { baseline: 900, minH: 160, maxH: 340, minW: 70, maxW: 160, gap: 10, windows: true });
  generateStringBulbs();
}

function updateBackground(videoId) {
  if (!CONFIG.dynamicBackground || !videoId) return;
  loadBestThumbnail(videoId, (url) => {
    el.bgPhotoDynamic.style.backgroundImage = `url("${url}")`;
    el.bgPhotoDynamic.classList.add("is-visible");
  });
}

/* ==========================================================================
   8b. DECORATIVE WAVEFORM
   ========================================================================== */

// Not tied to real audio — YouTube's cross-origin iframe never exposes its
// audio stream to this page, so a true audio-reactive waveform isn't
// technically possible here. This generates a fixed, natural-looking bar
// pattern once, then animates each bar's height with a staggered CSS-driven
// pulse while playing, reusing the same bars (cloned) as the progress fill.
function generateWaveform() {
  if (!el.waveformBars || !el.progressFillMask) return;
  const rand = seededRandom(42);
  const count = CONFIG.waveformBarCount;
  el.waveformBars.innerHTML = "";

  const heights = [];
  for (let i = 0; i < count; i++) {
    heights.push(0.25 + rand() * 0.75);
  }

  heights.forEach((h, i) => {
    const bar = document.createElement("span");
    bar.style.height = Math.round(h * 100) + "%";
    bar.dataset.baseHeight = h;
    bar.style.animationDelay = (i * 37) % 900 + "ms";
    el.waveformBars.appendChild(bar);
  });

  const clone = document.createElement("div");
  clone.className = "waveform-bars-clone";
  heights.forEach((h) => {
    const bar = document.createElement("span");
    bar.style.height = Math.round(h * 100) + "%";
    clone.appendChild(bar);
  });
  el.progressFillMask.innerHTML = "";
  el.progressFillMask.appendChild(clone);
}

let waveformPulseId = null;

function startWaveformPulse() {
  if (waveformPulseId || !el.waveformBars) return;
  const bars = el.waveformBars.querySelectorAll("span");
  if (!bars.length) return;
  let t = 0;
  const tick = () => {
    t += 1;
    bars.forEach((bar, i) => {
      const base = parseFloat(bar.dataset.baseHeight) || 0.5;
      const wobble = Math.sin(t * 0.15 + i * 0.6) * 0.18;
      const h = Math.max(0.12, Math.min(1, base + wobble));
      bar.style.height = Math.round(h * 100) + "%";
    });
    waveformPulseId = requestAnimationFrame(tick);
  };
  waveformPulseId = requestAnimationFrame(tick);
}

function stopWaveformPulse() {
  if (waveformPulseId) {
    cancelAnimationFrame(waveformPulseId);
    waveformPulseId = null;
  }
}

/* ==========================================================================
   9. THUMBNAIL LOADING WITH FALLBACK CHAIN
   ========================================================================== */

function loadBestThumbnail(videoId, onSuccess, onFailure) {
  const sizes = ["maxresdefault", "hqdefault", "mqdefault", "default"];
  let i = 0;

  function tryNext() {
    if (i >= sizes.length) {
      if (onFailure) onFailure();
      return;
    }
    const url = `https://img.youtube.com/vi/${videoId}/${sizes[i]}.jpg`;
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth <= 120 && sizes[i] !== "default") {
        i += 1;
        tryNext();
        return;
      }
      onSuccess(url);
    };
    probe.onerror = () => {
      i += 1;
      tryNext();
    };
    probe.src = url;
  }

  tryNext();
}

function setAlbumArtwork(videoId) {
  loadBestThumbnail(
    videoId,
    (url) => {
      el.albumArt.src = url;
      el.albumArt.alt = el.trackTitle.textContent;
    },
    () => {
      el.albumArt.removeAttribute("src");
    }
  );
}

/* ==========================================================================
   10. YOUTUBE IFRAME API
   ========================================================================== */

function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) {
    createYouTubePlayer();
    return;
  }
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  tag.onerror = () => showStatus("Unable to connect to YouTube.", { error: true });
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = createYouTubePlayer;
}

function createYouTubePlayer() {
  const playerVars = {
    listType: "playlist",
    list: CONFIG.playlistId,
    controls: 0,
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
    disablekb: 1,
    iv_load_policy: 3,
  };

  if (window.location.protocol.startsWith("http") && window.location.origin && window.location.origin !== "null") {
    playerVars.origin = window.location.origin;
  }

  state.player = new YT.Player("youtube-player", {
    height: "1",
    width: "1",
    host: "https://www.youtube-nocookie.com",
    playerVars: playerVars,
    events: {
      onReady: handlePlayerReady,
      onStateChange: handlePlayerStateChange,
      onError: handlePlayerError,
    },
  });
}

function handlePlayerReady(event) {
  state.playerReady = true;

  const playlist = state.player.getPlaylist();
  if (!playlist || playlist.length === 0) {
    showStatus("Playlist not found. Check CONFIG.playlistId in script.js.", { error: true });
    return;
  }

  hideStatus();
  refreshMetadataWithRetry();
  buildPlaylistPopupList(playlist);

  if (CONFIG.autoplay) {
    state.player.playVideo();
  }
}

function handlePlayerStateChange(event) {
  const YTState = window.YT.PlayerState;

  switch (event.data) {
    case YTState.PLAYING:
      state.isPlaying = true;
      state.userWantsPlayback = true;
      state.duration = state.player.getDuration() || 0;
      state.consecutiveErrors = 0;
      enableBackgroundAudioSession();
      updateUI();
      refreshMetadataWithRetry();
      startProgressLoop();
      startWaveformPulse();
      updateMediaSessionPlaybackState(true);
      updateMediaSessionPositionState();

      const currentPlaylist = state.player && state.player.getPlaylist ? state.player.getPlaylist() : null;
      if (currentPlaylist && currentPlaylist.length > 0 && (state.queueIds.length === 0 || state.queueIds[0] !== currentPlaylist[0])) {
        buildPlaylistPopupList(currentPlaylist);
      } else {
        highlightCurrentPlaylistRow();
      }
      hideStatus();
      break;

    case YTState.PAUSED:
      // If paused automatically by browser when minimizing to home screen,
      // and the user didn't explicitly tap pause:
      if (document.hidden && state.userWantsPlayback) {
        enableBackgroundAudioSession();
        setTimeout(() => {
          if (state.player && state.userWantsPlayback) {
            state.player.playVideo();
          }
        }, 150);
        return;
      }
      state.isPlaying = false;
      state.userWantsPlayback = false;
      pauseBackgroundAudioSession();
      updateUI();
      stopProgressLoop();
      stopWaveformPulse();
      updateMediaSessionPlaybackState(false);
      highlightCurrentPlaylistRow();
      break;

    case YTState.BUFFERING:
      state.isPlaying = false;
      updateUI();
      break;

    case YTState.CUED:
      state.isPlaying = false;
      updateUI();
      refreshMetadataWithRetry();
      const cuedPlaylist = state.player && state.player.getPlaylist ? state.player.getPlaylist() : null;
      if (cuedPlaylist && cuedPlaylist.length > 0 && (state.queueIds.length === 0 || state.queueIds[0] !== cuedPlaylist[0])) {
        buildPlaylistPopupList(cuedPlaylist);
      }
      break;

    case YTState.ENDED:
      state.isPlaying = false;
      updateUI();
      refreshMetadataWithRetry();
      break;

    default:
      break;
  }
}

function handlePlayerError(event) {
  // We got a real signal from the player (even if it's a failure), so the
  // "did nothing happen at all" watchdog no longer applies — the existing
  // skip-ahead / give-up logic below takes over from here.
  clearPlaylistSwitchWatchdog();

  const messages = {
    2: "This video can't be played.",
    5: "A playback error occurred.",
    100: "This video was removed or is private.",
    101: "This video can't be played here.",
    150: "This video can't be played here.",
  };
  const message = messages[event.data] || "Something went wrong with playback.";

  state.consecutiveErrors += 1;

  const playlist = state.player && state.player.getPlaylist ? state.player.getPlaylist() : null;
  const playlistLength = playlist ? playlist.length : 0;

  // Once we've failed 3 times in a row, the per-track message stops being
  // useful — switch to a broader banner. Note this no longer halts playback
  // (see below): it used to give up entirely here, leaving the player
  // permanently stuck even when later tracks were perfectly playable.
  if (state.consecutiveErrors >= 3) {
    showStatus("Several tracks in this playlist can't be played. Skipping ahead…", { error: true });
  } else {
    showStatus(message, { error: true, autoHide: true });
  }

  // Keep skipping forward as long as we haven't already struck out on every
  // track in the playlist — a bad run of unplayable videos shouldn't
  // permanently freeze the player. Only stop once the number of consecutive
  // failures reaches the playlist length, i.e. nothing is left to try.
  if (playlist && playlist.length > 1 && state.consecutiveErrors < playlistLength) {
    setTimeout(() => {
      playNext();
    }, 1200);
  } else if (playlist && playlistLength > 0 && state.consecutiveErrors >= playlistLength) {
    showStatus("None of the tracks in this playlist could be played. Check CONFIG.playlistId.", { error: true });
  }
}

/* ==========================================================================
   11. METADATA
   ========================================================================== */

function refreshMetadataWithRetry(attempt) {
  attempt = attempt || 0;
  clearTimeout(state.metadataRetryTimer);
  state.metadataRetryTimer = null;

  if (!state.player || !state.player.getVideoData) return;

  const data = state.player.getVideoData();

  if (data && data.title) {
    updateSongMetadata(data);
    return;
  }

  if (attempt < 6) {
    state.metadataRetryTimer = setTimeout(() => {
      refreshMetadataWithRetry(attempt + 1);
    }, 300);
  }
}

// Splits a YouTube title like: Khuda Jaane (From "Bachna Ae Haseeno")
// into a title line + a parenthetical subtitle line, when present.
function splitTitleAndSubtitle(rawTitle) {
  const match = rawTitle.match(/^(.*?)\s*[\(\[]([^)\]]+)[\)\]]\s*$/);
  if (match) {
    return { title: match[1].trim(), subtitle: match[2].trim() };
  }
  return { title: rawTitle, subtitle: "" };
}

function updateSongMetadata(data) {
  if (!data || !data.video_id) return;
  if (data.video_id === state.currentVideoId) return;

  state.currentVideoId = data.video_id;
  clearPlaylistSwitchWatchdog();

  const fullTitle = data.title || "Untitled";
  const author = data.author || "";
  const { title, subtitle } = splitTitleAndSubtitle(fullTitle);
  if (el.trackTitle) {
    el.trackTitle.textContent = title;
    el.trackTitle.title = data.title || "";
  }
  if (el.trackArtist) {
    el.trackArtist.textContent = author;
  }

  setAlbumArtwork(data.video_id);
  updateBackground(data.video_id);
  updateTabTitle(fullTitle);
  updateMediaSessionMetadata(fullTitle, author, data.video_id);

  state.queueMeta[data.video_id] = { title: fullTitle, author: author || "Unknown artist" };
  refreshPlaylistPopupRow(data.video_id);
  highlightCurrentPlaylistRow();
}

/* ==========================================================================
   11b. TAB TITLE
   ========================================================================== */

const DEFAULT_TAB_TITLE = document.title;

function updateTabTitle(trackTitle) {
  document.title = trackTitle ? `${trackTitle} — ${CONFIG.heroTitle || DEFAULT_TAB_TITLE}` : DEFAULT_TAB_TITLE;
}

/* ==========================================================================
   11c. MEDIA SESSION — lock-screen / notification playback controls
   ========================================================================== */

function initMediaSession() {
  if (!("mediaSession" in navigator)) return;

  navigator.mediaSession.setActionHandler("play", () => {
    state.userWantsPlayback = true;
    enableBackgroundAudioSession();
    if (state.player) state.player.playVideo();
  });

  navigator.mediaSession.setActionHandler("pause", () => {
    state.userWantsPlayback = false;
    pauseBackgroundAudioSession();
    if (state.player) state.player.pauseVideo();
  });

  navigator.mediaSession.setActionHandler("previoustrack", () => {
    state.userWantsPlayback = true;
    enableBackgroundAudioSession();
    playPrevious();
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    state.userWantsPlayback = true;
    enableBackgroundAudioSession();
    playNext();
  });

  try {
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined && state.player) {
        seekTo(details.seekTime);
      }
    });
  } catch (e) { }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (state.userWantsPlayback) {
        enableBackgroundAudioSession();
        if (state.player && state.player.playVideo) {
          state.player.playVideo();
        }
      }
    } else {
      if (state.userWantsPlayback && state.player && state.player.playVideo) {
        state.player.playVideo();
      }
    }
  });
}

function updateMediaSessionMetadata(title, author, videoId) {
  if (!("mediaSession" in navigator)) return;

  loadBestThumbnail(
    videoId,
    (url) => {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: author,
        artwork: [
          { src: url, sizes: "512x512", type: "image/jpeg" },
          { src: url, sizes: "256x256", type: "image/jpeg" },
          { src: url, sizes: "128x128", type: "image/jpeg" }
        ],
      });
    },
    () => {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: author });
    }
  );
}

function updateMediaSessionPlaybackState(isPlaying) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
}

function updateMediaSessionPositionState() {
  if (!("mediaSession" in navigator) || !("setPositionState" in navigator.mediaSession)) return;
  if (!state.player || !state.duration || state.duration <= 0) return;
  try {
    const current = Math.min(state.player.getCurrentTime() || 0, state.duration);
    navigator.mediaSession.setPositionState({
      duration: state.duration,
      playbackRate: 1,
      position: current
    });
  } catch (e) { }
}

/* ==========================================================================
   12. PLAYBACK CONTROLS
   ========================================================================== */

function initControls() {
  el.playBtn.addEventListener("click", togglePlayPause);
  el.prevBtn.addEventListener("click", playPrevious);
  el.nextBtn.addEventListener("click", playNext);
  el.shuffleBtn.addEventListener("click", toggleShuffle);
}

function toggleShuffle() {
  if (!state.player || !state.player.setShuffle) return;
  state.shuffleOn = !state.shuffleOn;
  try {
    state.player.setShuffle(state.shuffleOn);
  } catch (err) {
    console.warn("[shuffle] setShuffle call failed:", err);
  }
  el.shuffleBtn.classList.toggle("is-active", state.shuffleOn);
  el.shuffleBtn.setAttribute("aria-pressed", String(state.shuffleOn));
  el.shuffleBtn.setAttribute("aria-label", state.shuffleOn ? "Shuffle on" : "Shuffle off");
  el.shuffleBtn.title = state.shuffleOn ? "Shuffle: on" : "Shuffle: off";
}

function togglePlayPause() {
  if (!state.player || !state.playerReady) return;
  if (state.isPlaying) {
    state.userWantsPlayback = false;
    pauseBackgroundAudioSession();
    state.player.pauseVideo();
  } else {
    state.userWantsPlayback = true;
    enableBackgroundAudioSession();
    state.player.playVideo();
  }
}

function playNext() {
  if (!state.player || !state.playerReady) return;
  state.userWantsPlayback = true;
  enableBackgroundAudioSession();
  try {
    state.player.nextVideo();
  } catch (err) {
    console.warn("[player] nextVideo failed:", err);
  }
}

function playPrevious() {
  if (!state.player || !state.playerReady) return;
  state.userWantsPlayback = true;
  enableBackgroundAudioSession();
  try {
    const elapsed = state.player.getCurrentTime ? state.player.getCurrentTime() : 0;
    if (elapsed > 3) {
      state.player.seekTo(0, true);
      paintProgress(0, state.duration || 0);
    } else {
      state.player.previousVideo();
    }
  } catch (err) {
    console.warn("[player] previousVideo failed:", err);
  }
}

function getActiveDuration() {
  return (state.player && state.player.getDuration && state.player.getDuration()) || state.duration || 0;
}

let seekGraceTimer = null;

function seekTo(fractionOrSeconds, isFraction) {
  if (!state.player) return;
  const duration = getActiveDuration();
  if (!duration || duration <= 0) return;

  state.duration = duration;
  const seconds = isFraction ? fractionOrSeconds * duration : fractionOrSeconds;
  const clamped = Math.max(0, Math.min(seconds, duration));

  // 1. Immediately paint UI to target timestamp
  paintProgress(clamped, duration);

  // 2. Lock progress loop so it doesn't immediately overwrite with stale playback time
  state.isSeeking = true;
  clearTimeout(seekGraceTimer);

  // 3. Command YouTube Player to seek
  try {
    if (state.player.seekTo) {
      state.player.seekTo(clamped, true);
    }
  } catch (err) {
    console.warn("[player] seekTo failed:", err);
  }

  // 4. Release seek lock after player stream catches up to the new timestamp
  seekGraceTimer = setTimeout(() => {
    state.isSeeking = false;
  }, 450);
}

/* ==========================================================================
   13. PROGRESS (waveform fill + time labels)
   ========================================================================== */

function startProgressLoop() {
  if (state.progressRafId) return;
  const tick = (timestamp) => {
    if (!state.isPlaying) {
      state.progressRafId = null;
      return;
    }
    if (!state.isSeeking && (!state.lastProgressPaint || timestamp - state.lastProgressPaint > 150)) {
      updateProgress();
      state.lastProgressPaint = timestamp;
    }
    state.progressRafId = requestAnimationFrame(tick);
  };
  state.progressRafId = requestAnimationFrame(tick);
}

function stopProgressLoop() {
  if (state.progressRafId) {
    cancelAnimationFrame(state.progressRafId);
    state.progressRafId = null;
  }
}

function updateProgress() {
  if (!state.player || !state.player.getCurrentTime) return;
  const current = state.player.getCurrentTime() || 0;
  const duration = state.player.getDuration() || state.duration || 0;
  state.duration = duration;
  paintProgress(current, duration);
}

function paintProgress(current, duration) {
  const pct = duration > 0 ? (current / duration) * 100 : 0;
  if (el.progressBar && !state.isDraggingProgress) {
    el.progressBar.value = pct;
    el.progressBar.style.background = `linear-gradient(to right, #e3a94c 0%, #e3a94c ${pct}%, rgba(255,255,255,0.15) ${pct}%, rgba(255,255,255,0.15) 100%)`;
  }
  if (el.currentTime) el.currentTime.textContent = formatTime(current);
  if (el.durationTime) el.durationTime.textContent = formatTime(duration);
}

function initProgressBarInteraction() {
  if (!el.progressBar) return;
  state.isDraggingProgress = false;

  el.progressBar.addEventListener("input", (e) => {
    state.isDraggingProgress = true;
    const pct = parseFloat(e.target.value);
    const duration = getActiveDuration();
    const current = (pct / 100) * duration;
    if (el.currentTime) el.currentTime.textContent = formatTime(current);
    el.progressBar.style.background = `linear-gradient(to right, #e3a94c 0%, #e3a94c ${pct}%, rgba(255,255,255,0.15) ${pct}%, rgba(255,255,255,0.15) 100%)`;
  });

  el.progressBar.addEventListener("change", (e) => {
    state.isDraggingProgress = false;
    const pct = parseFloat(e.target.value);
    seekTo(pct / 100, true);
  });
}

/* ==========================================================================
   13b. SWIPE / DRAG ON ALBUM ART — prev/next
   ========================================================================== */

function initArtSwipe() {
  let startX = 0;
  let currentX = 0;
  let dragging = false;
  const threshold = 45; // px before a drag counts as a swipe

  function onDown(e) {
    dragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    currentX = 0;
  }

  function onMove(e) {
    if (!dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
    currentX = x;
    el.artSwipeArea.style.transform = `translateX(${Math.max(-40, Math.min(40, x * 0.35))}px)`;
    el.swipeHintLeft.style.opacity = x > 10 ? "0.85" : "0";
    el.swipeHintRight.style.opacity = x < -10 ? "0.85" : "0";
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    el.artSwipeArea.style.transition = "transform 220ms ease";
    el.artSwipeArea.style.transform = "";
    el.swipeHintLeft.style.opacity = "0";
    el.swipeHintRight.style.opacity = "0";
    setTimeout(() => {
      el.artSwipeArea.style.transition = "";
    }, 240);

    if (currentX > threshold) {
      playPrevious();
    } else if (currentX < -threshold) {
      playNext();
    }
    currentX = 0;
  }

  el.artSwipeArea.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/* ==========================================================================
   14b. PLAYLIST POPUP MODAL
   ========================================================================== */

function initPlaylistPopup() {
  const triggerElements = [
    document.getElementById("coverContainer"),
    document.getElementById("trackMetaText"),
    document.getElementById("playlistPopupBtn")
  ];

  triggerElements.forEach(trigger => {
    if (trigger) trigger.addEventListener("click", togglePlaylistPopup);
  });

  if (el.playlistPopupCloseBtn) {
    el.playlistPopupCloseBtn.addEventListener("click", closePlaylistPopup);
  }
  if (el.playlistPopupBackdrop) {
    el.playlistPopupBackdrop.addEventListener("click", closePlaylistPopup);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.playlistPopupOpen) closePlaylistPopup();
  });
}

function togglePlaylistPopup() {
  if (state.playlistPopupOpen) closePlaylistPopup();
  else openPlaylistPopup();
}

function openPlaylistPopup() {
  state.playlistPopupOpen = true;
  if (el.playlistPopup) el.playlistPopup.classList.add("is-open");
  if (el.playlistPopupBackdrop) el.playlistPopupBackdrop.classList.add("is-open");
  if (el.playlistPopup) el.playlistPopup.setAttribute("aria-hidden", "false");
  highlightCurrentPlaylistRow(true);
}

function closePlaylistPopup() {
  state.playlistPopupOpen = false;
  if (el.playlistPopup) el.playlistPopup.classList.remove("is-open");
  if (el.playlistPopupBackdrop) el.playlistPopupBackdrop.classList.remove("is-open");
  if (el.playlistPopup) el.playlistPopup.setAttribute("aria-hidden", "true");
}

function runWithConcurrency(items, limit, worker) {
  let index = 0;
  let active = 0;

  return new Promise((resolve) => {
    function next() {
      if (index >= items.length && active === 0) {
        resolve();
        return;
      }
      while (active < limit && index < items.length) {
        const item = items[index++];
        active += 1;
        worker(item).finally(() => {
          active -= 1;
          next();
        });
      }
    }
    next();
  });
}

function fetchOEmbedMeta(videoId) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    "https://www.youtube.com/watch?v=" + videoId
  )}&format=json`;

  return fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      state.queueMeta[videoId] = {
        title: (data && data.title) || "Unavailable video",
        author: (data && data.author_name) || "",
      };
    })
    .catch(() => {
      state.queueMeta[videoId] = { title: "Unavailable video", author: "" };
    })
    .then(() => {
      refreshPlaylistPopupRow(videoId);
    });
}

function buildPlaylistPopupList(playlistIds) {
  state.queueIds = playlistIds.slice();
  if (!el.playlistPopupList) return;
  el.playlistPopupList.innerHTML = "";

  playlistIds.forEach((videoId, index) => {
    const li = document.createElement("li");
    li.className = "playlist-popup-item";

    const row = document.createElement("button");
    row.type = "button";
    row.className = "playlist-popup-row";
    row.dataset.videoId = videoId;
    row.dataset.index = String(index);
    row.setAttribute("aria-label", `Play track ${index + 1}`);
    row.addEventListener("click", () => playPopupIndex(index));

    const numSpan = document.createElement("span");
    numSpan.className = "playlist-row-num";
    numSpan.textContent = String(index + 1);

    const textDiv = document.createElement("div");
    textDiv.className = "playlist-row-text";

    const titleSpan = document.createElement("span");
    titleSpan.className = "playlist-row-title";
    titleSpan.textContent = "Loading…";

    const artistSpan = document.createElement("span");
    artistSpan.className = "playlist-row-artist";
    artistSpan.textContent = "";

    textDiv.appendChild(titleSpan);
    textDiv.appendChild(artistSpan);

    row.appendChild(numSpan);
    row.appendChild(textDiv);
    li.appendChild(row);
    el.playlistPopupList.appendChild(li);
  });

  const unknownIds = playlistIds.filter((id) => !state.queueMeta[id]);
  runWithConcurrency(unknownIds, 4, fetchOEmbedMeta);

  highlightCurrentPlaylistRow();
}

function refreshPlaylistPopupRow(videoId) {
  const meta = state.queueMeta[videoId];
  if (!meta || !el.playlistPopupList) return;
  const row = el.playlistPopupList.querySelector(`.playlist-popup-row[data-video-id="${cssEscape(videoId)}"]`);
  if (!row) return;
  const titleEl = row.querySelector(".playlist-row-title");
  const artistEl = row.querySelector(".playlist-row-artist");
  if (titleEl) titleEl.textContent = meta.title;
  if (artistEl) artistEl.textContent = meta.author;
}

function highlightCurrentPlaylistRow(scrollIntoView) {
  if (!state.player || !state.player.getPlaylistIndex || !el.playlistPopupList) return;
  const currentIndex = state.player.getPlaylistIndex();
  const rows = el.playlistPopupList.querySelectorAll(".playlist-popup-row");
  rows.forEach((row) => {
    const isCurrent = Number(row.dataset.index) === currentIndex;
    row.classList.toggle("is-current", isCurrent);
    row.classList.toggle("is-paused", isCurrent && !state.isPlaying);
    if (isCurrent && scrollIntoView) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
}

function playPopupIndex(index) {
  if (!state.player || !state.player.playVideoAt) return;
  state.player.playVideoAt(index);
  closePlaylistPopup();
}

function cssEscape(value) {
  return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
}

/* ==========================================================================
   14c. FULLSCREEN MODE
   ========================================================================== */

function initFullscreen() {
  const btn = document.getElementById("fullscreenBtn");
  if (!btn) return;

  function updateIcon() {
    const inFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement
    );
    btn.setAttribute("aria-label", inFs ? "Exit fullscreen" : "Enter fullscreen");
    btn.title = inFs ? "Exit fullscreen" : "Fullscreen";
    btn.classList.toggle("is-fullscreen", inFs);
  }

  btn.addEventListener("click", () => {
    try {
      if (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      ) {
        (
          document.exitFullscreen ||
          document.webkitExitFullscreen ||
          document.mozCancelFullScreen
        ).call(document);
      } else {
        const el_ = document.documentElement;
        (
          el_.requestFullscreen ||
          el_.webkitRequestFullscreen ||
          el_.mozRequestFullScreen
        ).call(el_);
      }
    } catch (e) {
      console.warn("[fullscreen] Not supported:", e.message);
    }
  });

  document.addEventListener("fullscreenchange", updateIcon);
  document.addEventListener("webkitfullscreenchange", updateIcon);
  document.addEventListener("mozfullscreenchange", updateIcon);
  updateIcon();
}

/* ==========================================================================
   15. KEYBOARD SHORTCUTS
   ========================================================================== */

function initKeyboardControls() {
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : "";
    const isTyping =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      (document.activeElement && document.activeElement.isContentEditable);
    if (isTyping) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        togglePlayPause();
        break;
      case "ArrowRight":
        e.preventDefault();
        if (state.player) seekTo(Math.min(state.duration, (state.player.getCurrentTime() || 0) + 5));
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (state.player) seekTo(Math.max(0, (state.player.getCurrentTime() || 0) - 5));
        break;
      case "n":
      case "N":
        playNext();
        break;
      case "p":
      case "P":
        playPrevious();
        break;
      default:
        break;
    }
  });
}

/* ==========================================================================
   16. UI SYNC HELPERS
   ========================================================================== */

function updateUI() {
  el.player.classList.toggle("is-playing", state.isPlaying);
  el.iconPlay.style.display = state.isPlaying ? "none" : "block";
  el.iconPause.style.display = state.isPlaying ? "block" : "none";
  el.playBtn.setAttribute("aria-label", state.isPlaying ? "Pause" : "Play");
  el.playBtn.title = state.isPlaying ? "Pause" : "Play";
}

/* ==========================================================================
   17. STATUS / LOADING / ERROR BANNER
   ========================================================================== */

let statusHideTimer = null;

function showStatus(message, opts) {
  opts = opts || {};
  clearTimeout(statusHideTimer);
  el.statusBanner.innerHTML = "";

  if (opts.loading) {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    el.statusBanner.appendChild(spinner);
  }

  const text = document.createElement("span");
  text.textContent = message;
  el.statusBanner.appendChild(text);

  el.statusBanner.classList.toggle("is-error", !!opts.error);
  el.statusBanner.classList.add("is-visible");

  if (opts.autoHide) {
    statusHideTimer = setTimeout(hideStatus, 3200);
  }
}

function hideStatus() {
  el.statusBanner.classList.remove("is-visible");
}

/* ==========================================================================
   17b. TOAST — brief, low-priority confirmations
   ========================================================================== */

let toastHideTimer = null;

function showToast(message, durationMs) {
  if (!el.toast) return;
  clearTimeout(toastHideTimer);
  el.toast.textContent = message;
  el.toast.classList.add("is-visible");
  toastHideTimer = setTimeout(() => {
    el.toast.classList.remove("is-visible");
  }, durationMs || 2200);
}

/* ==========================================================================
   18. UTILITIES
   ========================================================================== */

function formatTime(totalSeconds) {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}
