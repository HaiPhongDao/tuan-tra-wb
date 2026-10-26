/**
 * Tuần tra West Bay: nhận báo cáo từ trang nhân viên và tính trạng thái cho trang trưởng ca.
 * Dán toàn bộ file này vào Apps Script gắn với một Google Sheet, chạy khoiTao() một lần, rồi Triển khai > Ứng dụng web.
 */
const TZ_OFFSET_H = 7; // Việt Nam, không có giờ mùa hè
const SHEET_NV = 'NhanVien';
const SHEET_LOG = 'NhatKy';
const SHEET_CFG = 'CauHinh';
const SHEET_PT = 'DiemQuet';
const AREAS = ["BỂ BƠI WEST BAY", "Tùy chọn 2", "MẶT SAU THÁP A WB", "BÃI XE HẦM THÁP B WB", "MẶT SAU THÁP B WB", "LỐI VÀO HẦM CLB WB", "BÃI XE HẦM C WB", "BÃI XE HẦM D WB", "MẶT SAU THÁP C WB", "LỐI VÀO TẦNG 01 NHÀ XE AB WB", "TẦNG MÁI NHÀ XE AB", "LỐI RA TẦNG 01 NHÀ XE AB WB", "LỐI VÀO TẦNG 01 NHÀ XE CD WB", "TẦNG MÁI NHÀ XE CD", "LỐI RA TẦNG 01 NHÀ XE CD", "TẦNG 12 THÁP A", "TẦNG MÁI THÁP A", "TẦNG 12 THÁP B", "TẦNG MÁI THÁP B", "TẦNG 12 THÁP C", "TẦNG MÁI THÁP C", "TẦNG 12 THÁP D", "TẦNG MÁI THÁP D"];

const CFG_DEFAULTS = [
  ['adminKey', '', 'Mã của trưởng ca để mở trang giám sát. Tự tạo khi chạy khoiTao().'],
  ['gapMin', 90, 'Phút giữa hai vòng tuần tra'],
  ['tolMin', 10, 'Dung sai (phút) trước khi báo đỏ quá giờ vòng kế tiếp'],
  ['startGraceMin', 30, 'Sau đầu ca bao nhiêu phút mà chưa có tín hiệu thì báo đỏ'],
  ['roundGraceMin', 30, 'Một vòng bắt đầu bao nhiêu phút mà còn thiếu điểm thì báo đỏ'],
  ['minRounds', 6, 'Số vòng tối thiểu mỗi ca'],
  ['dayStartHour', 6, 'Giờ bắt đầu Ca Ngày'],
  ['nightStartHour', 18, 'Giờ bắt đầu Ca Đêm'],
  ['email', '', 'Email nhận cảnh báo đỏ. Để trống thì dùng email của chủ Sheet.'],
  ['requireQr', 0, '1 = chỉ nhận lần chạm có quét đúng mã QR của điểm. 0 = cho phép chạm tay']
];

/* ---------- Cài đặt lần đầu ---------- */
function khoiTao() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let nv = ss.getSheetByName(SHEET_NV) || ss.insertSheet(SHEET_NV);
  if (nv.getLastRow() === 0) {
    nv.appendRow(['id', 'ten', 'ma', 'ca_truc', 'hoat_dong']);
    nv.appendRow(['A01', 'Nguyễn Văn A (mẫu, sửa hoặc xoá)', randKey_(), 'Ngày', 'x']);
    nv.setFrozenRows(1);
  }
  let lg = ss.getSheetByName(SHEET_LOG) || ss.insertSheet(SHEET_LOG);
  if (lg.getLastRow() === 0) {
    lg.appendRow(['id', 'gio_may_chu', 'gio_may_nv', 'uid', 'ten', 'ca', 'vong', 'khu_vuc', 'thu', 'huy', 'tuyen', 'loai_tuan', 'qua']);
    lg.setFrozenRows(1);
  }
  let cf = ss.getSheetByName(SHEET_CFG) || ss.insertSheet(SHEET_CFG);
  if (cf.getLastRow() === 0) {
    cf.appendRow(['khoa', 'gia_tri', 'ghi_chu']);
    CFG_DEFAULTS.forEach(r => cf.appendRow(r));
  }
  const cur = cfgMap_();
  if (!cur.adminKey) setCfg_('adminKey', randKey_());
  const s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  SpreadsheetApp.getUi().alert('Xong. Mở trang CauHinh để lấy adminKey, trang NhanVien để quản lý nhân viên và ca trực.');
}

function caiTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'kiemTra').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('kiemTra').timeBased().everyMinutes(10).create();
}

/* Bảng DiemQuet: mỗi điểm một mã bí mật in trong QR. Tự tạo khi cần. */
function ensurePoints_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_PT);
  if (!sh) { sh = ss.insertSheet(SHEET_PT); sh.appendRow(['stt', 'khu_vuc', 'ma']); sh.setFrozenRows(1); }
  const have = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues() : [];
  const map = {};
  have.forEach(r => { map[String(r[0])] = { area: String(r[1]), token: String(r[2]) }; });
  const add = [];
  AREAS.forEach((a, i) => { if (!map[String(i)]) { const t = randKey_().slice(0, 8); add.push([i, a, t]); map[String(i)] = { area: a, token: t }; } });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 3).setValues(add);
  return AREAS.map((a, i) => ({ i, area: a, token: map[String(i)].token }));
}

/* ---------- API ---------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'ping') return out_({ ok: true });
    if (p.action === 'tap') return out_(actTap_(p));
    if (p.action === 'cancel') return out_(actCancel_(p));
    if (p.action === 'dash') return out_(actDash_(p));
    if (p.action === 'staffSet') return out_(actStaffSet_(p));
    if (p.action === 'staffKey') return out_(actStaffKey_(p));
    if (p.action === 'staffDel') return out_(actStaffDel_(p));
    if (p.action === 'cfgSet') return out_(actCfgSet_(p));
    if (p.action === 'pointsList') return out_(actPointsList_(p));
    if (p.action === 'pointRotate') return out_(actPointRotate_(p));
    return out_({ ok: false, err: 'action' });
  } catch (err) {
    return out_({ ok: false, err: 'server', msg: String(err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function actTap_(p) {
  const nv = findStaff_(p.u, p.k);
  if (!nv) return { ok: false, err: 'key' };
  const id = String(p.id || '');
  if (!id) return { ok: false, err: 'id' };
  let via = 'tay', area = p.area || '';
  if (p.a !== undefined && p.a !== '' && p.qt) {
    const pt = ensurePoints_()[Number(p.a)];
    if (!pt || pt.token !== String(p.qt)) return { ok: false, err: 'qrbad' };
    via = 'qr'; area = pt.area;
  }
  if (via !== 'qr' && Number(cfgMap_().requireQr) === 1) return { ok: false, err: 'qr' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
    const n = sh.getLastRow();
    if (n > 1) {
      const from = Math.max(2, n - 300);
      const ids = sh.getRange(from, 1, n - from + 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return { ok: false, err: 'dup' };
    }
    sh.appendRow([id, new Date(), Number(p.t) || '', nv.id, nv.ten, p.shift || '', Number(p.round) || 1, area, '', '', p.route || '', p.lane === 'loi' ? 'loi' : 'ham', via]);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function actCancel_(p) {
  const nv = findStaff_(p.u, p.k);
  if (!nv) return { ok: false, err: 'key' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
    const n = sh.getLastRow();
    if (n < 2) return { ok: false, err: 'missing' };
    const from = Math.max(2, n - 500);
    const vals = sh.getRange(from, 1, n - from + 1, 4).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) === String(p.id) && String(vals[i][3]) === nv.id) {
        sh.getRange(from + i, 10).setValue('x');
        return { ok: true };
      }
    }
  } finally { lock.releaseLock(); }
  return { ok: false, err: 'missing' };
}

function adminOk_(p) {
  const c = cfgMap_();
  return !!c.adminKey && p.ak === String(c.adminKey);
}

function actDash_(p) {
  if (!adminOk_(p)) return { ok: false, err: 'admin' };
  const c = cfgMap_();
  const cfg = {};
  EDITABLE_CFG.forEach(k => { cfg[k] = c[k]; });
  return Object.assign({ ok: true }, dashboard_(Date.now(), true), { roster: staffList_(), cfgAll: cfg });
}

const EDITABLE_CFG = ['gapMin', 'tolMin', 'startGraceMin', 'roundGraceMin', 'minRounds', 'dayStartHour', 'nightStartHour', 'email', 'requireQr'];
const CA_VALUES = ['Ngày', 'Đêm', 'Cả hai', 'Nghỉ', ''];

function staffRowIndex_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NV);
  const n = sh.getLastRow();
  if (n < 2) return { sh, row: 0 };
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === id) return { sh, row: i + 2 };
  return { sh, row: 0 };
}

function actStaffSet_(p) {
  if (!adminOk_(p)) return { ok: false, err: 'admin' };
  const id = String(p.id || '').trim();
  const ten = String(p.ten || '').trim();
  const ca = String(p.ca === undefined ? '' : p.ca).trim();
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) return { ok: false, err: 'id', msg: 'Mã nhân viên chỉ gồm chữ không dấu, số, gạch, tối đa 20 ký tự' };
  if (!ten || ten.length > 60) return { ok: false, err: 'ten', msg: 'Tên không được trống, tối đa 60 ký tự' };
  if (CA_VALUES.indexOf(ca) < 0) return { ok: false, err: 'ca' };
  const on = p.on === '0' ? '' : 'x';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const f = staffRowIndex_(id);
    if (f.row) {
      f.sh.getRange(f.row, 2).setValue(ten);
      f.sh.getRange(f.row, 4).setValue(ca);
      f.sh.getRange(f.row, 5).setValue(on);
    } else {
      f.sh.appendRow([id, ten, randKey_(), ca, on]);
    }
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function actStaffKey_(p) {
  if (!adminOk_(p)) return { ok: false, err: 'admin' };
  const f = staffRowIndex_(String(p.id || '').trim());
  if (!f.row) return { ok: false, err: 'missing' };
  f.sh.getRange(f.row, 3).setValue(randKey_());
  return { ok: true };
}

function actStaffDel_(p) {
  if (!adminOk_(p)) return { ok: false, err: 'admin' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const f = staffRowIndex_(String(p.id || '').trim());
    if (!f.row) return { ok: false, err: 'missing' };
    f.sh.deleteRow(f.row);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function actPointsList_(p) {
  if (!adminOk_(p)) return { ok: false, err: 'admin' };
  return { ok: true, points: ensurePoints_() };
}

function actPointRotate_(p) {
  if (!adminOk_(p)) return { ok: false, err: 'admin' };
  const i = Number(p.i);
  if (!isFinite(i) || i < 0 || i >= AREAS.length) return { ok: false, err: 'i' };
  ensurePoints_();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PT);
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (let r = 0; r < vals.length; r++) if (String(vals[r][0]) === String(i)) { sh.getRange(r + 2, 3).setValue(randKey_().slice(0, 8)); return { ok: true }; }
  return { ok: false, err: 'missing' };
}

function actCfgSet_(p) {
  if (!adminOk_(p)) return { ok: false, err: 'admin' };
  const k = String(p.key || '');
  if (EDITABLE_CFG.indexOf(k) < 0) return { ok: false, err: 'key' };
  let v = String(p.value === undefined ? '' : p.value).trim();
  if (k !== 'email') {
    const n = Number(v);
    if (!isFinite(n) || n < 0 || n > 1000) return { ok: false, err: 'value' };
    v = n;
  }
  setCfg_(k, v);
  return { ok: true };
}

/* ---------- Dữ liệu ---------- */
function randKey_() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function cfgMap_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CFG);
  const o = {};
  CFG_DEFAULTS.forEach(r => { o[r[0]] = r[1]; });
  if (!sh || sh.getLastRow() < 2) return o;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => {
    if (r[0] !== '' && r[1] !== '') o[r[0]] = r[1];
  });
  return o;
}

