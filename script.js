/* ==========================================================================
   दिल का सफर — cinematic music player
   Vanilla JS. No frameworks, no build step, no backend for playback (a small
   Firebase Realtime Database is used only for the live "online now" count).

   Architecture (see README for details):
     initializeApp          – boots everything on DOMContentLoaded
     loadYouTubeAPI          – injects the IFrame API script once
     createYouTubePlayer     – instantiates the hidden YT.Player
     handlePlayerReady       – first-load bookkeeping
     handlePlayerStateChange – reacts to play/pause/buffer/end/cue
     handlePlayerError       – user-friendly error states
     updateSongMetadata      – title / artist / thumbnail
     updateProgress          – rAF-driven progress bar + time labels
     seekTo / togglePlayPause / playNext / playPrevious
     updateUI                – small DOM sync helpers
     updateBackground        – optional per-song background wash
     formatTime               – mm:ss helper
     initPresence             – real "online now" count via Firebase
   ========================================================================== */

/* ==========================================================================
   1. CONFIGURATION — the only section most people need to touch
   ========================================================================== */

const CONFIG = {
  // Paste a YouTube playlist ID here (the part after "list=" in a playlist
  // URL). Example: https://www.youtube.com/playlist?list=PLxxxxxxxxxxxx
  playlistId: "PLcrE2_0C5h0wplMKN7ZvNJpwSuj-H0Y-C",

  // Devanagari (or any) title rendered large in the background. Set
  // showHeroTitle to false to disable it entirely.
  heroTitle: "लग्जरी रिक्शा",
  showHeroTitle: true,

  // External service links, opened in a new tab.
  spotifyUrl: "https://open.spotify.com/",
  youtubeMusicUrl: "https://music.youtube.com/playlist?list=PLcrE2_0C5h0wplMKN7ZvNJpwSuj-H0Y-C",

  // "Online" pill in the top right. Backed by real Firebase presence
  // tracking (see initPresence() below) — this is now a live count, not a
  // placeholder. onlineCount is just what briefly shows before the first
  // presence snapshot arrives.
  showOnlineCount: true,
  onlineCount: 462,

  // If set to a path/URL (e.g. "assets/background.jpg"), that image is used
  // as the fixed background instead of the built-in illustrated skyline.
  backgroundImage: "assets/bg.webp",

  // When true, a heavily blurred wash of the current song's thumbnail is
  // faded in behind the illustration/photo each time the track changes.
  dynamicBackground: false,

  // Attempt to start playback automatically once the playlist is ready.
  // Browsers frequently block unmuted autoplay — if that happens the player
  // simply stays paused and waits for the user to press play.
  autoplay: false,

  defaultVolume: 70, // initial volume level (0 = muted, 100 = max)
};

/* ==========================================================================
   1b. FIREBASE — used only for the live "online now" presence count
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCmnxFyJarwNRsXEXt-eTp7BAQcFrT39fM",
  authDomain: "rickshaw-10933.firebaseapp.com",
  databaseURL: "https://rickshaw-10933-default-rtdb.firebaseio.com",
  projectId: "rickshaw-10933",
  storageBucket: "rickshaw-10933.firebasestorage.app",
  messagingSenderId: "301375252455",
  appId: "1:301375252455:web:6c11bde4c6979e5048ff42",
};

/* ==========================================================================
   2. STATE
   ========================================================================== */

const state = {
  player: null,
  playerReady: false,
  isPlaying: false,
  duration: 0,
  currentVideoId: null,
  isSeeking: false,
  isMuted: false,
  lastVolume: CONFIG.defaultVolume,
  progressRafId: null,
  lastProgressPaint: 0,
  metadataRetryTimer: null,
};

/* ==========================================================================
   3. DOM REFERENCES
   ========================================================================== */

const el = {};

