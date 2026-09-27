export const WEDDING_MUSIC_VOLUME = 0.35;
export const WEDDING_MUSIC_SWIPE_THRESHOLD = 24;

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

  let touchStartY = null;
  let autoStartArmed = true;
  let explicitDecision = false;

  const syncState = () => {
    const playing = !audio.paused && !audio.ended;
    button.classList.toggle('is-playing',playing);
    button.setAttribute('aria-pressed',String(playing));
    button.setAttribute('aria-label',playing ? labels.playing : labels.paused);
  };

  const disarmAutoStart = () => {
    autoStartArmed = false;
    touchStartY = null;
    documentTarget?.removeEventListener('touchstart',handleTouchStart);
    documentTarget?.removeEventListener('touchend',handleTouchEnd);
    documentTarget?.removeEventListener('touchcancel',handleTouchCancel);
  };

  const attemptPlay = () => {
    let result;
    try {
      result = audio.play();
    } catch {
      syncState();
      return Promise.resolve(false);
    }

    return Promise.resolve(result).then(
      () => {
        syncState();
        return true;
      },
      () => {
        syncState();
        return false;
      }
    );
  };

  const togglePlayback = async () => {
    explicitDecision = true;
    disarmAutoStart();

    if (!audio.paused && !audio.ended) {
      audio.pause();
      syncState();
      return;
    }

    await attemptPlay();
  };

  function handleTouchStart(event) {
    if (!autoStartArmed || explicitDecision || event.touches?.length !== 1) {
      touchStartY = null;
      return;
    }
    touchStartY = event.touches[0].clientY;
  }

  function handleTouchEnd(event) {
    if (!autoStartArmed || explicitDecision || !Number.isFinite(touchStartY)) return;
    const endY = event.changedTouches?.[0]?.clientY;
    const upwardMovement = touchStartY - endY;
    touchStartY = null;
    if (!Number.isFinite(endY) || upwardMovement < WEDDING_MUSIC_SWIPE_THRESHOLD) return;

    disarmAutoStart();
    void attemptPlay();
  }

  function handleTouchCancel() {
    touchStartY = null;
  };

  audio.volume = WEDDING_MUSIC_VOLUME;
  button.addEventListener('click',togglePlayback);
  documentTarget?.addEventListener('touchstart',handleTouchStart,{passive:true});
  documentTarget?.addEventListener('touchend',handleTouchEnd,{passive:true});
  documentTarget?.addEventListener('touchcancel',handleTouchCancel,{passive:true});
  audio.addEventListener('play',syncState);
  audio.addEventListener('pause',syncState);
  audio.addEventListener('ended',syncState);
  audio.addEventListener('error',syncState);
  documentTarget?.addEventListener('visibilitychange',syncState);
  windowTarget?.addEventListener('pageshow',syncState);
  syncState();

  return {
    syncState,
    togglePlayback,
    getState: () => ({autoStartArmed,explicitDecision})
  };
}

if (typeof document !== 'undefined') {
  initWeddingMusic({
    audio: document.getElementById('wedding-music'),
    button: document.getElementById('music-control')
  });
}