function setCfg_(key, value) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CFG);
  const vals = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 0; i < vals.length; i++) if (vals[i][0] === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  sh.appendRow([key, value, '']);
}

function staffList_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NV);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues()
    .filter(r => String(r[0]).trim() && String(r[2]).trim())
    .map(r => ({ id: String(r[0]).trim(), ten: String(r[1]).trim(), ma: String(r[2]).trim(), ca: String(r[3]).trim(), on: String(r[4]).trim() !== '' }));
}

function findStaff_(u, k) {
  const a = staffList_().find(s => s.id === String(u) && s.ma === String(k) && s.on);
  return a ? { id: a.id, ten: a.ten } : null;
}

/* Ca làm việc chứa thời điểm ms, tính theo giờ Việt Nam. */
function shiftWindow_(ms, c) {
  const off = TZ_OFFSET_H * 3600000;
  const loc = new Date(ms + off);
  const h = loc.getUTCHours();
  const dS = Number(c.dayStartHour), nS = Number(c.nightStartHour);
  const y = loc.getUTCFullYear(), m = loc.getUTCMonth(), d = loc.getUTCDate();
  const at = (yy, mm, dd, hh) => Date.UTC(yy, mm, dd, hh) - off;
  if (h >= dS && h < nS) return { label: 'Ngày', start: at(y, m, d, dS), end: at(y, m, d, nS) };
  const start = h >= nS ? at(y, m, d, nS) : at(y, m, d - 1, nS);
  return { label: 'Đêm', start, end: start + (24 - nS + dS) * 3600000 };
}