function cacheDom() {
  el.clock = document.getElementById("clock");
  el.onlinePill = document.getElementById("onlinePill");
  el.onlineCount = document.getElementById("onlineCount");
  el.spotifyLink = document.getElementById("spotifyLink");
  el.ytMusicLink = document.getElementById("ytMusicLink");
  el.heroTitle = document.getElementById("heroTitle");
  el.statusBanner = document.getElementById("statusBanner");

  el.bgPhoto = document.getElementById("bgPhoto");
  el.bgPhotoDynamic = document.getElementById("bgPhotoDynamic");
  el.rowFar = document.getElementById("rowFarBuildings");
  el.rowMid = document.getElementById("rowMidBuildings");
  el.rowNear = document.getElementById("rowNearBuildings");
  el.stringBulbs = document.querySelector(".string-bulbs");

  el.player = document.getElementById("player");
  el.albumArt = document.getElementById("albumArt");
  el.trackTitle = document.getElementById("trackTitle");
  el.trackArtist = document.getElementById("trackArtist");
  el.currentTime = document.getElementById("currentTime");
  el.durationTime = document.getElementById("durationTime");
  el.progressTrack = document.getElementById("progressTrack");
  el.progressFill = document.getElementById("progressFill");
  el.progressHandle = document.getElementById("progressHandle");

  el.prevBtn = document.getElementById("prevBtn");
  el.playBtn = document.getElementById("playBtn");
  el.nextBtn = document.getElementById("nextBtn");
  el.iconPlay = document.getElementById("iconPlay");
  el.iconPause = document.getElementById("iconPause");
  el.volumeBtn = document.getElementById("volumeBtn");
  el.iconVolume = document.getElementById("iconVolume");
  el.iconMuted = document.getElementById("iconMuted");
  el.volumeSlider = document.getElementById("volumeSlider");
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
  initBackgroundPhoto();
  generateIllustration();
  initControls();
  initProgressBarInteraction();
  initKeyboardControls();
  initVolumeControl();

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
   6. TOP-RIGHT SERVICE LINKS
   ========================================================================== */

function initServiceLinks() {
  el.spotifyLink.href = CONFIG.spotifyUrl;
  el.ytMusicLink.href = CONFIG.youtubeMusicUrl;
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

function initPresence() {
  if (!CONFIG.showOnlineCount) return;

  if (typeof firebase === "undefined") {
    console.warn("[presence] Firebase SDK not loaded — check the <script> tags in index.html.");
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  const myPresenceRef = db.ref("presence").push();
  const connectedRef = db.ref(".info/connected");

  connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
      // Firebase removes this the instant the tab closes or the connection
      // drops — no manual cleanup / heartbeat needed.
      myPresenceRef.onDisconnect().remove();
      myPresenceRef.set(true);
    }
  });

  db.ref("presence").on("value", (snap) => {
    const count = snap.numChildren();
    if (el.onlineCount) {
      el.onlineCount.textContent = count;
    }
  });
}

/* ==========================================================================
   7. HERO TITLE
   ========================================================================== */

function initHeroTitle() {
  if (!CONFIG.showHeroTitle || !CONFIG.heroTitle) {
    el.heroTitle.classList.add("is-hidden");
    return;
  }
  el.heroTitle.textContent = CONFIG.heroTitle;
}

/* ==========================================================================
   8. BACKGROUND — static photo + procedural illustration
   ========================================================================== */

function initBackgroundPhoto() {
  if (!CONFIG.backgroundImage) return;
  const img = new Image();
  img.onload = () => {
    el.bgPhoto.style.backgroundImage = `url("${CONFIG.backgroundImage}")`;
    el.bgPhoto.classList.add("is-visible");
    // A user-supplied photo takes over from the built-in illustration.
    document.getElementById("bgIllustration").style.opacity = "0";
  };
  img.onerror = () => {
    console.warn(`[player] Could not load CONFIG.backgroundImage "${CONFIG.backgroundImage}", falling back to the built-in illustration.`);
  };
  img.src = CONFIG.backgroundImage;
}

// Small deterministic PRNG so the generated skyline is stable across reloads.
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
    // Approximate the drape of the string-lights path with a sine curve.
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
      // YouTube serves a small grey placeholder (120x90) for sizes that
      // don't actually exist for a given video — skip those.
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

  // YouTube's API calls this global function once it has finished loading.
  window.onYouTubeIframeAPIReady = createYouTubePlayer;
}

