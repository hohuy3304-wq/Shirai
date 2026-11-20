function placeholders_(row, customer, cfg) {
  const map = Object.create(null);
  SCHEMA[TAB.contracts].filter(k => !OMIT_DOC.includes(k)).forEach(k => {
    let value = row[k];
    if (value instanceof Date) value = formatDateVi_(value);
    if (k === 'Gia_Tri') value = formatCurrencyVnd_(value);
    map[k.toUpperCase()] = value;
  });
  SCHEMA[TAB.customers].forEach(k => {
    map[k.toUpperCase()] = customer[k];
    if (ALIAS_KH[k]) map[ALIAS_KH[k]] = customer[k];
  });
  Object.keys(ALIAS_HD).forEach(k => { map[ALIAS_HD[k]] = row[k]; });
  SELLER.forEach(k => { map[k] = cfg[k]; });
  return map;
}

function fillSection_(section, map, pattern) {
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
    const value = map[key] == null ? '' : String(map[key]).trim();
    if (value) {
      const attrs = text.getAttributes(start);
      text.insertText(start, value).setAttributes(start, start + value.length - 1, attrs);
    }
    text.deleteText(start + value.length, end + value.length);
  });
}

function fillTab_(tab, map, pattern) {
  const body = tab.getBody();
  fillSection_(body, map, pattern);
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
  sections.filter(Boolean).forEach(s => fillSection_(s, map, pattern));
}

function exportPdf_(file, folder, name) {
  return folder.createFile(file.getAs(MimeType.PDF).setName(name + '.pdf'));
}

function fillTemplateAndExportPdf_(templateId, destFolder, fileName, map, saveDocLink) {
  const copy = DriveApp.getFileById(templateId).makeCopy(fileName, destFolder);
  try {
    const doc = DocumentApp.openById(copy.getId());
    const pattern = Object.keys(map).map(key => escapeRegex_('{{' + key + '}}')).join('|');
    function visit(tab) {
      fillTab_(tab.asDocumentTab(), map, pattern);
      tab.getChildTabs().forEach(visit);
    }
    if (typeof doc.getTabs === 'function') doc.getTabs().forEach(visit);
    else fillTab_(doc, map, pattern);
    doc.saveAndClose();
  } catch (err) {
    copy.setTrashed(true);
    throw err;
  }
  saveDocLink(copy.getUrl());
  return exportPdf_(copy, destFolder, fileName);
}
