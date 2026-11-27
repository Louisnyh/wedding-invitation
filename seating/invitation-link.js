/* Capture only this visitor's invitation before the existing RSVP module
   removes the credential from the address bar. No storage or network call. */
(() => {
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get('token') || '';
  const token = /^[a-f0-9]{16,128}$/i.test(candidate) ? candidate : '';
  const root = document.currentScript && document.currentScript.src;
  if (!root) return;
  const target = new URL('./', root);
  document.addEventListener('DOMContentLoaded', () => {
    const link = document.getElementById('seat-entry-link');
    if (!link) return;
    link.href = target.href;
    link.addEventListener('click', () => {
      const destination = new URL(target.href);
      if (token) destination.searchParams.set('token', token);
      link.href = destination.href;
    });
  }, {once:true});
})();
