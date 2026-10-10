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
  let touchIdentifier = null;
  let autoStartArmed = true;
  let explicitDecision = false;
  const touchListenerOptions = {passive:true,capture:true};

  const clearTouch = () => {
    touchStartY = null;
    touchIdentifier = null;
  };

  const syncState = () => {
    const playing = !audio.paused && !audio.ended;
    button.classList.toggle('is-playing',playing);
    button.setAttribute('aria-pressed',String(playing));
    button.setAttribute('aria-label',playing ? labels.playing : labels.paused);
  };

  const disarmAutoStart = () => {
    autoStartArmed = false;
    clearTouch();
    documentTarget?.removeEventListener('touchstart',handleTouchStart,touchListenerOptions);
    documentTarget?.removeEventListener('touchend',handleTouchEnd,touchListenerOptions);
    documentTarget?.removeEventListener('touchcancel',handleTouchCancel,touchListenerOptions);
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
      clearTouch();
      return;
    }
    const touch = event.touches[0];
    touchStartY = touch.clientY;
    touchIdentifier = Number.isFinite(touch.identifier) ? touch.identifier : null;
  }

  function handleTouchEnd(event) {
    if (!autoStartArmed || explicitDecision || !Number.isFinite(touchStartY)) return;
    const changedTouches = Array.from(event.changedTouches || []);
    const touch = touchIdentifier === null
      ? changedTouches[0]
      : changedTouches.find(candidate => candidate.identifier === touchIdentifier);
    const endY = touch?.clientY;
    const upwardMovement = touchStartY - endY;
    clearTouch();
    if (!Number.isFinite(endY) || upwardMovement < WEDDING_MUSIC_SWIPE_THRESHOLD) return;

    disarmAutoStart();
    void attemptPlay();
  }

  function handleTouchCancel() {
    clearTouch();
  };

  audio.volume = WEDDING_MUSIC_VOLUME;
  button.addEventListener('click',togglePlayback);
  documentTarget?.addEventListener('touchstart',handleTouchStart,touchListenerOptions);
  documentTarget?.addEventListener('touchend',handleTouchEnd,touchListenerOptions);
  documentTarget?.addEventListener('touchcancel',handleTouchCancel,touchListenerOptions);
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
