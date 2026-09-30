/**
 * Admin-only guest credential generation for the Production v2 Apps Script.
 *
 * Add this file to the same Apps Script project as the verified v2 API source.
 * These functions are intentionally absent from doGet()/doPost() routing and
 * may only be run manually by a project editor from the Apps Script console.
 */
const GUEST_CREDENTIAL_HEADERS = [
  "guest_id", "token", "guest_name", "invitation_status", "pax_limit", "table_id",
  "revoked", "expires_at", "guest_type", "group_name", "personal_message", "invite_url"
];
const GUEST_TOKEN_PEPPER_PROPERTY = "GUEST_TOKEN_PEPPER";
const GUEST_CREDENTIAL_INVITE_ROOT = "https://louisnyh.github.io/wedding-invitation/";
const GUEST_CREDENTIAL_LOCK_TIMEOUT_MS = 10000;
const GUEST_TOKEN_RETRY_LIMIT = 20;
const GUEST_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const REAL_GUEST_ID_PATTERN = /^guest-(\d+)$/;
const VALID_CREDENTIALED_INVITATION_STATUSES = [
  "active", "invited", "sent", "delivered", "opened", "valid", "revoked", "disabled", "expired"
];

/** Read-only validation and generation preview. */
function previewGuestCredentialGeneration() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheet = openGuestCredentialAdminSpreadsheet(properties);
  const dataset = readGuestCredentialDataset(spreadsheet);
  const plan = planGuestCredentialGeneration(
    dataset.values,
    Boolean(String(properties.getProperty(GUEST_TOKEN_PEPPER_PROPERTY) || "").trim())
  );
  const report = guestCredentialPreviewReport(plan);
  Logger.log(report);
  return report;
}

/**
 * Generates credentials for every eligible row after a locked, full-dataset
 * validation. Existing complete credentials are never changed.
 */
function generateGuestCredentials() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(GUEST_CREDENTIAL_LOCK_TIMEOUT_MS)) {
    throw new Error("Guest credential generation blocked: script lock unavailable");
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    const pepper = String(properties.getProperty(GUEST_TOKEN_PEPPER_PROPERTY) || "").trim();
    const spreadsheet = openGuestCredentialAdminSpreadsheet(properties);
    const dataset = readGuestCredentialDataset(spreadsheet);
    const plan = planGuestCredentialGeneration(dataset.values, Boolean(pepper));

    if (plan.errors.length) {
      throw new Error("Guest credential generation blocked:\n" + plan.errors.join("\n"));
    }

    const tokenColumn = plan.headerIndexes.token;
    const guestIdColumn = plan.headerIndexes.guest_id;
    const statusColumn = plan.headerIndexes.invitation_status;
    const inviteUrlColumn = plan.headerIndexes.invite_url;
    const usedTokens = new Set(plan.existingTokens);
    let generated = 0;

    plan.eligibleRows.forEach(function (eligible, index) {
      const guestId = formatRealGuestId(plan.nextGuestNumber + index);
      const token = createUniqueCredentialToken(pepper, guestId, eligible.rowNumber, usedTokens);
      const inviteUrl = buildCanonicalGuestInviteUrl(token);

      // Only the four system-managed fields are written. A completed row is
      // then safely skipped on every later run.
      dataset.sheet.getRange(eligible.rowNumber, guestIdColumn + 1).setValue(guestId);
      dataset.sheet.getRange(eligible.rowNumber, tokenColumn + 1).setValue(token);
      dataset.sheet.getRange(eligible.rowNumber, statusColumn + 1).setValue("active");
      dataset.sheet.getRange(eligible.rowNumber, inviteUrlColumn + 1).setValue(inviteUrl);
      usedTokens.add(token);
      generated += 1;
    });

    const result = [
      "Guest Credential Generation Complete",
      "",
      "Generated: " + generated,
      "Already credentialed: " + plan.counts.alreadyCredentialed,
      "Production write: " + (generated ? "PERFORMED FOR ELIGIBLE ROWS" : "NOT REQUIRED"),
      "Raw credentials: NOT LOGGED"
    ].join("\n");
    Logger.log(result);
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** Read-only aggregate verification after credential generation. */
function verifyGuestCredentials() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheet = openGuestCredentialAdminSpreadsheet(properties);
  const dataset = readGuestCredentialDataset(spreadsheet);
  const verification = verifyGuestCredentialDataset(dataset.values);
  const report = guestCredentialVerificationReport(verification);
  Logger.log(report);
  return report;
}

