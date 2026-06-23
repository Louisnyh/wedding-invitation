/**
 * Louis & Joyce Wedding Invitation API
 *
 * This Google Apps Script file reads guest data from Google Sheets and returns
 * personalized invitation data as JSON.
 *
 * IMPORTANT:
 * - Do not store real guest phone numbers or private guest data in GitHub.
 * - This file does not change the approved website visual design.
 */

const SPREADSHEET_ID = "1bvo6l0_4_MNdVqgSIbgnnR1uwIrrDgPLmAiGGDke3og";

const SHEET_NAMES = {
  guests: "Guests",
  tables: "Tables",
  rsvp: "RSVP",
  messages: "Messages",
  settings: "Settings",
  menu: "Menu",
};

const INVITE_URL_BASE = "https://louisnyh.github.io/wedding-invitation/?token=";
const DEFAULT_TABLE_RELEASE_DATE = "2026-11-28";
const DEFAULT_TABLE_LOCKED_COPY =
  "桌位会在婚礼前开放查询。现在先让你看看，那天会有哪些熟悉的人也会来到。";
const DEFAULT_TABLE_RELEASED_COPY = "你的桌位已经开放查询。";

/**
 * Returns JSON with the correct content type.
 *
 * This helper is placed near the top because doGet() uses it many times.
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Main API endpoint.
 *
 * Example URL after deployment:
 * https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?token=jason-a7k29x
 *
 * @param {Object} e Apps Script event object containing query parameters.
 * @return {ContentService.TextOutput} JSON response.
 */
