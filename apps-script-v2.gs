/** Phase 2A API. Deploy separately from static files. See docs/DEPLOYMENT.md.
 * RSVP is an append-only canonical log; Guests is never updated by this API.
 */
const API_VERSION = 2;
const WEDDING_TIMEZONE = "Asia/Kuala_Lumpur";
const MAX_PARTY_SIZE = 20;
const GENERAL_INVITE_PARTY_LIMIT = 6;
const RSVP_HEADERS = ["response_id", "request_id", "revision", "timestamp", "guest_id", "rsvp_status", "pax_count", "under_5_child_count", "dietary_notes", "private_note"];
const MAP_HOSTS = ["maps.app.goo.gl", "maps.google.com", "www.google.com", "google.com", "www.google.com.my"];
const WAZE_HOSTS = ["ul.waze.com", "www.waze.com", "waze.com"];

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
// Credentials are accepted only in POST bodies, not API query strings.
function doGet() { return jsonResponse(apiError("invalid_invitation")); }
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    if (typeof raw !== "string" || raw.length > 8192) return jsonResponse(apiError("invalid_invitation"));
    const request = JSON.parse(raw);
    if (!request || Array.isArray(request) || typeof request !== "object") return jsonResponse(apiError("invalid_invitation"));
    if (!["invitation", "rsvp", "general_registration"].includes(request.action)) return jsonResponse(apiError("invalid_invitation"));
    if (request.action === "general_registration") {
      return jsonResponse(registerGeneralRsvp(openConfiguredSpreadsheet(), request));
    }
    const token = cleanToken(request.token);
    if (!token) return jsonResponse(apiError("invalid_invitation"));
    const spreadsheet = openConfiguredSpreadsheet();
    if (request.action === "rsvp") return jsonResponse(saveRsvp(spreadsheet, token, request));
    const guest = authorizeGuest(spreadsheet, token, new Date());
    if (!guest) return jsonResponse(apiError("invalid_invitation"));
    return jsonResponse(invitationResponse(spreadsheet, guest, new Date()));
  } catch (_) {
    // Never disclose spreadsheet identifiers, exception text or request contents.
    return jsonResponse(apiError("temporary_error"));
  }
}
function apiError(state) { return { schemaVersion: API_VERSION, state: state }; }
function openConfiguredSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const environment = properties.getProperty("ENVIRONMENT");
  const id = properties.getProperty("SPREADSHEET_ID");
  if (!["staging", "production"].includes(environment) || !id) throw new Error("Not configured");
  if (environment === "production" && properties.getProperty("PRODUCTION_ENABLED") !== "yes") throw new Error("Not enabled");
  return SpreadsheetApp.openById(id);
}
function cleanToken(value) {
  return typeof value === "string" && /^[a-f0-9]{16,128}$/i.test(value) ? value.toLowerCase() : "";
}
function readRows(spreadsheet, name, required) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error("Missing required sheet");
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(function (value) { return String(value).trim(); });
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error("Duplicate headers");
  (required || []).forEach(function (key) { if (!headers.includes(key)) throw new Error("Missing required column"); });
  return {
    sheet: sheet, headers: headers,
    rows: values.slice(1).filter(function (row) { return row.some(function (cell) { return cell !== ""; }); }).map(function (row) {
      const record = Object.create(null);
      headers.forEach(function (key, index) { if (key) record[key] = row[index]; });
      return record;
    })
  };
}
function authorizeGuest(spreadsheet, token, now) {
  const guests = readRows(spreadsheet, "Guests", ["guest_id", "token", "guest_name", "invitation_status", "pax_limit"]).rows;
  const matches = guests.filter(function (guest) { return cleanToken(guest.token) === token; });
  if (matches.length !== 1) return null;
  const guest = matches[0];
  const active = ["", "active", "invited", "sent", "delivered", "opened", "valid"];
  if (!active.includes(String(guest.invitation_status || "").trim().toLowerCase())) return null;
  if (["yes", "true", "1"].includes(String(guest.revoked || "").trim().toLowerCase())) return null;
  if (!String(guest.guest_id || "").trim()) return null;
  if (guests.filter(function (row) { return String(row.guest_id) === String(guest.guest_id); }).length !== 1) return null;
  if (guest.expires_at) {
    const expiry = expiryInstant(guest.expires_at);
    if (expiry === null || now.getTime() >= expiry) return null;
  }
  return guest;
}
function expiryInstant(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (validDateKey(text)) return new Date(text + "T00:00:00+08:00").getTime();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(text) || !validDateKey(text.slice(0, 10))) return null;
  const time = new Date(text).getTime();
  return isNaN(time) ? null : time;
}
function publicText(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}
function readSettings(spreadsheet) {
  const settings = Object.create(null);
  readRows(spreadsheet, "Settings", ["key", "value"]).rows.forEach(function (row) {
    if (typeof row.key === "string") settings[row.key] = row.value;
  });
  return settings;
}
function validatedMapUrl(value, hosts) {
  if (typeof value !== "string" || value.length > 2048 || /[\s<>"'\\\u0000-\u001f]/.test(value)) return "";
  // Apps Script does not provide the browser URL constructor.
  const match = /^https:\/\/([a-z0-9.-]+)(\/[^#]*)?(?:#[^\s]*)?$/i.exec(value);
  if (!match || !hosts.includes(match[1].toLowerCase())) return "";
  if (MAP_HOSTS.includes(match[1].toLowerCase()) && match[1].toLowerCase() !== "maps.app.goo.gl" &&
      match[1].toLowerCase() !== "maps.google.com" && !/^\/maps(?:[/?]|$)/.test(match[2] || "")) return "";
  return value;
}
function eventResponse(settings) {
  // No settings spread: administrator metadata can never become API fields.
  return {
    dateLabel: publicText(settings.wedding_date_display, 100),
    timeLabel: publicText(settings.wedding_start_time, 100),
    venueName: publicText(settings.venue_name, 160),
    venueAddress: publicText(settings.venue_address, 300),
    dressCode: publicText(settings.dress_code, 160),
    googleMapsUrl: validatedMapUrl(settings.google_maps_url, MAP_HOSTS),
    wazeUrl: validatedMapUrl(settings.waze_url, WAZE_HOSTS)
  };
}
function invitationResponse(spreadsheet, guest, now) {
  const settings = readSettings(spreadsheet);
  return {
    schemaVersion: API_VERSION, state: "ready",
    guest: { displayName: publicText(guest.guest_name, 120) || "Guest" },
    event: eventResponse(settings),
    rsvp: ownRsvpResponse(guest, readRows(spreadsheet, "RSVP", RSVP_HEADERS).rows),
    tableCheck: tableResponse(spreadsheet, guest, settings, now)
  };
}
function validDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function weddingDateKey(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : Utilities.formatDate(value, WEDDING_TIMEZONE, "yyyy-MM-dd");
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (validDateKey(text)) return text;
  const instant = expiryInstant(text);
  return instant === null ? null : Utilities.formatDate(new Date(instant), WEDDING_TIMEZONE, "yyyy-MM-dd");
}
function releaseDecision(settings, now) {
  const mode = String(settings.table_check_mode || "scheduled").trim().toLowerCase();
  if (mode === "force_closed") return { state: "locked", reason: "force_closed", releaseDate: null };
  if (mode === "force_open") return { state: "released" };
  if (mode !== "scheduled") return { state: "temporary_error" };
  const releaseDate = weddingDateKey(settings.table_release_date);
  if (!releaseDate) return { state: "temporary_error" };
  const today = Utilities.formatDate(now, WEDDING_TIMEZONE, "yyyy-MM-dd");
  return today >= releaseDate ? { state: "released" } : { state: "locked", reason: "scheduled", releaseDate: releaseDate };
}
function tableResponse(spreadsheet, guest, settings, now) {
  const decision = releaseDecision(settings, now);
  if (decision.state !== "released") return decision;
  const id = String(guest.table_id || "").trim();
  if (!id) return { state: "assignment_pending" };
  try {
    const matches = readRows(spreadsheet, "Tables", ["table_id", "table_name"]).rows.filter(function (table) { return String(table.table_id).trim() === id; });
    if (matches.length > 1) return { state: "temporary_error" };
    const name = matches.length ? publicText(matches[0].table_name, 120) : "";
    if (!name) return { state: "assignment_pending" };
    return { state: "available", assignment: { name: name } };
  } catch (_) { return { state: "temporary_error" }; }
}
function strictInteger(value, min, max) {
  if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}
function strictUnder5ChildCount(value, max) {
  return typeof value === "number" && Number.isSafeInteger(value) && Number.isInteger(max) && value >= 0 && value <= max ? value : null;
}
function storedUnder5ChildCount(value, partySize) {
  if (value === "" || value === undefined || value === null) return null;
  const count = Number.isInteger(partySize) ? strictUnder5ChildCount(value, partySize) : null;
  if (count === null) throw new Error("Invalid saved under-5 child count");
  return count;
}
function partyLimit(guest) {
  if (guest.pax_limit === "" || guest.pax_limit === undefined || guest.pax_limit === null) return 1;
  const limit = strictInteger(guest.pax_limit, 1, MAX_PARTY_SIZE);
  if (limit === null) throw new Error("Invalid party limit");
  return limit;
}
function responseStatus(value) {
  const map = { confirmed: "attending", attending: "attending", maybe: "unsure", unsure: "unsure", declined: "unable", unable: "unable" };
  return map[String(value || "").trim().toLowerCase()] || null;
}
function latestOwnRecord(guest, rows) {
  const own = rows.filter(function (row) { return String(row.guest_id) === String(guest.guest_id); });
  if (!own.length) return guest;
  const versioned = own.filter(function (row) { return strictInteger(row.revision, 1, Number.MAX_SAFE_INTEGER) !== null; });
  if (versioned.length) {
    const revisions = versioned.map(function (row) { return Number(row.revision); });
    if (new Set(revisions).size !== revisions.length) throw new Error("Duplicate revisions");
    return versioned.reduce(function (latest, row) { return Number(row.revision) > Number(latest.revision) ? row : latest; });
  }
  // Legacy log timestamps, not physical Sheet order; ambiguous records fail closed.
  const dated = own.map(function (row) { return {row: row, time: expiryInstant(row.timestamp)}; });
  if (dated.some(function (item) { return item.time === null; })) throw new Error("Invalid historical timestamp");
  dated.sort(function (a, b) { return b.time - a.time; });
  if (dated.length > 1 && dated[0].time === dated[1].time) throw new Error("Ambiguous historical responses");
  return dated[0].row;
}
function ownRsvpResponse(guest, rows) {
  const latest = latestOwnRecord(guest, rows);
  const status = responseStatus(latest.rsvp_status);
  const responsePartySize = status === "attending" ? strictInteger(latest.pax_count, 1, MAX_PARTY_SIZE) : null;
  return {
    status: status,
    partySize: responsePartySize,
    partyLimit: partyLimit(guest),
    under5ChildCount: status === "attending" ? storedUnder5ChildCount(latest.under_5_child_count, responsePartySize) : null,
    dietaryRequirements: status === "attending" ? privateFormText(latest.dietary_notes) : "",
    // Organizer special_notes/personal_message are intentionally never read here.
    privateNote: latest === guest ? "" : privateFormText(latest.private_note)
  };
}
function privateFormText(value) {
  if (value === undefined || value === null || value === "") return "";
  if (!validateGuestText(value)) throw new Error("Invalid saved form text");
  return value;
}
function validateGuestText(value) {
  return typeof value === "string" && value.length <= 500 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
function validateRsvp(request, guest, allowedFields) {
  const errors = {};
  const allowed = allowedFields || ["action", "token", "requestId", "status", "partySize", "under5ChildCount", "dietaryRequirements", "privateNote"];
  if (Object.keys(request).some(function (key) { return !allowed.includes(key); })) errors.form = "Unexpected fields";
  if (typeof request.requestId !== "string" || !/^[a-f0-9]{32}$/.test(request.requestId)) errors.form = "Invalid request identifier";
  if (!["attending", "unsure", "unable"].includes(request.status)) errors.status = "Choose a response";
  const count = request.status === "attending" ? strictInteger(request.partySize, 1, partyLimit(guest)) : null;
  if (request.status === "attending" && count === null) errors.partySize = "Enter a whole number within your invitation allowance";
  const childCount = request.status === "attending" ? strictUnder5ChildCount(request.under5ChildCount, count) : null;
  if (request.status === "attending" && childCount === null) errors.under5ChildCount = "Enter an under-5 child count from zero to the attending party size";
  if (!validateGuestText(request.dietaryRequirements)) errors.dietaryRequirements = "Use up to 500 characters";
  if (!validateGuestText(request.privateNote)) errors.privateNote = "Use up to 500 characters";
  if (request.status !== "attending" && (request.partySize !== null || request.dietaryRequirements !== "")) errors.form = "Attendance fields must be empty";
  return { errors: errors, value: { status: request.status, partySize: count, under5ChildCount: childCount, dietaryRequirements: request.dietaryRequirements, privateNote: request.privateNote } };
}

function cleanGeneralGuestName(value) {
  if (typeof value !== "string") return "";
  const name = value.trim();
  if (!name || name.length > 120 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(name)) return "";
  return name;
}

function generalValidation(request) {
  const guestName = cleanGeneralGuestName(request.guestName);
  const checked = validateRsvp(request, { pax_limit: GENERAL_INVITE_PARTY_LIMIT }, [
    "action", "requestId", "guestName", "status", "partySize", "under5ChildCount",
    "dietaryRequirements", "privateNote", "website"
  ]);
  if (!guestName) checked.errors.guestName = "Enter a name using up to 120 characters";
  if (typeof request.website !== "string" || request.website !== "") checked.errors.form = "Unable to submit this response";
  return { errors: checked.errors, value: checked.value, guestName: guestName };
}

function sameStoredRsvp(row, value) {
  const status = responseStatus(row.rsvp_status);
  const partySize = status === "attending" ? strictInteger(row.pax_count, 1, MAX_PARTY_SIZE) : null;
  const childCount = status === "attending" ? storedUnder5ChildCount(row.under_5_child_count, partySize) : null;
  return status === value.status && partySize === value.partySize && childCount === value.under5ChildCount &&
    String(row.dietary_notes || "") === value.dietaryRequirements && String(row.private_note || "") === value.privateNote;
}

function generalRegisteredResponse(guest, rsvpRows) {
  const token = cleanToken(guest.token);
  const inviteUrl = buildCanonicalGuestInviteUrl(token);
  if (!GUEST_TOKEN_PATTERN.test(token) || String(guest.invite_url || "") !== inviteUrl) throw new Error("Invalid general credential");
  return {
    schemaVersion: API_VERSION,
    state: "registered",
    rsvp: ownRsvpResponse(guest, rsvpRows),
    personalInviteUrl: inviteUrl
  };
}

function generalRetryResponse(guestStore, rsvpStore, requestId, checked) {
  const matchingResponses = rsvpStore.rows.filter(function (row) { return row.request_id === requestId; });
  if (!matchingResponses.length) return null;
  if (matchingResponses.length !== 1) throw new Error("Ambiguous request identity");
  const prior = matchingResponses[0];
  const matchingGuests = guestStore.rows.filter(function (guest) { return String(guest.guest_id) === String(prior.guest_id); });
  if (matchingGuests.length !== 1) throw new Error("Missing request identity");
  const guest = matchingGuests[0];
  const isGeneral = String(guest.guest_type || "") === "General" && String(guest.group_name || "") === "General Invite";
  if (!isGeneral || String(guest.guest_name || "") !== checked.guestName || !sameStoredRsvp(prior, checked.value)) {
    return { schemaVersion: API_VERSION, state: "validation_error", errors: { form: "Use a new request identifier for changed registration details" } };
  }
  return generalRegisteredResponse(guest, rsvpStore.rows);
}

function appendGeneralGuest(guestStore, guestRecord) {
  const row = guestStore.headers.map(function (key) {
    return literalSheetText(Object.prototype.hasOwnProperty.call(guestRecord, key) ? guestRecord[key] : "");
  });
  guestStore.sheet.appendRow(row);
}

function removeGeneralGuestAfterFailedRsvp(guestStore, guestId, token) {
  const refreshed = guestStore.sheet.getDataRange().getValues();
  const headers = (refreshed[0] || []).map(function (value) { return String(value).trim(); });
  const idColumn = headers.indexOf("guest_id");
  const tokenColumn = headers.indexOf("token");
  const matches = [];
  refreshed.slice(1).forEach(function (row, index) {
    if (String(row[idColumn]) === guestId && String(row[tokenColumn]) === token) matches.push(index + 2);
  });
  if (matches.length !== 1) throw new Error("General registration cleanup requires manual review");
  guestStore.sheet.deleteRow(matches[0]);
}

function registerGeneralRsvp(spreadsheet, request) {
  const checked = generalValidation(request);
  if (Object.keys(checked.errors).length) return { schemaVersion: API_VERSION, state: "validation_error", errors: checked.errors };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return apiError("temporary_error");
  try {
    const guestStore = readRows(spreadsheet, "Guests", GUEST_CREDENTIAL_HEADERS);
    const rsvpStore = readRows(spreadsheet, "RSVP", RSVP_HEADERS);
    const retry = generalRetryResponse(guestStore, rsvpStore, request.requestId, checked);
    if (retry) return retry;

    const guestValues = guestStore.sheet.getDataRange().getValues();
    const analysis = analyzeGuestCredentialDataset(guestValues);
    if (analysis.errors.length) throw new Error("Guests dataset is not safe for registration");
    const pepper = String(PropertiesService.getScriptProperties().getProperty(GUEST_TOKEN_PEPPER_PROPERTY) || "").trim();
    if (!pepper) throw new Error("Guest token pepper is not configured");
    const guestId = formatRealGuestId(analysis.highestRealGuestNumber + 1);
    const usedTokens = new Set(analysis.existingTokens);
    const rowNumber = guestValues.length + 1;
    const token = createUniqueCredentialToken(pepper, guestId, rowNumber, usedTokens);
    const inviteUrl = buildCanonicalGuestInviteUrl(token);
    const guest = {
      guest_id: guestId, token: token, guest_name: checked.guestName, invitation_status: "active",
      pax_limit: GENERAL_INVITE_PARTY_LIMIT, table_id: "", revoked: "", expires_at: "",
      guest_type: "General", group_name: "General Invite", personal_message: "", invite_url: inviteUrl
    };
    try {
      appendGeneralGuest(guestStore, guest);
    } catch (_) {
      const refreshedGuests = readRows(spreadsheet, "Guests", GUEST_CREDENTIAL_HEADERS).rows.filter(function (row) {
        return String(row.guest_id) === guestId && cleanToken(row.token) === token;
      });
      if (refreshedGuests.length !== 1) throw new Error("General guest write failed");
    }

    const record = {
      response_id: Utilities.getUuid(), request_id: request.requestId, revision: 1, timestamp: new Date(), guest_id: guestId,
      rsvp_status: { attending: "confirmed", unsure: "maybe", unable: "declined" }[checked.value.status],
      pax_count: checked.value.status === "attending" ? checked.value.partySize : checked.value.status === "unable" ? 0 : "",
      under_5_child_count: checked.value.under5ChildCount === null ? "" : checked.value.under5ChildCount,
      dietary_notes: checked.value.dietaryRequirements, private_note: checked.value.privateNote
    };
    try {
      rsvpStore.sheet.appendRow(rsvpStore.headers.map(function (key) {
        return literalSheetText(Object.prototype.hasOwnProperty.call(record, key) ? record[key] : "");
      }));
    } catch (_) {
      const refreshedRsvp = readRows(spreadsheet, "RSVP", RSVP_HEADERS);
      const recovered = refreshedRsvp.rows.filter(function (row) {
        return row.request_id === request.requestId && String(row.guest_id) === guestId;
      });
      if (recovered.length === 1 && sameStoredRsvp(recovered[0], checked.value)) {
        return generalRegisteredResponse(guest, refreshedRsvp.rows);
      }
      removeGeneralGuestAfterFailedRsvp(guestStore, guestId, token);
      throw new Error("General RSVP write failed");
    }
    return generalRegisteredResponse(guest, rsvpStore.rows.concat([record]));
  } finally { lock.releaseLock(); }
}
function literalSheetText(value) {
  // Apostrophe forces literal text in Sheets; getValues returns the original text.
  return typeof value === "string" && value !== "" ? "'" + value : value;
}
function saveRsvp(spreadsheet, token, request) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return apiError("temporary_error");
  try {
    // Resolve identity/revocation inside the lock; never trust client guest IDs.
    const guest = authorizeGuest(spreadsheet, token, new Date());
    if (!guest) return apiError("invalid_invitation");
    const checked = validateRsvp(request, guest);
    if (Object.keys(checked.errors).length) return { schemaVersion: API_VERSION, state: "validation_error", errors: checked.errors };
    const store = readRows(spreadsheet, "RSVP", RSVP_HEADERS);
    const prior = store.rows.find(function (row) { return String(row.guest_id) === String(guest.guest_id) && row.request_id === request.requestId; });
    const value = checked.value;
    if (prior) {
      const priorStatus = responseStatus(prior.rsvp_status);
      const priorPartySize = priorStatus === "attending" ? strictInteger(prior.pax_count, 1, MAX_PARTY_SIZE) : null;
      const priorChildCount = priorStatus === "attending" ? storedUnder5ChildCount(prior.under_5_child_count, priorPartySize) : null;
      if (priorStatus !== value.status || priorPartySize !== value.partySize || priorChildCount !== value.under5ChildCount ||
          String(prior.dietary_notes || "") !== value.dietaryRequirements || String(prior.private_note || "") !== value.privateNote) {
        return { schemaVersion: API_VERSION, state: "validation_error", errors: { form: "Use a new request identifier for an edited response" } };
      }
      return { schemaVersion: API_VERSION, state: "saved", rsvp: ownRsvpResponse(guest, store.rows) };
    }
    const latest = latestOwnRecord(guest, store.rows);
    const revision = (strictInteger(latest.revision, 1, Number.MAX_SAFE_INTEGER) || 0) + 1;
    if (!Number.isSafeInteger(revision)) throw new Error("Revision overflow");
    const record = {
      revision: revision,
      response_id: Utilities.getUuid(), request_id: request.requestId, timestamp: new Date(), guest_id: guest.guest_id,
      rsvp_status: { attending: "confirmed", unsure: "maybe", unable: "declined" }[value.status],
      pax_count: value.status === "attending" ? value.partySize : value.status === "unable" ? 0 : "",
      under_5_child_count: value.under5ChildCount === null ? "" : value.under5ChildCount,
      dietary_notes: value.dietaryRequirements, private_note: value.privateNote
    };
    store.sheet.appendRow(store.headers.map(function (key) { return literalSheetText(Object.prototype.hasOwnProperty.call(record, key) ? record[key] : ""); }));
    return { schemaVersion: API_VERSION, state: "saved", rsvp: ownRsvpResponse(guest, store.rows.concat([record])) };
  } finally { lock.releaseLock(); }
}
