// ================================
// AURALIS - Local Media Player
// Version 0.9.0
// Plays whatever the user picks from their own folder.
// Works audio + video, with background audio playback on device.
// ================================

// ---------- Folder Access Bridge ----------
// On a Capacitor build, window.Capacitor.Plugins.FolderAccess is a native
// plugin (see /native/FolderAccessPlugin.kt) that opens Android's folder
// picker and remembers permission to it across app restarts.
// In a plain browser (for testing without a build) we fall back to the
// File System Access API, and finally to a plain <input type="file"
// webkitdirectory> if neither is available. The fallback still works,
// it just can't remember the folder after the page reloads.

const FolderAccess = {

    isNative() {
        return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FolderAccess);
    },

    async pickFolder() {
        if (this.isNative()) {
            const result = await window.Capacitor.Plugins.FolderAccess.pickFolder();
            return { backend: "native", uri: result.uri };
        }
        if (window.showDirectoryPicker) {
            const handle = await window.showDirectoryPicker();
            return { backend: "fsapi", handle };
        }
        return { backend: "input" };
    },

    async listFiles(ref) {
        if (ref.backend === "native") {
            const result = await window.Capacitor.Plugins.FolderAccess.listFiles({ uri: ref.uri });
            return result.files; // [{ name, uri, mimeType, size }]
        }
        if (ref.backend === "fsapi") {
            const files = [];
            for await (const [name, entry] of ref.handle.entries()) {
                if (entry.kind === "file" && isMediaFile(name)) {
                    files.push({ name, handle: entry, mimeType: guessMime(name) });
                }
            }
            return files;
        }
        return [];
    }

};

function isMediaFile(name) {
    return /\.(mp3|wav|m4a|ogg|flac|aac|mp4|mov|webm|mkv|avi)$/i.test(name);
}

function guessMime(name) {
    const ext = name.split(".").pop().toLowerCase();
    const audioExt = ["mp3", "wav", "m4a", "ogg", "flac", "aac"];
    const videoExt = ["mp4", "mov", "webm", "mkv", "avi"];
    if (audioExt.includes(ext)) return "audio/" + ext;
    if (videoExt.includes(ext)) return "video/" + ext;
    return "";
}

function fileType(mimeType) {
    return (mimeType || "").startsWith("video") ? "video" : "audio";
}

// ---------- Storage Bridge ----------
// Uses Capacitor Preferences on device (survives app updates better than
// WebView localStorage), falls back to localStorage in a plain browser.

const Store = {
    async get(key) {
        if (window.Capacitor?.Plugins?.Preferences) {
            const { value } = await window.Capacitor.Plugins.Preferences.get({ key });
            return value;
        }
        return localStorage.getItem(key);
    },
    async set(key, value) {
        if (window.Capacitor?.Plugins?.Preferences) {
            await window.Capacitor.Plugins.Preferences.set({ key, value });
            return;
        }
        localStorage.setItem(key, value);
    }
};

const KEYS = {
    folderRef: "auralis_folder_ref",
    currentIndex: "auralis_current_index",
    volume: "auralis_volume",
    favorites: "auralis_favorites",
    recent: "auralis_recent"
};

// ---------- DOM Elements ----------
const media = document.getElementById("media");
const cover = document.getElementById("cover");
const title = document.getElementById("title");
const artist = document.getElementById("artist");

const playBtn = document.getElementById("play");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");
const shuffleBtn = document.getElementById("shuffle");
const repeatBtn = document.getElementById("repeat");

const progress = document.getElementById("progress");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");

const volume = document.getElementById("volume");
const playlist = document.getElementById("playlist");

const emptyLibrary = document.getElementById("emptyLibrary");
const nowPlaying = document.getElementById("nowPlaying");
const openFolderBtn = document.getElementById("openFolderBtn");
const openFolderBtnLibrary = document.getElementById("openFolderBtnLibrary");
const favoriteBtn = document.getElementById("favoriteBtn");
const clearRecentBtn = document.getElementById("clearRecentBtn");