function doGet(e) {
  try {
    const token = getTokenFromRequest(e);

    if (!token) {
      return jsonResponse({
        success: false,
        error: "Invalid invitation link",
      });
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const guests = readSheetObjects(spreadsheet, SHEET_NAMES.guests);
    const messages = readSheetObjects(spreadsheet, SHEET_NAMES.messages);
    const settings = readSettings(spreadsheet, SHEET_NAMES.settings);
    const menu = readMenu(spreadsheet, SHEET_NAMES.menu);
    const tableVisibility = createTableVisibility(settings);

    const guest = guests.find((row) => normalize(row.token) === token);

    if (!guest) {
      return jsonResponse({
        success: false,
        error: "Invalid invitation link",
      });
    }

    const confirmedGroupMembers = getConfirmedGroupMembers(
      guests,
      guest,
      true
    );

    const approvedMessages = getApprovedGroupMessages(messages, guest);
    const response = {
      success: true,
      guest: removePrivateGuestFields(guest, {
        hideTable: !tableVisibility.isReleased,
      }),
      confirmedGroupMembers,
      messages: approvedMessages,
      settings,
      menu,
      tableVisibility,
    };

    if (tableVisibility.isReleased) {
      const tables = readSheetObjects(spreadsheet, SHEET_NAMES.tables);
      const table = tables.find(
        (row) => normalize(row.table_id) === normalize(guest.table_id)
      );
      const confirmedTableMembers = guests
        .filter((row) => normalize(row.table_id) === normalize(guest.table_id))
        .filter((row) => normalize(row.rsvp_status) === "confirmed")
        .map((row) => removePrivateGuestFields(row, { hideTable: true }));

      response.table = table || {};
      response.confirmedTableMembers = confirmedTableMembers;
    }

    return jsonResponse(response);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
}

/**
 * Save endpoint for website actions.
 *
 * The website sends action-based POST requests here:
 * - action = rsvp   saves attendance replies
 * - action = memory saves memories for review
 *
 * Older RSVP requests without an action are still treated as RSVP requests.
 *
 * @param {Object} e Apps Script event object containing submitted form data.
 * @return {ContentService.TextOutput} JSON response.
 */
function doPost(e) {
  try {
    const data = parsePostData(e);
    const action = normalize(data.action || "rsvp");

    if (action === "memory") {
      return saveMemoryPost(data);
    }

    if (action === "rsvp") {
      return saveRsvpPost(data);
    }

    return jsonResponse({
      success: false,
      error: "Invalid action",
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
}

/**
 * Saves an RSVP response.
 *
 * This is the original RSVP flow, moved into its own helper so doPost() can
 * also route memory submissions without mixing the two actions.
 */
function saveRsvpPost(data) {
  const token = normalize(data.token);
  const guestId = normalize(data.guest_id);
  const rsvpStatus = normalizeRsvpStatus(data.rsvp_status);

  if (!token || !guestId || !rsvpStatus) {
    return jsonResponse({
      success: false,
      error: "Invalid RSVP response",
    });
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const guestsSheet = spreadsheet.getSheetByName(SHEET_NAMES.guests);

  if (!guestsSheet) {
    throw new Error("Missing sheet: " + SHEET_NAMES.guests);
  }

  const guestLookup = findGuestRowByToken(guestsSheet, token);

  if (!guestLookup) {
    return jsonResponse({
      success: false,
      error: "Invalid invitation link",
    });
  }

  if (normalize(guestLookup.guest.guest_id) !== guestId) {
    return jsonResponse({
      success: false,
      error: "Guest ID does not match invitation token",
    });
  }

  const paxCount = cleanPaxCount(
    data.pax_count,
    rsvpStatus,
    guestLookup.guest.pax_limit
  );

  if (!paxCount.success) {
    return jsonResponse({
      success: false,
      error: paxCount.error,
    });
  }

  const savedResponse = {
    response_id: Utilities.getUuid(),
    timestamp: new Date(),
    guest_id: guestLookup.guest.guest_id,
    token: guestLookup.guest.token,
    rsvp_status: rsvpStatus,
    pax_count: paxCount.value,
    dietary_notes: cleanText(data.dietary_notes),
    special_notes: cleanText(data.special_notes),
  };

  // The lock prevents two quick submissions from writing over each other.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    appendRsvpResponse(spreadsheet, savedResponse);
    updateGuestRsvp(guestsSheet, guestLookup.rowNumber, savedResponse);
  } finally {
    lock.releaseLock();
  }

  return jsonResponse({
    success: true,
    message: "RSVP saved",
  });
}

/**
 * Saves a memory message for review.
 *
 * The message is not published immediately. It is saved with approved = no,
 * so Louis & Joyce can review it before it appears on the memory board.
 */
function saveMemoryPost(data) {
  const token = normalize(data.token);
  const guestId = normalize(data.guest_id);
  const message = cleanText(data.message);

  if (!token) {
    return jsonResponse({
      success: false,
      error: "Invalid invitation link",
    });
  }

  if (!message) {
    return jsonResponse({
      success: false,
      error: "Message cannot be empty",
    });
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const guestsSheet = spreadsheet.getSheetByName(SHEET_NAMES.guests);

  if (!guestsSheet) {
    throw new Error("Missing sheet: " + SHEET_NAMES.guests);
  }

  const guestLookup = findGuestRowByToken(guestsSheet, token);

  if (!guestLookup) {
    return jsonResponse({
      success: false,
      error: "Invalid invitation link",
    });
  }

  if (guestId && normalize(guestLookup.guest.guest_id) !== guestId) {
    return jsonResponse({
      success: false,
      error: "Guest ID does not match invitation token",
    });
  }

  const savedMessage = {
    message_id: Utilities.getUuid(),
    timestamp: new Date(),
    guest_id: guestLookup.guest.guest_id,
    guest_name: guestLookup.guest.guest_name,
    table_id: guestLookup.guest.table_id,
    group_name: guestLookup.guest.group_name,
    prompt_type: cleanText(data.prompt_type),
    message,
    approved: "no",
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    appendMemoryMessage(spreadsheet, savedMessage);
  } finally {
    lock.releaseLock();
  }

  return jsonResponse({
    success: true,
    message: "Memory saved for review",
  });
}

/**
 * Reads the Settings sheet and converts key/value rows into one object.
 *
 * Example sheet:
 * key          | value
 * wedding_date_display | 2026年12月5日 · 星期六
 *
 * Becomes:
 * { wedding_date_display: "2026年12月5日 · 星期六" }
 */
function readSettings(spreadsheet, sheetName) {
  const rows = readSheetObjects(spreadsheet, sheetName);

  return rows.reduce((settings, row) => {
    if (row.key) {
      settings[row.key] = row.value;
    }

    return settings;
  }, {});
}

/**
 * Reads confirmed menu items from the Menu sheet.
 *
 * Rules:
 * - Only rows with is_confirmed = yes are returned.
 * - Rows are sorted by display_order.
 * - If the Menu sheet is missing or empty, return an empty list so the
 *   frontend can safely show menu_status from Settings.
 */
function readMenu(spreadsheet, sheetName) {
  const rows = readOptionalSheetObjects(spreadsheet, sheetName);

  return rows
    .filter((row) => normalize(row.is_confirmed) === "yes")
    .sort((first, second) => getDisplayOrder(first) - getDisplayOrder(second));
}

/**
 * Decides whether final table assignments may be shown publicly.
 *
 * table_check_enabled = yes works as a manual release switch.
 * table_release_date is the automatic release date in yyyy-MM-dd format.
 */
function createTableVisibility(settings) {
  const releaseDate = getSettingValue(
    settings,
    "table_release_date",
    DEFAULT_TABLE_RELEASE_DATE
  );
  const isManualRelease =
    normalize(getSettingValue(settings, "table_check_enabled", "no")) === "yes";
  const isReleased = isManualRelease || isDateOnOrAfterRelease(releaseDate);

  return {
    isReleased,
    releaseDate,
    message: isReleased
      ? getSettingValue(settings, "table_released_copy", DEFAULT_TABLE_RELEASED_COPY)
      : getSettingValue(settings, "table_locked_copy", DEFAULT_TABLE_LOCKED_COPY),
  };
}

/**
 * Compares today's date against the release date using the script timezone.
 */
function isDateOnOrAfterRelease(releaseDate) {
  const cleanReleaseDate = String(releaseDate || DEFAULT_TABLE_RELEASE_DATE).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanReleaseDate)) {
    return false;
  }

  const timezone = Session.getScriptTimeZone() || "Asia/Kuala_Lumpur";
  const today = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
  return today >= cleanReleaseDate;
}

/**
 * Reads one Settings value with a safe fallback.
 */
function getSettingValue(settings, key, fallback) {
  if (
    !settings ||
    settings[key] === undefined ||
    settings[key] === null ||
    settings[key] === ""
  ) {
    return fallback;
  }

  return settings[key];
}

/**
 * Converts display_order into a number for sorting.
 */
function getDisplayOrder(row) {
  const order = parseInt(row.display_order, 10);

  if (isNaN(order)) {
    return 9999;
  }

  return order;
}

/**
 * Finds confirmed guests from the same social group as the current guest.
 *
 * Rules:
 * - Uses Guests.group_name, not a separate sheet.
 * - Only confirmed guests are returned.
 * - Pending, maybe, and declined guests are never returned.
 * - Private fields are removed before sending data to the website.
 *
 * The current guest and same-table guests may still be included here so the
 * frontend can compare total group count against same-table count.
 */
function getConfirmedGroupMembers(guests, guest, hideTable) {
  const groupName = normalize(guest.group_name);

  if (!groupName) {
    return [];
  }

  return guests
    .filter((row) => normalize(row.group_name) === groupName)
    .filter((row) => normalize(row.rsvp_status) === "confirmed")
    .map((row) => removePrivateGuestFields(row, { hideTable }));
}

/**
 * Finds approved memory messages from the same social group as the current guest.
 *
 * Rules:
 * - Uses Messages.group_name so split tables can still share one memory board.
 * - Only approved = yes/true/approved messages are returned.
 * - Messages from other groups and unapproved messages are never returned.
 */
function getApprovedGroupMessages(messages, guest) {
  const groupName = normalize(guest.group_name);

  if (!groupName) {
    return [];
  }

  return messages
    .filter((row) => normalize(row.group_name) === groupName)
    .filter((row) => isApproved(row.approved))
    .map(removePrivateMessageFields);
}

/**
 * Manual utility: generate missing guest tokens and invitation URLs.
 *
 * How to use:
 * 1. Open this Apps Script project.
 * 2. Select `generateMissingGuestTokensAndInviteUrls` from the function list.
 * 3. Click Run.
 *
 * Important:
 * - This function only updates Guests rows where `token` is blank.
 * - It never overwrites an existing token.
 * - Tokens are random and are not based on guest names.
 */
function generateMissingGuestTokensAndInviteUrls() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAMES.guests);

  if (!sheet) {
    throw new Error("Missing sheet: " + SHEET_NAMES.guests);
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    Logger.log("No guest rows found.");
    return;
  }

  const headers = values[0].map((header) => normalizeHeader(header));
  const tokenColumn = headers.indexOf("token");
  const inviteUrlColumn = headers.indexOf("invite_url");

  if (tokenColumn === -1) {
    throw new Error("Missing column in Guests: token");
  }

  if (inviteUrlColumn === -1) {
    throw new Error("Missing column in Guests: invite_url");
  }

  const existingTokens = collectExistingTokens(values, tokenColumn);
  let updatedCount = 0;

  // Start at index 1 because index 0 is the header row.
  for (let index = 1; index < values.length; index += 1) {
    const rowNumber = index + 1;
    const currentToken = normalize(values[index][tokenColumn]);

    if (currentToken) {
      continue;
    }

    const newToken = createUniqueGuestToken(existingTokens);
    const inviteUrl = INVITE_URL_BASE + newToken;

    sheet.getRange(rowNumber, tokenColumn + 1).setValue(newToken);
    sheet.getRange(rowNumber, inviteUrlColumn + 1).setValue(inviteUrl);
    existingTokens.add(newToken);
    updatedCount += 1;
  }

  Logger.log("Generated invitation tokens for " + updatedCount + " guest row(s).");
}

/**
 * Collects all existing tokens so newly generated tokens cannot duplicate them.
 */
function collectExistingTokens(values, tokenColumn) {
  const tokens = new Set();

  values.slice(1).forEach((row) => {
    const token = normalize(row[tokenColumn]);

    if (token) {
      tokens.add(token);
    }
  });

  return tokens;
}

/**
 * Creates one random token and checks it against the token list.
 *
 * Utilities.getUuid() gives us a random value. We remove dashes and keep a
 * shorter 16-character token so the invitation URL stays tidy.
 */
function createUniqueGuestToken(existingTokens) {
  let token = "";

  do {
    token = Utilities.getUuid().replace(/-/g, "").slice(0, 16).toLowerCase();
  } while (existingTokens.has(token));

  return token;
}

/**
 * Reads POST data from the website.
 *
 * The frontend sends JSON.stringify(payload), so the main path reads
 * e.postData.contents and parses it as JSON.
 */
function parsePostData(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (error) {
      return parseFormEncodedText(e.postData.contents);
    }
  }

  if (e && e.parameter && Object.keys(e.parameter).length) {
    return Object.assign({}, e.parameter);
  }

  return {};
}

/**
 * Converts text like "token=abc&rsvp_status=confirmed" into an object.
 */
function parseFormEncodedText(text) {
  return String(text || "")
    .split("&")
    .reduce((data, pair) => {
      const parts = pair.split("=");
      const key = decodeFormValue(parts[0]);
      const value = decodeFormValue(parts.slice(1).join("="));

      if (key) {
        data[key] = value;
      }

      return data;
    }, {});
}

function decodeFormValue(value) {
  return decodeURIComponent(String(value || "").replace(/\+/g, " "));
}

/**
 * Finds the guest row number in the Guests sheet by token.
 *
 * Apps Script rows start at 1, so the first data row is row 2.
 */
function findGuestRowByToken(sheet, token) {
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return null;
  }

  const headers = values[0].map((header) => normalizeHeader(header));
  const tokenColumn = headers.indexOf("token");

  if (tokenColumn === -1) {
    throw new Error("Missing column in Guests: token");
  }

  for (let index = 1; index < values.length; index += 1) {
    if (normalize(values[index][tokenColumn]) === token) {
      return {
        guest: rowToObject(headers, values[index]),
        rowNumber: index + 1,
      };
    }
  }

  return null;
}

