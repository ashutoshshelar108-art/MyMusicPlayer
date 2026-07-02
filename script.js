const songs = [
  {
    title: "Song One",
    artist: "Artist One",
    audio: "assets/songs/song1.mp3",
    cover: "assets/image/cover1.jpg"
  }
];

// Elements
const audio = document.getElementById("audio");
const cover = document.getElementById("cover");
const title = document.getElementById("title");
const artist = document.getElementById("artist");

const playBtn = document.getElementById("play");

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