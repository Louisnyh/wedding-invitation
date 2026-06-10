/**
 * Louis & Joyce Wedding Invitation API
 *
 * This Google Apps Script file reads guest data from Google Sheets and returns
 * personalized invitation data as JSON.
 *
 * IMPORTANT:
 * - Do not store real guest phone numbers or private guest data in GitHub.
 * - This API never returns the `whatsapp` column.
 * - This file does not change the approved website visual design.
 */

const SPREADSHEET_ID = "1bvo6l0_4_MNdVqgSIbgnnR1uwIrrDgPLmAiGGDke3og";

const SHEET_NAMES = {
  guests: "Guests",
  tables: "Tables",
  rsvp: "RSVP",
  messages: "Messages",
  settings: "Settings",
};

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
    const tables = readSheetObjects(spreadsheet, SHEET_NAMES.tables);
    const messages = readSheetObjects(spreadsheet, SHEET_NAMES.messages);
    const settings = readSettings(spreadsheet, SHEET_NAMES.settings);

    const guest = guests.find((row) => normalize(row.token) === token);

    if (!guest) {
      return jsonResponse({
        success: false,
        error: "Invalid invitation link",
      });
    }

    const table = tables.find(
      (row) => normalize(row.table_id) === normalize(guest.table_id)
    );

    if (!table) {
      return jsonResponse({
        success: false,
        error: "Invalid invitation link",
      });
    }

    const confirmedTableMembers = guests
      .filter((row) => normalize(row.table_id) === normalize(guest.table_id))
      .filter((row) => normalize(row.rsvp_status) === "confirmed")
      .filter((row) => !isDeclinedGuest(row))
      .map(removePrivateGuestFields);

    const approvedMessages = messages
      .filter((row) => normalize(row.table_id) === normalize(guest.table_id))
      .filter((row) => isApproved(row.approved));

    return jsonResponse({
      success: true,
      guest: removePrivateGuestFields(guest),
      table,
      confirmedTableMembers,
      messages: approvedMessages,
      settings,
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
 * RSVP save endpoint.
 *
 * The website sends a POST request here when a guest chooses:
 * - 会出席
 * - 暂时不确定
 * - 无法出席
 *
 * This function:
 * 1. Adds a new row to the RSVP sheet.
 * 2. Updates the matching guest row in the Guests sheet.
 *
 * @param {Object} e Apps Script event object containing submitted form data.
 * @return {ContentService.TextOutput} JSON response.
 */
function doPost(e) {
  try {
    const data = parsePostData(e);
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

    const savedResponse = {
      response_id: Utilities.getUuid(),
      timestamp: new Date(),
      guest_id: guestLookup.guest.guest_id,
      token: guestLookup.guest.token,
      rsvp_status: rsvpStatus,
      pax_count: cleanPaxCount(data.pax_count, rsvpStatus),
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
  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Server error",
      message: error.message,
    });
  }
}

/**
 * Reads the Settings sheet and converts key/value rows into one object.
 *
 * Example sheet:
 * key          | value
 * wedding_date | 5 December 2026
 *
 * Becomes:
 * { wedding_date: "5 December 2026" }
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
 * Attending guests need at least 1 pax. Other statuses do not reserve a count.
 */
function cleanPaxCount(value, rsvpStatus) {
  if (rsvpStatus === "declined") {
    return 0;
  }

  if (rsvpStatus !== "confirmed") {
    return "";
  }

  const paxCount = parseInt(value, 10);

  if (isNaN(paxCount) || paxCount < 1) {
    return 1;
  }

  return paxCount;
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
 * Requirement:
 * - Never return whatsapp numbers in the API response.
 */
function removePrivateGuestFields(guest) {
  const publicGuest = Object.assign({}, guest);
  delete publicGuest.whatsapp;
  return publicGuest;
}

/**
 * A declined guest should not appear inside the public table member list.
 */
function isDeclinedGuest(guest) {
  return (
    normalize(guest.invitation_status) === "declined" ||
    normalize(guest.rsvp_status) === "declined" ||
    normalize(guest.rsvp_status) === "unable"
  );
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
 *   "messages": [...],
 *   "settings": {...}
 * }
 *
 * Expected invalid response:
 * {
 *   "success": false,
 *   "error": "Invalid invitation link"
 * }
 */
