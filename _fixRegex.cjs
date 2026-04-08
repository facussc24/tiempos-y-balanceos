const fs = require('fs');
const lines = fs.readFileSync('utils/formatting.ts', 'utf8').split('\n');

// Line 132 (0-indexed: 131) - fix dd/MM/yyyy regex
lines[131] = String.raw`    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;`;

// Line 144 (0-indexed: 143) - fix Spanish date regex
lines[143] = String.raw`    const spanishMatch = trimmed.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);`;

fs.writeFileSync('utils/formatting.ts', lines.join('\n'));
console.log('Line 132:', lines[131]);
console.log('Line 144:', lines[143]);
console.log('DONE');
