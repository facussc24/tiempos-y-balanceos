import fs from 'fs';

const data = JSON.parse(fs.readFileSync('backups/2026-04-08T00-54-04/amfe_documents.json', 'utf8'));
const dir = 'backups/_audit_individual';
fs.mkdirSync(dir, { recursive: true });

data.forEach(doc => {
  const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  const name = (doc.name || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  fs.writeFileSync(dir + '/' + name + '.json', JSON.stringify({
    id: doc.id,
    name: doc.name,
    project_path: doc.project_path,
    status: doc.status,
    data: d
  }, null, 2));
  console.log(name + '.json - ' + (d.operations||[]).length + ' ops');
});
console.log('Done: ' + data.length + ' files written');
