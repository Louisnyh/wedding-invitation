import { WEDDING_CONTENT } from './wedding-content.js';

const countdown = document.querySelector('[data-countdown]');

if (countdown) {
  const target = Date.parse(WEDDING_CONTENT.event.countdownTarget);
  let timer;
  const update = () => {
    if (!Number.isFinite(target)) return;
    const remaining = Math.max(0, target - Date.now());
    if (remaining === 0) {
      countdown.textContent = 'Today Is The Day.';
      clearTimeout(timer);
      return;
    }
    const minutes = Math.floor(remaining / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = String(Math.floor(minutes % 1440 / 60)).padStart(2, '0');
    const mins = String(minutes % 60).padStart(2, '0');
    countdown.textContent = `${days} DAYS · ${hours} HRS · ${mins} MIN`;
    // Only minutes are displayed. Recheck at the next minute or the target.
    timer = setTimeout(update, Math.min(remaining, remaining % 60000 + 1));
  };
  const refresh = () => {
    clearTimeout(timer);
    if (!document.hidden) update();
  };
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', refresh);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  update();
}