function readTaps_(sinceMs) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const n = sh.getLastRow();
  if (n < 2) return [];
  const from = Math.max(2, n - 3000);
  return sh.getRange(from, 1, n - from + 1, 13).getValues().map(r => ({
    id: String(r[0]), t: r[1] instanceof Date ? r[1].getTime() : 0, uid: String(r[3]), ten: String(r[4]),
    shift: String(r[5]), round: Number(r[6]) || 1, area: String(r[7]), test: String(r[8]) !== '', cancelled: String(r[9]) !== '', route: String(r[10]), lane: String(r[11]) === 'loi' ? 'loi' : 'ham', via: String(r[12]) === 'qr' ? 'qr' : 'tay'
  })).filter(x => x.t >= sinceMs);
}

function evalWindow_(taps, win, now, c, live) {
  const gap = Number(c.gapMin) * 60000, tol = Number(c.tolMin) * 60000;
  const out = { rounds: 0, complete: 0, reasons: [], level: 'ok', last: null, nextDue: null, route: [] };
  if (!taps.length) {
    if (live) {
      const late = now - (win.start + Number(c.startGraceMin) * 60000);
      if (late > 0) { out.level = 'red'; out.reasons.push('Chưa có tín hiệu nào từ đầu ca (' + Math.round((now - win.start) / 60000) + ' phút)'); }
      else out.level = 'wait';
    } else out.level = 'red';
    return out;
  }
  const sorted = taps.slice().sort((a, b) => a.t - b.t);
  out.last = sorted[sorted.length - 1];
  let route = [];
  try { route = JSON.parse(out.last.route || '[]'); } catch (e) { route = []; }
  out.route = route;
  const rounds = {};
  sorted.forEach(x => {
    const r = rounds[x.round] || (rounds[x.round] = { n: x.round, start: x.t, areas: {} });
    if (x.t < r.start) r.start = x.t;
    r.areas[x.area] = true;
  });
  const list = Object.keys(rounds).map(k => rounds[k]).sort((a, b) => a.n - b.n);
  out.rounds = list.length;
  out.complete = list.filter(r => route.length && route.every(a => r.areas[a])).length;
  if (!live) return out;
  const R = list[list.length - 1];
  const missing = route.filter(a => !R.areas[a]);
  out.missing = missing;
  out.roundStart = R.start;
  if (missing.length && now - R.start > Number(c.roundGraceMin) * 60000) {
    out.level = 'red';
    out.reasons.push('Vòng ' + R.n + ' còn thiếu ' + missing.length + ' điểm: ' + missing.join(', '));
  }
  out.nextDue = R.start + gap;
  if (now > out.nextDue + tol && out.nextDue + tol < win.end) {
    out.level = 'red';
    out.reasons.push('Quá giờ vòng ' + (R.n + 1) + ' (' + Math.round((now - out.nextDue) / 60000) + ' phút)');
  }
  return out;
}

const LANES = [{ id: 'ham', name: 'Tuần hầm' }, { id: 'loi', name: 'Tuần lõi' }];
const RANK_ = { off: 0, ok: 1, wait: 2, red: 3 };

