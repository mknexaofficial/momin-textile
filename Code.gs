// ================================================================
// Momin Textile — Google Apps Script Backend v2.0
// 
// SHEETS REQUIRED:
//   Sheet 1: "Database"
//     A: ID | B: Date | C: Item | D: Type | E: Qty | F: Party
//     G: Rate | H: Total_Value | I: Notes | J: Meters
//
//   Sheet 2: "Transactions"
//     A: TXN_ID | B: Date | C: Party | D: Amount | E: Type | F: Notes
//
// Item => 'Suth' ya 'Dhaga'
// Type => 'in' ya 'out'
// Txn Type => 'received' ya 'paid'
// ================================================================

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_DB  = "Database";
const SHEET_TXN = "Transactions";

// ===================== RESPONSE HELPER =====================
function makeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== MAIN ROUTER =====================
function doGet(e) {
  try {
    const action = e.parameter.action;
    const data   = e.parameter.data
      ? JSON.parse(decodeURIComponent(e.parameter.data))
      : {};

    // Auto-create sheets on first use
    ensureDbSheet();
    ensureTxnSheet();

    switch (action) {
      case 'addRecord':        return makeResponse(addRecord(data));
      case 'getRecords':       return makeResponse(getRecords());
      case 'deleteRecord':     return makeResponse(deleteRecord(data));
      case 'addTransaction':   return makeResponse(addTransaction(data));
      case 'getTransactions':  return makeResponse(getTransactions());
      case 'deleteTransaction':return makeResponse(deleteTransaction(data));
      default:
        return makeResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

// ===================== SHEET SETUP =====================
function ensureDbSheet() {
  let sheet = SS.getSheetByName(SHEET_DB);
  if (!sheet) {
    sheet = SS.insertSheet(SHEET_DB);
    const headers = ["ID", "Date", "Item", "Type", "Qty", "Party", "Rate", "Total_Value", "Notes", "Meters"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  } else {
    // Ensure Meters column (J=col10) exists as header
    const lastCol = sheet.getLastColumn();
    if (lastCol < 10) {
      sheet.getRange(1, 10).setValue("Meters").setFontWeight("bold");
    }
  }
  return sheet;
}

function ensureTxnSheet() {
  let sheet = SS.getSheetByName(SHEET_TXN);
  if (!sheet) {
    sheet = SS.insertSheet(SHEET_TXN);
    const headers = ["TXN_ID", "Date", "Party", "Amount", "Type", "Notes"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

// ===================== DATABASE RECORDS =====================
function addRecord(d) {
  const sheet  = SS.getSheetByName(SHEET_DB);
  const qty    = parseFloat(d.qty)       || 0;
  const rate   = parseFloat(d.ratePerKg) || 0;
  const meters = parseFloat(d.meters)    || 0;
  const item   = d.item || 'Suth';
  const type   = d.type || 'in';
  const prefix = item === 'Suth' ? 'S' : 'D';
  const id     = prefix + (type === 'in' ? 'IN' : 'OUT') + '-' + Date.now();

  // For Dhaga exit: amount entered IS the total (no qty*rate)
  const finalTotal = (item === 'Dhaga' && type === 'out') ? rate : (qty * rate);

  sheet.appendRow([
    id,
    d.date    || today(),
    item,
    type,
    qty,
    d.party   || '',
    rate,
    finalTotal,
    d.notes   || '',
    meters              // Column J — meters (only meaningful for Suth OUT)
  ]);

  updateTotals();
  return { success: true, id: id };
}

function getRecords() {
  const sheet = SS.getSheetByName(SHEET_DB);
  const rows  = sheet.getDataRange().getValues();

  const data = rows.slice(1).filter(r => r[0]).map(r => ({
    id:         String(r[0] || ''),
    date:       fmtDate(r[1]),
    item:       String(r[2] || ''),
    type:       String(r[3] || ''),
    qty:        parseFloat(r[4]) || 0,
    party:      String(r[5] || ''),
    ratePerKg:  parseFloat(r[6]) || 0,
    totalValue: parseFloat(r[7]) || 0,
    notes:      String(r[8] || ''),
    meters:     parseFloat(r[9]) || 0   // New field
  }));

  const suthData  = data.filter(r => r.item === 'Suth');
  const dhagaData = data.filter(r => r.item === 'Dhaga');

  const sIn      = suthData.filter(r => r.type === 'in').reduce((s, r) => s + r.qty, 0);
  const sOut     = suthData.filter(r => r.type === 'out').reduce((s, r) => s + r.qty, 0);
  const sMeters  = suthData.filter(r => r.type === 'out').reduce((s, r) => s + r.meters, 0);
  const dIn      = dhagaData.filter(r => r.type === 'in').reduce((s, r) => s + r.qty, 0);
  const dOut     = dhagaData.filter(r => r.type === 'out').reduce((s, r) => s + r.qty, 0);

  return {
    success: true,
    suth: {
      data:         suthData,
      totalIn:      sIn,
      totalOut:     sOut,
      available:    sIn - sOut,
      totalMeters:  sMeters      // Total meters produced (exit only)
    },
    dhaga: {
      data:         dhagaData,
      totalIn:      dIn,
      totalOut:     dOut,
      available:    dIn - dOut
    }
  };
}

function deleteRecord(d) {
  const sheet = SS.getSheetByName(SHEET_DB);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(d.id)) {
      sheet.deleteRow(i + 1);
      updateTotals();
      return { success: true };
    }
  }
  return { success: false, error: 'Record nahi mila: ' + d.id };
}

// ===================== TRANSACTIONS =====================
function addTransaction(d) {
  const sheet  = SS.getSheetByName(SHEET_TXN);
  const id     = 'TXN-' + Date.now();
  const amount = parseFloat(d.amount) || 0;

  sheet.appendRow([
    id,
    d.date  || today(),
    d.party || '',
    amount,
    d.type  || 'received',   // 'received' | 'paid'
    d.notes || ''
  ]);

  return { success: true, id: id };
}

function getTransactions() {
  const sheet = SS.getSheetByName(SHEET_TXN);
  if (!sheet) return { success: true, data: [], parties: [] };

  const rows = sheet.getDataRange().getValues();
  const data = rows.slice(1).filter(r => r[0]).map(r => ({
    id:     String(r[0] || ''),
    date:   fmtDate(r[1]),
    party:  String(r[2] || ''),
    amount: parseFloat(r[3]) || 0,
    type:   String(r[4] || 'received'),
    notes:  String(r[5] || '')
  }));

  // Party-wise summary
  const partyMap = {};
  data.forEach(t => {
    if (!partyMap[t.party]) partyMap[t.party] = { party: t.party, received: 0, paid: 0 };
    if (t.type === 'received') partyMap[t.party].received += t.amount;
    else                       partyMap[t.party].paid     += t.amount;
  });

  const parties = Object.values(partyMap).map(p => ({
    ...p,
    balance: p.received - p.paid   // positive = party still owes us; negative = we owe party
  }));

  return { success: true, data: data.reverse(), parties: parties };
}

function deleteTransaction(d) {
  const sheet = SS.getSheetByName(SHEET_TXN);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(d.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Transaction nahi mili: ' + d.id };
}

// ===================== TOTALS SUMMARY (Sheet Summary Columns) =====================
function updateTotals() {
  const sheet = SS.getSheetByName(SHEET_DB);
  const rows  = sheet.getDataRange().getValues();

  let sIn = 0, sOut = 0, sMeters = 0, dIn = 0, dOut = 0;

  for (let i = 1; i < rows.length; i++) {
    const item   = rows[i][2];
    const type   = rows[i][3];
    const qty    = parseFloat(rows[i][4])  || 0;
    const meters = parseFloat(rows[i][9])  || 0;

    if (item === 'Suth') {
      if (type === 'in')  { sIn  += qty; }
      if (type === 'out') { sOut += qty; sMeters += meters; }
    } else if (item === 'Dhaga') {
      if (type === 'in')  dIn  += qty;
      if (type === 'out') dOut += qty;
    }
  }

  // Write summary to cols L-N (col 12-14) — cols K-M were already used
  const s = sheet;
  s.getRange(1, 12).setValue('Suth IN').setFontWeight('bold');
  s.getRange(2, 12).setValue(sIn);
  s.getRange(1, 13).setValue('Suth OUT').setFontWeight('bold');
  s.getRange(2, 13).setValue(sOut);
  s.getRange(1, 14).setValue('Suth AVAIL').setFontWeight('bold');
  s.getRange(2, 14).setValue(sIn - sOut).setFontWeight('bold')
    .setFontColor(sIn - sOut >= 0 ? 'green' : 'red');
  s.getRange(1, 15).setValue('Meters Out').setFontWeight('bold');
  s.getRange(2, 15).setValue(sMeters);

  s.getRange(4, 12).setValue('Dhaga IN').setFontWeight('bold');
  s.getRange(5, 12).setValue(dIn);
  s.getRange(4, 13).setValue('Dhaga OUT').setFontWeight('bold');
  s.getRange(5, 13).setValue(dOut);
  s.getRange(4, 14).setValue('Dhaga AVAIL').setFontWeight('bold');
  s.getRange(5, 14).setValue(dIn - dOut).setFontWeight('bold')
    .setFontColor(dIn - dOut >= 0 ? 'green' : 'red');
}

// ===================== HELPERS =====================
function today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function fmtDate(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}
