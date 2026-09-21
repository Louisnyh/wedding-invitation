const targets = [...document.querySelectorAll('[data-reveal]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (targets.length && !reducedMotion.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('reveal-ready');

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.18 });

  for (const target of targets) observer.observe(target);
}
