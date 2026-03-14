// Fix the project_name format to match the hierarchical path system
// The UI expects: "client/project/study" format (e.g., "VWA/PATAGONIA/INSERTO")
// But the seed script used: "PATAGONIA - INSERTO"
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, copyFileSync } from 'fs';

const roamingDb = process.env.APPDATA + '\\com.barackmercosul.app\\barack_mercosul.db';
const sourceDb = 'C:\\Users\\FacundoS-PC\\Documents\\Software Barack Mercosul\\Data\\barack_mercosul.db';

// Fix source DB first
console.log('Fixing source DB:', sourceDb);
const SQL = await initSqlJs();
const buf = readFileSync(sourceDb);
const db = new SQL.Database(buf);

// Check current state
const before = db.exec("SELECT id, project_name, client, subject FROM amfe_documents");
console.log('Before:', before[0]?.values);

// The hierarchical path format is: client/project/studyName
// client = "VWA" (from header.client field)
// project = "PATAGONIA" (the project/vehicle)
// studyName = "INSERTO" (the subject/part)
const newProjectName = 'VWA/PATAGONIA/INSERTO';

// Update AMFE
db.run("UPDATE amfe_documents SET project_name = ? WHERE project_name = 'PATAGONIA - INSERTO'", [newProjectName]);

// Also update CP document to match
db.run("UPDATE cp_documents SET project_name = ? WHERE project_name = 'PATAGONIA - INSERTO'", [newProjectName]);
// Update linked_amfe_project too
db.run("UPDATE cp_documents SET linked_amfe_project = ? WHERE linked_amfe_project = 'PATAGONIA - INSERTO'", [newProjectName]);

// Verify
const after = db.exec("SELECT id, project_name, client, subject FROM amfe_documents");
console.log('After:', after[0]?.values);

const cpAfter = db.exec("SELECT id, project_name, client, linked_amfe_project FROM cp_documents");
console.log('CP After:', cpAfter[0]?.values);

// Save
const data = db.export();
writeFileSync(sourceDb, Buffer.from(data));
console.log('Source DB saved:', sourceDb);

db.close();

// Now copy to Roaming (delete WAL/SHM first)
import { unlinkSync, existsSync } from 'fs';
const walFile = roamingDb + '-wal';
const shmFile = roamingDb + '-shm';
if (existsSync(walFile)) { unlinkSync(walFile); console.log('Deleted WAL'); }
if (existsSync(shmFile)) { unlinkSync(shmFile); console.log('Deleted SHM'); }

copyFileSync(sourceDb, roamingDb);
const info = readFileSync(roamingDb);
console.log('Copied to Roaming:', roamingDb, '(' + info.length + ' bytes)');
console.log('✅ Done!');
