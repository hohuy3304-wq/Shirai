function currentYear_() { return Utilities.formatDate(new Date(), TZ, 'yyyy'); }

function nextSequence_(prefix, year, numbers, counter) {
  const pattern = new RegExp('^' + escapeRegex_(prefix + '-' + year + '-') + '(\\d{4})$');
  let max = Number(counter || 0);
  if (!Number.isInteger(max) || max < 0) throw new Error('Bộ đếm hợp đồng không hợp lệ.');
  numbers.forEach(number => {
    const match = pattern.exec(String(number));
    if (match) max = Math.max(max, Number(match[1]));
  });
  if (max >= 9999) throw new Error('Đã hết dải số cho tiền tố và năm này.');
  return max + 1;
}

// Chỉ gọi khi đang giữ khóa script của runAction_.
function sinhSoHopDong_(tienTo, nam, sheet) {
  const col = getHeaderIndexMap_(sheet).So_HD;
  const count = sheet.getLastRow() - 1;
  const numbers = count ? sheet.getRange(2, col, count, 1).getValues().flat() : [];
  const props = PropertiesService.getScriptProperties();
  const key = 'seq/' + tienTo + '/' + nam;
  const next = nextSequence_(tienTo, nam, numbers, props.getProperty(key));
  props.setProperty(key, String(next));
  return tienTo + '-' + nam + '-' + String(next).padStart(4, '0');
}

function requiredId_(id, label) {
  id = String(id || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Hãy điền ID thật cho ' + label + '.');
  return id;
}
function getOrCreateFolderPath_(rootId, nam, tenKh) {
  let folder = DriveApp.getFolderById(requiredId_(rootId, 'ROOT_FOLDER_ID'));
  [String(nam), String(tenKh).trim()].forEach(name => {
    const matches = folder.getFoldersByName(name);
    if (!matches.hasNext()) folder = folder.createFolder(name);
    else {
      folder = matches.next();
      if (matches.hasNext()) throw new Error('Có nhiều thư mục trùng tên ' + name);
    }
  });
  return folder;
}
function destination_(template, cfg, year, customer) {
  return template.Thu_Muc_Luu_ID
    ? DriveApp.getFolderById(requiredId_(template.Thu_Muc_Luu_ID, 'Thu_Muc_Luu_ID'))
    : getOrCreateFolderPath_(cfg.ROOT_FOLDER_ID, year, customer);
}

function docFile_(url) {
  const m = /^https:\/\/docs\.google\.com\/document\/d\/([\w-]+)/.exec(String(url));
  if (!m) throw new Error('Thiếu hoặc sai liên kết Google Docs trên dòng hợp đồng.');
  return DriveApp.getFileById(m[1]);
}
function folderOfDoc_(url) {
  const parents = docFile_(url).getParents();
  if (!parents.hasNext()) throw new Error('Không đọc được thư mục chứa bản Docs.');
  return parents.next();
}

function createContract_(ctx) {
  const row = ctx.data;
  if (row.Link_PDF) throw new Error('Dòng này đã có PDF. Hãy dùng Tạo lại PDF.');
  if (row.Trang_Thai && row.Trang_Thai !== ST.draft) throw new Error('Chỉ tạo hợp đồng trên dòng nháp.');
  if (row.Link_Docs && row.So_HD) return regeneratePdf_(ctx);
  validateContract_(row);
  const cfg = getConfig();
  const kh = getCustomerInfo_(row.Ma_KH);
  if (!String(kh.Ten_Cong_Ty).trim()) throw new Error('Thiếu tên công ty trong danh mục khách hàng.');
  const template = getTemplateInfo_(row.Loai_HD);
  const id = requiredId_(template.ID_Google_Docs_Mau, 'ID_Google_Docs_Mau');
  if (DriveApp.getFileById(id).getMimeType() !== MimeType.GOOGLE_DOCS) throw new Error('Tệp mẫu phải là Google Docs.');
  const prefix = String(template.Tien_To_So_HD).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(prefix)) throw new Error('Tiền tố số hợp đồng không hợp lệ.');
  const year = row.So_HD ? String(row.So_HD).split('-').slice(-2)[0] : currentYear_();
  const folder = destination_(template, cfg, year, kh.Ten_Cong_Ty);
  const email = activeEmail_();
  if (!row.So_HD) {
    setField_(ctx, 'So_HD', sinhSoHopDong_(prefix, year, ctx.sheet));
    SpreadsheetApp.flush();
  }
  setField_(ctx, 'Ten_KH', String(kh.Ten_Cong_Ty).trim());
  setField_(ctx, 'Gia_Tri_Bang_Chu', docSoThanhChu(row.Gia_Tri));
  if (!row.Ngay_Tao) setField_(ctx, 'Ngay_Tao', new Date());
  if (!row.Nguoi_Tao) setField_(ctx, 'Nguoi_Tao', email);
  setField_(ctx, 'Trang_Thai', ST.draft);
  const name = row.So_HD + ' - ' + row.Ten_KH;
  const pdf = fillTemplateAndExportPdf_(id, folder, name, placeholders_(row, kh, cfg), url => {
    setField_(ctx, 'Link_Docs', url);
    SpreadsheetApp.flush();
  });
  setField_(ctx, 'Link_PDF', pdf.getUrl());
  return 'Đã tạo Docs và PDF cho ' + row.So_HD;
}

function regeneratePdf_(ctx) {
  const row = ctx.data;
  if (!row.So_HD || !row.Link_Docs) throw new Error('Cần có số hợp đồng và bản Docs để tạo lại PDF.');
  const file = docFile_(row.Link_Docs);
  const pdf = exportPdf_(file, folderOfDoc_(row.Link_Docs), file.getName());
  setField_(ctx, 'Link_PDF', pdf.getUrl());
  return 'Đã xuất PDF từ bản Docs của ' + row.So_HD;
}
