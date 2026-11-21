function isApprover_(email, cfg) {
  return emailList_((cfg || getConfig()).NGUOI_DUYET).includes(String(email).trim().toLowerCase());
}

function checkTransition_(from, to, approver, automatic) {
  if (!(TRANSITIONS[from] || []).includes(to)) throw new Error('Không thể chuyển từ ' + from + ' sang ' + to + '.');
  if (to === ST.expired && !automatic) throw new Error('Hết hạn do chức năng quét ngày cập nhật.');
  if ((to === ST.approved || (from === ST.approved && !automatic)) && !approver)
    throw new Error('Thao tác này cần người thuộc danh sách NGUOI_DUYET.');
}

function chuyenTrangThai_(rowIdx, targetStatus, context) {
  const ctx = context || rowAt_(sheet_(TAB.contracts), rowIdx);
  const row = ctx.data;
  if (!row.So_HD) throw new Error('Hãy tạo hợp đồng trước khi chuyển trạng thái.');
  checkFileIdle_(ctx);
  const cfg = getConfig();
  const actor = activeEmail_();
  const from = row.Trang_Thai || ST.draft;
  checkTransition_(from, targetStatus, isApprover_(actor, cfg), false);
  if ([ST.approved, ST.pending].includes(targetStatus)) {
    validateContract_(row);
    if (!row.Link_Docs || !row.Link_PDF) throw new Error('Hợp đồng cần có đủ liên kết Docs và PDF.');
  }
  if (targetStatus === ST.approved) {
    // Chốt tên tra cứu để các thay đổi danh mục về sau không làm đổi bản đã duyệt.
    if (ctx.sheet.getRange(rowIdx, ctx.map.Ten_KH).getFormula()) setField_(ctx, 'Ten_KH', row.Ten_KH);
    khoaDongHopDong_(ctx.sheet, rowIdx, ctx, cfg, actor);
  }
  setField_(ctx, 'Trang_Thai', targetStatus);
  return row.So_HD + ' chuyển từ ' + from + ' sang ' + targetStatus + '.';
}

function coreSpans_(indices) {
  const spans = [];
  indices.sort((a, b) => a - b).forEach(col => {
    const last = spans[spans.length - 1];
    if (last && last.start + last.width === col) last.width++;
    else spans.push({start: col, width: 1});
  });
  return spans;
}

function khoaDongHopDong_(sheet, rowIdx, ctx, cfg, actor) {
  ctx = ctx || rowAt_(sheet, rowIdx);
  cfg = cfg || getConfig();
  actor = actor || activeEmail_();
  if (!isApprover_(actor, cfg)) throw new Error('Chỉ người duyệt được khóa dòng.');
  const owner = sheet.getParent().getOwner();
  const keep = new Set(emailList_(cfg.NGUOI_DUYET));
  if (owner) keep.add(owner.getEmail().toLowerCase());
  const operational = ['Trang_Thai', 'Link_Docs', 'Link_PDF', 'Ghi_Chu'];
  const columns = SCHEMA[TAB.contracts].filter(k => !operational.includes(k)).map(k => ctx.map[k]);
  if (ctx.map.Noi_Dung_HD) columns.push(ctx.map.Noi_Dung_HD);
  const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  const tag = 'Hợp đồng ' + ctx.data.So_HD;
  coreSpans_(columns).forEach(({start, width}) => {
    const range = sheet.getRange(rowIdx, start, 1, width);
    let p = existing.find(item => item.getDescription() === tag && item.getRange().getA1Notation() === range.getA1Notation());
    if (!p) p = range.protect().setDescription(tag);
    p.setWarningOnly(false);
    p.addEditor(actor);
    p.addEditors([...keep]);
    const others = p.getEditors().filter(u => !keep.has(u.getEmail().toLowerCase()));
    if (others.length) p.removeEditors(others);
    if (p.canDomainEdit()) p.setDomainEdit(false);
  });
}

function statusMenu_(action, target) {
  rowMenu_(action, ctx => chuyenTrangThai_(ctx.row, target, ctx));
}
function guiDuyet() { statusMenu_('Gửi duyệt', ST.pending); }
function pheDuyet() { statusMenu_('Phê duyệt', ST.approved); }
function traVeNhap() { statusMenu_('Trả về nháp', ST.draft); }
function danhDauDaKy() { statusMenu_('Đánh dấu đã ký', ST.signed); }
function huyHopDong() { statusMenu_('Hủy hợp đồng', ST.void); }
