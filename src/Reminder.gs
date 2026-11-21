function reminderDays_(value) {
  const days = String(value || '').split(',').map(s => s.trim());
  if (!days.every(s => /^\d+$/.test(s) && Number.isSafeInteger(Number(s))))
    throw new Error('SO_NGAY_NHAC phải gồm các số ngày không âm, cách nhau bằng dấu phẩy.');
  return new Set(days.map(Number));
}

function scanRows_(data, map, today, thresholds) {
  const expired = [], due = [], invalid = [];
  data.forEach((values, i) => {
    const r = record_(values, map);
    if (![ST.approved, ST.signed].includes(r.Trang_Thai)) return;
    if (isHdnt_(r.Loai_HD)) {
      // Ngày hết hạn trên các dòng cũ chỉ dùng làm mốc nhắc khi chưa có ngày rà soát.
      const review = r.Ngay_Ra_Soat || r.Ngay_Het_Han;
      if (review && validDate_(review) && r.So_HD) {
        const days = dayNumber_(review) - today;
        if (thresholds.has(days) || days === 0) due.push({contract:r, days, review});
      } else if (review) invalid.push(i + 2);
      return;
    }
    if (!r.So_HD || !validDate_(r.Ngay_Het_Han)) { invalid.push(i + 2); return; }
    const days = dayNumber_(r.Ngay_Het_Han) - today;
    if (days < 0) expired.push({row: i + 2, number: r.So_HD});
    else if (thresholds.has(days)) due.push({contract: r, days});
  });
  return {expired, due, invalid};
}

function html_(v) {
  const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  return String(v || '').replace(/[&<>"']/g, c => entities[c]);
}
function mailLink_(url, title) {
  return /^https:\/\/(docs|drive)\.google\.com\//.test(String(url)) ? '<a href="' + html_(url) + '">' + title + '</a>' : '';
}
function sendSummary_(cfg, due, dateLabel) {
  const recipients = emailList_(cfg.EMAIL_NHAN_NHAC);
  if (!recipients.length || !recipients.every(e => /^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(e)))
    throw new Error('Hãy kiểm tra EMAIL_NHAN_NHAC trong cấu hình.');
  if (recipients.length > 50 || MailApp.getRemainingDailyQuota() < recipients.length)
    throw new Error('Hạn mức email không đủ cho danh sách người nhận.');
  const lines = [], items = [];
  due.forEach(({contract: r, days, review}) => {
    const detail = r.So_HD + ' — ' + r.Ten_KH + (review ? ' — rà soát gia hạn ' : ' — hết hạn ') + formatDateVi_(review || r.Ngay_Het_Han) + ' (còn ' + days + ' ngày)';
    lines.push(detail);
    items.push('<li>' + html_(detail) + ' ' + mailLink_(r.Link_Docs, 'Docs') + ' ' + mailLink_(r.Link_PDF, 'PDF') + '</li>');
  });
  MailApp.sendEmail({
    to: recipients.join(','), subject: 'Nhắc hạn hợp đồng ngày ' + dateLabel,
    body: lines.join('\n'), htmlBody: '<p>Hợp đồng đến mốc hết hạn hoặc rà soát gia hạn</p><ul>' + items.join('') + '</ul>'
  });
}

function dailyScan_() {
  const cfg = getConfig();
  const sheet = sheet_(TAB.contracts);
  const data = sheet.getDataRange().getValues();
  const map = headerMap_(data.shift(), TAB.contracts);
  const now = new Date(), today = dayNumber_(now);
  const {expired, due, invalid} = scanRows_(data, map, today, reminderDays_(cfg.SO_NGAY_NHAC));
  if (expired.length) {
    const col = sheet.getRange(1, map.Trang_Thai).getA1Notation().replace(/\d+$/, '');
    sheet.getRangeList(expired.map(e => col + e.row)).setValue(ST.expired);
    SpreadsheetApp.flush();
    appendLog_('Cập nhật hết hạn', '', 'Đã chuyển ' + expired.map(e => e.number).join(', '));
  }
  const props = PropertiesService.getScriptProperties();
  const key = 'ngay-gui-nhac';
  let result = 'Đã chuyển hết hạn ' + expired.length + ' hợp đồng.';
  if (due.length && props.getProperty(key) !== String(today)) {
    sendSummary_(cfg, due, formatDateVi_(now));
    props.setProperty(key, String(today));
    result += ' Đã gửi một email tổng hợp cho ' + due.length + ' hợp đồng.';
  } else if (due.length) result += ' Hôm nay đã gửi email tổng hợp.';
  else result += ' Không có hợp đồng đến mốc nhắc.';
  if (invalid.length) result += ' Kiểm tra số hợp đồng và ngày hết hạn ở dòng ' + invalid.join(', ') + '.';
  return result;
}
function runDailyContractScan() { return runAction_('Quét hết hạn định kỳ', dailyScan_, {}); }
function quetHetHan() { return runAction_('Quét hết hạn', dailyScan_, {menu: true}); }

function ensureDailyTrigger_() {
  const owner = contractBook_().getOwner();
  if (!owner || activeEmail_() !== owner.getEmail().toLowerCase())
    throw new Error('Chỉ chủ sở hữu bảng tính My Drive cài trigger chung.');
  const triggers = ScriptApp.getProjectTriggers().filter(t =>
    t.getHandlerFunction() === 'runDailyContractScan' && t.getEventType() === ScriptApp.EventType.CLOCK);
  const props = PropertiesService.getScriptProperties();
  // Giữ đúng trigger do hàm này cài. Thay lịch thủ công nếu có.
  const saved = triggers.find(t => t.getUniqueId() === props.getProperty('trigger-nhac-han'));
  if (!saved) {
    const trigger = ScriptApp.newTrigger('runDailyContractScan').timeBased().atHour(8).everyDays(1).inTimezone(TZ).create();
    props.setProperty('trigger-nhac-han', trigger.getUniqueId());
  }
  triggers.filter(t => t !== saved).forEach(t => ScriptApp.deleteTrigger(t));
  return 'Đã cài một lịch quét mỗi ngày trong khung 8–9 giờ Việt Nam.';
}
function installDailyTrigger() { return runAction_('Cài nhắc hạn hàng ngày', ensureDailyTrigger_, {}); }
function caiNhacHan() { return runAction_('Cài nhắc hạn hàng ngày', ensureDailyTrigger_, {menu: true}); }
