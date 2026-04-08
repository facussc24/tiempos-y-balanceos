import fs from 'fs';

const data = JSON.parse(fs.readFileSync('backups/2026-04-08T00-54-04/amfe_documents.json', 'utf8'));
const dir = 'backups/_audit_individual';
fs.mkdirSync(dir, { recursive: true });

const nameMap = {
  'INSERT': 'INSERT',
  'Apoyacabezas Delantero': 'HEADREST_DELANTERO',
  'TRIM ASM-UPR WRAPPING': 'IP_PAD',
  'Proceso de fabricación - Telas Termoformadas': 'TELAS_TERMOFORMADAS',
  'ARMREST DOOR PANEL': 'ARMREST',
  'Apoyacabezas Trasero Central': 'HEADREST_CENTRAL',
  'Proceso de fabricación - Telas Planas': 'TELAS_PLANAS',
  'Apoyacabezas Trasero Lateral': 'HEADREST_LATERAL',
  'TOP ROLL': 'TOP_ROLL'
};

data.forEach(doc => {
  const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  const safeName = nameMap[doc.name] || doc.id;
  fs.writeFileSync(dir + '/' + safeName + '.json', JSON.stringify({
    id: doc.id, name: doc.name, project_path: doc.project_path, status: doc.status, data: d
  }, null, 2));
  const ops = d.operations || [];
  const wes = ops.reduce((s, op) => s + (op.workElements||[]).length, 0);
  console.log(safeName + '.json - ' + ops.length + ' ops, ' + wes + ' WEs');
});
console.log('Done: ' + data.length + ' files');
