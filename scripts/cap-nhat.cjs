'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createInterface } = require('node:readline/promises');
const { isDeepStrictEqual } = require('node:util');

const project = path.resolve(__dirname, '..');
const source = path.join(project, 'src');
const clasp = path.join(project, 'node_modules', '@google', 'clasp', 'build', 'src', 'index.js');
const configName = '.clasp.local.json';

function scriptId(input) {
  const value = String(input || '').trim();
  if (/^[\w-]{20,}$/.test(value)) return value;
  const link = /^https:\/\/script\.google\.com\/(?:u\/\d+\/)?(?:home\/projects|d)\/([\w-]{20,})(?:\/edit)?\/?(?:[?#].*)?$/.exec(value);
  return link ? link[1] : '';
}

async function chooseTarget() {
  const downloads = path.join(os.homedir(), 'Downloads', 'Shirai-main');
  const candidates = [project, path.join(downloads, 'Shirai-main'), downloads];
  let saved = '';
  for (const dir of candidates) {
    const file = path.join(dir, configName);
    if (!fs.existsSync(file)) continue;
    try {
      saved = scriptId(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')).scriptId);
    } catch {
      console.log('Không đọc được cấu hình cũ tại ' + file);
    }
    if (saved) {
      console.log('Dự án tìm thấy trong ' + file + '\nhttps://script.google.com/home/projects/' + saved + '/edit');
      break;
    }
  }
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const hint = saved ? 'Nhấn Enter để cập nhật dự án trên, hoặc dán link dự án khác: '
      : 'Mở Sheet → Tiện ích mở rộng → Apps Script. Dán link trên thanh địa chỉ hoặc ID tập lệnh: ';
    const answer = (await input.question(hint)).trim();
    const id = answer ? scriptId(answer) : saved;
    if (!id) throw new Error('Cần link trình chỉnh sửa Apps Script hoặc ID tập lệnh. Hãy chạy lại và dán đúng giá trị.');
    return id;
  } finally {
    input.close();
  }
}

function runClasp(args, cwd, capture = false) {
  const result = spawnSync(process.execPath, [clasp, ...args], {
    cwd, encoding: 'utf8', stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('clasp chưa hoàn tất. Xem thông báo Google ở trên.');
  return result.stdout;
}

function verifySource(remote) {
  const normalize = code => code.replace(/\r\n?/g, '\n').trimEnd();
  for (const file of fs.readdirSync(source)) {
    if (file !== 'appsscript.json' && !/\.(?:gs|html)$/.test(file)) continue;
    if (!fs.existsSync(path.join(remote,file))) {
      throw new Error('Google chưa có tệp ' + file + '. Kiểm tra đích cập nhật và lựa chọn Yes khi clasp hỏi cập nhật manifest.');
    }
    const expected = fs.readFileSync(path.join(source, file), 'utf8');
    const actual = fs.readFileSync(path.join(remote, file), 'utf8');
    const matches = file === 'appsscript.json'
      ? isDeepStrictEqual(JSON.parse(actual), JSON.parse(expected))
      : normalize(actual) === normalize(expected);
    if (!matches) {
      throw new Error('Bản trên Google khác bản vừa tải ở tệp ' + file);
    }
  }
}

async function main() {
  if (!/\bfunction\s+doGet\s*\(/.test(fs.readFileSync(path.join(source, 'WebApp.gs'), 'utf8'))) {
    throw new Error('Thiếu hàm doGet trong bộ mã. Hãy giải nén lại toàn bộ gói Web App.');
  }
  const id = await chooseTarget();
  console.log('Đích cập nhật: https://script.google.com/home/projects/' + id + '/edit');
  // Cả hai cấu hình tạm chỉ trỏ vào thư mục của lần chạy này.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hong-thien-'));
  try {
    const upload = path.join(temp, 'upload');
    const check = path.join(temp, 'check');
    for (const dir of [upload, check]) {
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, '.clasp.json'), JSON.stringify({scriptId: id, rootDir: 'src', scriptExtensions: ['gs']}));
    }
    fs.cpSync(source, path.join(upload, 'src'), {recursive: true});
    fs.mkdirSync(path.join(check, 'src'));

    const auth = JSON.parse(runClasp(['--json', 'show-authorized-user'], upload, true));
    if (!auth.loggedIn) runClasp(['login'], upload);
    else if (auth.email) console.log('Tài khoản Google: ' + auth.email);
    console.log('Đang đồng bộ. Nếu clasp hỏi cập nhật manifest của dự án đã chọn, chọn Yes để tiếp tục.');
    runClasp(['push'], upload);
    console.log('Đang đọc lại mã từ Google để kiểm tra Web App…');
    runClasp(['pull'], check);
    verifySource(path.join(check, 'src'));
    console.log('Đã xác nhận mã mới và hàm doGet() trong dự án Google.');
    console.log('Mở https://script.google.com/home/projects/' + id + '/edit');
    console.log('Để cập nhật link /exec: Triển khai → Quản lý bản triển khai → bút chì → Phiên bản mới → Triển khai.');
    console.log('Nếu dùng lần đầu: mở Sheet → Hợp đồng → Chuẩn bị mẫu và thư mục → sau đó chọn Kết nối Web App.');
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
}

main().catch(error => {
  console.error('\n' + error.message);
  process.exitCode = 1;
});
