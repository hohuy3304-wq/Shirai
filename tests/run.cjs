const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function runtime(services = {}) {
  const src = path.join(__dirname, '../src');
  const context = vm.createContext({
    console,
    Utilities: {
      formatDate(date, zone, pattern) {
        const iso = new Intl.DateTimeFormat('sv-SE', {timeZone: zone}).format(date);
        if (pattern === 'yyyy') return iso.slice(0, 4);
        if (pattern === 'dd/MM/yyyy') return iso.split('-').reverse().join('/');
        assert.equal(pattern, 'yyyy-MM-dd');
        return iso;
      }
    },
    ...services
  });
  for (const file of fs.readdirSync(src).filter(file => file.endsWith('.gs'))) {
    vm.runInContext(fs.readFileSync(path.join(src, file), 'utf8'), context, {filename: file});
  }
  return context;
}

function properties() {
  const values = new Map();
  return {
    getProperty: k => values.get(k) ?? null,
    setProperty: (k, v) => values.set(k, v),
    deleteProperty: k => values.delete(k)
  };
}

test('Bộ kiểm thử dùng chung với Apps Script', () => assert.equal(runtime().runAllTests(), 5));

test('Hai lượt tạo xen kẽ, chống cấp trùng và phục hồi sau lỗi xuất PDF', () => {
  const props = properties();
  const alerts = [], logs = [], numbers = [], stored = [];
  let locked = false, copies = 0, failExport = true;
  const c = runtime({
    PropertiesService: {getScriptProperties: () => props},
    LockService: {getScriptLock: () => ({
      waitLock(ms) { assert.equal(ms, 10000); assert.equal(locked, false); locked = true; },
      releaseLock() { assert.equal(locked, true); locked = false; }
    })},
    SpreadsheetApp: {flush() {}},
    MimeType: {GOOGLE_DOCS: 'docs'},
    DriveApp: {getFileById: () => ({getMimeType: () => 'docs', getName: () => 'Hợp đồng'})}
  });
  const fields = Array.from(vm.runInContext('SCHEMA[TAB.contracts].slice().reverse()', c));
  const numberCol = fields.indexOf('So_HD') + 1;
  const sheet = {
    getName: () => 'HopDong', getLastRow: () => stored.length + 1, getLastColumn: () => fields.length,
    getRange(row, col, rows) {
      if (row === 1) return {getValues: () => [fields]};
      if (col === numberCol && rows) return {
        getValues: () => stored.map(r => [r.So_HD || '']),
        createTextFinder(number) { return {
          matchEntireCell() { return this; }, matchCase() { return this; },
          findAll() { return stored.flatMap((r, i) => r.So_HD === number ? [{getRow: () => i + 2}] : []); }
        }; }
      };
      if (rows) return {getValues: () => [fields.map(k => stored[row - 2][k] || '')]};
      return {getFormula: () => '', setValue(v) {
        assert.equal(locked, true);
        stored[row - 2][fields[col - 1]] = v;
        if (col === numberCol) numbers.push(v);
      }};
    }
  };
  const sample = vm.runInContext("({Loai_HD:'Dịch vụ', Ma_KH:'K', Gia_Tri:1001, Ngay_Hieu_Luc:new Date(2026,0,1), Ngay_Het_Han:new Date(2026,1,1)})", c);
  stored.push({...sample}, {...sample});
  let selected = 2;
  Object.assign(c, {
    activeRow_: () => c.rowAt_(sheet, selected),
    activeEmail_: () => 'a@example.com', currentYear_: () => '2026',
    getConfig: () => ({}), getCustomerInfo_: () => ({Ten_Cong_Ty: 'Công ty A'}),
    getTemplateInfo_: () => ({ID_Google_Docs_Mau: 'test', Tien_To_So_HD: 'HD'}),
    destination_: () => ({}), folderOfDoc_: () => ({}),
    showAlert_: msg => alerts.push(msg), appendLog_: (...args) => logs.push(args),
    fillTemplateAndExportPdf_(_id, _folder, _name, map, save) {
      assert.equal(locked, false);
      assert.equal(map.GIA_TRI_BANG_CHU, 'Một nghìn không trăm lẻ một đồng');
      copies++;
      if (copies === 1) {
        c.taoHopDongTuDongDangChon(); // Cùng dòng.
        assert.match(alerts.at(-1), /đang được xuất/);
        selected = 3;
        c.taoHopDongTuDongDangChon(); // Dòng khác trong lúc bản thứ nhất đang xuất.
        selected = 2;
      }
      save('https://docs.google.com/document/d/test/edit');
      if (map.SO_HD.endsWith('0001') && failExport) throw Error('Lỗi xuất thử nghiệm');
      return {getUrl: () => 'pdf/' + map.SO_HD};
    },
    exportPdf_: () => ({getUrl: () => 'pdf/thu-lai'})
  });
  c.taoHopDongTuDongDangChon();
  assert.deepEqual(numbers, ['HD-2026-0001', 'HD-2026-0002']);
  assert.equal(stored[1].Link_PDF, 'pdf/HD-2026-0002');
  assert.ok(stored[0].Link_Docs);
  assert.match(alerts.at(-1), /Lỗi xuất thử nghiệm/);
  failExport = false;
  c.taoHopDongTuDongDangChon();
  assert.equal(stored[0].Link_PDF, 'pdf/thu-lai');
  assert.equal(copies, 2);
  assert.equal(numbers.length, 2);
  assert.equal(logs.length, 4);
});

