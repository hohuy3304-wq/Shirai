// Sổ được gắn một lần sau khi xác minh tài khoản quản trị.
const BOOK_PROPERTY = 'hopdong/spreadsheet';
let executionBook_;

function contractBook_() {
  if (executionBook_) return executionBook_;
  const id = PropertiesService.getScriptProperties().getProperty(BOOK_PROPERTY);
  if (!id) {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return (executionBook_ = active);
    throw new Error('Hãy hoàn tất thiết lập lần đầu trong Web App.');
  }
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound && bound.getId() === id) return (executionBook_ = bound);
  checkWebIdentity_();
  return (executionBook_ = SpreadsheetApp.openById(id));
}

function deskPage_(page) {
  const template = HtmlService.createTemplateFromFile('BanLamViec');
  template.startPage = page;
  return template.evaluate().setTitle('Hồng Thiên · Quản lý hợp đồng')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function checkWebIdentity_() {
  if (activeEmail_() !== Session.getEffectiveUser().getEmail().trim().toLowerCase())
    throw new Error('Hãy triển khai ứng dụng chạy bằng tài khoản người dùng truy cập.');
}

function doGet(e) {
  checkWebIdentity_();
  if (!PropertiesService.getScriptProperties().getProperty(BOOK_PROPERTY)) {
    if (!setupAdmin_()) return HtmlService.createHtmlOutput('Ứng dụng đang chờ tài khoản quản trị hoàn tất thiết lập. Hãy mở lại sau.');
    return HtmlService.createHtmlOutputFromFile('KhoiTao').setTitle('Thiết lập Hồng Thiên')
      .addMetaTag('viewport','width=device-width, initial-scale=1');
  }
  contractBook_().getName(); // Kiểm tra quyền đọc sổ của chính người đang mở app.
  return deskPage_(e && e.parameter && e.parameter.page === 'settings' && contractBook_().getOwner().getEmail().toLowerCase() === activeEmail_() ? 'settings' : 'manage');
}

function moWebApp() {
  const url = ScriptApp.getService().getUrl();
  if (!url) return showAlert_('Chủ sở hữu mở Apps Script → Triển khai → Ứng dụng web để lấy đường dẫn /exec.');
  const link = HtmlService.createHtmlOutput('<p><a target="_blank" rel="noopener" href="' + html_(url) +
    '">Mở web app quản lý hợp đồng</a></p>').setWidth(360).setHeight(95);
  SpreadsheetApp.getUi().showModalDialog(link,'Quản lý hợp đồng Hồng Thiên');
}

function childFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (!folders.hasNext()) return parent.createFolder(name);
  const folder = folders.next();
  if (folders.hasNext()) throw new Error('Có nhiều thư mục trùng tên ' + name);
  return folder;
}

function hasParent_(file, id) {
  const parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === id) return true;
  return false;
}

// appProperties được ghi cùng lệnh tạo bản sao để lần thử lại nhận diện đúng tệp.
function copyNativeDoc_(sourceId, folder, name, version) {
  const key = digest_([sourceId, String(version), folder.getId(), name]);
  const q = "'" + folder.getId() + "' in parents and trashed = false and appProperties has { key='hopdong' and value='" + key + "' }";
  const matches = Drive.Files.list({q, pageSize: 2, fields: 'nextPageToken,files(id)'}).files || [];
  if (matches.length > 1) throw new Error('Có nhiều bản sao của cùng phiên bản ' + name);
  if (matches.length) return matches[0].id;
  return Drive.Files.copy({name, parents: [folder.getId()], appProperties: {hopdong: key}},
    sourceId, {fields: 'id'}).id;
}

function templateInRoot_(id, folder) {
  const file = DriveApp.getFileById(id);
  if (file.getMimeType() !== MimeType.GOOGLE_DOCS) throw new Error('Hãy chọn bản mẫu Google Tài liệu.');
  if (hasParent_(file, folder.getId())) return id;
  const version = driveVersion_(id);
  return copyNativeDoc_(id, folder, file.getName(), version);
}