function dashboard_(now, withKeys) {
  const c = cfgMap_();
  const win = shiftWindow_(now, c);
  const prevWin = shiftWindow_(win.start - 1, c);
  const taps = readTaps_(prevWin.start - 3600000).filter(x => !x.test);
  const staff = staffList_().filter(s => s.on);
  const minRounds = Number(c.minRounds);
  const rows = staff.map(s => {
    const ca = s.ca.toLowerCase();
    const label = win.label.toLowerCase(), plabel = prevWin.label.toLowerCase();
    const mine = taps.filter(x => x.uid === s.id && !x.cancelled);
    const inWin = mine.filter(x => x.t >= win.start && x.t < win.end);
    const inPrev = mine.filter(x => x.t >= prevWin.start && x.t < prevWin.end);
    const cancels = taps.filter(x => x.uid === s.id && x.cancelled && x.t >= win.start && x.t < win.end).length;
    const onDuty = ca === label || ca === 'cả hai' || ca === 'ca hai';
    const row = { id: s.id, ten: s.ten, ca: s.ca, onDuty, cancels, level: 'off', reasons: [], minRounds, lanes: {}, rounds: 0, complete: 0 };
    if (withKeys) row.ma = s.ma;
    row.manual = inWin.filter(x => x.via !== 'qr').length;
    row.viaQr = inWin.length - row.manual;
    if (onDuty || inWin.length) {
      let level = 'ok', last = null, nextDue = null;
      LANES.forEach(L => {
        const cur = inWin.filter(x => x.lane === L.id);
        if (!onDuty && !cur.length) return;
        const e = evalWindow_(cur, win, now, c, true);
        e.reasons.forEach(r => row.reasons.push(L.name + ': ' + r));
        row.lanes[L.id] = { name: L.name, level: e.level, rounds: e.rounds, complete: e.complete, nextDue: e.nextDue, missing: e.missing || [],
          last: e.last ? { t: e.last.t, area: e.last.area, round: e.last.round } : null };
        if (RANK_[e.level] > RANK_[level]) level = e.level;
        row.rounds += e.rounds; row.complete += e.complete;
        if (e.last && (!last || e.last.t > last.t)) last = { t: e.last.t, area: e.last.area, round: e.last.round };
        if (e.nextDue && (!nextDue || e.nextDue < nextDue)) nextDue = e.nextDue;
      });
      row.level = onDuty ? level : 'ok';
      row.last = last; row.nextDue = nextDue;
    }
    // Báo cáo ca vừa kết thúc, hiện trong 4 giờ đầu của ca mới.
    if ((ca === plabel || ca === 'cả hai' || inPrev.length) && now - win.start < 4 * 3600000) {
      const prevLanes = {};
      let short = false;
      LANES.forEach(L => {
        const pe = evalWindow_(inPrev.filter(x => x.lane === L.id), prevWin, now, c, false);
        prevLanes[L.id] = { name: L.name, rounds: pe.rounds, complete: pe.complete };
        if (pe.complete < minRounds) short = true;
      });
      const assigned = ca === plabel || ca === 'cả hai';
      row.prev = { label: prevWin.label, lanes: prevLanes, short, assigned };
      if (short && assigned) {
        row.reasons.push('Ca ' + prevWin.label + ' trước chưa đủ ' + minRounds + ' vòng: ' + LANES.map(L => L.name + ' ' + prevLanes[L.id].complete + '/' + minRounds).join(', '));
        row.level = 'red';
      }
    }
    return row;
  });
  const recent = taps.sort((a, b) => b.t - a.t).slice(0, 40).map(x => ({ id: x.id, t: x.t, uid: x.uid, ten: x.ten, area: x.area, round: x.round, lane: x.lane, via: x.via, cancelled: x.cancelled }));
  return { now, win: { label: win.label, start: win.start, end: win.end }, staff: rows, recent, cfg: { gapMin: Number(c.gapMin), minRounds } };
}

/* ---------- Cảnh báo email (chạy mỗi 10 phút nhờ caiTrigger) ---------- */
function kiemTra() {
  const d = dashboard_(Date.now(), false);
  const props = PropertiesService.getScriptProperties();
  const sent = JSON.parse(props.getProperty('sent') || '{}');
  const fresh = [];
  d.staff.forEach(s => {
    if (s.level !== 'red') return;
    const key = s.id + '|' + d.win.start + '|' + s.reasons.join(';');
    if (!sent[key]) { sent[key] = Date.now(); fresh.push(s); }
  });
  Object.keys(sent).forEach(k => { if (Date.now() - sent[k] > 2 * 86400000) delete sent[k]; });
  props.setProperty('sent', JSON.stringify(sent));
  if (!fresh.length) return;
  const c = cfgMap_();
  const to = String(c.email || '').trim() || Session.getEffectiveUser().getEmail();
  const body = fresh.map(s => '• ' + s.ten + ': ' + s.reasons.join('; ')).join('\n');
  MailApp.sendEmail(to, 'Tuần tra West Bay: ' + fresh.length + ' cảnh báo đỏ', body);
}
