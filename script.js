// ================================
// AURALIS - Offline Music Player
// Version 0.8.0
// ================================

// ---------- Songs ----------
const songs = [
    {
        title: "Song One",
        artist: "Artist One",
        audio: "assets/songs/song1.mp3",
        cover: "assets/image/cover1.jpg"
    },
    {
        title: "Song Two",
        artist: "Artist Two",
        audio: "assets/songs/song2.mp3",
        cover: "assets/image/cover2.jpg"
    },
    {
       title: "Song Three",
       artist: "Artist Three",
       audio: "assets/songs/song3.mp3",
       cover: "assets/image/cover3.jpg"
      },
      {
       title: "Song Four",
       artist: "Artist Four",
       audio: "assets/songs/song4.mp3",
       cover: "assets/image/cover4.jpg"
       }, 
      {
       title: "Song Five",
       artist: "Artist Five",
       audio: "assets/songs/song5.mp3",
       cover: "assets/image/cover5.jpg"
      }, 
       {
       title: "Song six",
        artist: "Artist Six",
       audio: "assets/songs/song6.mp3",
       cover: "assets/image/cover6.jpg"
       },
];

// ---------- DOM Elements ----------
const audio = document.getElementById("audio");
const cover = document.getElementById("cover");
const title = document.getElementById("title");
const artist = document.getElementById("artist");

const playBtn = document.getElementById("play");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");
const shuffleBtn = document.getElementById("shuffle");
const repeatBtn = document.getElementById("repeat");

const progress = document.getElementById("progress");
const currentTime = document.getElementById("current-time");
const duration = document.getElementById("duration");

const volume = document.getElementById("volume");
const playlist = document.getElementById("playlist");

// ---------- Player State ----------
let currentSong = 0;
let isPlaying = false;
let repeatMode = 0;

// Restore last song
const savedSong = Number(localStorage.getItem("currentSong"));

if (!isNaN(savedSong) && savedSong >= 0 && savedSong < songs.length) {
    currentSong = savedSong;
} else {
    currentSong = 0;
}

// ---------- Load Song ----------
function loadSong(index) {

    if (index < 0 || index >= songs.length) {
        index = 0;
    }

    currentSong = index;

    title.textContent = songs[index].title;
    artist.textContent = songs[index].artist;
    cover.src = songs[index].cover;
    audio.src = songs[index].audio;

    localStorage.setItem("currentSong", index);

    updatePlaylist();
}

// ---------- Play ----------
function playSong() {

    audio.play();
    isPlaying = true;
    playBtn.textContent = "⏸";

}

// ---------- Pause ----------
function pauseSong() {

    audio.pause();
    isPlaying = false;
    playBtn.textContent = "▶";

}

// ---------- Time Format ----------
function formatTime(seconds) {

    if (isNaN(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, "0")}`;

}

// ---------- Playlist ----------
function createPlaylist() {

    playlist.innerHTML = "";

    songs.forEach((song, index) => {

        const li = document.createElement("li");

        li.innerHTML = `
        <div class="playlist-song">
            <span class="play-indicator">▶</span>

            <div class="playlist-info">
                <strong>${song.title}</strong>
                <small>${song.artist}</small>
            </div>
        </div>
        `;

        li.addEventListener("click", () => {

            currentSong = index;

            loadSong(currentSong);

            updatePlaylist();

            playSong();

        });

        playlist.appendChild(li);

    });

}

// ---------- Highlight Current Song ----------
function updatePlaylist() {

    const items = playlist.querySelectorAll("li");

    items.forEach((item, index) => {

        if (index === currentSong) {

            item.classList.add("active");

        } else {

            item.classList.remove("active");

        }

    });

}
// ---------- Progress Fill Color ----------
function updateProgressFill() {
    const percent = progress.value;
    progress.style.background = `linear-gradient(to right, var(--primary) ${percent}%, #4d4d4d ${percent}%)`;
}

// ---------- Initialize ----------
loadSong(currentSong);
createPlaylist();
updatePlaylist();

// Restore volume
const savedVolume = localStorage.getItem("volume");

if (savedVolume !== null) {

    volume.value = savedVolume;
    audio.volume = savedVolume / 100;

}

// ---------- Play / Pause Button ----------
playBtn.addEventListener("click", () => {

    if (isPlaying) {

        pauseSong();

    } else {

        playSong();

    }

});

// ---------- Next ----------
nextBtn.addEventListener("click", () => {

    currentSong++;

    if (currentSong >= songs.length) {

        currentSong = 0;

    }

    loadSong(currentSong);
    updatePlaylist();
    playSong();

});

// ---------- Previous ----------
prevBtn.addEventListener("click", () => {

    currentSong--;

    if (currentSong < 0) {

        currentSong = songs.length - 1;

    }

    loadSong(currentSong);
    updatePlaylist();
    playSong();

});

// ---------- Progress ----------
audio.addEventListener("timeupdate", () => {

    progress.value =
        (audio.currentTime / audio.duration) * 100;

    currentTime.textContent =
        formatTime(audio.currentTime);

    duration.textContent =
        formatTime(audio.duration);
        updateProgressFill();

});

// ---------- Seek ----------
progress.addEventListener("input", () => {

    const newTime =
        (progress.value / 100) * audio.duration;

    audio.currentTime = newTime;
    updateProgressFill();

});

// ---------- Auto Next ----------
audio.addEventListener("ended", () => {

    // Repeat One
    if (repeatMode === 2) {

        playSong();
        return;

    }

    // Go to next song
    currentSong++;

    // Last song reached
    if (currentSong >= songs.length) {

        // Repeat All
        if (repeatMode === 1) {

            currentSong = 0;

        } else {

            // Repeat Off
            currentSong = songs.length - 1;
            pauseSong();
            return;

        }

    }

    loadSong(currentSong);
    updatePlaylist();
    playSong();

});

// ---------- Volume ----------
volume.addEventListener("input", () => {

    audio.volume = volume.value / 100;

    localStorage.setItem("volume", volume.value);

});
//---------shuffle--------
shuffleBtn.addEventListener("click", () => {

    console.log("Shuffle button clicked");

    let randomSong = Math.floor(Math.random() * songs.length);

    while (randomSong === currentSong) {
        randomSong = Math.floor(Math.random() * songs.length);
    }

    currentSong = randomSong;

    console.log("Playing:", currentSong);

    loadSong(currentSong);
    playSong();

});
//---------repeat--------
repeatBtn.addEventListener("click", () => {
    repeatMode++;
    if (repeatMode > 2) {
        repeatMode = 0;
    }
    if (repeatMode === 0) {
        repeatBtn.textContent = "⏹";
    } else if (repeatMode === 1) {
        repeatBtn.textContent = "🔁";
    } else {
        repeatBtn.textContent = "🔂";
    }
});