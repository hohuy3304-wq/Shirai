function onOpen() {
  SpreadsheetApp.getUi().createMenu('Hợp đồng')
    .addItem('Nhập hợp đồng mới…', 'moPhieuHopDong')
    .addItem('Chuẩn bị mẫu và thư mục', 'chuanBiHopDong')
    .addSeparator()
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
    // Chuẩn bị và cấp số dưới khóa; xuất file của hai hợp đồng có thể chạy song song.
    const prepared = withLock_(() => {
      if (options.context) ctx = options.context();
      else if (options.row) ctx = activeRow_();
      return fn(ctx);
    });
    if (typeof prepared === 'function') {
      try { result = prepared(); }
      finally { withLock_(() => releaseFileJob_(ctx)); }
    } else result = prepared;
    result = result || 'Đã hoàn tất.';
    appendLog_(name, ctx && ctx.data.So_HD, result);
  } catch (err) {
    const detail = 'Lỗi khi ' + name.toLowerCase() + '. ' + err.message;
    try { appendLog_(name, ctx && ctx.data.So_HD, detail); }
    catch (logError) { console.error('Lỗi ghi nhật ký: ' + logError.message); }
    if (!options.menu) throw new Error(detail);
    showAlert_(detail);
    return;
  }
  if (options.display) options.display();
  else if (options.menu) showAlert_(result);
  return result;
}

function rowMenu_(name, fn) { return runAction_(name, fn, {row: true, menu: true}); }
function taoHopDongTuDongDangChon() { rowMenu_('Tạo hợp đồng', createContract_); }
function taoLaiPdfTuDongDangChon() { rowMenu_('Tạo lại PDF', regeneratePdf_); }
function moThuMuc() {
  let url;
  runAction_('Mở thư mục', ctx => {
    const folder = ctx.data.Link_Docs ? folderOfDoc_(ctx.data.Link_Docs) : destination_(getTemplateInfo_(ctx.data.Loai_HD), getConfig(), currentYear_(), getCustomerInfo_(ctx.data.Ma_KH).Ten_Cong_Ty);
    url = folder.getUrl();
    return 'Đã tìm thấy thư mục lưu.';
  }, {row: true, menu: true, display: () => {
    const html = HtmlService.createHtmlOutput('<p><a target="_blank" rel="noopener" href="' + html_(url) + '">Mở thư mục trên Google Drive</a></p>').setWidth(320).setHeight(90);
    SpreadsheetApp.getUi().showModalDialog(html, 'Thư mục hợp đồng');
  }});
}
