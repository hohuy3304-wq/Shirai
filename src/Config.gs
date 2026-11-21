const TZ = 'Asia/Ho_Chi_Minh';
const TAB = {contracts: 'HopDong', customers: 'KhachHang', templates: 'Mau', config: 'CauHinh', log: 'NhatKy', drafts: 'BanNhap'};
const SCHEMA = {
  [TAB.contracts]: ['So_HD', 'Loai_HD', 'Ma_KH', 'Ten_KH', 'Ngay_Ky', 'Ngay_Hieu_Luc', 'Ngay_Het_Han', 'Gia_Tri', 'Gia_Tri_Bang_Chu', 'Dieu_Khoan_Thanh_Toan', 'Nguoi_Phu_Trach', 'Trang_Thai', 'Link_Docs', 'Link_PDF', 'Ngay_Tao', 'Nguoi_Tao', 'Ghi_Chu'],
  [TAB.customers]: ['Ma_KH', 'Ten_Cong_Ty', 'Dia_Chi', 'MST', 'Nguoi_Dai_Dien', 'Chuc_Vu', 'SDT', 'Email', 'Tai_Khoan_NH'],
  [TAB.templates]: ['Loai_HD', 'ID_Google_Docs_Mau', 'Tien_To_So_HD', 'Thu_Muc_Luu_ID'],
  [TAB.config]: ['Key', 'Value', 'Mo_Ta'],
  [TAB.drafts]: ['Nguoi_Tao', 'Ma_Phieu', 'Du_Lieu'],
  [TAB.log]: ['Thoi_Gian', 'Nguoi_Dung', 'Hanh_Dong', 'So_HD', 'Ket_Qua']
};
const ST = {draft: 'Nháp', pending: 'Chờ duyệt', approved: 'Đã duyệt', signed: 'Đã ký', expired: 'Hết hạn', ended: 'Đã chấm dứt', void: 'Hủy'};
const OMIT_DOC = ['Link_Docs', 'Link_PDF', 'Ngay_Tao', 'Nguoi_Tao'];
const ALIAS_KH = {Ten_Cong_Ty: 'TEN_KH', Dia_Chi: 'DIA_CHI_KH', MST: 'MST_KH', Nguoi_Dai_Dien: 'DAI_DIEN_KH', Chuc_Vu: 'CHUC_VU_KH', SDT: 'SDT_KH', Email: 'EMAIL_KH', Tai_Khoan_NH: 'TAI_KHOAN_NH_KH'};
const ALIAS_HD = {Dieu_Khoan_Thanh_Toan: 'DIEU_KHOAN_TT'};
const SELLER = ['TEN_BEN_BAN', 'MST_BEN_BAN', 'DIA_CHI_BEN_BAN', 'DAI_DIEN_BEN_BAN', 'CHUC_VU_BEN_BAN', 'SDT_BEN_BAN', 'TAI_KHOAN_BEN_BAN'];
const DEFAULT_CFG = [
  ...SELLER.map(key => [key, '', 'Thông tin bên bán dùng trong mẫu']),
  ['ROOT_FOLDER_ID', '<DIEN_ID_THU_MUC_GOC>', 'Thư mục My Drive mặc định'],
  ['NGUOI_DUYET', '', 'Các email có quyền duyệt, cách nhau bằng dấu phẩy'],
  ['EMAIL_NHAN_NHAC', '', 'Danh sách nhận email tổng hợp'],
  ['SO_NGAY_NHAC', '30,15,7', 'Các mốc ngày trước khi hết hạn']
];

function sheet_(name) {
  const sheet = contractBook_().getSheetByName(name);
  if (!sheet) throw new Error('Thiếu tab ' + name + '. Hãy chạy initSheetStructure.');
  return sheet;
}

function headerMap_(headers, name) {
  const map = Object.create(null);
  headers.forEach((v, i) => {
    const key = String(v).trim();
    if (!key) return;
    if (map[key]) throw new Error('Trùng tiêu đề ' + key + ' tại ' + name);
    map[key] = i + 1;
  });
  SCHEMA[name].forEach(k => { if (!map[k]) throw new Error('Thiếu cột ' + k + ' tại ' + name); });
  return map;
}

function getHeaderIndexMap_(sheet) {
  return headerMap_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0], sheet.getName());
}

function record_(values, map) {
  const result = Object.create(null);
  Object.keys(map).forEach(k => { result[k] = values[map[k] - 1]; });
  return result;
}

function records_(name) {
  const data = sheet_(name).getDataRange().getValues();
  const map = headerMap_(data.shift(), name);
  return data.map(row => record_(row, map));
}

function getConfig() {
  const cfg = Object.create(null);
  records_(TAB.config).forEach(r => {
    const key = String(r.Key).trim();
    if (!key) return;
    if (key in cfg) throw new Error('Trùng khóa cấu hình ' + key);
    cfg[key] = String(r.Value).trim();
  });
  return cfg;
}