/**
 * Adds a fresh RSVP record to the RSVP sheet.
 */
function appendRsvpResponse(spreadsheet, responseData) {
  const sheet = spreadsheet.getSheetByName(SHEET_NAMES.rsvp);

  if (!sheet) {
    throw new Error("Missing sheet: " + SHEET_NAMES.rsvp);
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map((header) => normalizeHeader(header));

  const row = headers.map((header) => {
    if (responseData[header] !== undefined) {
      return responseData[header];
    }

    return "";
  });

  sheet.appendRow(row);
}

/**
 * Adds one memory message to the Messages sheet.
 *
 * Expected Messages columns:
 * message_id | timestamp | guest_id | guest_name | table_id | group_name |
 * prompt_type | message | approved
 */
function appendMemoryMessage(spreadsheet, messageData) {
  const sheet = spreadsheet.getSheetByName(SHEET_NAMES.messages);

  if (!sheet) {
    throw new Error("Missing sheet: " + SHEET_NAMES.messages);
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map((header) => normalizeHeader(header));
  const requiredHeaders = [
    "message_id",
    "timestamp",
    "guest_id",
    "guest_name",
    "table_id",
    "group_name",
    "prompt_type",
    "message",
    "approved",
  ];

  requiredHeaders.forEach((header) => {
    if (headers.indexOf(header) === -1) {
      throw new Error("Missing column in Messages: " + header);
    }
  });

  const row = headers.map((header) => {
    if (messageData[header] !== undefined) {
      return messageData[header];
    }

    return "";
  });

  sheet.appendRow(row);
}

/**
 * Updates the latest RSVP details back into the Guests sheet.
 */
function updateGuestRsvp(sheet, rowNumber, responseData) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map((header) => normalizeHeader(header));

  setCellByHeader(sheet, rowNumber, headers, "rsvp_status", responseData.rsvp_status);
  setCellByHeader(sheet, rowNumber, headers, "pax_count", responseData.pax_count);
  setCellByHeader(
    sheet,
    rowNumber,
    headers,
    "dietary_notes",
    responseData.dietary_notes
  );
  setCellByHeader(
    sheet,
    rowNumber,
    headers,
    "special_notes",
    responseData.special_notes
  );
}

/**
 * Updates one cell by column name so the sheet columns can be reordered later.
 */
function setCellByHeader(sheet, rowNumber, headers, headerName, value) {
  const columnIndex = headers.indexOf(headerName);

  if (columnIndex === -1) {
    throw new Error("Missing column in Guests: " + headerName);
  }

  sheet.getRange(rowNumber, columnIndex + 1).setValue(value);
}

/**
 * Converts button/form values into the statuses used by the Guests sheet.
 */
function normalizeRsvpStatus(value) {
  const status = normalize(value);

  if (["attending", "attend", "confirmed", "yes", "会出席"].indexOf(status) !== -1) {
    return "confirmed";
  }

  if (
    ["unsure", "not sure", "not_sure", "maybe", "暂时不确定", "还不确定"]
      .indexOf(status) !== -1
  ) {
    return "maybe";
  }

  if (
    ["unable", "cannot attend", "cannot_attend", "declined", "no", "无法出席"]
      .indexOf(status) !== -1
  ) {
    return "declined";
  }

  return "";
}

/**
 * Attending guests need at least 1 pax.
 *
 * If Guests.pax_limit is blank, guests can enter pax_count normally.
 * If Guests.pax_limit has a number, pax_count cannot be higher than that limit.
 */
function cleanPaxCount(value, rsvpStatus, paxLimitValue) {
  if (rsvpStatus === "declined") {
    return {
      success: true,
      value: 0,
    };
  }

  if (rsvpStatus !== "confirmed") {
    return {
      success: true,
      value: "",
    };
  }

  const paxCount = parseInt(value, 10);
  const cleanCount = isNaN(paxCount) || paxCount < 1 ? 1 : paxCount;
  const paxLimit = cleanPaxLimit(paxLimitValue);

  if (paxLimit && cleanCount > paxLimit) {
    return {
      success: false,
      error: "Pax count exceeds pax_limit",
    };
  }

  return {
    success: true,
    value: cleanCount,
  };
}

/**
 * Converts Guests.pax_limit into a usable number.
 *
 * Blank, zero, or non-number values mean there is no guest-specific limit.
 */
function cleanPaxLimit(value) {
  const paxLimit = parseInt(value, 10);

  if (isNaN(paxLimit) || paxLimit < 1) {
    return null;
  }

  return paxLimit;
}

/**
 * Keeps free-text notes tidy before saving them into the spreadsheet.
 */
function cleanText(value) {
  return String(value || "").trim().slice(0, 500);
}

/**
 * Reads the token from the URL query parameter.
 *
 * Example:
 * ?token=jason-a7k29x
 */
function getTokenFromRequest(e) {
  if (!e || !e.parameter || !e.parameter.token) {
    return "";
  }

  return normalize(e.parameter.token);
}

/**
 * Reads a sheet and converts each row into an object.
 *
 * Example:
 * Header row:
 * guest_id | token | guest_name
 *
 * Data row:
 * G001 | jason-a7k29x | Jason
 *
 * Becomes:
 * { guest_id: "G001", token: "jason-a7k29x", guest_name: "Jason" }
 */
function readSheetObjects(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error("Missing sheet: " + sheetName);
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map((header) => normalizeHeader(header));
  const rows = values.slice(1);

  return rows
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => rowToObject(headers, row));
}

