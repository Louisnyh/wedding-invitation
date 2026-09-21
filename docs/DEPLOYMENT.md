# Frontend v2 staging, production, and rollback

This runbook records the workflow verified through the Production v2 remote-browser E2E. The legacy frontend and legacy Apps Script remain separate rollback assets.

## Safety rules

- Never commit guest tokens, token-bearing invitation URLs, spreadsheet identifiers, deployment identifiers, `.env` files, or exported guest data.
- Keep `PREVIEW_TOKEN` empty in every remote or production build. It is only populated by the in-memory local synthetic preview.
- Send invitation credentials only through the supported `?token=` entry point. The frontend captures a valid token into the current page session and immediately removes the parameter with `history.replaceState()`; it does not use local storage or reload the page.
- The API accepts credentials only in POST bodies and uses `credentials: omit`, `cache: no-store`, and `referrerPolicy: no-referrer`.
- Keep `PRODUCTION_ENABLED=no` during builds, deployments, and public smoke tests. Open it only for an explicitly approved live API operation.
- If an RSVP write times out, loses acknowledgement, or otherwise becomes ambiguous, do not retry. Close the production gate and inspect the append-only RSVP sheet for the request identity first.
- RSVP rows are audit evidence. Revoke QA guests instead of deleting QA guests or their RSVP revisions.

## Automated verification

Use a current Node runtime. No npm dependencies are required.

```sh
npm test
npm run build:v2
git diff --check
```

The test count changes as coverage grows, so this runbook does not hard-code it. A successful `npm test` result is authoritative.

Every frontend-v2 build must pass `--v2`, either through `npm run build:v2` or directly to `scripts/build.mjs`. The output is `dist-v2`; `dist` is the legacy build and must not be published for a v2 release.

## Local synthetic preview

```sh
npm run preview:v2
```

The preview builds `dist-v2` and serves the frontend at `http://127.0.0.1:4173/frontend-v2/`. Its `/api` endpoint is an in-memory synthetic backend. Open `/_staging` to select scenarios. No Google Sheet is contacted, and preview writes disappear when the process stops.

## Separate Google staging

1. Use a staging-only Apps Script project and a staging-only spreadsheet.
2. Deploy the repository `apps-script.gs` with Script Properties `ENVIRONMENT=staging` and the staging spreadsheet binding.
3. Use these required headers:
   - Guests: `guest_id`, `token`, `guest_name`, `invitation_status`, `pax_limit`; optional supported fields include `revoked`, `expires_at`, and `table_id`.
   - Settings: `key`, `value`.
   - Tables: `table_id`, `table_name`.
   - RSVP: `response_id`, `request_id`, `revision`, `timestamp`, `guest_id`, `rsvp_status`, `pax_count`, `under_5_child_count`, `dietary_notes`, `private_note`.
4. Keep historical `under_5_child_count` cells blank so they deserialize as unknown (`null`), rather than explicit zero.
5. Build against the staging deployment:

   ```sh
   node scripts/build.mjs --v2 --api-url "$STAGING_API_URL"
   ```

6. Verify authorization, revoked and expired invitations, party limits, all RSVP choices, editing, unchanged retry identity, lost acknowledgement handling, Table Check states, and formula-like text round trips.

## Production v2 candidate workflow

The verified candidate workflow is side-by-side and does not replace the public root:

1. Confirm `PRODUCTION_ENABLED=no`, all QA guests are revoked, and the production workbook contains no real guests.
2. Build `dist-v2` with the Production v2 Apps Script `/exec` endpoint and an empty `PREVIEW_TOKEN`.
3. Verify the explicit build allowlist contains frontend assets and generated browser configuration only. It must exclude backend source, tests, fixtures, `.env` files, original photos, and Git metadata.
4. Publish the build below an isolated candidate path such as `candidate-v2/`.
5. Compare the remote candidate files byte-for-byte with the local artifact and confirm the public legacy root is unchanged.
6. Run responsive and asset QA against the remote candidate before any live credential is created.
7. For an explicitly approved E2E, create a dedicated QA guest, temporarily set `PRODUCTION_ENABLED=yes`, submit exactly one browser RSVP, verify its physical revision and a fresh restore, revoke the QA guest, verify the invitation is rejected, and restore `PRODUCTION_ENABLED=no`.

