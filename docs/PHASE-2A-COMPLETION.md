# Phase 2A completion — 7 September 2026

## Recommendation

Ready to integrate into `wedding-v2-astra` as a development change, subject to resolving any conflicts against that branch. Not ready for production deployment. Only `main` and `origin/main` exist in this isolated clone, so compatibility with the target branch could not be checked. Nothing has been committed, merged, pushed or deployed.

The final verification found no application defect requiring a change. No application code, CSS, assets or build output was modified during this final pass. Only these completion/deployment documents were added. Phase 2B has not begun.

## A. Files changed across Phase 2A

Modified: `apps-script.gs`, `index.html`, `script.js`.

Added: `.gitignore`, `package.json`; `js/api.js`, `js/config.js`, `js/schema.js`, `js/rsvp-state.js`, `js/table-check.js`; `scripts/build.mjs`, `scripts/staging.mjs`; `tests/backend.test.mjs`, `tests/frontend.test.mjs`, `tests/build-staging.test.mjs`, `tests/fixtures.mjs`, `tests/harness.mjs`; this report and `docs/DEPLOYMENT.md`.

The existing CSS and displayed photo assets remain unchanged. Approved feature removals and the RSVP controls necessarily change content and interaction layout; this is not a claim of pixel-identical pages. No new visual direction, photo selection, monogram modification or section reorder was implemented.

## B. Privacy/security fixes

- Server constructs explicit response allowlists. No full guest rows, tokens, invite URLs, internal IDs, organizer metadata, personal invitation text, group records or public messages are returned.
- Only the authenticated invitation's own saved dietary requirements/private note are returned for editing. Nested records are also schema-checked.
- Closed Table Check responses contain no assignment; the server does not read Tables before release. Browser date authority was removed.
- Every write resolves authorization inside the server lock; revoked, expired and ambiguous identities fail closed. Client-supplied guest IDs cannot authorize writes.
- Strict integers, bounded text, literal spreadsheet writes, idempotent retries and per-guest revisions protect response handling.
- Production sample data, legacy API endpoint, payload logging and old memory/group paths were removed from shipped frontend code. Sheet text renders as text and map URLs are host/protocol validated.
- Source API configuration is disconnected. Public builds use an explicit file allowlist. Synthetic staging has no Google connection and limits browser API connections to itself.

## C. Final API schema

POST JSON content using `text/plain;charset=UTF-8`; the token travels in the body. GET is not a guest-data endpoint.

Requests:

```js
{ action: 'invitation', token }
{ action: 'rsvp', token, requestId, status, partySize, dietaryRequirements, privateNote }
```

`status`: `attending | unsure | unable`; `requestId`: 32 hexadecimal characters. Non-attending writes use `partySize: null` and empty dietary requirements.

Response variants, with exact allowed keys:

```js
{ schemaVersion: 2, state: 'ready',
  guest: { displayName },
  event: { dateLabel, timeLabel, venueName, venueAddress, dressCode, googleMapsUrl, wazeUrl },
  rsvp: { status, partySize, partyLimit, dietaryRequirements, privateNote },
  tableCheck }
{ schemaVersion: 2, state: 'saved', rsvp }
{ schemaVersion: 2, state: 'validation_error', errors }
{ schemaVersion: 2, state: 'temporary_error' }
{ schemaVersion: 2, state: 'invalid_invitation' }
```

Unanswered RSVP status is null. `errors` allows only form/status/partySize/dietaryRequirements/privateNote keys with bounded text messages.

Table variants:

```js
{ state: 'locked', reason: 'scheduled', releaseDate: 'YYYY-MM-DD' }
{ state: 'locked', reason: 'force_closed', releaseDate: null }
{ state: 'available', assignment: { name } }
{ state: 'assignment_pending' }
{ state: 'temporary_error' }
```

## D. Table Check state model