/**
 * Reads a sheet if it exists. Missing optional sheets return an empty list.
 */
function readOptionalSheetObjects(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  return readSheetObjects(spreadsheet, sheetName);
}

/**
 * Converts a spreadsheet row array into an object using the header row.
 */
function rowToObject(headers, row) {
  const item = {};

  headers.forEach((header, index) => {
    if (!header) {
      return;
    }

    item[header] = formatCellValue(row[index]);
  });

  return item;
}

/**
 * Removes private guest fields before sending API data to the website.
 *
 * Keep this guard for older sheet copies that may still contain removed fields.
 */
function removePrivateGuestFields(guest, options) {
  const publicGuest = Object.assign({}, guest);
  delete publicGuest.whatsapp;
  delete publicGuest.table_locked;
  delete publicGuest.invitation_status;
  delete publicGuest.plus_one_allowed;

  if (options && options.hideTable) {
    delete publicGuest.table_id;
  }

  return publicGuest;
}

/**
 * Removes fields that should never be part of the public memory board.
 */
function removePrivateMessageFields(message) {
  const publicMessage = Object.assign({}, message);
  delete publicMessage.whatsapp;
  delete publicMessage.rsvp_status;
  delete publicMessage.token;
  return publicMessage;
}

/**
 * Only approved memory messages should be shown publicly.
 */
