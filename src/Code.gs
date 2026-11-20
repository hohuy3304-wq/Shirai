function onOpen() {
  SpreadsheetApp.getUi().createMenu('Hợp đồng')
    .addItem('Tạo hợp đồng từ dòng đang chọn', 'taoHopDongTuDongDangChon')
    .addItem('Tạo lại PDF', 'taoLaiPdfTuDongDangChon')
    .addItem('Mở thư mục lưu', 'moThuMuc')
    .addSeparator()
    .addItem('Gửi duyệt', 'guiDuyet')
    .addItem('Phê duyệt', 'pheDuyet')
    .addItem('Trả về nháp', 'traVeNhap')
    .addItem('Đánh dấu đã ký', 'danhDauDaKy')
    .addItem('Hủy hợp đồng', 'huyHopDong')
    .addSeparator()
    .addItem('Quét hết hạn', 'quetHetHan')
    .addItem('Cài nhắc hạn hàng ngày', 'caiNhacHan')
    .addToUi();
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
  }
}

function activeRow_() {
  const sel = SpreadsheetApp.getActiveRange();
  if (!sel || sel.getSheet().getName() !== TAB.contracts || sel.getRow() < 2 || sel.getNumRows() !== 1)
    throw new Error('Hãy chọn một dòng dữ liệu trên tab ' + TAB.contracts + '.');
  return rowAt_(sel.getSheet(), sel.getRow());
}

function rowAt_(sheet, row) {
  const map = getHeaderIndexMap_(sheet);
  return {sheet, row, map, data: record_(sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0], map)};
}

function setField_(ctx, key, value) {
  const cell = ctx.sheet.getRange(ctx.row, ctx.map[key]);
  if (typeof value === 'string' && value.startsWith('=')) {
    cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(value).build());
  } else cell.setValue(value);
  ctx.data[key] = value;
}

function runAction_(name, fn, options) {
  let ctx;
  let result;
  try {
    result = withLock_(() => {
      if (options.row) ctx = activeRow_();
      const msg = fn(ctx) || 'Đã hoàn tất.';
      appendLog_(name, ctx && ctx.data.So_HD, msg);
      return msg;
    });
  } catch (err) {
    const detail = 'Lỗi khi ' + name.toLowerCase() + '. ' + err.message;
    try { appendLog_(name, ctx && ctx.data.So_HD, detail); }
    catch (logError) { console.error('Lỗi ghi nhật ký: ' + logError.message); }
    if (!options.menu) throw new Error(detail);
    showAlert_(detail);
    return;
  }
  if (options.menu) showAlert_(result);
  return result;
}

function rowMenu_(name, fn) { return runAction_(name, fn, {row: true, menu: true}); }
function taoHopDongTuDongDangChon() { rowMenu_('Tạo hợp đồng', createContract_); }
function taoLaiPdfTuDongDangChon() { rowMenu_('Tạo lại PDF', regeneratePdf_); }
function moThuMuc() {
  rowMenu_('Mở thư mục', ctx => {
    const folder = ctx.data.Link_Docs ? folderOfDoc_(ctx.data.Link_Docs) : destination_(getTemplateInfo_(ctx.data.Loai_HD), getConfig(), currentYear_(), getCustomerInfo_(ctx.data.Ma_KH).Ten_Cong_Ty);
    return 'Thư mục lưu hợp đồng\n' + folder.getUrl();
  });
}
