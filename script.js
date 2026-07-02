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

let currentSong = 0;
let isPlaying = false;

// Load Song
function loadSong(index) {
  title.textContent = songs[index].title;
  artist.textContent = songs[index].artist;
  cover.src = songs[index].cover;
  audio.src = songs[index].audio;
}

loadSong(currentSong);
function playSong() {
    audio.play();
    isPlaying = true;
    playBtn.textContent = "⏸";
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