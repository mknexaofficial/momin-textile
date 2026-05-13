// ================================================================
// Momin Textile — Suth Manager (app.js)
// ================================================================

// ✅ HARDCODED API URL — har device par automatically kaam karega
const DEFAULT_API = 'https://script.google.com/macros/s/AKfycbxSNaV_vuIzjCSNMc-7tLZwc_x45S7litAXYKtwUDO-snkgZUPKOYruSw-gK-RBGa1Tgw/exec';

let API = '', suthRecords = [], suthTotalIn = 0, suthTotalOut = 0, suthAvailable = 0, charts = {};

// ===== INIT =====
window.onload = () => {
  loadSettings();
  const today = new Date().toISOString().split('T')[0];
  ['siDate', 'soDate'].forEach(id => { const e = document.getElementById(id); if (e) e.value = today; });
  setInterval(() => { const e = document.getElementById('clock'); if (e) e.textContent = new Date().toLocaleString('en-IN'); }, 1000);
  showPage('dash');
  checkSession();
  refreshData();
};

// ===== NAVIGATION + BACK BUTTON =====
const PAGES = {
  'dash':       'Dashboard',
  'suth-stock': 'Suth Ledger',
  'suth':       'Suth Calculator',
  'settings':   'Settings'
};

let currentPage = 'dash';

function showPage(id, pushHistory = true) {
  // Hide all pages
  document.querySelectorAll('.pg').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  // Show target page with animation
  const pg = document.getElementById('pg-' + id);
  if (pg) {
    pg.style.display = 'block';
    // Force reflow then add animation class
    void pg.offsetWidth;
    pg.classList.add('active');
  }

  // Update title
  const t = document.getElementById('pageTitle');
  if (t) t.textContent = PAGES[id] || id;

  // Update nav active state — sidebar
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sn = document.getElementById('nav-' + id);
  if (sn) sn.classList.add('active');

  // Update bottom nav
  document.querySelectorAll('.bn').forEach(b => b.classList.remove('active'));
  const bn = document.getElementById('bn-' + id);
  if (bn) bn.classList.add('active');

  // Close sidebar on mobile
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  if (sb && window.innerWidth <= 768) {
    sb.classList.remove('open');
    if (ov) ov.style.display = 'none';
  }

  // History API — enables browser/Android back button
  if (pushHistory) {
    history.pushState({ page: id }, '', '#' + id);
  }

  currentPage = id;
}

// Handle browser back/forward button
window.addEventListener('popstate', (e) => {
  const page = (e.state && e.state.page) || 'dash';
  showPage(page, false); // false = don't push again
});

// ===== MULTI-DEVICE: Auto-refresh when tab becomes visible =====
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // User switched back to this tab/app — refresh data silently
    refreshData();
  }
});

// ===== PIN + SESSION =====
const SESSION_KEY = 'mt_session';
const SESSION_HOURS = 12; // auto-logout after 12 hours
let pinEntry = '';

function checkSession() {
  const s = localStorage.getItem(SESSION_KEY);
  if (s) {
    const { time } = JSON.parse(s);
    if (Date.now() - time < SESSION_HOURS * 3600000) {
      unlockApp(); return;
    }
  }
  // Show PIN screen
  loadPinScreen();
}

function loadPinScreen() {
  const logo    = localStorage.getItem('mt_logo');
  const company = localStorage.getItem('mt_company') || 'Momin Textile';
  const pl = document.getElementById('pinLogo');
  const pc = document.getElementById('pinCompany');
  if (pc) pc.textContent = company;
  if (pl) pl.innerHTML = logo ? `<img src="${logo}">` : '🧵';
  // Reset and focus
  const inp = document.getElementById('pinReal');
  if (inp) { inp.value = ''; inp.focus(); }
  pinEntry = '';
  updatePinDots();
  const err = document.getElementById('pinErr');
  if (err) err.textContent = '';
}

// Single source of truth — only called by the real input's oninput event
function onPinInput(inp) {
  const val = inp.value.replace(/\D/g, '').slice(0, 4);
  inp.value = val;   // strip non-digits
  pinEntry  = val;
  updatePinDots();
  document.getElementById('pinErr').textContent = '';
  if (pinEntry.length === 4) setTimeout(checkPin, 150);
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const c = document.getElementById('pc' + i);
    if (c) c.classList.toggle('on', i < pinEntry.length);
  }
}