function createYouTubePlayer() {
  state.player = new YT.Player("youtube-player", {
    height: "1",
    width: "1",
    playerVars: {
      listType: "playlist",
      list: CONFIG.playlistId,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      disablekb: 1,
      iv_load_policy: 3,
      origin: window.location.origin,
    },
    events: {
      onReady: handlePlayerReady,
      onStateChange: handlePlayerStateChange,
      onError: handlePlayerError,
    },
  });
}

function handlePlayerReady(event) {
  state.playerReady = true;
  state.player.setVolume(CONFIG.defaultVolume);
  el.volumeSlider.value = CONFIG.defaultVolume;

  const playlist = state.player.getPlaylist();
  if (!playlist || playlist.length === 0) {
    showStatus("Playlist not found. Check CONFIG.playlistId in script.js.", { error: true });
    return;
  }

  hideStatus();
  refreshMetadataWithRetry();

  if (CONFIG.autoplay) {
    state.player.playVideo();
  }
}

function handlePlayerStateChange(event) {
  const YTState = window.YT.PlayerState;

  switch (event.data) {
    case YTState.PLAYING:
      state.isPlaying = true;
      state.duration = state.player.getDuration() || 0;
      updateUI();
      refreshMetadataWithRetry();
      startProgressLoop();
      hideStatus();
      break;

    case YTState.PAUSED:
      state.isPlaying = false;
      updateUI();
      stopProgressLoop();
      break;

    case YTState.BUFFERING:
      state.isPlaying = false;
      updateUI();
      break;

    case YTState.CUED:
      state.isPlaying = false;
      updateUI();
      refreshMetadataWithRetry();
      break;

    case YTState.ENDED:
      // The playlist auto-advances on its own; this just keeps our UI in
      // sync in case the next video's metadata hasn't fired a CUED event.
      state.isPlaying = false;
      updateUI();
      refreshMetadataWithRetry();
      break;

    default:
      break;
  }
}

function handlePlayerError(event) {
  const messages = {
    2: "This video can't be played.",
    5: "A playback error occurred.",
    100: "This video was removed or is private.",
    101: "This video can't be played here.",
    150: "This video can't be played here.",
  };
  const message = messages[event.data] || "Something went wrong with playback.";
  showStatus(message, { error: true, autoHide: true });

  // Try to keep the music going by skipping the broken track.
  const playlist = state.player && state.player.getPlaylist ? state.player.getPlaylist() : null;
  if (playlist && playlist.length > 1) {
    setTimeout(() => {
      playNext();
    }, 1200);
  }
}

/* ==========================================================================
   11. METADATA
   ========================================================================== */

function refreshMetadataWithRetry(attempt) {
  attempt = attempt || 0;
  clearTimeout(state.metadataRetryTimer);

  if (!state.player || !state.player.getVideoData) return;

  const data = state.player.getVideoData();

  if (data && data.title) {
    updateSongMetadata(data);
    return;
  }

  // getVideoData() can briefly return an empty object right after a track
  // change — retry a few times rather than showing a blank title.
  if (attempt < 6) {
    state.metadataRetryTimer = setTimeout(() => {
      refreshMetadataWithRetry(attempt + 1);
    }, 300);
  }
}

function updateSongMetadata(data) {
  if (!data || !data.video_id) return;
  if (data.video_id === state.currentVideoId) return;

  state.currentVideoId = data.video_id;
  el.trackTitle.textContent = data.title || "Untitled";
  el.trackArtist.textContent = data.author || "Unknown artist";
  el.trackTitle.title = data.title || "";

  setAlbumArtwork(data.video_id);
  updateBackground(data.video_id);
}

/* ==========================================================================
   12. PLAYBACK CONTROLS
   ========================================================================== */

function initControls() {
  el.playBtn.addEventListener("click", togglePlayPause);
  el.prevBtn.addEventListener("click", playPrevious);
  el.nextBtn.addEventListener("click", playNext);
}

function togglePlayPause() {
  if (!state.player || !state.playerReady) return;
  if (state.isPlaying) {
    state.player.pauseVideo();
  } else {
    state.player.playVideo();
  }
}

function playNext() {
  if (!state.player || !state.playerReady) return;
  state.player.nextVideo();
}

