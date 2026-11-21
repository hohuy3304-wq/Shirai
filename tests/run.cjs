const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const crypto = require('node:crypto');

function runtime(services = {}) {
  const src = path.join(__dirname, '../src');
  const context = vm.createContext({
    console,
    Utilities: {
      DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'},
      getUuid: crypto.randomUUID,
      newBlob: value => ({getBytes: () => Buffer.from(value)}),
      computeDigest: (algorithm,value) => crypto.createHash(algorithm).update(value).digest(),
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
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
    getProperties: () => Object.fromEntries(values),
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
  copy.setTrashed=()=>events.push('trashed');
  assert.throws(()=>c.fillTemplateAndExportPdf_('test', {}, 'HD', {THAY_DOI:'Giao trước 10 giờ'}, ()=>{}), /thiếu {{THAY_DOI}}/);
  assert.equal(events.at(-1),'trashed');
});

test('Phiếu nhận link Google, kiểm tra ngày và tiền trước khi ghi', () => {
  const c = runtime();
  const form = {Loai_HD:'Dịch vụ', Ma_KH:'01', Noi_Dung_HD:'Bảo trì', Dieu_Khoan_Thanh_Toan:'Trả sau',
    Ngay_Ky:'2026-01-31', Ngay_Hieu_Luc:'2026-02-01', Ngay_Het_Han:'2026-03-01',
    Gia_Tri:'15.500.000', Nguoi_Phu_Trach:'a@example.com'};
  assert.equal(c.formData_(form).Gia_Tri, 15500000);
  assert.throws(() => c.formData_({...form, Ngay_Ky:'2026-02-31'}), /Ngày/);
  assert.throws(() => c.formData_({...form, Gia_Tri:'15.50'}), /VND/);
  assert.throws(() => c.formData_({...form, Noi_Dung_HD:' '}), /nội dung/);
  assert.equal(c.requiredId_('https://docs.google.com/document/d/abc/edit?tab=t.0','ID_Google_Docs_Mau'), 'abc');
  assert.equal(c.requiredId_('https://drive.google.com/drive/u/0/folders/xyz?usp=sharing','ROOT_FOLDER_ID'), 'xyz');
  assert.throws(() => c.requiredId_('https://other.com/drive/folders/xyz','ROOT_FOLDER_ID'));
});

test('Gửi lại cùng phiếu dùng dòng cũ, giữ dòng nhập tay và công thức ngoài bảng', () => {
  const c = runtime({SpreadsheetApp:{flush() {}}});
  const headers = Array.from(vm.runInContext('SCHEMA[TAB.contracts].slice().reverse()', c));
  headers.push('Ngoài bảng', 'Ma_Phieu', 'Noi_Dung_HD');
  const map = Object.fromEntries(headers.map((k,i)=>[k,i+1]));
  const rows = [headers, ...Array.from({length:3},()=>Array(headers.length).fill(''))];
  rows[1][map.Ghi_Chu-1]='Nhập dở';
  const formulas = rows.map(r=>r.map(()=> ''));
  formulas[2][map['Ngoài bảng']-1]='=""';
  formulas[3][map.Ten_KH-1]='=IFERROR(...)';
  let writes=0, exports=0;
  const sheet={
    getName:()=>'HopDong', getLastColumn:()=>headers.length, getMaxRows:()=>4,
    getDataRange:()=>({getValues:()=>rows,getFormulas:()=>formulas,getNumColumns:()=>headers.length}),
    getRange(i){return {getValues:()=>[rows[i-1]],setValues:([r])=>{rows[i-1]=r; writes++;}};}
  };
  const form={token:'11111111-2222-3333-4444-555555555555', Ma_KH:'A',Loai_HD:'Dịch vụ',Noi_Dung_HD:'Lắp đặt',
    Ngay_Ky:'2026-01-15',Ngay_Hieu_Luc:'2026-01-15',Ngay_Het_Han:'2026-02-15',Gia_Tri:'1.000',Dieu_Khoan_Thanh_Toan:'Trả sau',Nguoi_Phu_Trach:'a@example.com'};
  Object.assign(c,{sheet_:()=>sheet,getTemplateInfo_:()=>({ID_Google_Docs_Mau:'doc',Thu_Muc_Luu_ID:'folder'}),
    getCustomerInfo_:()=>({Ten_Cong_Ty:'Công ty A'}),withLock_:fn=>fn(),appendLog_(){}, releaseFileJob_(){},
    createContract_:ctx=>()=>{
      exports++;
      if (exports===1) throw Error('Mất kết nối');
      for(const [k,v] of Object.entries({So_HD:'HD-1',Link_Docs:'docs',Link_PDF:'pdf'})){
        rows[ctx.row-1][map[k]-1]=ctx.data[k]=v;
      }
    }});
  const failure=c.taoTuPhieu(form);
  assert.equal(failure.saved,true);
  assert.equal(failure.row,4);
  assert.equal(c.taoTuPhieu(form).number,'HD-1');
  assert.equal(c.taoTuPhieu(form).pdf,'pdf');
  assert.equal(writes,1);
  assert.equal(exports,2);
  assert.equal(rows[1][map.Ghi_Chu-1],'Nhập dở');
});

test('HĐNT theo đơn hàng, ký theo ủy quyền và rà soát gia hạn', () => {
  const c = runtime();
  const form = {Loai_HD:'HĐNT',Ma_KH:'001',Ngay_Ky:'2026-11-21',Nguoi_Phu_Trach:'a@example.com'};
  const fields = c.formData_({...form,So_Uy_Quyen:'15/UQ',Ngay_Uy_Quyen:'2026-10-05'});
  assert.equal(fields.Gia_Tri,'');
  assert.equal(fields.Ngay_Het_Han,'');
  assert.equal(fields.Ngay_Hieu_Luc.getTime(),fields.Ngay_Ky.getTime());
  assert.match(fields.Uy_Quyen,/15\/UQ ngày 05\/10\/2026/);
  assert.throws(()=>c.formData_({...form,So_Uy_Quyen:'15/UQ'}),/số và ngày/);
  assert.throws(()=>c.formData_({...form,Ngay_Ra_Soat:'2026-11-20'}),/rà soát/);
  assert.throws(()=>c.validateBuyer_('HĐNT',{Ten_Cong_Ty:'A'}),/đại diện/);
  assert.throws(()=>c.formData_({...form,Loai_HD:'Dịch vụ'}));
  const dates=['2026-11-20','2026-11-21','2026-11-28'].map(s=>c.dateFromForm_(s));
  const hd=['So_HD','Trang_Thai','Loai_HD','Ngay_Ra_Soat','Ngay_Het_Han'], map=Object.fromEntries(hd.map((k,i)=>[k,i+1]));
  const data=[['NT1','Đã ký','HĐNT',dates[0],''],['NT2','Đã duyệt','Nguyên tắc',dates[2],dates[0]],
    ['NT3','Đã ký','Hợp đồng nguyên tắc','',dates[1]],['DV1','Đã ký','Dịch vụ','',dates[0]],['NT4','Đã chấm dứt','HĐNT',dates[1],'']];
  const scan=c.scanRows_(data,map,c.dayNumber_(dates[1]),new Set([7]));
  assert.deepEqual(Array.from(scan.expired,r=>r.number),['DV1']);
  assert.deepEqual(Array.from(scan.due,r=>r.contract.So_HD),['NT2','NT3']);
});

test('Nháp riêng từng tài khoản, chống ghi đè và xóa nháp cũ', () => {
  const stores = {a:properties(),b:properties()};
  let actor='a';
  const c=runtime({PropertiesService:{getUserProperties:()=>stores[actor]}});
  Object.assign(c,{withLock_:f=>f(),appendLog_(){},records_:()=>[],activeEmail_:()=>actor,isApprover_:()=>false});
  const initial={token:crypto.randomUUID(),Loai_HD:'HĐNT'};
  const version=c.luuNhapCaNhan({...initial});
  assert.equal(c.danhSachHoSo('mine').drafts[0].draftVersion,version);
  assert.throws(()=>c.luuNhapCaNhan({...initial}),/thay đổi/);
  const latest=c.luuNhapCaNhan({...initial,draftVersion:version});
  actor='b';
  assert.equal(c.danhSachHoSo('mine').drafts.length,0);
  assert.throws(()=>c.danhSachHoSo('review'),/NGUOI_DUYET/);
  actor='a';
  assert.throws(()=>c.xoaNhapCaNhan(initial.token,version),/thay đổi/);
  c.xoaNhapCaNhan(initial.token,latest);
  assert.equal(c.danhSachHoSo('mine').drafts.length,0);
});

test('Trình, trả về, trình lần hai và duyệt đúng bản PDF khi nhiều người cùng mở', () => {
  const store=properties(),logs=[], exported=[];
  const creator='lap@example.com', reviewer='duyet@example.com';
  let actor=creator;
  const c=runtime({PropertiesService:{getUserProperties:()=>store}});
  const sheet={getRange:()=>({getFormula:()=>''})};
  const ctx={row:2,map:{},sheet,data:{Trang_Thai:'Nháp',Nguoi_Tao:creator,Loai_HD:'HĐNT',Ma_KH:'K'}};
  Object.assign(c,{
    withLock_:f=>f(),appendLog_:(...args)=>logs.push(args),dossierAt_:()=>ctx,formRow_:()=>ctx,activeEmail_:()=>actor,
    records_:()=>[ctx.data],getConfig:()=>({NGUOI_DUYET:reviewer}),checkFileIdle_(){},releaseFileJob_(){},
    formCustomer_:()=>({Ten_Cong_Ty:'A',MST:'01',Dia_Chi:'HCM',Nguoi_Dai_Dien:'B',Chuc_Vu:'GĐ'}),
    addFields_(){},setField_:(r,k,v)=>{r.data[k]=v;},khoaDongHopDong_(){},
    createContract_(r){
      r.data.So_HD='HDNT-2026-0001';
      return ()=>{
        exported.push('https://drive.google.com/pdf'+(exported.length+1));
        r.data.Link_Docs='https://docs.google.com/document/d/test/edit';
        r.data.Link_PDF=exported.at(-1);
      };
    }
  });
  const first={token:crypto.randomUUID(),Loai_HD:'HĐNT',Ma_KH:'K',Ngay_Ky:'2026-11-21',Nguoi_Phu_Trach:creator};
  const result=c.guiPhieuDeDuyet(first);
  assert.equal(c.guiPhieuDeDuyet(first).pdf,result.pdf);
  assert.equal(ctx.data.Trang_Thai,'Chờ duyệt');
  const v1=c.revision_(ctx.data);
  actor='other@example.com';
  assert.equal(c.danhSachHoSo('mine').rows.length,0);
  assert.throws(()=>c.guiPhieuDeDuyet(first),/thuộc người phụ trách khác/);
  assert.throws(()=>c.xuLyHoSo(result.number,v1,'approve',''),/quyền duyệt/);
  actor=reviewer;
  assert.equal(c.danhSachHoSo('review').rows[0].pdf,exported[0]);
  assert.throws(()=>c.xuLyHoSo(result.number,v1,'return',''),/lý do/);
  c.xuLyHoSo(result.number,v1,'return','Bổ sung thỏa thuận');
  assert.throws(()=>c.xuLyHoSo(result.number,v1,'approve',''),/đã thay đổi/);
  actor=creator;
  assert.throws(()=>c.guiPhieuDeDuyet(first),/đã được trình/);
  const returned=c.danhSachHoSo('mine').rows[0];
  assert.equal(returned.reason,'Bổ sung thỏa thuận');
  const second={...first,token:crypto.randomUUID(),number:result.number,version:returned.version,Thay_Doi:'Giao buổi sáng'};
  c.guiPhieuDeDuyet(second);
  assert.equal(ctx.data.Phien_Trinh,2);
  assert.equal(exported.length,2);
  assert.ok(logs.some(log=>log.includes('Bản 1 · '+exported[0])));
  assert.ok(logs.some(log=>log.includes('Bản 2 · '+exported[1])));
  actor=reviewer;
  ctx.data.Thay_Doi='thay đổi trực tiếp sau khi trình';
  assert.throws(()=>c.xuLyHoSo(result.number,c.revision_(ctx.data),'approve',''),/Nội dung đã đổi/);
  ctx.data.Thay_Doi=second.Thay_Doi;
  c.xuLyHoSo(result.number,c.revision_(ctx.data),'approve','');
  assert.equal(ctx.data.Trang_Thai,'Đã duyệt');
  actor=creator;
  c.xuLyHoSo(result.number,c.revision_(ctx.data),'end','Thông báo chấm dứt số 12');
  assert.equal(ctx.data.Trang_Thai,'Đã chấm dứt');
  assert.equal(ctx.data.Can_Cu_Cham_Dut,'Thông báo chấm dứt số 12');
});
