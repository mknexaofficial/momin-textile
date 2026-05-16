// ================================================================
// Momin Textile — Google Apps Script Backend (Unified Database)
// EK HI SHEET TAB CHAHIYE: "Database" (ya kisi bhi naam ka ek tab)
//
// Headers in Row 1:
// ID | Date | Item | Type | Qty | Party | Rate | Total_Value | Notes
// Item => 'Suth' ya 'Dhaga'
// Type => 'in' ya 'out'
// ================================================================

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_NAME = "Database";

function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const data   = e.parameter.data ? JSON.parse(decodeURIComponent(e.parameter.data)) : {};

    let sheet = SS.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = SS.insertSheet(SHEET_NAME);
      sheet.appendRow(["ID", "Date", "Item", "Type", "Qty", "Party", "Rate", "Total_Value", "Notes"]);
      sheet.getRange("A1:I1").setFontWeight("bold");
    }

    switch (action) {
      case 'addRecord':    return makeResponse(addRecord(data));
      case 'getRecords':   return makeResponse(getRecords());
      case 'deleteRecord': return makeResponse(deleteRecord(data));
      default: return makeResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

function deleteRecord(d) {
  const sheet = SS.getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === d.id) {
      sheet.deleteRow(i + 1);
      updateTotals();
      return { success: true };
    }
  }
  return { success: false, error: 'Record nahi mila: ' + d.id };
}

function addRecord(d) {
  const sheet = SS.getSheetByName(SHEET_NAME);
  const qty  = parseFloat(d.qty)       || 0;
  const rate = parseFloat(d.ratePerKg) || 0;
  const item = d.item || 'Suth';
  const type = d.type || 'in';
  const prefix = item === 'Suth' ? 'S' : 'D';
  const id   = prefix + (type === 'in' ? 'IN' : 'OUT') + '-' + Date.now();

  sheet.appendRow([
    id,
    d.date  || today(),
    item,
    type,
    qty,
    d.party || '',
    rate,
    qty * rate,
    d.notes || ''
  ]);

  updateTotals();
  return { success: true, id: id };
}

function getRecords() {
  const sheet = SS.getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();

  const data = rows.slice(1).filter(r => r[0]).map(r => ({
    id:         r[0] || '',
    date:       fmtDate(r[1]),
    item:       r[2] || '',
    type:       r[3] || '',
    qty:        parseFloat(r[4]) || 0,
    party:      r[5] || '',
    ratePerKg:  parseFloat(r[6]) || 0,
    totalValue: parseFloat(r[7]) || 0,
    notes:      r[8] || ''
  }));

  const suthData = data.filter(r => r.item === 'Suth');
  const dhagaData = data.filter(r => r.item === 'Dhaga');

  const sIn = suthData.filter(r => r.type === 'in').reduce((s, r) => s + r.qty, 0);
  const sOut= suthData.filter(r => r.type === 'out').reduce((s, r) => s + r.qty, 0);
  const dIn = dhagaData.filter(r => r.type === 'in').reduce((s, r) => s + r.qty, 0);
  const dOut= dhagaData.filter(r => r.type === 'out').reduce((s, r) => s + r.qty, 0);

  return {
    success: true,
    suth: { data: suthData, totalIn: sIn, totalOut: sOut, available: sIn - sOut },
    dhaga: { data: dhagaData, totalIn: dIn, totalOut: dOut, available: dIn - dOut }
  };
}

function updateTotals() {
  const sheet = SS.getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  
  let sIn = 0, sOut = 0, dIn = 0, dOut = 0;
  
  for (let i = 1; i < rows.length; i++) {
    const item = rows[i][2];
    const type = rows[i][3];
    const qty = parseFloat(rows[i][4]) || 0;
    
    if (item === 'Suth') {
      if (type === 'in') sIn += qty;
      if (type === 'out') sOut += qty;
    } else if (item === 'Dhaga') {
      if (type === 'in') dIn += qty;
      if (type === 'out') dOut += qty;
    }
  }
  
  sheet.getRange(1, 11).setValue('Suth IN').setFontWeight('bold');
  sheet.getRange(2, 11).setValue(sIn);
  sheet.getRange(1, 12).setValue('Suth OUT').setFontWeight('bold');
  sheet.getRange(2, 12).setValue(sOut);
  sheet.getRange(1, 13).setValue('Suth AVAIL').setFontWeight('bold');
  sheet.getRange(2, 13).setValue(sIn - sOut).setFontWeight('bold').setFontColor(sIn - sOut >= 0 ? 'green' : 'red');

  sheet.getRange(4, 11).setValue('Dhaga IN').setFontWeight('bold');
  sheet.getRange(5, 11).setValue(dIn);
  sheet.getRange(4, 12).setValue('Dhaga OUT').setFontWeight('bold');
  sheet.getRange(5, 12).setValue(dOut);
  sheet.getRange(4, 13).setValue('Dhaga AVAIL').setFontWeight('bold');
  sheet.getRange(5, 13).setValue(dIn - dOut).setFontWeight('bold').setFontColor(dIn - dOut >= 0 ? 'green' : 'red');
}

function today() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function fmtDate(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}