test('Quét nhiều lần trong ngày, hạn mức mail và ký tự HTML', () => {
  const props = properties(), mails = [], changed = [];
  let quota = 1, reads = 0;
  const c = runtime({
    PropertiesService: {getScriptProperties: () => props},
    SpreadsheetApp: {flush() {}},
    MailApp: {getRemainingDailyQuota: () => quota, sendEmail: m => mails.push(m)}
  });
  const headers = Array.from(vm.runInContext('SCHEMA[TAB.contracts].slice().reverse()', c));
  const data = [-1, 7, 30].map((days, i) => {
    const record = {So_HD: 'HD-' + i, Trang_Thai: 'Đã ký', Ten_KH: '<A&B>',
      Ngay_Het_Han: vm.runInContext('new Date(Date.now() + ' + days + ' * 86400000)', c)};
    return headers.map(k => record[k] || '');
  });
  Object.assign(c, {
    appendLog_() {},
    getConfig: () => ({SO_NGAY_NHAC: '7,30', EMAIL_NHAN_NHAC: 'a@example.com,b@example.com'}),
    sheet_: () => ({
      getDataRange: () => ({getValues() { reads++; return [headers, ...data]; }}),
      getRange: () => ({getA1Notation: () => 'F1'}),
      getRangeList: ranges => ({setValue(v) {
        changed.push(...ranges);
        data[0][headers.indexOf('Trang_Thai')] = v;
      }})
    })
  });
  assert.throws(() => c.dailyScan_(), /Hạn mức/);
  quota = 2;
  c.dailyScan_();
  c.dailyScan_();
  assert.deepEqual(changed, ['F2']);
  assert.equal(reads, 3);
  assert.equal(mails.length, 1);
  assert.match(mails[0].htmlBody, /&lt;A&amp;B&gt;/);
  assert.match(mails[0].body, /HD-1/);
  assert.match(mails[0].body, /HD-2/);
});

