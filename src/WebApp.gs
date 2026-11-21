// Lưu ID từ chính bảng tính liên kết, không nhận ID sổ từ URL hay từ trình duyệt.
const BOOK_PROPERTY = 'hopdong/spreadsheet';
let executionBook_;

function contractBook_() {
  if (executionBook_) return executionBook_;
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return (executionBook_ = active);
  const id = PropertiesService.getScriptProperties().getProperty(BOOK_PROPERTY);
  if (!id) throw new Error('Chủ sở hữu cần mở Sheet và chọn Hợp đồng → Kết nối Web App…');
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

function doGet() {
  if (!PropertiesService.getScriptProperties().getProperty(BOOK_PROPERTY))
    return HtmlService.createHtmlOutput('Chủ sở hữu cần mở Sheet và chọn Hợp đồng → Kết nối Web App…');
  checkWebIdentity_();
  contractBook_().getName(); // Kiểm tra quyền đọc sổ của chính người đang mở app.
  return deskPage_('create');
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
  const ui = SpreadsheetApp.getUi();
  const root = DriveApp.getFolderById(requiredId_(getConfig().ROOT_FOLDER_ID, 'ROOT_FOLDER_ID'));
  const answer = ui.alert('Kết nối Web App', 'Sử dụng thư mục “' + root.getName() +
    '” cho sổ này? Bảng tính sẽ được chuyển vào đó, mẫu ngoài thư mục sẽ được sao chép vào Mẫu hợp đồng. Hợp đồng mới lưu theo năm và khách hàng. Hãy kiểm tra quyền chia sẻ của thư mục.', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  runAction_('Kết nối Web App', () => {
    if (requiredId_(getConfig().ROOT_FOLDER_ID,'ROOT_FOLDER_ID') !== root.getId())
      throw new Error('Thư mục cấu hình đã thay đổi. Hãy mở lại mục kết nối.');
    initSheetStructure();
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
    return 'Đã kết nối bảng tính. Trong Apps Script, chọn Triển khai → Tùy chọn triển khai mới → Ứng dụng web.';
  }, {menu:true});
}