// ---------- Player State ----------
let library = [];          // [{ name, uri|handle|blobUrl, mimeType, type }]
let currentIndex = 0;
let isPlaying = false;
let repeatMode = 0;
let folderRef = null;
let favorites = [];        // [{ key, name, type, uri }]
let recent = [];           // [{ key, name, type, uri, playedAt }]

// ---------- Open Folder ----------
async function openFolder() {

    let ref;
    try {
        ref = await FolderAccess.pickFolder();
    } catch (err) {
        console.error("Folder pick cancelled or failed", err);
        return;
    }

    if (ref.backend === "input") {
        pickFilesFallback();
        return;
    }

    folderRef = ref;
    const files = await FolderAccess.listFiles(ref);

    library = files.map((f) => ({
        ...f,
        type: fileType(f.mimeType || guessMime(f.name))
    }));

    if (ref.backend === "native") {
        await Store.set(KEYS.folderRef, JSON.stringify({ backend: "native", uri: ref.uri }));
    }

    await onLibraryLoaded();
}

// Last-resort fallback for plain browsers with no File System Access API.
// Works for one session; can't be restored after a reload.
function pickFilesFallback() {

    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = true;
    input.accept = "audio/*,video/*";

    input.addEventListener("change", async () => {

        library = Array.from(input.files)
            .filter((file) => isMediaFile(file.name))
            .map((file) => ({
                name: file.name,
                blobUrl: URL.createObjectURL(file),
                mimeType: file.type || guessMime(file.name),
                type: fileType(file.type || guessMime(file.name))
            }));

        await onLibraryLoaded();

    });

    input.click();

}

async function onLibraryLoaded() {

    if (!library.length) return;

    emptyLibrary.classList.add("hidden");
    nowPlaying.classList.remove("hidden");

    createPlaylist();
    await loadTrack(0);
    renderLibraryPage();

}

openFolderBtn.addEventListener("click", openFolder);
openFolderBtnLibrary.addEventListener("click", openFolder);

favoriteBtn.addEventListener("click", () => {
    const item = library[currentIndex];
    if (item) toggleFavorite(item);
});

clearRecentBtn.addEventListener("click", clearRecent);

// ---------- Resolve a Playable URL ----------
async function resolveSrc(item) {

    if (item.blobUrl) return item.blobUrl;

    if (item.handle) {
        const file = await item.handle.getFile();
        return URL.createObjectURL(file);
    }

    if (item.uri && window.Capacitor?.convertFileSrc) {
        return window.Capacitor.convertFileSrc(item.uri);
    }

    return item.uri || "";

}

// ---------- Load Track ----------
async function loadTrack(index) {

    if (!library.length) return;

    if (index < 0 || index >= library.length) {
        index = 0;
    }

    currentIndex = index;

    const item = library[index];
    const cleanName = item.name.replace(/\.[^/.]+$/, "");

    title.textContent = cleanName;
    artist.textContent = item.type === "video" ? "Video" : "Audio";

    media.src = await resolveSrc(item);

    if (item.type === "video") {
        media.classList.add("active");
    } else {
        media.classList.remove("active");
    }

    Store.set(KEYS.currentIndex, String(index));

    updatePlaylist();
    updateMediaSession(cleanName);
    updateFavoriteButton(item);

}

// ---------- Favorites & Recently Played ----------
// Both are keyed on item.uri (stable across sessions for the native
// backend) falling back to item.name (fsapi/input backends, where the
// uri isn't stable — favoriting still works for the current session,
// but won't reliably survive a reload with those backends).

function trackKey(item) {
    return item.uri || item.name;
}

function findInLibrary(key) {
    return library.findIndex((item) => trackKey(item) === key);
}

function isFavorite(item) {
    return favorites.some((f) => f.key === trackKey(item));
}

async function toggleFavorite(item) {

    const key = trackKey(item);
    const existingIndex = favorites.findIndex((f) => f.key === key);

    if (existingIndex >= 0) {
        favorites.splice(existingIndex, 1);
    } else {
        favorites.unshift({
            key,
            name: item.name,
            type: item.type,
            uri: item.uri || null
        });
    }

    await Store.set(KEYS.favorites, JSON.stringify(favorites));
    updateFavoriteButton(item);
    renderFavoritesPage();
    renderLibraryPage();

}

