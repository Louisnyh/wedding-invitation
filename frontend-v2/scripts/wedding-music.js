export const WEDDING_MUSIC_VOLUME = 0.35;

const labels = {
  paused: 'Play background music',
  playing: 'Pause background music'
};

export function initWeddingMusic({
  audio,
  button,
  documentTarget = globalThis.document,
  windowTarget = globalThis.window
} = {}) {
  if (!audio || !button) return null;

  const syncState = () => {
    const playing = !audio.paused && !audio.ended;
    button.classList.toggle('is-playing',playing);
    button.setAttribute('aria-pressed',String(playing));
    button.setAttribute('aria-label',playing ? labels.playing : labels.paused);
  };

  const togglePlayback = async () => {
    if (!audio.paused && !audio.ended) {
      audio.pause();
      syncState();
      return;
    }

    try {
      await audio.play();
    } catch {
      // Browser policy or loading errors leave the invitation usable and silent.
    }
    syncState();
  };

  audio.volume = WEDDING_MUSIC_VOLUME;
  button.addEventListener('click',togglePlayback);
  audio.addEventListener('play',syncState);
  audio.addEventListener('pause',syncState);
  audio.addEventListener('ended',syncState);
  audio.addEventListener('error',syncState);
  documentTarget?.addEventListener('visibilitychange',syncState);
  windowTarget?.addEventListener('pageshow',syncState);
  syncState();

  return { syncState, togglePlayback };
}

if (typeof document !== 'undefined') {
  initWeddingMusic({
    audio: document.getElementById('wedding-music'),
    button: document.getElementById('music-control')
  });
}
