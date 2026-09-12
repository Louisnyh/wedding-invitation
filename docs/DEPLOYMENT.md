# Phase 2A staging and deployment

This supersedes the legacy root README for Phase 2A. No production deployment or guest-data migration has been performed.

## Local synthetic staging

Use a current Node runtime. No npm dependencies are required.

```sh
npm run staging
```

This normally generates dist and serves http://127.0.0.1:4173. Open `/_staging` for synthetic scenarios and its synthetic invitation link. All writes exist only in process memory. No Google Sheets connection exists. Tests live outside the public build. `npm test` runs the synthetic automated suite; the recorded result is 84 passing checks.

## Separate Google staging gate

1. Create a separate Apps Script project and spreadsheet containing synthetic data only. Do not bind it to the real guest spreadsheet.
2. Use `apps-script.gs`. Set Script Properties `ENVIRONMENT=staging` and `SPREADSHEET_ID` to that synthetic spreadsheet. Set project/spreadsheet timezone to Asia/Kuala_Lumpur for consistent administration; release logic already uses this zone explicitly.
3. Required sheet headers:
   - Guests: guest_id, token, guest_name, invitation_status, pax_limit. Optional fields used include revoked, expires_at, table_id and legacy RSVP fallback fields.
   - Settings: key, value.
   - Tables: table_id, table_name.
   - RSVP: response_id, request_id, revision, timestamp, guest_id, rsvp_status, pax_count, under_5_child_count, dietary_notes, private_note. Add `under_5_child_count` immediately after `pax_count`; leave historical cells blank so they remain unknown (`null`), rather than converting them to zero.
4. Settings keys for public details: wedding_date_display, wedding_start_time, venue_name, venue_address, dress_code, google_maps_url, waze_url. Table keys: table_check_mode and table_release_date. Use scheduled plus YYYY-MM-DD, or force_closed. force_open is an explicit administrator override. Legacy table_check_enabled is ignored.
5. Deploy the synthetic web app with execution/access settings permitting invited browsers to POST while keeping the spreadsheet private. Verify those permissions with synthetic data before production. Build a staging frontend with `node scripts/build.mjs --api-url https://script.google.com/macros/s/DEPLOYMENT_ID/exec` using the real staging deployment ID; serve only dist.
6. Verify lock/release at Malaysia midnight, force-closed, pending, invalid/revoked, all RSVP choices, failed/lost-response retry, and literal strings beginning with =, +, -, @ plus whitespace/newlines. Confirm no spreadsheet formulas are created and saved text round-trips exactly. Inspect responses for forbidden fields and no closed table assignment.

## Production gate — not authorized/performed in this task

Resolve organizer reporting first: saves append RSVP history and do not update Guests. Prefer a derived current-response view using per-guest highest revision. Back up and validate required-column migration and existing invitation-token compatibility before any rollout; do not copy staging fixtures to production.

Only after staging approval, configure a separate production project with ENVIRONMENT=production, its intended SPREADSHEET_ID, and PRODUCTION_ENABLED=yes. Confirm release controls and party limits. Coordinate backend/frontend rollout and retirement of the old data-exposing deployment; do not leave the legacy API accessible as a fallback.

Build with the approved production v2 deployment URL and publish **only dist**, never the repository root. A default build has an empty API URL and is deliberately disconnected. The public build excludes backend, tests, synthetic fixtures, original JPEGs and git history.

Do not roll back to the legacy privacy boundary. If rollout fails, disable writes/access while investigating and preserve the RSVP log. A backend outage must not cause the frontend to load sample guest records.