function updateFavoriteButton(item) {
    if (!item) return;
    favoriteBtn.classList.toggle("active", isFavorite(item));
}

async function addToRecent(item) {

    const key = trackKey(item);
    recent = recent.filter((r) => r.key !== key);

    recent.unshift({
        key,
        name: item.name,
        type: item.type,
        uri: item.uri || null,
        playedAt: Date.now()
    });

    recent = recent.slice(0, 30);

    await Store.set(KEYS.recent, JSON.stringify(recent));
    renderRecentPage();

}

async function clearRecent() {
    recent = [];
    await Store.set(KEYS.recent, JSON.stringify(recent));
    renderRecentPage();
}

// Plays a saved favorite/recent entry. If the file is in the currently
// loaded library, this is a normal track change. If the folder that file
// lives in isn't the one currently open, we can't play it — the user
// needs to open that folder first (uri permission from the last folder
// doesn't apply to files outside it).
async function playSavedEntry(entry) {

    const index = findInLibrary(entry.key);

    if (index >= 0) {
        await loadTrack(index);
        playMedia();
        goToPage("home");
        return;
    }

    alert(`"${entry.name}" isn't in the currently open folder. Open that folder again to play it.`);

}

// ---------- Play / Pause ----------
function playMedia() {

    media.play();
    isPlaying = true;
    playBtn.innerHTML = '<i data-lucide="pause"></i>';
    lucide.createIcons();
    enableBackgroundMode();

    if (library[currentIndex]) {
        addToRecent(library[currentIndex]);
    }

}

function pauseMedia() {

    media.pause();
    isPlaying = false;
    playBtn.innerHTML = '<i data-lucide="play"></i>';
    lucide.createIcons();

}

async function enableBackgroundMode() {
    if (window.Capacitor?.Plugins?.BackgroundMode) {
        await window.Capacitor.Plugins.BackgroundMode.enable();
    }
}

// ---------- Media Session (lock screen controls) ----------
function updateMediaSession(trackName) {

    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: trackName,
        artist: "Auralis"
    });

    navigator.mediaSession.setActionHandler("play", playMedia);
    navigator.mediaSession.setActionHandler("pause", pauseMedia);
    navigator.mediaSession.setActionHandler("previoustrack", () => skip(-1));
    navigator.mediaSession.setActionHandler("nexttrack", () => skip(1));

}