function openGuestCredentialAdminSpreadsheet(properties) {
  const environment = String(properties.getProperty("ENVIRONMENT") || "").trim();
  const spreadsheetId = String(properties.getProperty("SPREADSHEET_ID") || "").trim();
  if (!["staging", "production"].includes(environment) || !spreadsheetId) {
    throw new Error("Guest credential administration is not configured");
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function readGuestCredentialDataset(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Guests");
  if (!sheet) throw new Error("Missing required sheet: Guests");
  return { sheet: sheet, values: sheet.getDataRange().getValues() };
}

/** Pure planning helper. It never generates tokens or mutates a Sheet. */
function planGuestCredentialGeneration(values, pepperConfigured) {
  const analysis = analyzeGuestCredentialDataset(values);
  const errors = analysis.errors.slice();
  if (!pepperConfigured) errors.push("TOKEN PEPPER NOT CONFIGURED");
  const nextGuestNumber = analysis.highestRealGuestNumber + 1;
  const plannedLastNumber = analysis.eligibleRows.length
    ? nextGuestNumber + analysis.eligibleRows.length - 1
    : null;
  return Object.assign({}, analysis, {
    errors: errors,
    pepperConfigured: Boolean(pepperConfigured),
    nextGuestNumber: nextGuestNumber,
    nextGuestId: formatRealGuestId(nextGuestNumber),
    plannedLastGuestId: plannedLastNumber === null ? null : formatRealGuestId(plannedLastNumber)
  });
}

/** Pure validation helper shared by preview, generation, and verification. */
function analyzeGuestCredentialDataset(values) {
  const errors = [];
  const warnings = [];
  const headers = (values[0] || []).map(function (value) { return String(value || "").trim(); });
  const headerIndexes = Object.create(null);
  const duplicateHeaders = duplicateValues(headers.filter(Boolean));
  if (duplicateHeaders.length) errors.push("Duplicate Guests headers: " + duplicateHeaders.join(", "));
  GUEST_CREDENTIAL_HEADERS.forEach(function (header, index) {
    headerIndexes[header] = headers.indexOf(header);
    if (headers[index] !== header) errors.push("Guests headers must exactly match the approved schema and order");
  });
  if (headers.length !== GUEST_CREDENTIAL_HEADERS.length) {
    errors.push("Guests headers must contain exactly " + GUEST_CREDENTIAL_HEADERS.length + " columns");
  }

  // Header errors make row interpretation unsafe; return a deterministic result.
  if (errors.length) {
    return emptyGuestCredentialAnalysis(errors, warnings, headers, headerIndexes);
  }

  const records = [];
  values.slice(1).forEach(function (row, index) {
    if (!row.some(function (cell) { return cell !== "" && cell !== null && cell !== undefined; })) return;
    const record = Object.create(null);
    headers.forEach(function (header, column) { record[header] = row[column]; });
    records.push({ rowNumber: index + 2, record: record });
  });

  const byGuestId = Object.create(null);
  const byToken = Object.create(null);
  const byInviteUrl = Object.create(null);
  const byGuestName = Object.create(null);
  const eligibleRows = [];
  const existingTokens = [];
  let highestRealGuestNumber = 0;
  let alreadyCredentialed = 0;
  let partialCredentials = 0;
  let invalidPaxLimit = 0;
  let missingGuestName = 0;
  let missingGuestType = 0;
  let missingGroupName = 0;

  records.forEach(function (item) {
    const row = item.record;
    const rowNumber = item.rowNumber;
    const guestId = cleanCredentialCell(row.guest_id);
    const token = cleanCredentialCell(row.token);
    const inviteUrl = cleanCredentialCell(row.invite_url);
    const guestName = cleanCredentialCell(row.guest_name);
    const status = cleanCredentialCell(row.invitation_status).toLowerCase();
    const presentCount = [guestId, token, inviteUrl].filter(Boolean).length;

    addRowReference(byGuestId, guestId.toLowerCase(), rowNumber);
    addRowReference(byToken, token, rowNumber);
    addRowReference(byInviteUrl, inviteUrl, rowNumber);
    addRowReference(byGuestName, guestName, rowNumber);
    if (token) existingTokens.push(token);

    if (!guestName) {
      missingGuestName += 1;
      errors.push("Row " + rowNumber + " — missing guest_name");
    }

    if (guestId.toLowerCase().indexOf("guest-") === 0) {
      const numericId = parseRealGuestId(guestId);
      if (numericId === null) errors.push("Row " + rowNumber + " — invalid real guest_id format");
      else highestRealGuestNumber = Math.max(highestRealGuestNumber, numericId);
    }

    if (token && !GUEST_TOKEN_PATTERN.test(token)) {
      errors.push("Row " + rowNumber + " — invalid token format");
    }
    if (inviteUrl && (!token || inviteUrl !== buildCanonicalGuestInviteUrl(token))) {
      errors.push("Row " + rowNumber + " — invite_url does not match its token or canonical root");
    }

    if (presentCount > 0 && presentCount < 3) {
      partialCredentials += 1;
      errors.push("Row " + rowNumber + " — partial credentials");
      return;
    }

    if (presentCount === 3) {
      alreadyCredentialed += 1;
      if (!VALID_CREDENTIALED_INVITATION_STATUSES.includes(status)) {
        errors.push("Row " + rowNumber + " — invalid invitation_status for credentialed row");
      }
      return;
    }

    if (status) {
      errors.push("Row " + rowNumber + " — invitation_status must be blank before generation");
    }
    if (!validCredentialPaxLimit(row.pax_limit)) {
      invalidPaxLimit += 1;
      errors.push("Row " + rowNumber + " — invalid pax_limit");
    }
    if (!cleanCredentialCell(row.guest_type)) {
      missingGuestType += 1;
      errors.push("Row " + rowNumber + " — missing guest_type");
    }
    if (!cleanCredentialCell(row.group_name)) {
      missingGroupName += 1;
      errors.push("Row " + rowNumber + " — missing group_name");
    }
    if (guestName && !status && validCredentialPaxLimit(row.pax_limit) &&
        cleanCredentialCell(row.guest_type) && cleanCredentialCell(row.group_name)) {
      eligibleRows.push({ rowNumber: rowNumber });
    }
  });

  appendDuplicateErrors(errors, "guest_id", byGuestId);
  appendDuplicateErrors(errors, "token", byToken);
  appendDuplicateErrors(errors, "invite_url", byInviteUrl);
  Object.keys(byGuestName).forEach(function (name) {
    if (name && byGuestName[name].length > 1) {
      warnings.push("Duplicate guest_name at rows " + byGuestName[name].join(", "));
    }
  });

  return {
    headers: headers,
    headerIndexes: headerIndexes,
    records: records,
    eligibleRows: eligibleRows,
    existingTokens: existingTokens,
    highestRealGuestNumber: highestRealGuestNumber,
    errors: uniqueStrings(errors),
    warnings: uniqueStrings(warnings),
    counts: {
      totalRows: records.length,
      alreadyCredentialed: alreadyCredentialed,
      eligible: eligibleRows.length,
      partialCredentials: partialCredentials,
      existingRealGuestIds: records.filter(function (item) { return parseRealGuestId(cleanCredentialCell(item.record.guest_id)) !== null; }).length,
      invalidPaxLimit: invalidPaxLimit,
      missingGuestName: missingGuestName,
      missingGuestType: missingGuestType,
      missingGroupName: missingGroupName,
      duplicateGuestIds: duplicateReferenceCount(byGuestId),
      duplicateTokens: duplicateReferenceCount(byToken),
      duplicateInviteUrls: duplicateReferenceCount(byInviteUrl)
    }
  };
}

function verifyGuestCredentialDataset(values) {
  const analysis = analyzeGuestCredentialDataset(values);
  const realRows = analysis.records.filter(function (item) {
    return parseRealGuestId(cleanCredentialCell(item.record.guest_id)) !== null;
  });
  const qaRows = analysis.records.filter(function (item) {
    const id = cleanCredentialCell(item.record.guest_id);
    return id && parseRealGuestId(id) === null;
  });
  const realTokens = realRows.map(function (item) { return cleanCredentialCell(item.record.token); });
  const realUrls = realRows.map(function (item) { return cleanCredentialCell(item.record.invite_url); });
  const realIds = realRows.map(function (item) { return cleanCredentialCell(item.record.guest_id); });
  return {
    errors: analysis.errors,
    warnings: analysis.warnings,
    counts: {
      realGuests: realRows.length,
      realGuestIdsPresent: realIds.filter(Boolean).length,
      realGuestIdsUnique: new Set(realIds.filter(Boolean)).size,
      realGuestIdsValid: realIds.filter(function (id) { return parseRealGuestId(id) !== null; }).length,
      tokensPresent: realTokens.filter(Boolean).length,
      tokensUnique: new Set(realTokens.filter(Boolean)).size,
      tokensValid: realTokens.filter(function (token) { return GUEST_TOKEN_PATTERN.test(token); }).length,
      inviteUrlsPresent: realUrls.filter(Boolean).length,
      inviteUrlsUnique: new Set(realUrls.filter(Boolean)).size,
      inviteUrlsCanonical: realRows.filter(function (item) {
        const token = cleanCredentialCell(item.record.token);
        return token && cleanCredentialCell(item.record.invite_url) === buildCanonicalGuestInviteUrl(token);
      }).length,
      activeRealGuests: realRows.filter(function (item) {
        return cleanCredentialCell(item.record.invitation_status).toLowerCase() === "active" && !credentialRowRevoked(item.record);
      }).length,
      revokedRealGuests: realRows.filter(function (item) { return credentialRowRevoked(item.record); }).length,
      partialCredentials: analysis.counts.partialCredentials,
      qaGuests: qaRows.length,
      qaRevoked: qaRows.filter(function (item) { return credentialRowRevoked(item.record); }).length
    }
  };
}

function guestCredentialPreviewReport(plan) {
  const lines = [
    "Guest Credential Generation Preview", "",
    "Total Guest rows: " + plan.counts.totalRows,
    "Already credentialed: " + plan.counts.alreadyCredentialed,
    "Eligible for generation: " + plan.counts.eligible,
    "Partial credential rows: " + plan.counts.partialCredentials, "",
    "Existing real guest IDs: " + plan.counts.existingRealGuestIds,
    "Next guest ID: " + plan.nextGuestId,
    "Planned last guest ID: " + (plan.plannedLastGuestId || "none"), "",
    "Invalid pax_limit: " + plan.counts.invalidPaxLimit,
    "Missing guest_name: " + plan.counts.missingGuestName,
    "Missing guest_type: " + plan.counts.missingGuestType,
    "Missing group_name: " + plan.counts.missingGroupName, "",
    "Duplicate guest IDs: " + plan.counts.duplicateGuestIds,
    "Duplicate tokens: " + plan.counts.duplicateTokens,
    "Duplicate invite URLs: " + plan.counts.duplicateInviteUrls, "",
    "Token pepper configured: " + (plan.pepperConfigured ? "YES" : "NO"),
    "Blocking errors: " + plan.errors.length,
    "Warnings: " + plan.warnings.length,
    "Production write:", "NOT PERFORMED"
  ];
  if (plan.errors.length) lines.push("", "Errors:", plan.errors.join("\n"));
  if (plan.warnings.length) lines.push("", "Warnings:", plan.warnings.join("\n"));
  return lines.join("\n");
}

function guestCredentialVerificationReport(verification) {
  const count = verification.counts;
  const lines = [
    "Guest Credential Verification", "",
    "Real Guests: " + count.realGuests, "",
    "Real Guest IDs:", count.realGuestIdsPresent + " present", count.realGuestIdsUnique + " unique", count.realGuestIdsValid + " valid", "",
    "Tokens:", count.tokensPresent + " present", count.tokensUnique + " unique", count.tokensValid + " valid 64-hex", "",
    "Invite URLs:", count.inviteUrlsPresent + " present", count.inviteUrlsUnique + " unique", count.inviteUrlsCanonical + " canonical", "",
    "Active real Guests: " + count.activeRealGuests,
    "Revoked real Guests: " + count.revokedRealGuests,
    "Partial credentials: " + count.partialCredentials, "",
    "QA Guests: " + count.qaGuests,
    "QA revoked: " + count.qaRevoked, "",
    "RSVP: UNCHANGED / not touched by this function",
    "Blocking errors: " + verification.errors.length,
    "Warnings: " + verification.warnings.length,
    "Raw credentials: NOT LOGGED"
  ];
  if (verification.errors.length) lines.push("", "Errors:", verification.errors.join("\n"));
  if (verification.warnings.length) lines.push("", "Warnings:", verification.warnings.join("\n"));
  return lines.join("\n");
}

function parseRealGuestId(value) {
  const match = REAL_GUEST_ID_PATTERN.exec(cleanCredentialCell(value));
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number >= 1 ? number : null;
}

function formatRealGuestId(number) {
  if (!Number.isSafeInteger(number) || number < 1) throw new Error("Invalid real guest number");
  return "guest-" + String(number).padStart(4, "0");
}

function buildCanonicalGuestInviteUrl(token) {
  return GUEST_CREDENTIAL_INVITE_ROOT + "?token=" + String(token || "");
}

function credentialBytesToHex(bytes) {
  return Array.prototype.map.call(bytes, function (byte) {
    return ((Number(byte) + 256) % 256).toString(16).padStart(2, "0");
  }).join("");
}

function createUniqueCredentialToken(pepper, guestId, rowNumber, usedTokens) {
  if (!pepper) throw new Error("Guest credential generation blocked: TOKEN PEPPER NOT CONFIGURED");
  for (let attempt = 0; attempt < GUEST_TOKEN_RETRY_LIMIT; attempt += 1) {
    const nonce = [
      Utilities.getUuid(), Utilities.getUuid(), String(Date.now()), guestId,
      String(rowNumber), String(attempt)
    ].join("|");
    const token = credentialBytesToHex(Utilities.computeHmacSha256Signature(nonce, pepper)).toLowerCase();
    if (GUEST_TOKEN_PATTERN.test(token) && !usedTokens.has(token)) return token;
  }
  throw new Error("Guest credential generation blocked: unique token retry limit reached");
}

function validCredentialPaxLimit(value) {
  if (typeof value === "string" && !/^[1-9]\d*$/.test(value.trim())) return false;
  if (typeof value !== "string" && typeof value !== "number") return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 && number <= 20;
}

function credentialRowRevoked(row) {
  const value = cleanCredentialCell(row.revoked).toLowerCase();
  const status = cleanCredentialCell(row.invitation_status).toLowerCase();
  return ["yes", "true", "1"].includes(value) || status === "revoked";
}

function cleanCredentialCell(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function addRowReference(map, value, rowNumber) {
  if (!value) return;
  if (!map[value]) map[value] = [];
  map[value].push(rowNumber);
}

function appendDuplicateErrors(errors, label, references) {
  Object.keys(references).forEach(function (value) {
    if (references[value].length > 1) {
      errors.push("Duplicate " + label + " at rows " + references[value].join(", "));
    }
  });
}

function duplicateReferenceCount(references) {
  return Object.keys(references).filter(function (value) { return references[value].length > 1; }).length;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach(function (value) { if (seen.has(value)) duplicates.add(value); else seen.add(value); });
  return Array.from(duplicates);
}

function uniqueStrings(values) { return Array.from(new Set(values)); }

function emptyGuestCredentialAnalysis(errors, warnings, headers, headerIndexes) {
  return {
    headers: headers, headerIndexes: headerIndexes, records: [], eligibleRows: [], existingTokens: [],
    highestRealGuestNumber: 0, errors: uniqueStrings(errors), warnings: warnings,
    counts: {
      totalRows: 0, alreadyCredentialed: 0, eligible: 0, partialCredentials: 0,
      existingRealGuestIds: 0, invalidPaxLimit: 0, missingGuestName: 0,
      missingGuestType: 0, missingGroupName: 0, duplicateGuestIds: 0,
      duplicateTokens: 0, duplicateInviteUrls: 0
    }
  };
}
