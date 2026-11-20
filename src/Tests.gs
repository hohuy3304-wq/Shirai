function equal_(actual, expected, label) {
  if (actual !== expected) throw new Error(label + ' — mong đợi ' + expected + ', nhận ' + actual);
}
function rejects_(fn, label) {
  try { fn(); } catch (e) { return; }
  throw new Error(label + ' — cần báo lỗi.');
}
function testDocSoThanhChu_() {
  const cases = [
    [0, 'Không đồng'], [14, 'Mười bốn đồng'], [24, 'Hai mươi tư đồng'],
    [101, 'Một trăm lẻ một đồng'], [1000, 'Một nghìn đồng'], [1001, 'Một nghìn không trăm lẻ một đồng'],
    [15500000, 'Mười lăm triệu năm trăm nghìn đồng'], [1000000000, 'Một tỷ đồng'],
    [2005000001, 'Hai tỷ không trăm lẻ năm triệu không trăm lẻ một đồng'],
    [1000000000000, 'Một nghìn tỷ đồng'], [21, 'Hai mươi mốt đồng'], [105, 'Một trăm lẻ năm đồng'],
    [14.6, 'Mười lăm đồng']
  ];
  cases.forEach(([n, expected]) => equal_(docSoThanhChu(n), expected, String(n)));
  [-0.1, '123', NaN, Infinity, 1e18].forEach(n => rejects_(() => docSoThanhChu(n), String(n)));
}
function testSinhSoHopDong_() {
  const numbers = ['HD-2026-0001', 'HD-2026-0011', 'HDX-2026-0078', 'HD-2025-0199', ''];
  equal_(nextSequence_('HD', 2026, numbers, null), 12, 'Lấy số lớn nhất');
  equal_(nextSequence_('HD', 2026, numbers, '20'), 21, 'Giữ bộ đếm sau khi xóa dòng');
  equal_(nextSequence_('HD', 2027, numbers, ''), 1, 'Năm mới');
  equal_(nextSequence_('A.B', 2026, ['AxB-2026-0099'], null), 1, 'Thoát ký tự regex');
  rejects_(() => nextSequence_('HD', 2026, [], '9999'), 'Hết dải số');
}
function runAllTests() {
  const tests = [testDocSoThanhChu_, testSinhSoHopDong_];
  tests.forEach(fn => { fn(); console.log('Đạt ' + fn.name); });
  return tests.length;
}