Browser transport begins at `loading`, with refresh disabled. The server determines scheduled lock, administrator force-closed, assigned, pending, temporary error or invalid invitation. Release uses Asia/Kuala_Lumpur and a normalized date. No browser clock decides release. Invalid invitation is a top-level API state that clears guest UI and disables actions. Other states allow retry/refresh. Refresh never replaces an active RSVP draft; error refresh removes the old displayed assignment.

## E. RSVP state model

`selected → editing → saving → saved`, or `saving → recoverable_error → saving`.

Selecting does not submit. Attending reveals party size/dietary/private note; other options permit the optional private note. One explicit save action handles all options. Errors preserve form values; unchanged retries reuse the request ID. Editing prefills saved values. Duplicate submission is disabled during saving. Revocation clears the fields and stale in-flight save acknowledgements cannot restore revoked state.

Storage A is intentional in this implementation: an append-only RSVP log is the single authority, avoiding partial updates across two Sheets. Idempotency handles lost acknowledgements; per-guest revisions keep the current response stable when rows are sorted. Guests is not updated by saves.

Operational recommendation: **B — one current-response row per invitation, with separate history** is easier for catering counts and organizer review. With Sheets, preferably derive a read-only current-response view from the authoritative log, selecting the highest revision for each guest. This provides B's operational view without two competing writable authorities. That view has not been implemented. Existing Guests-based RSVP reports will become stale and must not be used after rollout. Do not silently switch to dual writes.

## F. Verification and results

Previously completed automated result: **84 passed, 0 failed** across backend, frontend state/schema/transport, and build/staging checks. The full suite was not rerun in this final pass, as requested.

Final browser verification used the existing dist build, served locally with the synthetic Sheet harness. The server was restarted with its build call bypassed in memory; no source or dist file was changed. All relevant staged HTML/CSS/JS files were confirmed equal to their source counterparts (config intentionally differs to point to local staging).

Observed in this pass:

- Failed attending save retained party size 2, synthetic dietary text and private note; zero successful writes.
- Table refresh changed locked to assigned while RSVP stayed in recoverable_error with all draft values unchanged.
- Explicit RSVP retry reached saved; exactly one synthetic log write resulted.
- Refresh from assigned to temporary error removed the displayed assignment; retry showed loading with a disabled button, then assignment pending.
- Administrator force-closed refresh showed locked with no table name.
- Revocation refresh showed invalid invitation, disabled Table Check, removed guest greeting and cleared all RSVP field values.
- Browser warnings/errors: none recorded.

Prior browser checks also covered saved-response editing/prefill and reload persistence. No production guest records were accessed or modified.

Final git review: whitespace check clean, three tracked modified files plus the listed new files; no generated dist files staged/tracked. CSS remains byte-identical to HEAD. Application diff totals before documents: 434 insertions, 2,523 deletions across the three tracked files. New files are additional and must be included when committing.

## G. Staging/deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). Local synthetic verification is complete. Separate real Google Apps Script staging verification is still required before production rollout.

## H. Remaining risks and decisions

1. Confirm RSVP reporting strategy above; organizer current-response view is not implemented.
2. Validate real Sheets literal-text round trips, web-app permissions and browser cross-origin POST behavior in a separate synthetic Google staging spreadsheet. Emulated tests do not prove these platform details.
3. Confirm production release date/mode and party-size policy (blank limit defaults to 1; maximum 20). Populate required headers and validate migration in staging.
4. Retire the old production API when rolling out: the isolated implementation cannot revoke an already deployed legacy endpoint. Publishing frontend changes alone is insufficient.
5. Invitation links remain bearer credentials. Rate limiting is not implemented, concurrent different-device saves are last-write-wins, and production Apps Script quota/latency have not been measured.
6. Root README is legacy documentation. Use DEPLOYMENT.md for Phase 2A; do not use the old sample-data/deployment workflow.
7. Target-branch conflict review remains necessary because `wedding-v2-astra` is absent here. Keep this change separate from any production auto-deploy branch until staging gates pass.
