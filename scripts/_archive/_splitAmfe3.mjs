/** Parte tmp/amfe3.data.min.json en N chunks + manifest con md5 acumulado (utf8) para
 *  transporte verificable via MCP (data = data || chunk). */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const out = rel => new URL(rel, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const data = readFileSync(out('../tmp/amfe3.data.min.json'), 'utf8');
const N = 6;
const size = Math.ceil(data.length / N);
mkdirSync(out('../tmp/chunks'), { recursive: true });
let cum = '';
console.log('TOTAL chars:', data.length, '| md5:', createHash('md5').update(data).digest('hex'));
for (let i = 0; i < N; i++) {
    const chunk = data.slice(i * size, (i + 1) * size);
    writeFileSync(out(`../tmp/chunks/c${i}.txt`), chunk);
    cum += chunk;
    console.log(`c${i}: chars=${chunk.length} cumChars=${cum.length} cumMd5=${createHash('md5').update(cum).digest('hex')}`);
}
