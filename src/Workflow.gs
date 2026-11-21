function isApprover_(email, cfg) {
  return emailList_((cfg || getConfig()).NGUOI_DUYET).includes(String(email).trim().toLowerCase());
}

function checkTransition_(from, to, approver, automatic) {
  if (!(TRANSITIONS[from] || []).includes(to)) throw new Error('Không thể chuyển từ ' + from + ' sang ' + to + '.');
  if (to === ST.expired && !automatic) throw new Error('Hết hạn do chức năng quét ngày cập nhật.');
  if ((to === ST.approved || (from === ST.approved && !automatic)) && !approver)
    throw new Error('Thao tác này cần người thuộc danh sách NGUOI_DUYET.');
}

function verifySubmissionFiles_(row) {
  const pdf = /^https:\/\/drive\.google\.com\/(?:file\/d\/([\w-]+)|open\?id=([\w-]+))/.exec(String(row.Link_PDF));
  if (!row.Dau_Tep_Xuat || !pdf) throw new Error('Cần xuất lại PDF từ bản nháp trước khi duyệt hồ sơ này.');
  const doc = docFile_(row.Link_Docs);
  const pdfId = pdf[1] || pdf[2];
  const version = driveVersion_(doc.getId());
  if (digest_([doc.getId(), version, pdfId, driveVersion_(pdfId)]) !== row.Dau_Tep_Xuat)
    throw new Error('Tệp đã thay đổi sau khi xuất PDF. Hãy trả về nháp và trình lại.');
  return {id:doc.getId(), version};
}

function lockApprovedCopy_(id) {
  const file = Drive.Files.get(id, {fields:'contentRestrictions(readOnly,ownerRestricted)'});
  if ((file.contentRestrictions || []).some(rule => rule.readOnly && rule.ownerRestricted)) return;
  Drive.Files.update({contentRestrictions:[{
    readOnly:true, ownerRestricted:true, reason:'Bản hợp đồng đã được phê duyệt'
  }]}, id);
}

function archiveApprovedDoc_(ctx, cfg) {
  const row = ctx.data;
  const source = verifySubmissionFiles_(row);
  const year = String(row.So_HD).split('-').slice(-2)[0];
  const parent = getOrCreateFolderPath_(cfg.ROOT_FOLDER_ID,year,row.Ten_KH);
  const folder = childFolder_(parent,'Đã duyệt');
  const name = row.So_HD + ' - ' + row.Ten_KH + ' - Đã duyệt lần ' + Number(row.Phien_Trinh || 1);
  const id = copyNativeDoc_(source.id, folder, name, source.version);
  try {
    lockApprovedCopy_(id);
    verifySubmissionFiles_(row);
  } catch (err) {
    DriveApp.getFileById(id).setTrashed(true);
    throw err;
  }
  return 'https://docs.google.com/document/d/' + id + '/edit';
}

