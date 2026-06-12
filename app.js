// ================================================================
// Momin Textile Manager — app.js v2.0
// Features: Password Auth | Meters in Suth | Transaction System
// ================================================================

const DEFAULT_API = 'https://script.google.com/macros/s/AKfycby8voqrQPijw3X257GY2m_7u9pRtrOk02m58_wsbMQ-hDpPsz0rhI_ugOxELhB4bSfV/exec';
let API = '';

// ===== STATE =====
let suthRecords = [], suthTotalIn = 0, suthTotalOut = 0, suthAvailable = 0, suthTotalMeters = 0;
let dhagaRecords = [], dhagaTotalIn = 0, dhagaTotalOut = 0, dhagaAvailable = 0;
let txnRecords = [], txnParties = [];
let charts = {};

// ===== PAGES =====
const PAGES = {
  'dash':        '📊 Dashboard',
  'suth-stock':  '🧵 Suth Ledger',
  'dhaga-stock': '🧶 Dhaga Ledger',
  'hisaab':      '💰 Hisaab (Transactions)',
  'suth':        '🧮 Suth Calculator',
  'settings':    '⚙️ Settings'
};
let currentPage = 'dash';

// ===== INIT =====
window.onload = () => {
  loadSettings();
  const today = new Date().toISOString().split('T')[0];
  ['siDate','soDate','diDate','doDate','txnDate'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = today;
  });
  setInterval(() => {
    const e = document.getElementById('clock');
    if (e) e.textContent = new Date().toLocaleString('en-IN');
  }, 1000);
  showPage('dash');
  checkSession();
  refreshData();
};

// ===== NAVIGATION =====
function showPage(id) {
  document.querySelectorAll('.pg').forEach(p => { p.style.display='none'; p.classList.remove('active'); });
  const pg = document.getElementById('pg-' + id);
  if (pg) { pg.style.display='block'; void pg.offsetWidth; pg.classList.add('active'); }
  const t = document.getElementById('pageTitle');
  if (t) t.textContent = PAGES[id] || id;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sn = document.getElementById('nav-' + id); if (sn) sn.classList.add('active');
  document.querySelectorAll('.bn').forEach(b => b.classList.remove('active'));
  const bn = document.getElementById('bn-' + id); if (bn) bn.classList.add('active');
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  if (sb && window.innerWidth <= 768) { sb.classList.remove('open'); if (ov) ov.style.display='none'; }
  if (id === 'hisaab') renderTransactions();
  history.pushState({ page: id }, '', '#' + id);
  currentPage = id;
}

window.addEventListener('popstate', e => {
  const page = (e.state && e.state.page) || 'dash';
  showPage(page);
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshData(true); });

// ===== AUTH — PASSWORD SYSTEM =====
const SESSION_KEY = 'mt_session';
const SESSION_HOURS = 12;

function checkSession() {
  const s = localStorage.getItem(SESSION_KEY);
  if (s) {
    try {
      const { time } = JSON.parse(s);
      if (Date.now() - time < SESSION_HOURS * 3600000) { unlockApp(); return; }
    } catch(e) {}
  }
  showPasswordScreen();
}

function showPasswordScreen() {
  const logo    = localStorage.getItem('mt_logo');
  const company = localStorage.getItem('mt_company') || 'Momin Textile';
  const el = document.getElementById('pinCompany'); if (el) el.textContent = company;
  const pl = document.getElementById('pinLogo');
  if (pl) pl.innerHTML = logo ? `<img src="${logo}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;">` : '🧵';
  const inp = document.getElementById('passInput');
  if (inp) { inp.value = ''; inp.focus(); }
  const ps = document.getElementById('pinScreen');
  if (ps) { ps.style.display='flex'; ps.style.opacity='1'; }
  const err = document.getElementById('pinErr'); if (err) err.textContent = '';
}

function togglePassVis() {
  const inp = document.getElementById('passInput');
  const btn = document.getElementById('passEye');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text'; if (btn) btn.textContent = '🙈';
  } else {
    inp.type = 'password'; if (btn) btn.textContent = '👁️';
  }
}

function onPassInput(e) {
  const err = document.getElementById('pinErr');
  if (err) err.textContent = '';
  if (e.key === 'Enter') checkPassword();
}

