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
  }
];

// Elements
const audio = document.getElementById("audio");
const cover = document.getElementById("cover");
const title = document.getElementById("title");
const artist = document.getElementById("artist");

const playBtn = document.getElementById("play");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");
const progress = document.getElementById("progress");
const currentTime = document.getElementById("current-time");
const duration = document.getElementById("duration");

let currentSong = 0;
let isPlaying = false;

// Load Song
function loadSong(index) {
  title.textContent = songs[index].title;
  artist.textContent = songs[index].artist;
  cover.src = songs[index].cover;
  audio.src = songs[index].audio;
  localStorage.setItem("currentSong",index);
}
const savedSong = localStorage.getItem("currentSong");

if (savedSong !== null) {
    currentSong = Number(savedSong);
}

loadSong(currentSong);

function playSong() {
    audio.play();
    isPlaying = true;
    playBtn.textContent = "⏸";
}
function formatTime(seconds) {

    if (isNaN(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);

    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, "0")}`;

}
// Play / Pause
playBtn.addEventListener("click", () => {
  if (isPlaying) {
    audio.pause();
    playBtn.textContent = "▶";
    isPlaying = false;
  } else {
    audio.play();
    playBtn.textContent = "⏸";
    isPlaying = true;
  }
});
nextBtn.addEventListener("click", () => {
    currentSong++;

    if (currentSong >= songs.length) {
        currentSong = 0;
    }

    loadSong(currentSong);
    playSong();
});
prevBtn.addEventListener("click", () => {
    currentSong--;

    if (currentSong < 0) {
        currentSong = songs.length - 1;
    }

    loadSong(currentSong);
    playSong();
});
audio.addEventListener("timeupdate", () => {

    progress.value =
        (audio.currentTime / audio.duration) * 100;

    currentTime.textContent =
        formatTime(audio.currentTime);

    duration.textContent =
        formatTime(audio.duration);

});
progress.addEventListener("input", () => {

    const newTime =
        (progress.value / 100) * audio.duration;

    audio.currentTime = newTime;

});
audio.addEventListener("ended", () => {

    currentSong++;

    if (currentSong >= songs.length) {
        currentSong = 0;
    }

    loadSong(currentSong);

    playSong();

});
const volume = document.getElementById("volume");
volume.addEventListener("input", () => {

    audio.volume = volume.value / 100;
    localStorage.setItem("volume",volume.value);

});
loadSong(currentSong);

const savedVolume = localStorage.getItem("volume");

if (savedVolume !== null) {

    volume.value = savedVolume;

    audio.volume = savedVolume / 100;

}