function chuyenTrangThai_(rowIdx, targetStatus, context, exporting) {
  const ctx = context || rowAt_(sheet_(TAB.contracts), rowIdx);
  const row = ctx.data;
  if (!row.So_HD) throw new Error('Hãy tạo hợp đồng trước khi chuyển trạng thái.');
  if (!exporting) checkFileIdle_(ctx);
  const cfg = getConfig();
  const actor = activeEmail_();
  const from = row.Trang_Thai || ST.draft;
  const approver = isApprover_(actor, cfg);
  if (targetStatus === ST.void && !approver && !mine_(row, actor)) throw new Error('Chỉ người lập, phụ trách hoặc người duyệt được hủy hồ sơ.');
  checkTransition_(from, targetStatus, approver, false);
  if ([ST.approved, ST.pending].includes(targetStatus)) {
    validateContract_(row);
    if (!row.Link_Docs || !row.Link_PDF) throw new Error('Hợp đồng cần có đủ liên kết Docs và PDF.');
  }
  if (targetStatus === ST.pending) {
    if (!mine_(row,actor)) throw new Error('Chỉ người tạo hoặc phụ trách được gửi duyệt.');
    verifySubmissionFiles_(row);
    addFields_(ctx,['Phien_Trinh','Link_PDF_Trinh','Dau_Trinh','Ly_Do_Tra']);
    setField_(ctx,'Phien_Trinh',Number(row.Phien_Trinh || 0)+1);
    setField_(ctx,'Link_PDF_Trinh',row.Link_PDF);
    setField_(ctx,'Dau_Trinh',businessHash_(row));
    setField_(ctx,'Ly_Do_Tra','');
    appendLog_('Lưu PDF trình duyệt',row.So_HD,'Bản '+row.Phien_Trinh+' · '+row.Link_PDF_Trinh);
  }
  if (targetStatus === ST.approved) {
    if (row.Dau_Trinh && (row.Dau_Trinh !== businessHash_(row) || row.Link_PDF_Trinh !== row.Link_PDF))
      throw new Error('Nội dung đã đổi sau khi gửi. Hãy trả về để trình bản mới.');
    const revision = revision_(row);
    const approvedDoc = archiveApprovedDoc_(ctx,cfg);
    const newLocks = [];
    try {
      // Tìm lại đúng dòng sau khi sao chép Drive vì sổ có thể vừa được sắp xếp.
      const current = dossierAt_(row.So_HD);
      checkRevision_(current.data,revision);
      addFields_(current,['Link_Docs_Da_Duyet','Nguoi_Duyet','Ngay_Duyet']);
      if (current.sheet.getRange(current.row,current.map.Ten_KH).getFormula())
        setField_(current,'Ten_KH',current.data.Ten_KH);
      khoaDongHopDong_(current.sheet,current.row,current,cfg,actor,newLocks);
      setField_(current,'Link_Docs_Da_Duyet',approvedDoc);
      setField_(current,'Nguoi_Duyet',actor);
      setField_(current,'Ngay_Duyet',new Date());
      setField_(current,'Trang_Thai',targetStatus);
      SpreadsheetApp.flush();
    } catch (err) {
      const saved = dossierAt_(row.So_HD);
      if (saved.data.Trang_Thai !== targetStatus || saved.data.Link_Docs_Da_Duyet !== approvedDoc) {
        newLocks.forEach(p => p.remove());
        if (saved.data.Link_Docs_Da_Duyet === approvedDoc) {
          for (const key of ['Link_Docs_Da_Duyet','Nguoi_Duyet','Ngay_Duyet']) setField_(saved,key,'');
        }
        docFile_(approvedDoc).setTrashed(true);
        throw err;
      }
    }
    return row.So_HD + ' đã duyệt. Bản Docs chính thức: ' + approvedDoc;
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

function khoaDongHopDong_(sheet, rowIdx, ctx, cfg, actor, newLocks) {
  ctx = ctx || rowAt_(sheet, rowIdx);
  cfg = cfg || getConfig();
  actor = actor || activeEmail_();
  if (!isApprover_(actor, cfg)) throw new Error('Chỉ người duyệt được khóa dòng.');
  const owner = sheet.getParent().getOwner();
  const keep = new Set(emailList_(cfg.NGUOI_DUYET));
  if (owner) keep.add(owner.getEmail().toLowerCase());
  const operational = ['Trang_Thai', 'Link_Docs', 'Link_PDF', 'Ghi_Chu'];
  const columns = SCHEMA[TAB.contracts].filter(k => !operational.includes(k)).map(k => ctx.map[k]);
  ['Noi_Dung_HD','Uy_Quyen','Thay_Doi','So_Uy_Quyen','Ngay_Uy_Quyen','Link_Docs_Da_Duyet','Nguoi_Duyet','Ngay_Duyet'].forEach(k => { if (ctx.map[k]) columns.push(ctx.map[k]); });
  const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  const tag = 'Hợp đồng ' + ctx.data.So_HD;
  coreSpans_(columns).forEach(({start, width}) => {
    const range = sheet.getRange(rowIdx, start, 1, width);
    let p = existing.find(item => item.getDescription() === tag && item.getRange().getA1Notation() === range.getA1Notation());
    if (!p) {
      p = range.protect();
      if (newLocks) newLocks.push(p);
      p.setDescription(tag);
    }
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
function guiDuyet() {
  return rowMenu_('Gửi duyệt PDF trên dòng', ctx => {
    if (Number(ctx.data.Phien_Trinh) > 0)
      throw new Error('Hồ sơ đã từng trình. Mở Hợp đồng của tôi để sửa và trình bản mới.');
    return chuyenTrangThai_(ctx.row, ST.pending, ctx);
  });
}
function pheDuyet() { moChoDuyet(); }
function traVeNhap() { moChoDuyet(); }
function danhDauDaKy() { statusMenu_('Đánh dấu đã ký', ST.signed); }
function huyHopDong() { statusMenu_('Hủy hợp đồng', ST.void); }