function checkPassword() {
  const inp = document.getElementById('passInput');
  if (!inp) return;
  const entered = inp.value;
  const stored  = localStorage.getItem('mt_pass') || '1234';
  if (entered === stored) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ time: Date.now() }));
    const ps = document.getElementById('pinScreen');
    if (ps) { ps.style.opacity='0'; ps.style.transition='opacity 0.4s'; setTimeout(()=>{ ps.style.display='none'; },400); }
  } else {
    const err = document.getElementById('pinErr');
    if (err) err.textContent = '❌ Wrong password — try again';
    inp.value = ''; inp.focus();
    const box = document.querySelector('.pin-box');
    if (box) {
      const seq = [-10,10,-8,8,0];
      seq.forEach((v,i) => setTimeout(()=>{ box.style.transform=`translateX(${v}px)`; },i*80));
    }
  }
}

function unlockApp() {
  const ps = document.getElementById('pinScreen');
  if (ps) { ps.style.display='none'; }
}

function doLogout() {
  localStorage.removeItem(SESSION_KEY);
  showPasswordScreen();
  toast('Logged out 🔒', 'success');
}

// ===== SETTINGS =====
function loadSettings() {
  API = DEFAULT_API;
  const company = localStorage.getItem('mt_company') || 'Momin Textile';
  const c = document.getElementById('settCompany'); if (c) c.value = company;
  const t = localStorage.getItem('mt_theme') || 'dark';
  if (t === 'light') document.documentElement.setAttribute('data-theme','light');
  applyLogo();
  const sc = document.getElementById('sidebarCompany'); if (sc) sc.textContent = company;
}

async function saveSettings() {
  const company = (document.getElementById('settCompany').value || '').trim() || 'Momin Textile';
  localStorage.setItem('mt_company', company);
  const sc = document.getElementById('sidebarCompany'); if (sc) sc.textContent = company;
  const np = (document.getElementById('settNewPass').value || '').trim();
  const cp = (document.getElementById('settConfPass').value || '').trim();
  if (np) {
    if (np.length < 4) { toast('Password kam se kam 4 characters ka hona chahiye', 'error'); return; }
    if (np !== cp) { toast('Passwords match nahi kiye — dobara check karein', 'error'); return; }
    
    // Update backend
    const btn = document.querySelector('#settings .btn.bd');
    if (btn) { btn.textContent = 'Updating...'; btn.disabled = true; }
    const res = await api('updatePassword', { newPass: np });
    if (btn) { btn.textContent = 'Save Settings'; btn.disabled = false; }
    
    if (res && res.success) {
      localStorage.setItem('mt_pass', np);
      document.getElementById('settNewPass').value = '';
      document.getElementById('settConfPass').value = '';
      toast('Password backend aur mobile par change ho gaya! 🔒', 'success');
    } else {
      toast('Backend par password change nahi hua: ' + (res?.error || 'Unknown Error'), 'error');
      return;
    }
  }
  toast('Settings saved ✅', 'success');
}

// ===== LOGO =====
function applyLogo() {
  const logo = localStorage.getItem('mt_logo');
  const wrap = document.getElementById('sidebarLogoWrap');
  const prev = document.getElementById('logoPreview');
  if (logo) {
    if (wrap) wrap.innerHTML = `<img class="slogo-img" src="${logo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`;
    if (prev) prev.innerHTML = `<img src="${logo}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;">`;
  } else {
    if (wrap) wrap.innerHTML = '🧵';
    if (prev) prev.innerHTML = '🧵';
  }
}

function uploadLogo(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 500000) { toast('Logo 500KB se chota hona chahiye', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    localStorage.setItem('mt_logo', e.target.result);
    applyLogo();
    showPasswordScreen();
    toast('Logo upload ho gaya ✅', 'success');
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  localStorage.removeItem('mt_logo');
  applyLogo();
  toast('Logo remove ho gaya', 'success');
}

// ===== THEME =====
function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mt_theme', next);
  setText('themeIcon', next === 'dark' ? '🌙' : '☀️');
}

// ===== SIDEBAR =====
function toggleSB() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  const open = !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  if (ov) ov.style.display = open ? 'block' : 'none';
}

// ===== API =====
async function api(action, data = {}) {
  const bar = document.getElementById('offlineBar');
  if (!API) { if (bar) bar.style.display='block'; return null; }
  
  // Inject security pass
  data.pass = localStorage.getItem('mt_pass') || '1234';

  try {
    const url = `${API}?action=${action}&data=${encodeURIComponent(JSON.stringify(data))}`;
    const res  = await fetch(url);
    const json = await res.json();
    if (bar) bar.style.display='none';

    if (json && json.error === 'AUTH_FAILED') {
      toast('❌ Security Block: Password galat hai! Settings mein sahi password dalein.', 'error');
      // Kick to login screen if password doesn't match backend
      doLogout();
      return null;
    }

    return json;
  } catch (e) {
    console.error(e);
    if (bar) bar.style.display='block';
    return null;
  }
}