function lookup_(tab, key, value) {
  const rows = records_(tab).filter(r => String(r[key]).trim() === String(value).trim());
  if (rows.length !== 1) throw new Error('Cần đúng một dòng ' + key + ' = ' + value + ' trong ' + tab);
  return rows[0];
}
function getTemplateInfo_(loaiHd) { return lookup_(TAB.templates, 'Loai_HD', loaiHd); }
function getCustomerInfo_(maKh) { return lookup_(TAB.customers, 'Ma_KH', maKh); }

function appendRecord_(sheet, map, values) {
  const row = Array(sheet.getLastColumn()).fill('');
  Object.keys(values).forEach(k => { row[map[k] - 1] = values[k]; });
  sheet.appendRow(row);
}

function initSheetStructure() {
  const ss = contractBook_();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(SCHEMA).forEach(name => {
    const s = ss.getSheetByName(name) || ss.insertSheet(name);
    if (!s.getLastRow()) s.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]);
    getHeaderIndexMap_(s);
    s.setFrozenRows(1);
  });
  const cfgSheet = sheet_(TAB.config);
  const cfgMap = getHeaderIndexMap_(cfgSheet);
  const cfg = getConfig();
  cfgSheet.getRange(2, cfgMap.Value, cfgSheet.getMaxRows() - 1).setNumberFormat('@');
  DEFAULT_CFG.forEach(([Key, Value, Mo_Ta]) => {
    if (!(Key in cfg)) appendRecord_(cfgSheet, cfgMap, {Key, Value, Mo_Ta});
  });
  const templates = sheet_(TAB.templates);
  if (templates.getLastRow() === 1) {
    appendRecord_(templates, getHeaderIndexMap_(templates), {
      Loai_HD: 'Dịch vụ', ID_Google_Docs_Mau: '<DIEN_ID_DOC_MAU>', Tien_To_So_HD: 'HDDV'
    });
  }
  if (!records_(TAB.templates).some(r => isHdnt_(r.Loai_HD))) {
    appendRecord_(templates,getHeaderIndexMap_(templates),{
      Loai_HD:'Hợp đồng nguyên tắc',ID_Google_Docs_Mau:'<DIEN_ID_DOC_MAU>',Tien_To_So_HD:'HDNT'
    });
  }
  const hd = sheet_(TAB.contracts);
  const kh = sheet_(TAB.customers);
  const fields = getHeaderIndexMap_(hd);
  const customer = getHeaderIndexMap_(kh);
  const col = (s, i) => s.getRange(2, i, s.getMaxRows() - 1, 1);
  ['MST', 'SDT', 'Tai_Khoan_NH', 'Ma_KH'].forEach(k => col(kh, customer[k]).setNumberFormat('@'));
  col(hd, fields.Ma_KH).setNumberFormat('@');
  const dropdown = SpreadsheetApp.newDataValidation();
  col(hd, fields.Loai_HD).setDataValidation(dropdown.requireValueInRange(col(templates, getHeaderIndexMap_(templates).Loai_HD), true).setAllowInvalid(false).build());
  col(hd, fields.Ma_KH).setDataValidation(dropdown.requireValueInRange(col(kh, customer.Ma_KH), true).setAllowInvalid(false).build());
  col(hd, fields.Trang_Thai).setDataValidation(dropdown.requireValueInList(Object.values(ST), true).setAllowInvalid(false).build());
  ['Ngay_Ky', 'Ngay_Hieu_Luc', 'Ngay_Het_Han'].forEach(k => col(hd, fields[k]).setNumberFormat('dd/MM/yyyy'));
  col(hd, fields.Ngay_Tao).setNumberFormat('dd/MM/yyyy HH:mm');
  col(hd, fields.Gia_Tri).setNumberFormat('#,##0 "VND"');
  const names = col(hd, fields.Ten_KH);
  const values = names.getValues();
  const formulas = names.getFormulas();
  const separator = (1.1).toLocaleString(ss.getSpreadsheetLocale().replace(/_/g, '-')).includes(',') ? ';' : ',';
  const formula = '=IF(RC' + fields.Ma_KH + '=""' + separator + '""' + separator + 'IFERROR(INDEX(' + TAB.customers + '!C' + customer.Ten_Cong_Ty + separator + 'MATCH(RC' + fields.Ma_KH + separator + TAB.customers + '!C' + customer.Ma_KH + separator + '0))' + separator + '""))';
  // Chỉ điền các đoạn ô trống để giữ công thức và dữ liệu đã có.
  let start = 0;
  for (let i = 0; i <= values.length; i++) {
    if (i < values.length && values[i][0] === '' && !formulas[i][0]) continue;
    if (i > start) hd.getRange(start + 2, fields.Ten_KH, i - start, 1).setFormulaR1C1(formula);
    start = i + 1;
  }
}

const TRANSITIONS = {
  [ST.draft]: [ST.pending, ST.void],
  [ST.pending]: [ST.approved, ST.draft, ST.void],
  [ST.approved]: [ST.signed, ST.void, ST.expired],
  [ST.signed]: [ST.expired],
  [ST.expired]: [], [ST.void]: []
};
