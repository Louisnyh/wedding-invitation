import { validateResponse } from './schema.js';
export function createApi({ url, token, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  return async function request(action, data = {}) {
    if (!url) return { schemaVersion:2, state:'temporary_error' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({...data,action,...(token?{token}:{})}), signal:controller.signal,
        credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer'
      });
      if (!response.ok) throw new Error('Request unavailable');
      const result = validateResponse(await response.json());
      if (action === 'invitation' && result.state !== 'ready' && !['temporary_error','invalid_invitation'].includes(result.state)) throw new Error('Unexpected state');
      if (action === 'rsvp' && !['saved','validation_error','temporary_error','invalid_invitation'].includes(result.state)) throw new Error('Unexpected state');
      if (action === 'general_registration' && !['registered','validation_error','temporary_error'].includes(result.state)) throw new Error('Unexpected state');
      return result;
    } catch {
      // Deliberately no payload or error logging.
      return { schemaVersion:2, state:'temporary_error' };
    } finally { clearTimeout(timer); }
  };
}