// ===== REFRESH =====
async function refreshData(silent = false) {
  // Load transactions in parallel with records for speed
  const [res, txnRes] = await Promise.all([
    api('getRecords'),
    api('getTransactions')
  ]);
  if (txnRes && txnRes.success) {
    txnRecords = txnRes.data    || [];
    txnParties = txnRes.parties || [];
  }
  // Fake res reference so below code works unchanged
  const _res = res;
  if (_res && _res.success) {
    const res = _res;
    // Parse meters from old records (stored in notes as "12037 Mtr (@0.05874)")
    const parseMtrs = records => records.map(r => {
      if (r.meters === 0 && r.type === 'out' && r.notes) {
        const match = r.notes.match(/([\d.]+)\s*Mtr/i);
        if (match) r.meters = parseFloat(match[1]) || 0;
      }
      return r;
    });

    suthRecords     = parseMtrs(res.suth.data || []);
    suthTotalIn     = res.suth.totalIn    || 0;
    suthTotalOut    = res.suth.totalOut   || 0;
    suthAvailable   = res.suth.available  || 0;
    // Recalculate totalMeters including parsed old records
    suthTotalMeters = suthRecords.filter(r => r.type === 'out').reduce((s, r) => s + (r.meters || 0), 0);

    dhagaRecords    = res.dhaga.data      || [];
    dhagaTotalIn    = res.dhaga.totalIn   || 0;
    dhagaTotalOut   = res.dhaga.totalOut  || 0;
    dhagaAvailable  = res.dhaga.available || 0;

    localStorage.setItem('mt_cache', JSON.stringify(res));
  }
  renderDash();
  renderSuthLedger();
  renderDhagaLedger();
  updateAvailInfo();
  // Re-render Hisaab if visible
  if (currentPage === 'hisaab') renderTransactions();
}

// ===== DASHBOARD =====
function renderDash() {
  setText('dIn',      suthTotalIn.toFixed(3)    + ' kg');
  setText('dOut',     suthTotalOut.toFixed(3)   + ' kg');
  setText('dAvail',   suthAvailable.toFixed(3)  + ' kg');
  setText('dMeters',  suthTotalMeters.toFixed(1) + ' m');

  setText('ddIn',    dhagaTotalIn.toFixed(0)   + ' Bndl');
  setText('ddOut',   dhagaTotalOut.toFixed(0)  + ' Bndl');
  setText('ddAvail', dhagaAvailable.toFixed(0) + ' Bndl');

  buildSuthChart();
  buildDhagaChart();
  buildFeed();
}

function buildSuthChart() {
  const ctx = document.getElementById('cPie'); if (!ctx) return;
  if (charts.suth) { charts.suth.destroy(); }
  const hasData = suthTotalIn > 0 || suthTotalOut > 0;
  const dataArr = hasData ? [suthTotalIn, suthTotalOut, suthAvailable] : [1,0,1];
  const colors  = hasData
    ? ['#3498db','#e05260','#c9a84c']
    : ['rgba(52,152,219,.12)','rgba(224,82,96,.12)','rgba(201,168,76,.12)'];
  charts.suth = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Total Aaya (In)','Total Gaya (Out)','Baaki (Avail)'], datasets:[{ data:dataArr, backgroundColor:colors, borderWidth:0, hoverOffset:8 }] },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'67%',
      plugins:{
        legend:{ position:'bottom', labels:{ color:'#8a9bb5', padding:16, font:{size:11} } },
        tooltip:{ callbacks:{ label:(c)=> hasData ? ` ${c.label}: ${c.raw.toFixed(3)} kg` : ' No Data' } }
      }
    }
  });
}

function buildDhagaChart() {
  const ctx = document.getElementById('dPie'); if (!ctx) return;
  if (charts.dhaga) { charts.dhaga.destroy(); }
  const hasData = dhagaTotalIn > 0 || dhagaTotalOut > 0;
  const dataArr = hasData ? [dhagaTotalIn, dhagaTotalOut, dhagaAvailable] : [1,0,1];
  const colors  = hasData
    ? ['#2ec08b','#e05260','#c9a84c']
    : ['rgba(46,192,139,.12)','rgba(224,82,96,.12)','rgba(201,168,76,.12)'];
  charts.dhaga = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Total Aaya (In)','Total Gaya (Out)','Baaki (Avail)'], datasets:[{ data:dataArr, backgroundColor:colors, borderWidth:0, hoverOffset:8 }] },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'67%',
      plugins:{
        legend:{ position:'bottom', labels:{ color:'#8a9bb5', padding:16, font:{size:11} } },
        tooltip:{ callbacks:{ label:(c)=> hasData ? ` ${c.label}: ${c.raw.toFixed(0)} Bundle` : ' No Data' } }
      }
    }
  });
}