function ketNoiWebApp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || !ss.getOwner() || ss.getOwner().getEmail().toLowerCase() !== activeEmail_())
    throw new Error('Chủ sở hữu cần thực hiện từ menu của bảng tính My Drive.');
  const linked = PropertiesService.getScriptProperties().getProperty(BOOK_PROPERTY);
  if (linked && linked !== ss.getId()) throw new Error('Web App đang dùng một sổ dữ liệu khác.');
  const ui = SpreadsheetApp.getUi();
  const root = DriveApp.getFolderById(requiredId_(getConfig().ROOT_FOLDER_ID, 'ROOT_FOLDER_ID'));
  const answer = ui.alert('Kết nối Web App', 'Sử dụng thư mục “' + root.getName() +
    '” cho sổ này? Bảng tính sẽ được chuyển vào đó, mẫu ngoài thư mục sẽ được sao chép vào Mẫu hợp đồng. Hợp đồng mới lưu theo năm và khách hàng. Hãy kiểm tra quyền chia sẻ của thư mục.', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  runAction_('Kết nối Web App', () => {
    const current = PropertiesService.getScriptProperties().getProperty(BOOK_PROPERTY);
    if (current && current !== ss.getId()) throw new Error('Ứng dụng đã kết nối với sổ khác.');
    if (requiredId_(getConfig().ROOT_FOLDER_ID,'ROOT_FOLDER_ID') !== root.getId())
      throw new Error('Thư mục cấu hình đã thay đổi. Hãy mở lại mục kết nối.');
    initSheetStructure();
    connectBook_(ss, root);
    return 'Đã kết nối bảng tính. Trong Apps Script, chọn Triển khai → Tùy chọn triển khai mới → Ứng dụng web.';
  }, {menu:true});
}

function connectBook_(ss,root) {
  const dir = childFolder_(root, 'Mẫu hợp đồng');
  const sheet = sheet_(TAB.templates), map = getHeaderIndexMap_(sheet);
  records_(TAB.templates).forEach((r, i) => {
    if (!r.ID_Google_Docs_Mau || r.ID_Google_Docs_Mau === '<DIEN_ID_DOC_MAU>') return;
    const id = requiredId_(r.ID_Google_Docs_Mau, 'ID_Google_Docs_Mau');
    const stored = templateInRoot_(id, dir);
    if (stored !== r.ID_Google_Docs_Mau) sheet.getRange(i+2, map.ID_Google_Docs_Mau).setValue(stored);
  });
  const file = DriveApp.getFileById(ss.getId());
  if (!hasParent_(file,root.getId())) file.moveTo(root);
  PropertiesService.getScriptProperties().setProperty(BOOK_PROPERTY,ss.getId());
}

function setupAdmin_() {
  const configured = PropertiesService.getScriptProperties().getProperty('SETUP_ADMIN_EMAIL') ||
    (typeof INSTALL_OWNER === 'string' ? INSTALL_OWNER : '');
  return !!configured && configured.trim().toLowerCase() === activeEmail_();
}

function khoiTaoTuWeb(mode, bookLink, folderLink) {
  checkWebIdentity_();
  if (!setupAdmin_()) throw new Error('Chỉ quản trị viên cài đặt được chọn sổ.');
  return withLock_(() => {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(BOOK_PROPERTY)) throw new Error('Ứng dụng đã có sổ. Hãy tải lại trang.');
    const pending = 'hopdong/creating/' + activeEmail_();
    const rootId = folderLink.trim() ? requiredId_(folderLink,'ROOT_FOLDER_ID') : '';
    let root = rootId ? DriveApp.getFolderById(rootId) : null;
    if (root) root.getName();
    let ss;
    if (mode === 'existing') {
      const value = String(bookLink).trim();
      const match = /^https:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([\w-]+)(?:[/?#].*)?$/.exec(value);
      const id = match ? match[1] : value;
      if (!/^[\w-]{20,}$/.test(id)) throw new Error('Dán liên kết Google Sheets của sổ muốn dùng.');
      ss = SpreadsheetApp.openById(id);
    } else if (mode === 'new') {
      const prior = props.getProperty(pending);
      ss = prior ? SpreadsheetApp.openById(prior) : SpreadsheetApp.create('Sổ quản lý hợp đồng Hồng Thiên');
      if (!prior) props.setProperty(pending,ss.getId());
    } else throw new Error('Hãy chọn sổ hiện có hoặc tạo sổ mới.');
    if (!ss.getOwner() || ss.getOwner().getEmail().toLowerCase() !== activeEmail_())
      throw new Error('Hãy chọn Google Sheet trên My Drive do tài khoản của bạn sở hữu.');
    executionBook_ = ss;
    initSheetStructure();
    const old = getConfig().ROOT_FOLDER_ID;
    if (!root) root = old && !old.startsWith('<') ? DriveApp.getFolderById(requiredId_(old,'ROOT_FOLDER_ID'))
      : childFolder_(DriveApp.getRootFolder(),'Quản lý hợp đồng Hồng Thiên');
    const cfg = sheet_(TAB.config), index = records_(TAB.config).findIndex(r=>r.Key==='ROOT_FOLDER_ID');
    cfg.getRange(index+2,getHeaderIndexMap_(cfg).Value).setValue(root.getId());
    connectBook_(ss,root);
    props.deleteProperty(pending);
    return ScriptApp.getService().getUrl() + '?page=settings';
  });
}
