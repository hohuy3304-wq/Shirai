const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const FOUR_AFTER_TENS = 'tư';

function groupWords_(n, full) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, u = n % 10;
  const words = [];
  if (h || full) words.push(DIGITS[h], 'trăm');
  if (t > 1) words.push(DIGITS[t], 'mươi');
  else if (t === 1) words.push('mười');
  else if (u && (h || full)) words.push('lẻ');
  if (u === 1 && t > 1) words.push('mốt');
  else if (u === 4 && t > 1) words.push(FOUR_AFTER_TENS);
  else if (u === 5 && t) words.push('lăm');
  else if (u) words.push(DIGITS[u]);
  return words.join(' ');
}

function docSoThanhChu(n) {
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(Math.round(n)))
    throw new Error('Số tiền phải là số hữu hạn, không âm và trong giới hạn số nguyên an toàn.');
  let value = Math.round(n);
  if (!value) return 'Không đồng';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const parts = [];
  for (let i = 0; value; i++) {
    const group = value % 1000;
    value = Math.floor(value / 1000);
    if (group) parts.unshift([groupWords_(group, value > 0), units[i]].filter(Boolean).join(' '));
  }
  const words = parts.join(' ') + ' đồng';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatCurrencyVnd_(n) { return Math.round(n).toLocaleString('vi-VN') + ' VND'; }
function formatDateVi_(d) { return Utilities.formatDate(d, TZ, 'dd/MM/yyyy'); }
function dayNumber_(d) {
  const key = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return Date.parse(key + 'T00:00:00Z') / 86400000;
}
function validDate_(d) { return d instanceof Date && Number.isFinite(d.getTime()); }
function escapeRegex_(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function activeEmail_() {
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  if (!email) throw new Error('Không xác định được người dùng. Hãy đăng nhập bằng tài khoản Google được chia sẻ sổ hợp đồng.');
  return email;
}
function emailList_(s) {
  return [...new Set(String(s || '').toLowerCase().split(',').map(v => v.trim()).filter(Boolean))];
}

function isHdnt_(type) {
  return ['hợp đồng nguyên tắc', 'hđnt', 'nguyên tắc'].includes(String(type || '').trim().toLowerCase());
}

function validateContract_(row) {
  const framework = isHdnt_(row.Loai_HD);
  if (!String(row.Loai_HD || '').trim()) throw new Error('Hãy chọn Loai_HD.');
  if (!String(row.Ma_KH || '').trim()) throw new Error('Hãy chọn Ma_KH.');
  if (!framework || (row.Gia_Tri !== '' && row.Gia_Tri != null)) {
    if (!Number.isFinite(row.Gia_Tri) || Math.round(row.Gia_Tri) <= 0)
      throw new Error('Gia_Tri phải là số dương, ít nhất một đồng sau khi làm tròn.');
    docSoThanhChu(row.Gia_Tri);
  }
  if (framework) {
    if (!validDate_(row.Ngay_Ky) || !validDate_(row.Ngay_Hieu_Luc)) throw new Error('Hãy nhập ngày ký và ngày hiệu lực.');
    if (row.Ngay_Ra_Soat && (!validDate_(row.Ngay_Ra_Soat) || dayNumber_(row.Ngay_Ra_Soat) < dayNumber_(row.Ngay_Hieu_Luc)))
      throw new Error('Ngày rà soát phải từ ngày hiệu lực trở đi.');
    return;
  }
  if (!validDate_(row.Ngay_Hieu_Luc) || !validDate_(row.Ngay_Het_Han))
    throw new Error('Hãy nhập Ngay_Hieu_Luc và Ngay_Het_Han bằng ô kiểu ngày.');
  if (dayNumber_(row.Ngay_Het_Han) <= dayNumber_(row.Ngay_Hieu_Luc))
    throw new Error('Ngay_Het_Han phải sau Ngay_Hieu_Luc.');
  if (row.Ngay_Ky && !validDate_(row.Ngay_Ky)) throw new Error('Ngay_Ky phải là ngày hợp lệ.');
}

function appendLog_(action, number, result) {
  const sheet = sheet_(TAB.log);
  const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'Hệ thống';
  appendRecord_(sheet, getHeaderIndexMap_(sheet), {
    Thoi_Gian: new Date(), Nguoi_Dung: email, Hanh_Dong: action,
    So_HD: String(number || '').replace(/^=/, "'="), Ket_Qua: result
  });
}
function showAlert_(msg) { SpreadsheetApp.getUi().alert(String(msg)); }