function checkPin() {
  const stored = localStorage.getItem('mt_pin') || '1234';
  if (pinEntry === stored) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ time: Date.now() }));
    unlockApp();
  } else {
    document.getElementById('pinErr').textContent = '❌ Wrong PIN — try again';
    const inp = document.getElementById('pinReal');
    if (inp) { inp.value = ''; inp.focus(); }
    pinEntry = '';
    updatePinDots();
    // Shake
    const box = document.querySelector('.pin-box');
    if (box) {
      box.style.transition = 'transform .08s';
      const seq = [-10, 10, -8, 8, 0];
      seq.forEach((v, i) => setTimeout(() => { box.style.transform = `translateX(${v}px)`; }, i * 80));
    }
  }
}

function unlockApp() {
  const ps = document.getElementById('pinScreen');
  if (ps) ps.style.display = 'none';
}

function doLogout() {
  localStorage.removeItem(SESSION_KEY);
  pinEntry = '';
  loadPinScreen();
  const ps = document.getElementById('pinScreen');
  if (ps) ps.style.display = 'flex';
  toast('Logged out 🔒', 'success');
}

// ===== SETTINGS =====
function loadSettings() {
  // API always uses DEFAULT (hardcoded) — no user input needed
  API = DEFAULT_API;
  const company = localStorage.getItem('mt_company') || 'Momin Textile';
  const c = document.getElementById('settCompany'); if (c) c.value = company;
  const t = localStorage.getItem('mt_theme') || 'dark';
  if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  applyLogo();
  const sc = document.getElementById('sidebarCompany'); if (sc) sc.textContent = company;
}

function saveSettings() {
  API = (document.getElementById('settApiUrl').value || '').trim();
  localStorage.setItem('mt_api', API);
  const company = document.getElementById('settCompany').value || 'Momin Textile';
  localStorage.setItem('mt_company', company);
  const sc = document.getElementById('sidebarCompany'); if (sc) sc.textContent = company;
  // PIN change
  const np = document.getElementById('settNewPin').value;
  const cp = document.getElementById('settConfirmPin').value;
  if (np) {
    if (np.length !== 4 || !/^[0-9]+$/.test(np)) { toast('PIN 4 digits ka hona chahiye', 'error'); return; }
    if (np !== cp) { toast('PIN match nahi kiya — dobara check karein', 'error'); return; }
    localStorage.setItem('mt_pin', np);
    document.getElementById('settNewPin').value = '';
    document.getElementById('settConfirmPin').value = '';
    toast('PIN change ho gaya! 🔒', 'success');
  }
  toast('Settings saved ✅', 'success');
  refreshData();
}

// ===== LOGO =====
function applyLogo() {
  const logo = localStorage.getItem('mt_logo');
  const wrap = document.getElementById('sidebarLogoWrap');
  const prev = document.getElementById('logoPreview');
  if (logo) {
    if (wrap) wrap.innerHTML = `<img class="slogo-img" src="${logo}">`;
    if (prev) prev.innerHTML = `<img src="${logo}">`;
  } else {
    if (wrap) wrap.innerHTML = '🧵';
    if (prev) prev.innerHTML = '🧵';
  }
}