test('Khóa đúng cột sau khi đổi vị trí và giữ quyền của chủ sở hữu, người duyệt', () => {
  const order = [];
  const c = runtime({SpreadsheetApp: {ProtectionType: {RANGE: 'range'}}});
  const cols = Array.from(vm.runInContext('SCHEMA[TAB.contracts]', c)).reverse();
  const map = Object.fromEntries(cols.map((k, i) => [k, i + 1]));
  const users = ['owner@example.com', 'review@example.com', 'staff@example.com'].map(email => ({getEmail: () => email}));
  const protectedCols = [];
  const sheet = {
    getParent: () => ({getOwner: () => users[0]}), getProtections: () => [],
    getRange: (_row, col, _height, width) => ({protect: () => {
      protectedCols.push(...cols.slice(col - 1, col - 1 + width));
      return {
        setDescription() { return this; }, setWarningOnly() {},
        addEditor() { order.push('actor'); }, addEditors(emails) { assert.deepEqual(Array.from(emails).sort(), users.slice(0, 2).map(u => u.getEmail())); order.push('keep'); },
        getEditors: () => users, removeEditors(others) { assert.deepEqual(others, [users[2]]); order.push('drop'); },
        canDomainEdit: () => true, setDomainEdit(v) { assert.equal(v, false); order.push('domain'); }
      };
    }})
  };
  const ctx = {map, data: {So_HD: 'HD-1'}}, cfg = {NGUOI_DUYET: users[1].getEmail()};
  assert.throws(() => c.khoaDongHopDong_(sheet, 2, ctx, cfg, users[2].getEmail()), /người duyệt/);
  c.khoaDongHopDong_(sheet, 2, ctx, cfg, users[1].getEmail());
  assert.deepEqual(protectedCols, cols.filter(k => !['Trang_Thai', 'Ghi_Chu', 'Link_PDF', 'Link_Docs'].includes(k)));
  for (let i = 0; i < order.length; i += 4) assert.deepEqual(order.slice(i, i + 4), ['actor', 'keep', 'drop', 'domain']);
});

test('Điền mẫu có tab con, đầu và chân trang rồi đóng Docs trước khi xuất PDF', () => {
  const events = [];
  function section(initial, type = 'body') {
    let value = initial;
    const text = {
      asText() { return this; }, getText: () => value, getAttributes: () => ({}),
      insertText(i, v) { value = value.slice(0, i) + v + value.slice(i); return this; },
      setAttributes() {}, deleteText(a, b) { value = value.slice(0, a) + value.slice(b + 1); }
    };
    return {
      getType: () => type, text,
      findText(pattern, previous) {
        const re = new RegExp(pattern, 'g');
        re.lastIndex = previous ? previous.getEndOffsetInclusive() + 1 : 0;
        const m = re.exec(value);
        return m && {getElement: () => text, isPartial: () => m[0] !== value,
          getStartOffset: () => m.index, getEndOffsetInclusive: () => m.index + m[0].length - 1};
      }
    };
  }
  function tab(children) {
    const body = section('{{A}} / {{A}} / {{A.B}}'), header = section('{{A}}', 'header'), footer = section('{{A.B}}', 'footer');
    body.getParent = () => ({getNumChildren: () => 2, getChild: i => [header, footer][i]});
    const docTab = {getBody: () => body, getHeader: () => header, getFooter: () => footer};
    return {asDocumentTab: () => docTab, getChildTabs: () => children, body, header, footer};
  }
  const child = tab([]), root = tab([child]);
  const copy = {getId: () => 'test', getAs() { events.push('pdf'); return {setName: n => n}; }};
  const c = runtime({
    MimeType: {PDF: 'pdf'},
    DriveApp: {getFileById: () => ({makeCopy: () => copy})},
    DocumentApp: {ElementType: {HEADER_SECTION: 'header', FOOTER_SECTION: 'footer'},
      openById: () => ({getTabs: () => [root], saveAndClose: () => events.push('closed')})}
  });
  assert.equal(c.fillTemplateAndExportPdf_('test', {createFile: name => name}, 'HD', {A: ' $1 {{A.B}} ', 'A.B': null}, () => events.push('linked')), 'HD.pdf');
  for (const part of [root, child]) {
    assert.equal(part.body.text.getText(), '$1 {{A.B}} / $1 {{A.B}} / ');
    assert.equal(part.header.text.getText(), '$1 {{A.B}}');
    assert.equal(part.footer.text.getText(), '');
  }
  assert.deepEqual(events, ['closed', 'linked', 'pdf']);
});