function buildFeed() {
  const tbody = document.getElementById('feed');
  if (!tbody) return;
  const all = [
    ...suthRecords.map(r  => ({...r, _item:'🧵 Suth',  qFmt: r.qty.toFixed(3)+' kg' + (r.type === 'out' && r.meters > 0 ? `<br><small style="color:var(--gold)">${r.meters.toFixed(1)} m</small>` : '')})),
    ...dhagaRecords.map(r => ({...r, _item:'🧶 Dhaga', qFmt: r.qty.toFixed(0)+' Bndl'}))
  ];
  all.sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const sorted = all.slice(0, 10);
  if (!sorted.length) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--tm)">No data yet</td></tr>'; return; }
  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td style="color:var(--tm);font-size:12px">${r.date}</td>
      <td>${r._item}</td>
      <td><span class="badge ${r.type==='in'?'bg':'br'}">${r.type==='in'?'⬆️ Aaya':'⬇️ Gaya'}</span></td>
      <td><b>${r.qFmt}</b></td>
      <td style="color:var(--tm)">${r.party||'—'}</td>
      <td>${r.totalValue > 0 ? '<b style="color:var(--tx)">₹' + fmt(r.totalValue) + '</b>' : '<span style="color:var(--tm)">—</span>'}</td>
    </tr>`).join('');
}

// ===== SUTH LEDGER =====
function renderSuthLedger() {
  setText('ssIn',     suthTotalIn.toFixed(3)    + ' kg');
  setText('ssOut',    suthTotalOut.toFixed(3)   + ' kg');
  setText('ssAvail',  suthAvailable.toFixed(3)  + ' kg');
  setText('ssMeters', suthTotalMeters.toFixed(1) + ' m');

  const tbody = document.getElementById('suthTable');
  if (!tbody) return;
  if (!suthRecords.length) {
    tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--tm)">Koi record nahi — pehle entry karein</td></tr>';
    return;
  }
  let running = 0;
  const sorted = [...suthRecords].sort((a,b) => a.date.localeCompare(b.date));
  const rows = sorted.map(r => {
    running += r.type==='in' ? r.qty : -r.qty;
    const meterStr = r.type==='out' && r.meters > 0 ? `<b>${r.meters.toFixed(1)} m</b>` : '—';
    return `<tr>
      <td style="white-space:nowrap">${r.date}</td>
      <td><span class="badge ${r.type==='in'?'bg':'br'}">${r.type==='in'?'⬆️ Aaya':'⬇️ Gaya'}</span></td>
      <td>${meterStr}</td>
      <td><b>${r.qty.toFixed(3)} kg</b></td>
      <td>${r.party||'—'}</td>
      <td>${r.ratePerKg>0?'₹'+fmt(r.ratePerKg) + (r.type==='out'?' <small style="color:var(--tm)">/m</small>':' <small style="color:var(--tm)">/kg</small>'):'—'}</td>
      <td>${r.totalValue>0?'<b>₹'+fmt(r.totalValue)+'</b>':'—'}</td>
      <td><b style="color:${running>=0?'var(--suc)':'var(--dan)'}">${running.toFixed(3)} kg</b></td>
      <td><button onclick="showDeleteModal('${r.id}','${r.qty.toFixed(3)} kg','${r.type}')" class="del-btn">🗑</button></td>
    </tr>`;
  });
  tbody.innerHTML = rows.reverse().join('');
}

// ===== SUTH ENTRY =====
async function submitSuthIn() {
  const d = {
    date:  document.getElementById('siDate').value,
    qty:   parseFloat(document.getElementById('siQty').value) || 0,
    party: document.getElementById('siParty').value.trim(),
    notes: document.getElementById('siNotes').value.trim()
  };
  if (!d.date) { toast('Date zaroor dalein', 'error'); return; }
  if (!d.qty || d.qty <= 0) { toast('Quantity enter karein', 'error'); return; }
  const btn = document.getElementById('btnSI');
  btn.textContent='Saving...'; btn.disabled=true;
  const res = await api('addRecord', { ...d, item:'Suth', type:'in' });
  btn.textContent='✅ Save Entry'; btn.disabled=false;
  if (res && res.success) {
    toast(`✅ ${d.qty} kg suth aaya — saved!`, 'success');
    ['siQty','siParty','siNotes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    refreshData();
  } else toast(res?.error || 'API error', 'error');
}

// ===== SUTH EXIT (METER-BASED) =====
function calcSuthExit() {
  const m  = parseFloat(document.getElementById('soMeters').value)    || 0;
  const rm = parseFloat(document.getElementById('soRatePerM').value)   || 0;
  const rk = parseFloat(document.getElementById('soRate').value)       || 0; // rk is now Rate per Miter
  const totalKg = m * rm;
  const soQty = document.getElementById('soQty');
  if (soQty) soQty.value = totalKg > 0 ? totalKg.toFixed(3) : '';
  const soVal = document.getElementById('soValue');
  // Total Value calculation updated to (Meters * Rate) instead of (KG * Rate)
  const totalVal = m * rk;
  if (soVal) soVal.value = totalVal > 0 ? '₹' + fmt(totalVal) : '';
}

async function submitSuthOut() {
  const meters = parseFloat(document.getElementById('soMeters').value)    || 0;
  const rm     = parseFloat(document.getElementById('soRatePerM').value)   || 0;
  const qty    = parseFloat(document.getElementById('soQty').value)        || 0;
  if (!qty || qty <= 0) { toast('Suth ki Quantity (KG) dalein', 'error'); return; }
  if (qty > suthAvailable) {
    toast(`❌ Available suth sirf ${suthAvailable.toFixed(3)} kg hai!`, 'error'); return;
  }
  const d = {
    date:      document.getElementById('soDate').value,
    qty:       qty,
    meters:    meters,
    party:     document.getElementById('soParty').value.trim(),
    ratePerKg: parseFloat(document.getElementById('soRate').value) || 0,
    notes:     document.getElementById('soNotes').value.trim()
  };
  const btn = document.getElementById('btnSO');
  btn.textContent='Saving...'; btn.disabled=true;
  const res = await api('addRecord', { ...d, item:'Suth', type:'out' });
  btn.textContent='🔻 Save Exit'; btn.disabled=false;
  if (res && res.success) {
    toast(`✅ ${qty.toFixed(3)} kg suth gaya (${meters} m) — saved!`, 'success');
    ['soQty','soParty','soRate','soNotes','soValue','soMeters','soRatePerM'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    refreshData();
  } else toast(res?.error || 'API error', 'error');
}

// ===== DHAGA LEDGER =====
function renderDhagaLedger() {
  setText('dsIn',    dhagaTotalIn.toFixed(0)   + ' Bndl');
  setText('dsOut',   dhagaTotalOut.toFixed(0)  + ' Bndl');
  setText('dsAvail', dhagaAvailable.toFixed(0) + ' Bndl');

  const tbody = document.getElementById('dhagaTable');
  if (!tbody) return;
  if (!dhagaRecords.length) {
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--tm)">No records yet</td></tr>';
    return;
  }
  let running = 0;
  const sorted = [...dhagaRecords].sort((a,b) => a.date.localeCompare(b.date));
  const rows = sorted.map(r => {
    running += r.type==='in' ? r.qty : -r.qty;
    return `<tr>
      <td style="white-space:nowrap">${r.date}</td>
      <td><span class="badge ${r.type==='in'?'bg':'br'}">${r.type==='in'?'⬆️ Aaya':'⬇️ Gaya'}</span></td>
      <td><b>${r.qty.toFixed(0)} Bndl</b></td>
      <td>${r.party||'—'}</td>
      <td>${r.totalValue>0?'₹'+fmt(r.totalValue):'—'}</td>
      <td><b style="color:${running>=0?'var(--suc)':'var(--dan)'}">${running.toFixed(0)} Bndl</b></td>
      <td><button onclick="showDeleteDhagaModal('${r.id}','${r.qty.toFixed(0)} Bundle','${r.type}')" class="del-btn">🗑</button></td>
    </tr>`;
  });
  tbody.innerHTML = rows.reverse().join('');
}

// ===== DHAGA ENTRY =====
async function submitDhagaIn() {
  const d = {
    date:  document.getElementById('diDate').value,
    qty:   parseFloat(document.getElementById('diQty').value) || 0,
    party: document.getElementById('diParty').value.trim(),
    notes: document.getElementById('diNotes').value.trim()
  };
  if (!d.qty || d.qty <= 0) { toast('Quantity enter karein', 'error'); return; }
  const btn = document.getElementById('btnDI');
  btn.textContent='Saving...'; btn.disabled=true;
  const res = await api('addRecord', { ...d, item:'Dhaga', type:'in' });
  btn.textContent='✅ Save Entry'; btn.disabled=false;
  if (res && res.success) {
    toast(`✅ ${d.qty} bundle aaya — saved!`, 'success');
    ['diQty','diParty','diNotes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    refreshData();
  } else toast(res?.error || 'API error', 'error');
}

// ===== DHAGA EXIT =====
async function submitDhagaOut() {
  const d = {
    date:      document.getElementById('doDate').value,
    qty:       parseFloat(document.getElementById('doQty').value) || 0,
    party:     document.getElementById('doParty').value.trim(),
    ratePerKg: parseFloat(document.getElementById('doRate').value) || 0,
    notes:     document.getElementById('doNotes').value.trim()
  };
  if (!d.date) { toast('Date zaroor dalein', 'error'); return; }
  if (!d.qty || d.qty <= 0) { toast('Quantity enter karein', 'error'); return; }
  if (d.qty > dhagaAvailable) {
    toast(`❌ Available dhaga sirf ${dhagaAvailable.toFixed(0)} Bundle hai!`, 'error'); return;
  }
  const btn = document.getElementById('btnDO');
  btn.textContent='Saving...'; btn.disabled=true;
  const res = await api('addRecord', { ...d, item:'Dhaga', type:'out' });
  btn.textContent='🔻 Save Exit'; btn.disabled=false;
  if (res && res.success) {
    toast(`✅ ${d.qty} bundle dhaga gaya — saved!`, 'success');
    ['doQty','doParty','doRate','doNotes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    refreshData();
  } else toast(res?.error || 'API error', 'error');
}

// ===== AVAILABLE INFO =====
function updateAvailInfo() {
  const el = document.getElementById('soAvailInfo');
  if (el) el.textContent = `🧵 Available: ${suthAvailable.toFixed(3)} kg (${suthTotalMeters.toFixed(1)} m produced total)`;
  const doEl = document.getElementById('doAvailInfo');
  if (doEl) doEl.textContent = `🧶 Available: ${dhagaAvailable.toFixed(0)} Bundle`;
}

// ===== TRANSACTION SYSTEM =====
async function submitTransaction() {
  const d = {
    date:   document.getElementById('txnDate').value,
    party:  document.getElementById('txnParty').value.trim(),
    amount: parseFloat(document.getElementById('txnAmount').value) || 0,
    type:   document.getElementById('txnType').value,
    notes:  document.getElementById('txnNotes').value.trim()
  };
  if (!d.party) { toast('Party ka naam dalein', 'error'); return; }
  if (!d.amount || d.amount <= 0) { toast('Amount dalein', 'error'); return; }

  const btn = document.getElementById('btnTxn');
  btn.textContent='Saving...'; btn.disabled=true;
  const res = await api('addTransaction', d);
  btn.textContent='💾 Save'; btn.disabled=false;

  if (res && res.success) {
    toast(`✅ ₹${fmt(d.amount)} ${d.type === 'received' ? 'aaya' : 'diya'} — saved!`, 'success');
    ['txnParty','txnAmount','txnNotes'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    // Fast local update — no extra API call
    const newTxn = { id: res.id || 'TXN-'+Date.now(), ...d };
    txnRecords.unshift(newTxn);
    // Rebuild parties from local data
    rebuildParties();
    renderTransactions();
  } else toast(res?.error || 'API error', 'error');
}

function rebuildParties() {
  const map = {};
  txnRecords.forEach(t => {
    const k = t.party.toLowerCase().trim();
    if (!map[k]) map[k] = { party: t.party, received: 0, paid: 0 };
    if (t.type === 'received') map[k].received += t.amount;
    else                       map[k].paid     += t.amount;
  });
  txnParties = Object.values(map).map(p => ({ ...p, balance: p.received - p.paid }));
}

function renderTransactions() {
  // ---- OVERALL CASH AVAILABLE ----
  const sumCard = document.getElementById('hisaabSummaryCard');
  const sumVal  = document.getElementById('hisaabTotalAvailable');
  if (sumCard && sumVal) {
    let totRec = 0, totPaid = 0;
    txnRecords.forEach(t => { if(t.type==='received') totRec+=t.amount; else totPaid+=t.amount; });
    const totAvail = totRec - totPaid;
    
    // Only show if there's any transaction
    if (txnRecords.length > 0) {
      sumCard.style.display = 'block';
      sumVal.textContent = '₹' + fmt(totAvail);
      sumVal.style.color = totAvail >= 0 ? 'var(--suc)' : 'var(--dan)';
      if (totAvail < 0) {
        sumVal.textContent = '-₹' + fmt(Math.abs(totAvail)) + ' (Udhaar)';
      }
    } else {
      sumCard.style.display = 'none';
    }
  }

  // ---- PARTY CARDS ----
  const partySection = document.getElementById('partyCards');
  if (partySection) {
    if (!txnParties.length) {
      partySection.innerHTML = '<div style="text-align:center;padding:24px;color:var(--tm)">Koi party nahi — pehle hisaab add karein</div>';
    } else {
      const sorted = [...txnParties].sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance));
      partySection.innerHTML = sorted.map(p => {
        const bal = p.balance;
        const isPositive = bal >= 0; // Received > Paid → Unke paas hamara paisa hai (ya settle hai)
        const balLabel = bal > 0
          ? `🟡 Apne paas jama (Advance): ₹${fmt(bal)}`
          : bal < 0
            ? `🔴 Hamne diya: ₹${fmt(Math.abs(bal))}`
            : `✅ Hisaab saaf!`;
        const balColor = bal > 0 ? 'var(--suc)' : bal < 0 ? 'var(--dan)' : 'var(--tm)';
        return `
        <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:12px;padding:16px 18px;margin-bottom:10px;transition:.2s" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--brd)'">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--tx)">${p.party}</div>
              <div style="font-size:12px;color:var(--tm);margin-top:3px">
                <span style="color:var(--suc)">⬆️ Aaya ₹${fmt(p.received)}</span>
                &nbsp;•&nbsp;
                <span style="color:var(--dan)">⬇️ Diya ₹${fmt(p.paid)}</span>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:18px;font-weight:800;color:${balColor}">${bal > 0 ? '+' : bal < 0 ? '-' : ''}₹${fmt(Math.abs(bal))}</div>
              <div style="font-size:11px;color:${balColor};margin-top:2px">${balLabel}</div>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // ---- TRANSACTION LIST ----
  const txTable = document.getElementById('txnTable');
  if (txTable) {
    if (!txnRecords.length) {
      txTable.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--tm)">No transactions yet</td></tr>';
    } else {
      txTable.innerHTML = txnRecords.map(t => `
        <tr>
          <td style="white-space:nowrap;color:var(--tm);font-size:12px">${t.date}</td>
          <td><b>${t.party}</b></td>
          <td><span class="badge ${t.type==='received'?'bg':'br'}">${t.type==='received'?'⬆️ Aaya':'⬇️ Diya'}</span></td>
          <td><b style="color:${t.type==='received'?'var(--suc)':'var(--dan)'}">${t.type==='received'?'+':'-'}₹${fmt(t.amount)}</b></td>
          <td style="color:var(--tm)">${t.notes||'—'}</td>
          <td><button onclick="deleteTxn('${t.id}')" class="del-btn">🗑</button></td>
        </tr>`).join('');
    }
  }
}

