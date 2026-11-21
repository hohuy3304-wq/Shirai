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
  const pattern = label === 'ID_Google_Docs_Mau'
    ? /^https:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([\w-]+)(?:[/?#].*)?$/
    : /^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)(?:[/?#].*)?$/;
  const match = pattern.exec(id);
  if (match) return match[1];
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Hãy điền liên kết Google hoặc ID cho ' + label + '.');
  return id;
}
function getOrCreateFolderPath_(rootId, nam, tenKh) {
  let folder = DriveApp.getFolderById(requiredId_(rootId, 'ROOT_FOLDER_ID'));
  [String(nam), String(tenKh).trim()].forEach(name => {
    folder = childFolder_(folder, name);
  });
  return folder;
}
function customFolderId_(template) {
  if (!template.Thu_Muc_Luu_ID || PropertiesService.getScriptProperties().getProperty(BOOK_PROPERTY)) return '';
  return requiredId_(template.Thu_Muc_Luu_ID, 'Thu_Muc_Luu_ID');
}

function destination_(template, cfg, year, customer) {
  const custom = customFolderId_(template);
  return custom
    ? DriveApp.getFolderById(custom)
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

function createContract_(ctx, newEdition) {
  const row = ctx.data;
  if (row.So_HD) {
    locateContract_(ctx.sheet, ctx.map, row.So_HD);
    checkFileIdle_(ctx);
  }
  if (!newEdition && row.Link_PDF) throw new Error('Dòng này đã có PDF. Hãy dùng Tạo lại PDF.');
  if (row.Trang_Thai && row.Trang_Thai !== ST.draft) throw new Error('Chỉ tạo hợp đồng trên dòng nháp.');
  if (!newEdition && row.Link_Docs && row.So_HD) return regeneratePdf_(ctx);
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
  const nameCell = ctx.sheet.getRange(ctx.row, ctx.map.Ten_KH);
  const customerName = String(kh.Ten_Cong_Ty).trim();
  if (nameCell.getFormula()) row.Ten_KH = customerName;
  else setField_(ctx, 'Ten_KH', customerName);
  setField_(ctx, 'Gia_Tri_Bang_Chu', row.Gia_Tri === '' ? '' : docSoThanhChu(row.Gia_Tri));
  if (!row.Ngay_Tao) setField_(ctx, 'Ngay_Tao', new Date(Math.floor(Date.now()/1000)*1000));
  if (!row.Nguoi_Tao) setField_(ctx, 'Nguoi_Tao', email);
  setField_(ctx, 'Trang_Thai', ST.draft);
  const name = row.So_HD + ' - ' + row.Ten_KH + (newEdition ? ' - Trình ' + (Number(row.Phien_Trinh || 0)+1) : '');
  const map = placeholders_(row, kh, cfg);
  reserveFileJob_(ctx);
  return () => {
    let proof;
    const pdf = fillTemplateAndExportPdf_(id, folder, name, map, url => linkFile_(ctx, 'Link_Docs', url), value => { proof = value; });
    linkFile_(ctx, 'Link_PDF', pdf.getUrl(), proof);
    return 'Đã tạo Docs và PDF cho ' + row.So_HD;
  };
}

function fileJobKey_(ctx) { return 'xuat/' + ctx.data.So_HD; }

function checkFileIdle_(ctx) {
  const expiry = PropertiesService.getScriptProperties().getProperty(fileJobKey_(ctx));
  if (Number(expiry) > Date.now()) throw new Error('Hợp đồng này đang được xuất tệp. Hãy đợi tác vụ hoàn tất.');
}

function reserveFileJob_(ctx) {
  checkFileIdle_(ctx);
  // Mỗi lượt chạy Apps Script tối đa 6 phút. Sau khi bị dừng cưỡng bức, có thể thử lại.
  PropertiesService.getScriptProperties().setProperty(fileJobKey_(ctx), String(Date.now() + 7 * 60000));
}

function releaseFileJob_(ctx) {
  PropertiesService.getScriptProperties().deleteProperty(fileJobKey_(ctx));
}

// Tra lại vị trí nếu bảng đã được sắp xếp khi Drive đang xử lý.
function locateContract_(sheet, map, number) {
  const numbers = sheet.getRange(2, map.So_HD, sheet.getLastRow() - 1, 1);
  const matches = numbers.createTextFinder(String(number)).matchEntireCell(true).matchCase(true).findAll();
  if (matches.length !== 1) throw new Error('Cần có đúng một dòng mang số hợp đồng ' + number);
  return matches[0].getRow();
}

function linkFile_(ctx, key, url, proof) {
  withLock_(() => {
    const sheet = ctx.sheet;
    const map = getHeaderIndexMap_(sheet);
    try {
      const row = locateContract_(sheet, map, ctx.data.So_HD);
      const current = {...ctx, row, map};
      if (proof) {
        addFields_(current,['Dau_Tep_Xuat']);
        setField_(current,'Dau_Tep_Xuat',proof);
      }
      setField_(current, key, url);
    } catch (err) { throw new Error(err.message + '. Tệp đã lưu tại ' + url); }
  });
}

function regeneratePdf_(ctx) {
  const row = ctx.data;
  if (!row.So_HD || !row.Link_Docs) throw new Error('Cần có số hợp đồng và bản Docs để tạo lại PDF.');
  if (row.Trang_Thai === ST.pending) throw new Error('Hồ sơ đang chờ duyệt. Hãy trả về nháp trước khi xuất lại.');
  const file = docFile_(row.Link_Docs);
  const folder = folderOfDoc_(row.Link_Docs);
  reserveFileJob_(ctx);
  return () => {
    let proof;
    const pdf = exportPdf_(file, folder, file.getName(), value => { proof = value; });
    linkFile_(ctx, 'Link_PDF', pdf.getUrl(), proof);
    return 'Đã xuất PDF từ bản Docs của ' + row.So_HD;
  };
}