function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 500000) { toast('Logo 500KB se chota hona chahiye', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    localStorage.setItem('mt_logo', e.target.result);
    applyLogo();
    loadPinScreen();
    toast('Logo upload ho gaya ✅', 'success');
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  localStorage.removeItem('mt_logo');
  applyLogo();
  loadPinScreen();
  toast('Logo remove ho gaya', 'success');
}

// ===== API CALL =====
async function api(action, data = {}) {
  if (!API) { document.getElementById('offlineBar').style.display = 'block'; return null; }
  try {
    const url = `${API}?action=${action}&data=${encodeURIComponent(JSON.stringify(data))}`;
    const res = await fetch(url);
    const json = await res.json();
    document.getElementById('offlineBar').style.display = 'none';
    return json;
  } catch (e) {
    document.getElementById('offlineBar').style.display = 'block';
    return null;
  }
}

// ===== REFRESH DATA =====
async function refreshData() {
  const res = await api('getSuthStock');
  if (res && res.success) {
    suthRecords  = res.data       || [];
    suthTotalIn  = res.totalIn    || 0;
    suthTotalOut = res.totalOut   || 0;
    suthAvailable= res.available  || 0;
  }
  renderDash();
  renderSuthLedger();
  updateAvailInfo();
}

// ===== DASHBOARD =====
function renderDash() {
  setText('dIn',    suthTotalIn.toFixed(3)   + ' kg');
  setText('dOut',   suthTotalOut.toFixed(3)  + ' kg');
  setText('dAvail', suthAvailable.toFixed(3) + ' kg');
  buildBarChart();
  buildFeed();
}

function buildBarChart() {
  const ctx = document.getElementById('cBar'); if (!ctx) return;
  if (charts.bar) { charts.bar.destroy(); }

  // Group by month
  const months = last6();
  const inData  = months.map(m => suthRecords.filter(r => r.type === 'in'  && r.date.startsWith(m)).reduce((s, r) => s + r.qty, 0));
  const outData = months.map(m => suthRecords.filter(r => r.type === 'out' && r.date.startsWith(m)).reduce((s, r) => s + r.qty, 0));

  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Aaya (In)',  data: inData,  backgroundColor: '#2ec08b', borderRadius: 5 },
        { label: 'Gaya (Out)', data: outData, backgroundColor: '#e05260', borderRadius: 5 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8a9bb5' } } },
      scales: {
        x: { ticks: { color: '#8a9bb5' }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { ticks: { color: '#8a9bb5' }, grid: { color: 'rgba(255,255,255,.05)' } }
      }
    }
  });
}