async function deleteTxn(id) {
  const modal = document.getElementById('deleteModal');
  document.getElementById('delModalTitle').textContent = '💰 Transaction delete karein?';
  document.getElementById('delModalDetail').textContent = 'Ye hisaab Google Sheet se bhi hata diya jaayega!';
  modal.style.display = 'flex';
  document.getElementById('delConfirmBtn').onclick = async () => {
    const btn = document.getElementById('delConfirmBtn');
    btn.innerHTML = '⏳ Deleting...'; btn.disabled = true;
    const res = await api('deleteTransaction', { id });
    btn.innerHTML = '🗑 Delete'; btn.disabled = false;
    modal.style.display = 'none';
    if (res && res.success) {
      toast('✅ Hisaab delete ho gaya!', 'success');
      txnRecords = txnRecords.filter(t => t.id !== id);
      rebuildParties();
      renderTransactions();
    } else toast(res?.error || 'Delete nahi hua', 'error');
  };
  document.getElementById('delCancelBtn').onclick = () => { modal.style.display = 'none'; };
}

// ===== DELETE MODALS =====
function showDeleteModal(id, qtyLabel, type) {
  const modal = document.getElementById('deleteModal');
  document.getElementById('delModalTitle').textContent = (type==='in'?'⬆️ Entry':'⬇️ Exit') + ' delete karein?';
  document.getElementById('delModalDetail').textContent = 'Qty: ' + qtyLabel + ' — Google Sheet se bhi hatega!';
  modal.style.display='flex';
  document.getElementById('delConfirmBtn').onclick = async () => {
    const btn = document.getElementById('delConfirmBtn');
    btn.innerHTML='⏳ Deleting...'; btn.disabled=true;
    const res = await api('deleteRecord', { id });
    btn.innerHTML='🗑 Delete'; btn.disabled=false;
    modal.style.display='none';
    if (res && res.success) { toast('✅ Record delete ho gaya!','success'); refreshData(); }
    else toast(res?.error || 'Delete nahi hua','error');
  };
  document.getElementById('delCancelBtn').onclick = () => { modal.style.display='none'; };
}