// ---------- Time Format ----------
function formatTime(seconds) {

    if (isNaN(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, "0")}`;

}

// ---------- Playlist (Home page "Playing From" list) ----------
function createPlaylist() {

    playlist.innerHTML = "";

    library.forEach((item, index) => {

        const li = document.createElement("li");

        li.innerHTML = `
        <div class="playlist-song">
            <span class="play-indicator">▶</span>
            <div class="playlist-info">
                <strong>${item.name.replace(/\.[^/.]+$/, "")}</strong>
                <small>${item.type === "video" ? "Video" : "Audio"}</small>
            </div>
            <button class="row-fav ${isFavorite(item) ? "active" : ""}" title="Favorite">
                <i data-lucide="heart"></i>
            </button>
        </div>
        `;

        li.querySelector(".playlist-info").addEventListener("click", async () => {
            await loadTrack(index);
            playMedia();
        });

        li.querySelector(".row-fav").addEventListener("click", async (e) => {
            e.stopPropagation();
            await toggleFavorite(item);
            e.currentTarget.classList.toggle("active", isFavorite(item));
        });

        playlist.appendChild(li);

    });

    lucide.createIcons();

}

function updatePlaylist() {

    const items = playlist.querySelectorAll("li");

    items.forEach((item, index) => {
        item.classList.toggle("active", index === currentIndex);
    });

}

// ---------- Progress Fill Color ----------
function updateProgressFill() {
    const percent = progress.value;
    progress.style.background = `linear-gradient(to right, var(--primary) ${percent}%, #4d4d4d ${percent}%)`;
}

// ---------- Skip ----------
async function skip(direction) {

    if (!library.length) return;

    let next = currentIndex + direction;

    if (next >= library.length) next = 0;
    if (next < 0) next = library.length - 1;

    await loadTrack(next);
    playMedia();

}

// ---------- Restore Last Session ----------
async function restoreSession() {

    const savedFavorites = await Store.get(KEYS.favorites);
    if (savedFavorites) {
        try { favorites = JSON.parse(savedFavorites); } catch { favorites = []; }
    }

    const savedRecent = await Store.get(KEYS.recent);
    if (savedRecent) {
        try { recent = JSON.parse(savedRecent); } catch { recent = []; }
    }

    renderFavoritesPage();
    renderRecentPage();

    const savedRefRaw = await Store.get(KEYS.folderRef);

    if (savedRefRaw) {
        try {
            const savedRef = JSON.parse(savedRefRaw);
            const files = await FolderAccess.listFiles(savedRef);

            if (files.length) {
                folderRef = savedRef;
                library = files.map((f) => ({
                    ...f,
                    type: fileType(f.mimeType || guessMime(f.name))
                }));

                emptyLibrary.classList.add("hidden");
                nowPlaying.classList.remove("hidden");
                createPlaylist();

                const savedIndex = Number(await Store.get(KEYS.currentIndex));
                await loadTrack(!isNaN(savedIndex) ? savedIndex : 0);
                renderLibraryPage();
            }
        } catch (err) {
            console.error("Could not restore saved folder", err);
        }
    }

    const savedVolume = await Store.get(KEYS.volume);
    if (savedVolume !== null && savedVolume !== undefined) {
        volume.value = savedVolume;
        media.volume = savedVolume / 100;
    }

}

// ---------- Initialize ----------
playBtn.innerHTML = '<i data-lucide="play"></i>';
repeatBtn.innerHTML = '<i data-lucide="repeat"></i>';
shuffleBtn.innerHTML = '<i data-lucide="shuffle"></i>';
prevBtn.innerHTML = '<i data-lucide="skip-back"></i>';
nextBtn.innerHTML = '<i data-lucide="skip-forward"></i>';
lucide.createIcons();

restoreSession();

// ---------- Play / Pause Button ----------
playBtn.addEventListener("click", () => {
    if (isPlaying) {
        pauseMedia();
    } else {
        playMedia();
    }
});

// ---------- Next / Previous ----------
nextBtn.addEventListener("click", () => skip(1));
prevBtn.addEventListener("click", () => skip(-1));

// ---------- Progress ----------
media.addEventListener("timeupdate", () => {

    progress.value = (media.currentTime / media.duration) * 100 || 0;
    currentTimeEl.textContent = formatTime(media.currentTime);
    durationEl.textContent = formatTime(media.duration);
    updateProgressFill();

});

// ---------- Seek ----------
progress.addEventListener("input", () => {

    const newTime = (progress.value / 100) * media.duration;
    media.currentTime = newTime;
    updateProgressFill();

});

// ---------- Auto Next ----------
media.addEventListener("ended", async () => {

    if (repeatMode === 2) {
        playMedia();
        return;
    }

    let next = currentIndex + 1;

    if (next >= library.length) {
        if (repeatMode === 1) {
            next = 0;
        } else {
            pauseMedia();
            return;
        }
    }

    await loadTrack(next);
    playMedia();

});

// ---------- Volume ----------
volume.addEventListener("input", () => {
    media.volume = volume.value / 100;
    Store.set(KEYS.volume, volume.value);
});

// ---------- Shuffle ----------
shuffleBtn.addEventListener("click", async () => {

    if (library.length < 2) return;

    let randomIndex = Math.floor(Math.random() * library.length);
    while (randomIndex === currentIndex) {
        randomIndex = Math.floor(Math.random() * library.length);
    }

    await loadTrack(randomIndex);
    playMedia();

});

// ---------- Repeat ----------
repeatBtn.addEventListener("click", () => {

    repeatMode = (repeatMode + 1) % 3;

    if (repeatMode === 2) {
        repeatBtn.innerHTML = '<i data-lucide="repeat-1"></i>';
    } else {
        repeatBtn.innerHTML = '<i data-lucide="repeat"></i>';
    }

    lucide.createIcons();

});

// ---------- Sidebar ----------
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

menuBtn.addEventListener("click", () => {
    sidebar.classList.add("active");
    overlay.classList.add("active");
});

overlay.addEventListener("click", () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
});