function isApproved(value) {
  const normalized = normalize(value);
  return normalized === "true" || normalized === "yes" || normalized === "approved";
}

/**
 * Makes text comparison safer by trimming spaces and converting to lowercase.
 */
function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Converts spreadsheet headers into clean object keys.
 */
function normalizeHeader(value) {
  return String(value || "").trim();
}

/**
 * Formats cell values so JSON output is easier to read.
 */
function formatCellValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

/**
 * DEPLOYMENT INSTRUCTIONS
 *
 * 1. Open Google Apps Script:
 *    https://script.google.com/
 *
 * 2. Create a new Apps Script project.
 *
 * 3. Paste this entire file into the script editor.
 *
 * 4. Make sure the Google Sheet has these tabs:
 *    - Guests
 *    - Tables
 *    - RSVP
 *    - Messages
 *    - Settings
 *    - Menu
 *
 * 5. Click Deploy.
 *
 * 6. Choose New deployment.
 *
 * 7. Select type: Web app.
 *
 * 8. Set:
 *    - Execute as: Me
 *    - Who has access: Anyone
 *
 * 9. Click Deploy.
 *
 * 10. Copy the Web App URL.
 *
 * 11. Test the API in your browser:
 *     WEB_APP_URL?token=jason-a7k29x
 *
 * Expected valid response:
 * {
 *   "success": true,
 *   "guest": {...},
 *   "table": {...},
 *   "confirmedTableMembers": [...],
 *   "confirmedGroupMembers": [...],
 *   "messages": [...],
 *   "settings": {...},
 *   "menu": [...]
 * }
 *
 * Expected invalid response:
 * {
 *   "success": false,
 *   "error": "Invalid invitation link"
 * }
 */
