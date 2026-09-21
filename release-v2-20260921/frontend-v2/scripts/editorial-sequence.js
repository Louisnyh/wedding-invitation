const sequence = document.querySelector('.editorial-sequence');
const track = sequence?.querySelector('.editorial-sequence__track');

if (sequence && track) {
  const mobileMotion = window.matchMedia('(max-width: 767px) and (prefers-reduced-motion: no-preference)');
  let frame = 0;
  let viewportWidth = window.innerWidth;
  let travel = 1;

  const render = () => {
    frame = 0;
    if (!mobileMotion.matches) return;

    const progress = Math.min(1, Math.max(0, -sequence.getBoundingClientRect().top / travel));
    track.style.setProperty('--sequence-x', `${(-progress * viewportWidth).toFixed(2)}px`);
  };

  const scheduleRender = () => {
    if (!frame) frame = window.requestAnimationFrame(render);
  };

  const refresh = () => {
    const active = mobileMotion.matches;
    sequence.classList.toggle('editorial-sequence--active', active);
    track.style.removeProperty('--sequence-x');
    viewportWidth = window.innerWidth;
    travel = active ? Math.max(window.innerHeight, 1) : 1;
    scheduleRender();
  };

  window.addEventListener('scroll', scheduleRender, { passive: true });
  window.addEventListener('resize', refresh, { passive: true });
  mobileMotion.addEventListener('change', refresh);
  refresh();
}