function buildFeed() {
  const tbody = document.getElementById('feed');
  const sorted = [...suthRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--tm)">No data yet</td></tr>';
    return;
  }
  // Calculate running balances from start
  let balance = 0;
  const balanceMap = {};
  [...suthRecords].sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
    balance += r.type === 'in' ? r.qty : -r.qty;
    balanceMap[r.id] = balance;
  });

  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td style="color:var(--tm);font-size:12px">${r.date}</td>
      <td><span class="badge ${r.type === 'in' ? 'bg' : 'br'}">${r.type === 'in' ? '⬆️ In' : '⬇️ Out'}</span></td>
      <td><b>${r.qty.toFixed(3)}</b></td>
      <td style="color:var(--tm)">${r.party || '—'}</td>
      <td><b style="color:${(balanceMap[r.id] || 0) >= 0 ? 'var(--suc)' : 'var(--dan)'}">${(balanceMap[r.id] || 0).toFixed(3)}</b></td>
    </tr>`).join('');
}

// ===== SUTH LEDGER =====
function renderSuthLedger() {
  setText('ssIn',    suthTotalIn.toFixed(3)   + ' kg');
  setText('ssOut',   suthTotalOut.toFixed(3)  + ' kg');
  setText('ssAvail', suthAvailable.toFixed(3) + ' kg');

  const tbody = document.getElementById('suthTable');
  if (!suthRecords.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--tm)">Koi record nahi — pehle suth entry karein</td></tr>';
    return;
  }

  // Sort oldest first → calculate running balance
  let running = 0;
  const sorted = [...suthRecords].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map(r => {
    running += r.type === 'in' ? r.qty : -r.qty;
    const bal = running;
    return `<tr>
      <td>${r.date}</td>
      <td><span class="badge ${r.type === 'in' ? 'bg' : 'br'}">${r.type === 'in' ? '⬆️ Aaya' : '⬇️ Gaya'}</span></td>
      <td><b>${r.qty.toFixed(3)} kg</b></td>
      <td>${r.party || '—'}</td>
      <td>${r.ratePerKg > 0 ? '₹' + fmt(r.ratePerKg) : '—'}</td>
      <td>${r.totalValue > 0 ? '₹' + fmt(r.totalValue) : '—'}</td>
      <td><b style="color:${bal >= 0 ? 'var(--suc)' : 'var(--dan)'}">${bal.toFixed(3)} kg</b></td>
      <td><button onclick="showDeleteModal('${r.id}','${r.qty.toFixed(3)} kg','${r.type}')" style="background:rgba(224,82,96,.15);border:1px solid rgba(224,82,96,.3);color:var(--dan);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">🗑 Del</button></td>
    </tr>`;
  });
  tbody.innerHTML = rows.reverse().join(''); // newest first
}

// ===== CUSTOM CONFIRM MODAL =====
function showDeleteModal(id, qtyLabel, type) {
  const modal = document.getElementById('deleteModal');
  document.getElementById('delModalTitle').textContent =
    (type === 'in' ? '⬆️ Entry' : '⬇️ Exit') + ' delete karna chahte hain?';
  document.getElementById('delModalDetail').textContent =
    'Qty: ' + qtyLabel + ' — Google Sheet se bhi hata diya jaayega!';
  modal.style.display = 'flex';
  // Confirm button
  document.getElementById('delConfirmBtn').onclick = async () => {
    const btn = document.getElementById('delConfirmBtn');
    const oldText = btn.innerHTML;
    btn.innerHTML = '⏳ Deleting...';
    btn.disabled = true;

    const res = await api('deleteSuthRecord', { id });
    
    btn.innerHTML = oldText;
    btn.disabled = false;
    modal.style.display = 'none';

    if (res && res.success) {
      toast('✅ Record delete ho gaya!', 'success');
      refreshData();
    } else {
      toast(res ? res.error : 'Delete nahi hua — API check karein', 'error');
    }
  };
  document.getElementById('delCancelBtn').onclick = () => { modal.style.display = 'none'; };
}


function updateAvailInfo() {
  const el = document.getElementById('soAvailInfo');
  if (el) el.textContent = `🧵 Available Suth: ${suthAvailable.toFixed(3)} kg — is se zyada exit nahi ho sakta`;
}

// ===== SUTH ENTRY =====
function calcEntryValue() {
  const q = parseFloat(document.getElementById('siQty').value) || 0;
  const r = parseFloat(document.getElementById('siRate').value) || 0;
  document.getElementById('siValue').value = q && r ? '₹' + fmt(q * r) : '';
}

async function submitSuthIn() {
  const d = {
    date:      document.getElementById('siDate').value,
    qty:       parseFloat(document.getElementById('siQty').value) || 0,
    party:     document.getElementById('siParty').value.trim(),
    ratePerKg: parseFloat(document.getElementById('siRate').value) || 0,
    notes:     document.getElementById('siNotes').value.trim()
  };
  if (!d.qty || d.qty <= 0) { toast('Quantity enter karein', 'error'); return; }

  const btn = document.getElementById('btnSI');
  btn.textContent = 'Saving...'; btn.disabled = true;
  const res = await api('addSuthEntry', d);
  btn.textContent = '✅ Save Entry'; btn.disabled = false;

  if (res && res.success) {
    toast(`✅ ${d.qty} kg suth entry saved!`, 'success');
    resetSuthIn();
    refreshData();
  } else {
    toast(res ? res.error : 'API error — Settings mein URL check karein', 'error');
  }
}

function resetSuthIn() {
  ['siQty', 'siParty', 'siRate', 'siNotes', 'siValue'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
}

// ===== SUTH EXIT =====
async function submitSuthOut() {
  const d = {
    date:  document.getElementById('soDate').value,
    qty:   parseFloat(document.getElementById('soQty').value) || 0,
    party: document.getElementById('soParty').value.trim(),
    notes: document.getElementById('soNotes').value.trim()
  };
  if (!d.qty || d.qty <= 0) { toast('Quantity enter karein', 'error'); return; }
  if (d.qty > suthAvailable) {
    toast(`❌ Available suth sirf ${suthAvailable.toFixed(3)} kg hai!`, 'error');
    return;
  }

  const btn = document.getElementById('btnSO');
  btn.textContent = 'Saving...'; btn.disabled = true;
  const res = await api('addSuthExit', d);
  btn.textContent = '🔻 Save Exit'; btn.disabled = false;

  if (res && res.success) {
    toast(`✅ ${d.qty} kg suth exit saved!`, 'success');
    resetSuthOut();
    refreshData();
  } else {
    toast(res ? res.error : 'API error — Settings mein URL check karein', 'error');
  }
}

function resetSuthOut() {
  ['soQty', 'soParty', 'soNotes'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
}

// ===== SUTH CALCULATOR =====
function calcSuth() {
  const m = parseFloat(document.getElementById('scMeters').value) || 0;
  const r = parseFloat(document.getElementById('scRate').value)   || 0;
  const p = parseFloat(document.getElementById('scPrice').value)  || 0;
  const ts = m * r;
  const tc = ts * p;
  const pm = m > 0 ? tc / m : 0;

  setText('scTotalSuth', m > 0 && r > 0 ? ts.toFixed(6) + ' kg' : '—');
  setText('scTotalCost',  p > 0 ? '₹' + fmt(tc) : '—');
  setText('scPerMeter',   p > 0 && m > 0 ? '₹' + pm.toFixed(4) + '/m' : '—');

  // Breakdown table
  if (m > 0 && r > 0) {
    const rows = [];
    for (let i = 100; i < m; i += 100) rows.push(i);
    rows.push(m); // always include the entered value
    document.getElementById('scTable').innerHTML = rows.map(x =>
      `<tr><td><b>${x}m</b></td><td>${(x * r).toFixed(6)}</td><td>${p > 0 ? '₹' + fmt(x * r * p) : '—'}</td></tr>`
    ).join('');
  }
}

// ===== EXPORT =====
function exportSuthPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const co = localStorage.getItem('mt_company') || 'Momin Textile';
  doc.setFontSize(20); doc.setTextColor(201, 168, 76); doc.text(co, 14, 18);
  doc.setFontSize(11); doc.setTextColor(130); doc.text('Suth Ledger — ' + new Date().toLocaleDateString('en-IN'), 14, 27);
  doc.setFontSize(11); doc.setTextColor(46, 192, 139);
  doc.text(`Total In: ${suthTotalIn.toFixed(3)} kg   Out: ${suthTotalOut.toFixed(3)} kg   Available: ${suthAvailable.toFixed(3)} kg`, 14, 36);

  let running = 0;
  const sorted = [...suthRecords].sort((a, b) => a.date.localeCompare(b.date));
  const tableData = sorted.map(r => {
    running += r.type === 'in' ? r.qty : -r.qty;
    return [r.date, r.type === 'in' ? 'Aaya' : 'Gaya', r.qty.toFixed(3), r.party || '—',
      r.ratePerKg > 0 ? '₹' + fmt(r.ratePerKg) : '—', r.totalValue > 0 ? '₹' + fmt(r.totalValue) : '—', running.toFixed(3)];
  }).reverse();

  doc.autoTable({
    startY: 44,
    head: [['Date', 'Type', 'Qty (kg)', 'Party', 'Rate/kg', 'Value', 'Balance (kg)']],
    body: tableData,
    styles: { fontSize: 8.5 },
    headStyles: { fillColor: [13, 27, 42], textColor: [201, 168, 76] },
    alternateRowStyles: { fillColor: [22, 32, 50] }
  });

  doc.save(co.replace(/\s/g, '_') + '_Suth_' + new Date().toISOString().slice(0, 10) + '.pdf');
}

function exportSuthCSV() {
  const rows = [['Date', 'Type', 'Qty (kg)', 'Party/Purpose', 'Rate/kg (₹)', 'Value (₹)', 'Balance (kg)']];
  let running = 0;
  [...suthRecords].sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
    running += r.type === 'in' ? r.qty : -r.qty;
    rows.push([r.date, r.type === 'in' ? 'Aaya' : 'Gaya', r.qty.toFixed(3), r.party || '', r.ratePerKg || '', r.totalValue || '', running.toFixed(3)]);
  });
  const csv = rows.map(r => r.map(v => '"' + v + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'Momin_Suth_Ledger.csv';
  a.click();
}

// ===== NAVIGATION =====
function showPage(pg) {
  document.querySelectorAll('.pg').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bn').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('pg-' + pg);
  if (page) page.style.display = 'block';
  const nav = document.getElementById('nav-' + pg);
  if (nav) nav.classList.add('active');
  const bnav = document.getElementById('bn-' + pg);
  if (bnav) bnav.classList.add('active');
  const titles = { dash: '📊 Dashboard', 'suth-stock': '🧵 Suth Ledger', suth: '🧮 Suth Calculator', settings: '⚙️ Settings' };
  setText('pageTitle', titles[pg] || pg);
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').style.display = 'none';
  }
}

function toggleSB() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  const open = !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  ov.style.display = open ? 'block' : 'none';
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mt_theme', next);
  setText('themeIcon', next === 'dark' ? '🌙' : '☀️');
}

// ===== HELPERS =====
function fmt(n) { return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
function last6() {
  const m = []; const d = new Date();
  for (let i = 5; i >= 0; i--) { const t = new Date(d.getFullYear(), d.getMonth() - i, 1); m.push(t.toISOString().slice(0, 7)); }
  return m;
}
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
