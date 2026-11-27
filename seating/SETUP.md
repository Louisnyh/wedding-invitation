# Seating lookup

Guest page: `/seating/`. Visual trial: `/seating/?demo=1` (synthetic names only).

Personal invitation links keep using the existing `invitation` API and its release gate. The invitation page passes the visitor's existing credential only when they open their own seating page.

The shared-QR name search requires the updated `apps-script-v2.gs` to be deployed in the existing Apps Script project. Updating GitHub alone does not deploy that backend.

In the existing `Settings` sheet, add `public_table_lookup_enabled` with value `yes` when name lookup should be enabled. Existing `table_check_mode` and `table_release_date` still control release. Manually assign `Guests.table_id` and maintain its matching `Tables.table_id` / `table_name`; no new guest master is required. Optional `Guests.search_aliases` accepts full aliases separated by semicolons, pipes, or new lines.

Name lookup reads a matching record only. It never registers a guest or edits RSVP. Duplicate names ask the visitor to use their personal invitation or reception assistance. Real guest data and credentials must stay out of this repository.
