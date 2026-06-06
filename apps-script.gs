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

    if (!guest || isDeclinedGuest(guest)) {
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
 * A declined guest should not be returned by the API.
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
