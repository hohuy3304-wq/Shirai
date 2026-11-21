function placeholders_(row, customer, cfg) {
  const map = Object.create(null);
  SCHEMA[TAB.contracts].filter(k => !OMIT_DOC.includes(k)).forEach(k => {
    let value = row[k];
    if (value instanceof Date) value = formatDateVi_(value);
    if (k === 'Gia_Tri' && value !== '' && value != null) value = formatCurrencyVnd_(value);
    map[k.toUpperCase()] = value;
  });
  map.UY_QUYEN_KH = row.Uy_Quyen || '';
  map.THAY_DOI = row.Thay_Doi || '';
  map.NGAY_RA_SOAT = row.Ngay_Ra_Soat ? formatDateVi_(row.Ngay_Ra_Soat) : '';
  map.NOI_DUNG_HD = row.Noi_Dung_HD || '';
  SCHEMA[TAB.customers].forEach(k => {
    map[k.toUpperCase()] = customer[k];
    if (ALIAS_KH[k]) map[ALIAS_KH[k]] = customer[k];
  });
  Object.keys(ALIAS_HD).forEach(k => { map[ALIAS_HD[k]] = row[k]; });
  SELLER.forEach(k => { map[k] = cfg[k]; });
  return map;
}

function fillSection_(section, map, pattern, found) {
  // RE2 định vị phần tử. Thay theo offset từ phải sang trái để giữ định dạng
  // lân cận và chèn nguyên văn cả ký tự $, dấu gạch chéo và giá trị giống khóa.
  const nodes = [];
  let hit = section.findText(pattern);
  while (hit) {
    if (!hit.isPartial() || hit.getStartOffset() >= 0) {
      const text = hit.getElement().asText();
      const start = hit.isPartial() ? hit.getStartOffset() : 0;
      const end = hit.isPartial() ? hit.getEndOffsetInclusive() : text.getText().length - 1;
      nodes.push({text, start, end, key: text.getText().slice(start + 2, end - 1)});
    }
    hit = section.findText(pattern, hit);
  }
  nodes.reverse().forEach(({text, start, end, key}) => {
    found.add(key);
    const value = map[key] == null ? '' : String(map[key]).trim();
    if (value) {
      const attrs = text.getAttributes(start);
      text.insertText(start, value).setAttributes(start, start + value.length - 1, attrs);
    }
    text.deleteText(start + value.length, end + value.length);
  });
}

function fillTab_(tab, map, pattern, found) {
  const body = tab.getBody();
  fillSection_(body, map, pattern, found);
  // Một số tài liệu có nhiều vùng đầu trang hoặc chân trang.
  const sections = [];
  try {
    const parent = body.getParent();
    for (let i = 0; i < parent.getNumChildren(); i++) {
      const child = parent.getChild(i);
      if ([DocumentApp.ElementType.HEADER_SECTION, DocumentApp.ElementType.FOOTER_SECTION].includes(child.getType())) sections.push(child);
    }
  } catch (err) {
    console.info('Dùng đầu trang và chân trang của tab: ' + err.message);
  }
  if (!sections.some(s => s.getType() === DocumentApp.ElementType.HEADER_SECTION)) sections.push(tab.getHeader());
  if (!sections.some(s => s && s.getType() === DocumentApp.ElementType.FOOTER_SECTION)) sections.push(tab.getFooter());
  sections.filter(Boolean).forEach(s => fillSection_(s, map, pattern, found));
}

function exportPdf_(file, folder, name) {
  return folder.createFile(file.getAs(MimeType.PDF).setName(name + '.pdf'));
}

function fillTemplateAndExportPdf_(templateId, destFolder, fileName, map, saveDocLink) {
  const copy = DriveApp.getFileById(templateId).makeCopy(fileName, destFolder);
  try {
    const doc = DocumentApp.openById(copy.getId());
    const pattern = Object.keys(map).map(key => escapeRegex_('{{' + key + '}}')).join('|');
    const found = new Set();
    function visit(tab) {
      fillTab_(tab.asDocumentTab(), map, pattern, found);
      tab.getChildTabs().forEach(visit);
    }
    if (typeof doc.getTabs === 'function') doc.getTabs().forEach(visit);
    else fillTab_(doc, map, pattern, found);
    if (isHdnt_(map.LOAI_HD)) {
      const missing = SELLER.filter(key => found.has(key) && !String(map[key] || '').trim());
      if (missing.length) throw new Error('Hãy điền thông tin bên bán trong CauHinh: ' + missing.join(', '));
    }
    for (const key of ['UY_QUYEN_KH', 'THAY_DOI']) {
      if (map[key] && !found.has(key)) throw new Error('Mẫu thiếu {{' + key + '}}. Hãy bổ sung khóa tại vị trí cần in rồi gửi lại.');
    }
    doc.saveAndClose();
  } catch (err) {
    copy.setTrashed(true);
    throw err;
  }
  saveDocLink('https://docs.google.com/document/d/' + copy.getId() + '/edit');
  return exportPdf_(copy, destFolder, fileName);
}
