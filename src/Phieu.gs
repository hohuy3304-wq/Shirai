function moPhieuHopDong() { openDesk_('create'); }
function moHoSoCuaToi() { openDesk_('mine'); }
function moChoDuyet() { openDesk_('review'); }
function openDesk_(page) {
  SpreadsheetApp.getUi().showModalDialog(
    deskPage_(page).setWidth(960).setHeight(670), 'Hồng Thiên · Quản lý hợp đồng'
  );
}

function moBanLamViec(page) {
  const catalog = layDanhMucPhieu();
  const list = ['manage','mine','review','approved'].includes(page) ? danhSachHoSo(page) : null;
  return {catalog, list};
}

function layDanhMucPhieu() {
  const cfg = getConfig();
  const email = activeEmail_();
  const owner = contractBook_().getOwner();
  const templates = records_(TAB.templates);
  const isOwner = !!owner && owner.getEmail().toLowerCase() === email;
  const types = templates.map(r => String(r.Loai_HD).trim()).filter(Boolean);
  return {
    bookUrl: contractBook_().getUrl(),
    frameworkTypes: types.filter(isHdnt_),
    approver: isApprover_(email, cfg),
    owner: isOwner,
    settings: isOwner ? {
      sellerFields: Object.fromEntries(SELLER.map(k => [k,cfg[k] || ''])),
      reviewers: cfg.NGUOI_DUYET || '', root: cfg.ROOT_FOLDER_ID || '',
      connected: !!PropertiesService.getScriptProperties().getProperty(BOOK_PROPERTY),
      templates: templates.map(r => ({type:String(r.Loai_HD), doc:String(r.ID_Google_Docs_Mau || '')}))
    } : null,
    seller: [cfg.TEN_BEN_BAN, cfg.MST_BEN_BAN, cfg.DIA_CHI_BEN_BAN, cfg.DAI_DIEN_BEN_BAN, cfg.CHUC_VU_BEN_BAN].filter(Boolean).join(' · '),
    today: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'),
    email,
    types,
    customers: records_(TAB.customers).filter(r => r.Ma_KH !== '').map(customerCard_)
  };
}

function dateFromForm_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Hãy chọn đủ các ngày của hợp đồng.');
  const date = new Date(value + 'T00:00:00+07:00');
  if (!validDate_(date) || Utilities.formatDate(date, TZ, 'yyyy-MM-dd') !== value) throw new Error('Ngày không hợp lệ.');
  return date;
}

