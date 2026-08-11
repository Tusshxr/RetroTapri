# दिल का सफर — cinematic YouTube playlist player

A full-screen, illustrated music player with a floating capsule control bar,
built with plain HTML/CSS/JS and the official YouTube IFrame Player API.
No framework, no backend, no build step.

## Files

| File             | Purpose                                                              |
| ---------------- | --------------------------------------------------------------------- |
| `index.html`     | Multi-file version — links `style.css` and `script.js`.               |
| `style.css`      | All styling: layout, palette, animation, responsive rules.            |
| `script.js`      | All behavior: YouTube integration, controls, keyboard shortcuts.      |
| `standalone.html`| Same app as one self-contained file (CSS/JS inlined) — hand this off or open it directly with no other files needed. |

Use whichever suits you — they're functionally identical. Editing the
multi-file version is easier day to day; `standalone.html` is convenient for
sharing a single file.

## Running it locally

Opening `index.html` directly via `file://` mostly works, but some browsers
restrict the YouTube iframe on `file://` origins. The reliable option is a
tiny local server from inside the `music-player` folder:

```bash
# Python 3
python3 -m http.server 8000

# or Node, if you have it
npx serve .
```

Then visit `http://localhost:8000`.

## Required: set your playlist

Open `script.js` (or, in `standalone.html`, the `<script>` block) and find
the `CONFIG` object at the top:

```js
const CONFIG = {
  playlistId: "YOUR_PLAYLIST_ID",
  ...
};
```

Replace `"YOUR_PLAYLIST_ID"` with the ID from a YouTube playlist URL:

```
https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxx
                                       ^^^^^^^^^^^^^^^^^^^^^^
                                       this part
```

The playlist must be public or unlisted — private playlists can't be
embedded. Until you set a real ID, the player shows a "Playlist not found"
message, which is expected.

## Changing the background image

By default the app draws its own illustrated dusk skyline (procedurally
generated in `script.js`, no image file needed). To use your own artwork
instead, set:

```js
backgroundImage: "assets/background.jpg",
```

Put the file at `music-player/assets/background.jpg` (or any path/URL you
like — relative paths, absolute paths, and remote URLs all work). Leave the
string empty (`""`) to keep the built-in illustration.

Separately, `dynamicBackground: true` fades in a blurred wash of the current
song's thumbnail behind everything each time the track changes. Set it to
`false` to keep the background completely static.

## Changing the hero title

```js
heroTitle: "दिल का सफर",
showHeroTitle: true,
```

Any string works, not just Devanagari — the font stack
(`Yatra One` → `Noto Serif Devanagari` → system serif) will render Latin
text fine too. Set `showHeroTitle: false` to remove it entirely.

## Changing the Spotify / YT Music links

```js
spotifyUrl: "https://open.spotify.com/",
youtubeMusicUrl: "https://music.youtube.com/",
```

Point these at a specific playlist/artist page if you want; they open in a
new tab regardless.

## The "online" count

```js
showOnlineCount: true,
onlineCount: 30,
```

This is a static, clearly-configurable placeholder number — the app has no
real user-presence backend, so there's no way to show a genuine live count
without adding one. Set `showOnlineCount: false` to hide the pill instead of
displaying a fake number.

## Other CONFIG options

```js
autoplay: false,       // try to start playback once the playlist is ready
defaultVolume: 80,      // 0–100
```

Browsers block unmuted autoplay unless the page already has "media
engagement" with the user, so `autoplay: true` is a best-effort request, not
a guarantee — if it's blocked, the player just sits ready with the Play
button showing, which is the correct fallback behavior rather than an error.

## Controls

- Click the big white button, or press **Space**, to play/pause.
- **←/→** seek 5s back/forward, **↑/↓** change volume.
- **N** / **P** skip to next/previous track.
- Clicking Previous within the first 3 seconds of a track restarts it
  instead of going back a track (standard music-player behavior); after
  that it goes to the previous track.
- Click or drag anywhere on the thin progress bar to seek.
- Keyboard shortcuts are disabled while focus is inside a text field.

## YouTube API notes and limitations

- Playback runs through the real, official YouTube embedded player — it's
  just sized to 1×1px and visually hidden, so only your custom UI is
  visible. This is required for compliance: the app never scrapes, extracts,
  or downloads audio/video from YouTube.
- Song title and channel name come from the player's own
  `getVideoData()` — YouTube doesn't expose per-item titles for a raw
  playlist list, only for whichever video is currently cued/playing, which
  is why metadata updates a moment after each track change rather than
  instantly.
- Thumbnails are requested in this order: `maxresdefault` → `hqdefault` →
  `mqdefault` → `default`, falling back automatically if a size doesn't
  exist for a given video.
- If a video in the playlist is private, deleted, or blocked from embedding,
  the player shows a short message and automatically skips to the next
  track after a moment, rather than getting stuck.
- Live streams, age-restricted videos, and videos with embedding disabled by
  the uploader are limitations of YouTube itself, not this app — there's no
  official way around them.