// ---------- Page Router ----------
const navLinks = document.querySelectorAll(".sidebar li[data-page]");
const pages = document.querySelectorAll(".page[data-page]");

function goToPage(pageName) {

    pages.forEach((page) => {
        page.classList.toggle("active", page.dataset.page === pageName);
    });

    navLinks.forEach((link) => {
        link.classList.toggle("active", link.dataset.page === pageName);
    });

    sidebar.classList.remove("active");
    overlay.classList.remove("active");

    if (pageName === "library") {
        renderLibraryPage();
    }

    if (pageName === "favorites") {
        renderFavoritesPage();
    }

    if (pageName === "recent") {
        renderRecentPage();
    }

}

navLinks.forEach((link) => {
    link.addEventListener("click", () => {
        goToPage(link.dataset.page);
    });
});

// ---------- Library Page ----------
function renderLibraryPage() {

    const libraryList = document.getElementById("library-list");
    const libraryEmpty = document.getElementById("library-empty");

    libraryList.innerHTML = "";

    if (!library.length) {
        libraryEmpty.classList.remove("hidden");
        return;
    }

    libraryEmpty.classList.add("hidden");

    library.forEach((item, index) => {

        const li = document.createElement("li");
        li.className = "playlist-song";
        li.innerHTML = `
            <div class="playlist-info">
                <strong>${item.name.replace(/\.[^/.]+$/, "")}</strong>
                <small>${item.type === "video" ? "Video" : "Audio"}</small>
            </div>
            <button class="row-fav ${isFavorite(item) ? "active" : ""}" title="Favorite">
                <i data-lucide="heart"></i>
            </button>
        `;

        li.querySelector(".playlist-info").addEventListener("click", async () => {
            await loadTrack(index);
            playMedia();
            goToPage("home");
        });

        li.querySelector(".row-fav").addEventListener("click", async (e) => {
            e.stopPropagation();
            await toggleFavorite(item);
            e.currentTarget.classList.toggle("active", isFavorite(item));
        });

        libraryList.appendChild(li);

    });

    lucide.createIcons();

}

// ---------- Favorites Page ----------
function renderFavoritesPage() {

    const favList = document.getElementById("favorites-list");
    const favEmpty = document.getElementById("favorites-empty");

    favList.innerHTML = "";

    if (!favorites.length) {
        favEmpty.classList.remove("hidden");
        return;
    }

    favEmpty.classList.add("hidden");

    favorites.forEach((entry) => {

        const li = document.createElement("li");
        li.className = "playlist-song";
        li.innerHTML = `
            <div class="playlist-info">
                <strong>${entry.name.replace(/\.[^/.]+$/, "")}</strong>
                <small>${entry.type === "video" ? "Video" : "Audio"}</small>
            </div>
            <button class="row-fav active" title="Remove from Favorites">
                <i data-lucide="heart"></i>
            </button>
        `;

        li.querySelector(".playlist-info").addEventListener("click", () => {
            playSavedEntry(entry);
        });

        li.querySelector(".row-fav").addEventListener("click", async (e) => {
            e.stopPropagation();
            await toggleFavorite(entry);
        });

        favList.appendChild(li);

    });

    lucide.createIcons();

}

// ---------- Recently Played Page ----------
function renderRecentPage() {

    const recentList = document.getElementById("recent-list");
    const recentEmpty = document.getElementById("recent-empty");

    recentList.innerHTML = "";

    if (!recent.length) {
        recentEmpty.classList.remove("hidden");
        return;
    }

    recentEmpty.classList.add("hidden");

    recent.forEach((entry) => {

        const li = document.createElement("li");
        li.className = "playlist-song";
        li.innerHTML = `
            <div class="playlist-info">
                <strong>${entry.name.replace(/\.[^/.]+$/, "")}</strong>
                <small>${entry.type === "video" ? "Video" : "Audio"}</small>
            </div>
        `;

        li.addEventListener("click", () => {
            playSavedEntry(entry);
        });

        recentList.appendChild(li);

    });

}