function showDeleteDhagaModal(id, qtyLabel, type) {
  showDeleteModal(id, qtyLabel, type);
}

// ===== SUTH CALCULATOR =====
function calcSuth() {
  const m = parseFloat(document.getElementById('scMeters').value) || 0;
  const r = parseFloat(document.getElementById('scRate').value)   || 0;
  const p = parseFloat(document.getElementById('scPrice').value)  || 0;
  const ts = m * r;
  const tc = ts * p;
  const pm = m > 0 ? tc / m : 0;
  setText('scTotalSuth', m>0&&r>0 ? ts.toFixed(6)+' kg' : '—');
  setText('scTotalCost',  p>0     ? '₹'+fmt(tc) : '—');
  setText('scPerMeter',   p>0&&m>0? '₹'+pm.toFixed(4)+'/m' : '—');
  if (m>0 && r>0) {
    const rows=[];
    for (let i=100; i<m; i+=100) rows.push(i);
    rows.push(m);
    document.getElementById('scTable').innerHTML = rows.map(x =>
      `<tr><td><b>${x}m</b></td><td>${(x*r).toFixed(6)}</td><td>${p>0?'₹'+fmt(x*r*p):'—'}</td></tr>`
    ).join('');
  }
}

// ===== EXPORT =====
function exportSuthPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const co = localStorage.getItem('mt_company') || 'Momin Textile';
  doc.setFontSize(20); doc.setTextColor(201,168,76); doc.text(co,14,18);
  doc.setFontSize(11); doc.setTextColor(130); doc.text('Suth Ledger — '+new Date().toLocaleDateString('en-IN'),14,27);
  doc.setFontSize(10); doc.setTextColor(46,192,139);
  doc.text(`In: ${suthTotalIn.toFixed(3)} kg | Out: ${suthTotalOut.toFixed(3)} kg | Avail: ${suthAvailable.toFixed(3)} kg | Meters: ${suthTotalMeters.toFixed(1)} m`,14,36);
  let running=0;
  const sorted=[...suthRecords].sort((a,b)=>a.date.localeCompare(b.date));
  const tableData=sorted.map(r=>{
    running += r.type==='in' ? r.qty : -r.qty;
    return [r.date, r.type==='in'?'Aaya':'Gaya', r.meters>0?r.meters.toFixed(1)+'m':'—', r.qty.toFixed(3), r.party||'—', r.ratePerKg>0?'₹'+fmt(r.ratePerKg):'—', r.totalValue>0?'₹'+fmt(r.totalValue):'—', running.toFixed(3)];
  }).reverse();
  doc.autoTable({ startY:44, head:[['Date','Type','Meters','Qty(kg)','Party','Rate/kg','Value','Balance(kg)']], body:tableData, styles:{fontSize:8}, headStyles:{fillColor:[13,27,42],textColor:[201,168,76]}, alternateRowStyles:{fillColor:[22,32,50]} });
  doc.save(co.replace(/\s/g,'_')+'_Suth_'+new Date().toISOString().slice(0,10)+'.pdf');
}

function exportSuthCSV() {
  const rows=[['Date','Type','Meters','Qty(kg)','Party','Rate/kg','Value','Balance(kg)']];
  let running=0;
  [...suthRecords].sort((a,b)=>a.date.localeCompare(b.date)).forEach(r=>{
    running += r.type==='in'?r.qty:-r.qty;
    rows.push([r.date,r.type==='in'?'Aaya':'Gaya',r.meters||0,r.qty.toFixed(3),r.party||'',r.ratePerKg||'',r.totalValue||'',running.toFixed(3)]);
  });
  const csv=rows.map(r=>r.map(v=>'"'+v+'"').join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='Momin_Suth_Ledger.csv'; a.click();
}

// ===== HELPERS =====
function fmt(n) { return Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2}); }
function setText(id,v) { const e=document.getElementById(id); if(e) e.textContent=v; }
function toast(msg, type='success') {
  const el=document.createElement('div');
  el.className='toast '+type; el.textContent=msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(()=>el.remove(),3500);
}