function playPrevious() {
  if (!state.player || !state.playerReady) return;
  const elapsed = state.player.getCurrentTime ? state.player.getCurrentTime() : 0;
  if (elapsed > 3) {
    state.player.seekTo(0, true);
  } else {
    state.player.previousVideo();
  }
}

function seekTo(fractionOrSeconds, isFraction) {
  if (!state.player || !state.duration) return;
  const seconds = isFraction ? fractionOrSeconds * state.duration : fractionOrSeconds;
  state.player.seekTo(Math.max(0, Math.min(seconds, state.duration)), true);
}

/* ==========================================================================
   13. PROGRESS BAR
   ========================================================================== */

function startProgressLoop() {
  if (state.progressRafId) return;
  const tick = (timestamp) => {
    if (!state.isPlaying) {
      state.progressRafId = null;
      return;
    }
    if (!state.isSeeking && timestamp - state.lastProgressPaint > 200) {
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
  el.progressFill.style.width = `${pct}%`;
  el.progressHandle.style.left = `${pct}%`;
  el.currentTime.textContent = formatTime(current);
  el.durationTime.textContent = formatTime(duration);
  el.progressTrack.setAttribute("aria-valuenow", Math.round(pct));
}

function initProgressBarInteraction() {
  let dragging = false;

  function fractionFromEvent(e) {
    const rect = el.progressTrack.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }

  function onPointerDown(e) {
    if (!state.duration) return;
    dragging = true;
    state.isSeeking = true;
    const fraction = fractionFromEvent(e);
    paintProgress(fraction * state.duration, state.duration);
    el.progressTrack.setPointerCapture && e.pointerId != null && el.progressTrack.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const fraction = fractionFromEvent(e);
    paintProgress(fraction * state.duration, state.duration);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    const fraction = fractionFromEvent(e);
    seekTo(fraction, true);
    state.isSeeking = false;
  }

  el.progressTrack.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  // Keyboard access when the progress bar itself is focused.
  el.progressTrack.addEventListener("keydown", (e) => {
    if (!state.duration) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      seekTo(Math.min(state.duration, (state.player.getCurrentTime() || 0) + 5));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekTo(Math.max(0, (state.player.getCurrentTime() || 0) - 5));
    }
  });
}

/* ==========================================================================
   14. VOLUME
   ========================================================================== */

function initVolumeControl() {
  el.volumeSlider.value = CONFIG.defaultVolume;

  el.volumeSlider.addEventListener("input", (e) => {
    const value = Number(e.target.value);
    state.lastVolume = value || state.lastVolume;
    if (state.player && state.player.setVolume) {
      state.player.setVolume(value);
    }
    state.isMuted = value === 0;
    if (state.player && state.player.mute && state.player.unMute) {
      if (state.isMuted) state.player.mute();
      else state.player.unMute();
    }
    updateVolumeIcon();
  });

  el.volumeBtn.addEventListener("click", toggleMute);
}

function toggleMute() {
  if (!state.player) return;
  if (state.isMuted) {
    state.player.unMute();
    state.player.setVolume(state.lastVolume || CONFIG.defaultVolume);
    el.volumeSlider.value = state.lastVolume || CONFIG.defaultVolume;
    state.isMuted = false;
  } else {
    state.lastVolume = Number(el.volumeSlider.value) || state.lastVolume;
    state.player.mute();
    el.volumeSlider.value = 0;
    state.isMuted = true;
  }
  updateVolumeIcon();
}

function adjustVolume(delta) {
  const current = Number(el.volumeSlider.value) || 0;
  const next = Math.max(0, Math.min(100, current + delta));
  el.volumeSlider.value = next;
  el.volumeSlider.dispatchEvent(new Event("input"));
}

function updateVolumeIcon() {
  el.iconVolume.style.display = state.isMuted ? "none" : "block";
  el.iconMuted.style.display = state.isMuted ? "block" : "none";
  el.volumeBtn.setAttribute("aria-label", state.isMuted ? "Unmute" : "Mute");
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
      case "ArrowUp":
        e.preventDefault();
        adjustVolume(5);
        break;
      case "ArrowDown":
        e.preventDefault();
        adjustVolume(-5);
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