The production gate is a server-side requirement. A public frontend deployment does not authorize writes while the gate is closed.

## Final public-root artifact

Use an immutable release namespace so new HTML never depends on cached legacy CSS or JavaScript. For the prepared C2G artifact:

```sh
node scripts/build.mjs --v2 \
  --api-url "$PRODUCTION_V2_API_URL" \
  --public-root release-v2-20260921
```

This creates the cutover-ready `dist-v2` layout:

```text
dist-v2/
├── index.html
└── release-v2-20260921/
    ├── frontend-v2/
    │   ├── index.html
    │   ├── scripts/
    │   └── styles/
    ├── assets/photos/
    └── js/
        ├── api.js
        ├── config.js
        ├── rsvp-state.js
        └── schema.js
```

The root `index.html` contains a `<base>` pointing at the versioned `frontend-v2/` directory. Module-relative imports and photo paths retain their tested structure. The namespace must be treated as immutable after publication. A later asset change requires a new namespace.

Before publishing, verify:

- `dist-v2/index.html` opens Pages 01–08.
- Every root HTML asset resolves inside the versioned namespace.
- The generated `js/config.js` contains the approved Production v2 endpoint and `PREVIEW_TOKEN = ""`.
- No token, staging endpoint, legacy endpoint, `.env`, backend source, test, or fixture exists in `dist-v2`.
- The artifact fingerprint is recorded in the release report.

Publish `dist-v2`, never the repository root and never `dist`.

## Production Settings

Production v2 uses `wedding_date_display`, `wedding_start_time`, `venue_name`, `venue_address`, `dress_code`, `google_maps_url`, `waze_url`, `table_check_mode`, and `table_release_date`.

The approved frontend-v2 currently renders the ceremony content and Google Maps link from its reviewed static Page 05 markup. It does not render `venue_address` or `waze_url`, so those settings may remain blank. Keep `table_check_mode=force_closed` and `table_release_date` blank until a separate Table Check release is approved.

## Public cutover

Use a cutover branch created from the current deployed `origin/main`. Reconcile the development branch with the candidate deployment commit using a normal merge so both histories and the legacy baseline remain reachable. Resolve the final tree around the reviewed `dist-v2` artifact; do not manually reconstruct source changes or squash away the candidate deployment.

For the public Pages commit:

1. Preserve a tag or immutable commit reference to the legacy frontend baseline.
2. Add the versioned release directory without overwriting legacy asset paths.
3. Replace only the public root `index.html` entry point with the prepared root HTML.
4. Keep the candidate path during the initial cutover and remove it only in a later approved cleanup.
5. Keep `PRODUCTION_ENABLED=no`, make no Sheet mutations, and verify root HTTP status, all versioned assets, Pages 01–08, mobile and desktop layouts, generated config, and the absence of secrets.

GitHub Pages may cache static resources for about ten minutes. The versioned namespace prevents mixed legacy HTML/CSS/JS. The root HTML is the only same-path cutover resource; a cached root continues to reference the intact legacy assets until it expires, while new root HTML references only the new namespace.

## Rollback

Known legacy references:

- Frontend baseline: `9136be96b67d`
- Legacy Apps Script: Version 8
- Legacy endpoint and workbook: unchanged; workbook backup retained

Rollback triggers include an unavailable public page, missing assets, inability to authorize a valid controlled invitation, a Production API schema mismatch, unexpected RSVP duplication, or a severe responsive regression.

Rollback procedure:

1. Set `PRODUCTION_ENABLED=no`.
2. Restore the public root entry point and legacy asset tree from the known legacy artifact or cutover parent commit.
3. Do not overwrite, truncate, or restore the Production v2 workbook.
4. Preserve any legitimate Production v2 RSVP evidence and revoke affected test credentials.
5. Leave the Production v2 Apps Script deployment intact but gated off.
6. Verify the restored legacy root and investigate the v2 failure offline.

## Real guest onboarding after cutover approval

Prepare an organizer-owned input file with:

```text
guest_name
pax_limit
guest_type
group_name
personal_message
```

Table assignment may be supplied later. The import process generates `guest_id`, a fresh unique hexadecimal `token`, `invitation_status`, and `invite_url`. Generated tokens and invitation URLs must remain outside Git and public build artifacts. Import real guests only after the public cutover passes, the production gate state is reviewed, and Louis explicitly approves the import.
