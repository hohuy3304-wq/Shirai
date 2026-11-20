const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = path.join(__dirname, '../src');
const context = vm.createContext({
  console,
  Utilities: {
    formatDate(date, zone, pattern) {
      if (pattern !== 'yyyy-MM-dd') throw Error('Dạng ngày ngoài phạm vi kiểm thử');
      return new Intl.DateTimeFormat('sv-SE', {timeZone: zone}).format(date);
    }
  }
});
for (const file of fs.readdirSync(src).filter(file => file.endsWith('.gs'))) {
  vm.runInContext(fs.readFileSync(path.join(src, file), 'utf8'), context, { filename: file });
}
context.runAllTests();