function formData_(form) {
  const fields = {};
  for (const k of ['Loai_HD','Ma_KH','Noi_Dung_HD','Dieu_Khoan_Thanh_Toan','Nguoi_Phu_Trach','Ghi_Chu']) {
    fields[k] = String(form[k] || '').trim();
  }
  const framework = isHdnt_(fields.Loai_HD);
  fields.Ngay_Ky = dateFromForm_(form.Ngay_Ky);
  fields.Ngay_Hieu_Luc = framework ? fields.Ngay_Ky : dateFromForm_(form.Ngay_Hieu_Luc);
  fields.Ngay_Het_Han = framework ? '' : dateFromForm_(form.Ngay_Het_Han);
  if (framework) {
    fields.Ngay_Ra_Soat = form.Ngay_Ra_Soat ? dateFromForm_(form.Ngay_Ra_Soat) : '';
    fields.So_Uy_Quyen = String(form.So_Uy_Quyen || '').trim();
    fields.Ngay_Uy_Quyen = form.Ngay_Uy_Quyen ? dateFromForm_(form.Ngay_Uy_Quyen) : '';
    if ((form.Ky_Theo_Uy_Quyen || fields.So_Uy_Quyen || fields.Ngay_Uy_Quyen) && (!fields.So_Uy_Quyen || !fields.Ngay_Uy_Quyen))
      throw new Error('Khi ký theo ủy quyền, hãy điền cả số và ngày giấy ủy quyền.');
    fields.Uy_Quyen = fields.So_Uy_Quyen
      ? 'Theo giấy ủy quyền số ' + fields.So_Uy_Quyen + ' ngày ' + formatDateVi_(fields.Ngay_Uy_Quyen)
      : String(form.Uy_Quyen || '').trim();
    fields.Thay_Doi = String(form.Thay_Doi || '').trim();
    fields.Noi_Dung_HD = 'Ống lõi giấy';
    fields.Dieu_Khoan_Thanh_Toan = 'Theo Điều IV của mẫu HĐNT';
  }
  const money = String(form.Gia_Tri ?? '').trim();
  if ((!framework || money) && !/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(money)) throw new Error('Nhập số tiền VND nguyên, ví dụ 15500000 hoặc 15.500.000.');
  fields.Gia_Tri = money ? Number(money.replace(/\./g, '')) : '';
  validateContract_(fields);
  if (!fields.Noi_Dung_HD || !fields.Dieu_Khoan_Thanh_Toan) throw new Error('Hãy nhập nội dung hợp đồng và điều khoản thanh toán.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.Nguoi_Phu_Trach)) throw new Error('Email người phụ trách chưa hợp lệ.');
  return fields;
}

function literalCell_(v) {
  return typeof v === 'string' && v.startsWith('=') ? "'" + v : v;
}

function formCustomer_(form, code) {
  if (form.Ma_KH) {
    if (!form.buyerSupplement) return getCustomerInfo_(code);
    const rows = records_(TAB.customers);
    const index = customerIndex_(rows, code);
    const current = customerCard_(rows[index]).fields;
    const updated = {...current};
    for (const key of ['Ten_Cong_Ty','Dia_Chi','MST','Nguoi_Dai_Dien','Chuc_Vu']) {
      const value = String(form.buyerSupplement[key] || '').trim();
      if (!value) continue;
      if (current[key] && current[key] !== value)
        throw new Error('Đồng nghiệp đã cập nhật thông tin bên mua. Hãy đối chiếu lại khách hàng trên phiếu.');
      updated[key] = value;
    }
    const valid = customerInput_({...updated, Loai_HD:form.Loai_HD}, code, rows);
    writeCustomerChanges_(index,current,valid);
    return valid;
  }
  if (form.buyerMode && form.buyerMode !== 'new') throw new Error('Hãy chọn khách hàng hoặc bấm Thêm khách hàng.');
  const rows = records_(TAB.customers);
  const saved = rows.find(r => String(r.Ma_KH) === code);
  if (saved) return saved;
  const customer = customerInput_(form,code,rows);
  const s = sheet_(TAB.customers);
  const map = getHeaderIndexMap_(s);
  const values = {};
  Object.keys(customer).forEach(k => { values[k] = literalCell_(customer[k]); });
  appendRecord_(s, map, values);
  return customer;
}

function customerCard_(r) {
  const fields = {};
  for (const key of SCHEMA[TAB.customers]) fields[key] = String(r[key] ?? '').trim();
  return {fields, code:fields.Ma_KH, name:fields.Ten_Cong_Ty, tax:fields.MST, address:fields.Dia_Chi,
    representative:fields.Nguoi_Dai_Dien, position:fields.Chuc_Vu, version:digest_(fields)};
}

function customerInput_(form, code, rows) {
  const customer = {Ma_KH: code};
  SCHEMA[TAB.customers].filter(k => k !== 'Ma_KH').forEach(k => { customer[k] = String(form[k] || '').trim(); });
  if (!customer.Ten_Cong_Ty || !customer.Dia_Chi) throw new Error('Khách hàng mới cần tên và địa chỉ.');
  validateBuyer_(form.Loai_HD, customer);
  if (customer.MST && rows.some(r => String(r.Ma_KH).trim() !== code && String(r.MST).trim() === customer.MST))
    throw new Error('Mã số thuế đã có trong danh mục. Hãy chọn khách hàng hiện có.');
  return customer;
}

function luuKhachHang(form, code, version, token) {
  activeEmail_();
  return runAction_('Lưu khách hàng', () => {
    if (!code) {
      draftKey_(token);
      const created = formCustomer_({...form,Ma_KH:''},'KH-' + token);
      return 'Đã lưu khách hàng ' + created.Ten_Cong_Ty;
    }
    const rows = records_(TAB.customers);
    const index = customerIndex_(rows,code);
    const current = customerCard_(rows[index]);
    const values = customerInput_(form,code,rows);
    if (current.version !== customerCard_(values).version && current.version !== version)
      throw new Error('Khách hàng đã thay đổi. Hãy mở lại để cập nhật.');
    writeCustomerChanges_(index,current.fields,values);
    return 'Đã lưu khách hàng ' + values.Ten_Cong_Ty;
  },{});
}

function customerIndex_(rows,code) {
  const matches = rows.map((row,index) => ({row,index})).filter(item => String(item.row.Ma_KH).trim() === code);
  if (matches.length !== 1) throw new Error('Cần đúng một khách hàng có mã ' + code + '. Hãy tải lại danh mục.');
  return matches[0].index;
}

function writeCustomerChanges_(index,current,values) {
  const changes = SCHEMA[TAB.customers].filter(key => key !== 'Ma_KH' && current[key] !== values[key]);
  if (!changes.length) return;
  const sheet = sheet_(TAB.customers), map = getHeaderIndexMap_(sheet);
  for (const {start,width} of coreSpans_(changes.map(key => map[key]))) {
    const keys = changes.filter(key => map[key] >= start && map[key] < start + width).sort((a,b) => map[a]-map[b]);
    sheet.getRange(index+2,start,1,width).setValues([keys.map(key => literalCell_(values[key]))]);
  }
}

function validateBuyer_(type, customer) {
  const required = ['Ten_Cong_Ty','MST','Dia_Chi','Nguoi_Dai_Dien','Chuc_Vu'];
  if (isHdnt_(type) && required.some(k => !String(customer[k] || '').trim()))
    throw new Error('Cần có tên công ty, MST, địa chỉ, đại diện và chức vụ bên mua trong danh mục khách hàng.');
}

function formRow_(form, creator) {
  const token = String(form.token || '');
  if (!/^[0-9a-f-]{36}$/i.test(token)) throw new Error('Hãy đóng và mở lại phiếu.');
  const sheet = sheet_(TAB.contracts);
  const map = getHeaderIndexMap_(sheet);
  const additions = ['Noi_Dung_HD', 'Ma_Phieu'].concat(isHdnt_(form.Loai_HD) ? ['Ngay_Ra_Soat','Uy_Quyen','Thay_Doi','So_Uy_Quyen','Ngay_Uy_Quyen'] : []).filter(k => !map[k]);
  if (additions.length) {
    const col = sheet.getLastColumn() + 1;
    if (col + additions.length - 1 > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), additions.length);
    sheet.getRange(1, col, 1, additions.length).setValues([additions]);
    additions.forEach((k, i) => { map[k] = col + i; });
  }
  const range = sheet.getDataRange();
  const rows = range.getValues();
  const prior = rows.findIndex(r => r[map.Ma_Phieu - 1] === token);
  if (prior > 0) return rowAt_(sheet, prior + 1);
  if (creator) readDraft_(form);
  const code = String(form.Ma_KH || 'KH-' + token);
  const fields = formData_({...form, Ma_KH: code});
  const template = getTemplateInfo_(fields.Loai_HD);
  requiredId_(template.ID_Google_Docs_Mau, 'ID_Google_Docs_Mau');
  if (!customFolderId_(template)) requiredId_(getConfig().ROOT_FOLDER_ID, 'ROOT_FOLDER_ID');
  const customer = formCustomer_(form, code);
  validateBuyer_(fields.Loai_HD, customer);
  const formulas = range.getFormulas();
  // Tìm dòng trống thật sự, bỏ qua công thức tra tên được khởi tạo sẵn.
  let i = rows.findIndex((r, idx) => idx > 0 && r.every((v,j) =>
    v === '' && (!formulas[idx][j] || j === map.Ten_KH - 1)));
  if (i < 0) i = rows.length;
  if (i >= sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
  const values = Array(range.getNumColumns()).fill('');
  Object.assign(fields, {Ma_Phieu: token, Trang_Thai: ST.draft, Ten_KH: customer.Ten_Cong_Ty});
  if (creator) fields.Nguoi_Tao = creator;
  Object.keys(fields).forEach(k => { values[map[k]-1] = literalCell_(fields[k]); });
  const nameFormula = formulas[i] && formulas[i][map.Ten_KH - 1];
  if (nameFormula) values[map.Ten_KH - 1] = nameFormula;
  sheet.getRange(i+1, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
  return rowAt_(sheet, i+1);
}

function taoTuPhieu(form) {
  let ctx;
  try {
    runAction_('Tạo hợp đồng từ phiếu', row => {
      if (row.data.Link_PDF && row.data.Link_Docs) return 'Hợp đồng đã tạo.';
      return createContract_(row);
    }, {context: () => { ctx = formRow_(form); return ctx; }});
    return {number: ctx.data.So_HD, docs: ctx.data.Link_Docs, pdf: ctx.data.Link_PDF};
  } catch (err) {
    return {error: err.message, saved: Boolean(ctx), row: ctx && ctx.row || 0};
  }
}

function chuanBiHopDong() {
  runAction_('Chuẩn bị mẫu và thư mục', () => {
    const ss = contractBook_();
    const owner = ss.getOwner();
    if (!owner || owner.getEmail().toLowerCase() !== activeEmail_()) throw new Error('Chủ sở hữu bảng tính cần chạy bước chuẩn bị.');
    initSheetStructure();
    const cfgSheet = sheet_(TAB.config);
    const cfgMap = getHeaderIndexMap_(cfgSheet);
    const config = getConfig();
    let root = config.ROOT_FOLDER_ID;
    if (!root || root === '<DIEN_ID_THU_MUC_GOC>') {
      const parent = DriveApp.getRootFolder();
      const folderName = 'Quản lý hợp đồng Hồng Thiên';
      const existing = parent.getFoldersByName(folderName);
      const folder = existing.hasNext() ? existing.next() : parent.createFolder(folderName);
      if (existing.hasNext()) throw new Error('Có nhiều thư mục cùng tên. Hãy dán liên kết thư mục cần dùng vào ROOT_FOLDER_ID trong CauHinh.');
      const configRow = records_(TAB.config).findIndex(r => String(r.Key).trim() === 'ROOT_FOLDER_ID') + 2;
      cfgSheet.getRange(configRow, cfgMap.Value).setValue(folder.getId());
      root = folder.getId();
      SpreadsheetApp.flush();
    }
    const folder = DriveApp.getFolderById(requiredId_(root, 'ROOT_FOLDER_ID'));
    const templates = sheet_(TAB.templates);
    const map = getHeaderIndexMap_(templates);
    const created = [];
    records_(TAB.templates).forEach((r,i) => {
      if (!r.Loai_HD || isHdnt_(r.Loai_HD) || (r.ID_Google_Docs_Mau && r.ID_Google_Docs_Mau !== '<DIEN_ID_DOC_MAU>')) return;
      const doc = DocumentApp.create('Mẫu hợp đồng – ' + r.Loai_HD);
      const body = doc.getBody();
      body.appendParagraph('HỢP ĐỒNG {{LOAI_HD}}').setHeading(DocumentApp.ParagraphHeading.TITLE);
      body.appendParagraph('Số {{SO_HD}} · Ngày ký {{NGAY_KY}}');
      body.appendParagraph('Bên cung cấp').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendParagraph('{{TEN_BEN_BAN}}\nMã số thuế: {{MST_BEN_BAN}}\nĐịa chỉ: {{DIA_CHI_BEN_BAN}}\nĐại diện: {{DAI_DIEN_BEN_BAN}} · {{CHUC_VU_BEN_BAN}}');
      body.appendParagraph('Khách hàng').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendParagraph('{{TEN_KH}}\nMã số thuế: {{MST_KH}}\nĐịa chỉ: {{DIA_CHI_KH}}\nĐại diện: {{DAI_DIEN_KH}} · {{CHUC_VU_KH}}\nĐiện thoại: {{SDT_KH}} · Email: {{EMAIL_KH}}\nTài khoản: {{TAI_KHOAN_NH_KH}}');
      body.appendParagraph('Nội dung thỏa thuận').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendParagraph('{{NOI_DUNG_HD}}\nThời hạn: {{NGAY_HIEU_LUC}} đến {{NGAY_HET_HAN}}\nGiá trị: {{GIA_TRI}} ({{GIA_TRI_BANG_CHU}})\nThanh toán: {{DIEU_KHOAN_THANH_TOAN}}\nNgười phụ trách: {{NGUOI_PHU_TRACH}}\nGhi chú: {{GHI_CHU}}');
      const id = doc.getId();
      doc.saveAndClose();
      DriveApp.getFileById(id).moveTo(childFolder_(folder, 'Mẫu hợp đồng'));
      templates.getRange(i+2, map.ID_Google_Docs_Mau).setValue(id);
      SpreadsheetApp.flush();
      created.push(r.Loai_HD);
    });
    return (created.length ? 'Đã tạo mẫu tham khảo: ' + created.join(', ') + '. ' : '') +
      'Hãy kiểm tra thông tin bên bán trong CauHinh. Với HĐNT, điền liên kết mẫu trong Thiết lập. Chọn Hợp đồng → Tạo hợp đồng để nhập liệu.';
  }, {menu:true});
}
