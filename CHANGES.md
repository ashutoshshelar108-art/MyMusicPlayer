# CHANGES — Folder-based local player + Capacitor groundwork

Scope of this pass: turn Auralis from "plays 6 hardcoded demo songs" into
"plays whatever audio/video the user picks from their own device folder,"
with the plumbing needed for a real Capacitor app (native folder access,
background audio, lock-screen controls). Visual design (colors, layout,
button placement) was left as-is — changes are additive.

---

## index.html

- Removed the standalone `<audio>` element. Replaced with a single
  `<video id="media">` that now handles **both** audio and video files —
  a video element can play audio-only files fine (it just shows nothing
  visually), so one media element replaces what would've been two parallel
  sets of play/pause/seek code.
- Added `.media-wrapper` around the existing `#cover` image and the new
  `#media` video tag, so they occupy the same spot. `#cover` is used as a
  generic placeholder for audio tracks; `#media` becomes visible only when
  a video file is loaded.
- Added an **empty state** (`#emptyLibrary`) with an "Open Folder" button —
  shown until the user has picked a folder. Your original player UI
  (`#nowPlaying`) is hidden until then, so first-time use is one big
  obvious button instead of a player with nothing loaded in it.
- Added a second "Open Folder" icon button on the Library page.
- Renamed the "Playlist" section heading to "Playing From" (cosmetic only —
  same element, same styling).

## style.css

- No existing rules were changed. Everything new was appended at the end
  of the file, and it all reuses your existing CSS variables (`--primary`,
  `--surface-hover`, etc.) so it matches the current look automatically.
- New rules: `.media-wrapper` / `.video-surface` (video visibility
  toggle), `.empty-library` / `.primary-btn` (the open-folder prompt),
  `.page-header` / `.icon-btn` (Library page's open-folder button),
  `.now-playing.hidden` (show/hide toggle for the player).

## script.js — rewritten

The hardcoded `songs[]` array is gone. In its place:

- **`FolderAccess`** — a small bridge object with three backends:
  - `native`: calls the custom Capacitor plugin (see `native/FolderAccessPlugin.kt`)
    for real folder access + permanent permission on Android.
  - `fsapi`: uses the browser's File System Access API (`showDirectoryPicker`),
    so you can test the whole flow on Chrome desktop without building the
    native app.
  - `input`: last-resort `<input type="file" webkitdirectory>` fallback —
    works but can't remember the folder after a reload.
- **`Store`** — wraps Capacitor's `Preferences` plugin when available,
  falls back to `localStorage` otherwise. Used to remember the picked
  folder and the last-played track index.
- **`loadTrack()` / `resolveSrc()`** — resolves whatever the current
  backend gives us (a `content://` URI, a file handle, or a blob) into an
  actual playable URL, and shows/hides the video surface depending on file
  type.
- **`playMedia()` / `pauseMedia()`** — same job as your old `playSong()` /
  `pauseSong()`, renamed since they now drive a shared audio+video element.
  Calls `enableBackgroundMode()` on play.
- **Media Session API wiring** — lock-screen/notification play, pause,
  next, previous controls. Works in a plain mobile browser too, not just
  Capacitor.
- **`restoreSession()`** — runs on load; if a folder was saved, re-lists it
  (files may have changed) and resumes on the last track.
- Sidebar toggle and page router logic are untouched from before.

## native/FolderAccessPlugin.kt — new

A custom Capacitor plugin (Kotlin) implementing:
- `pickFolder()` — opens Android's `ACTION_OPEN_DOCUMENT_TREE` picker and
  calls `takePersistableUriPermission()`, which is the actual mechanism
  that lets the folder survive an app restart. Generic file-picker plugins
  don't do this step, which is why a custom plugin was needed.
- `listFiles(uri)` — lists the folder's audio/video files by extension and
  returns name/uri/mimeType/size for each.

This file needs to be dropped into
`android/app/src/main/java/com/auralis/app/` in your generated Android
project and registered in `MainActivity.java` (one line, shown below).

## capacitor.config.ts — new

Basic config with the app ID/name and a `BackgroundMode` plugin block
(keeps a low-priority notification up while audio plays, which is what
stops Android from killing the app in the background).

---

## What you still need to do (can't be done from here — no network/build access)

1. `npm install @capacitor/core @capacitor/cli @capacitor/preferences @capacitor-community/background-mode`
2. `npx cap add android`
3. Copy `native/FolderAccessPlugin.kt` into
   `android/app/src/main/java/com/auralis/app/FolderAccessPlugin.kt`
4. In `MainActivity.java`, register it:
   ```java
   import com.auralis.app.FolderAccessPlugin;
   // inside onCreate, before super.onCreate() registerPlugin call chain:
   registerPlugin(FolderAccessPlugin.class);
   ```
5. In `android/app/src/main/AndroidManifest.xml`, add the audio foreground
   service permission for `@capacitor-community/background-mode`
   (their README has the exact block).
6. `npx cap sync android` then run from Android Studio.

## Open questions for you

- Do you want subfolders included when a folder is picked, or top-level
  files only? (`listFiles` in the plugin currently does top-level only —
  one-line change to recurse if you want it.)
- Favorites/Recently Played pages are still just empty-state placeholders —
  want those wired up next?
- `accountBtn` in the navbar still has no handler — what should it do, if
  anything, for an app with no accounts?

---

## Update — Favorites & Recently Played wired up

- **`#favoriteBtn`** (new heart icon under the track title on Home) toggles
  favoriting the currently loaded track.
- **Heart icon on every row** in the "Playing From" list (Home) and the
  Library list — favorite without needing to open the track first.
- **Recently Played** logs automatically every time a track actually
  starts playing (in `playMedia()`), most-recent-first, capped at 30
  entries, with a trash-can button to clear it.
- Both lists are persisted through `Store` (Preferences on device,
  `localStorage` in browser) under `auralis_favorites` / `auralis_recent`,
  and reload on app start.

**One real limitation, by design, not a bug:** favorites/recent entries
are keyed on the file's `uri` (stable for the native Android backend).
Tapping a favorite/recent entry only works if that file is inside the
*currently open* folder — Android's permission is per-folder, not global,
so a file from a different folder than the one you have open can't be
resolved yet. If you tap one that isn't reachable, you'll get a message
telling you to reopen that folder rather than a silent failure.

If you'd rather favorites work across folders without that limitation,
the fix is to remember *which* folder each favorite came from and prompt
to reopen it automatically — happy to build that next if it matters to
you.
