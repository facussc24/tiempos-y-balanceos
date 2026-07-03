const SUPABASE_URL = 'https://fbfsbbewmgoegjgnkkag.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnNiYmV3bWdvZWdqZ25ra2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTI4NDksImV4cCI6MjA4OTA4ODg0OX0.YKHwbbwcnqNCnxFMSyeoM6VzZgvGuIctVSfdMNyQfL4';
const DOC_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

async function main() {
  const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@barack.com', password: 'U3na%LNSYVmVCYvP' })
  });
  const auth = await authResp.json();
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/amfe_documents?id=eq.${DOC_ID}&select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json'
    }
  });
  const rows = await resp.json();
  let data = rows[0].data;
  if (typeof data === 'string') data = JSON.parse(data);

  // Full JSON dump of OP 130
  for (const op of data.operations) {
    if ((op.operationNumber || op.opNumber) === '130') {
      console.log('=== OP 130 FULL JSON ===');
      console.log(JSON.stringify(op, null, 2));
    }
  }

  // Search for "embalaje" keyword occurrences in OP 130
  console.log('\n=== EMBALAJE KEYWORD SEARCH IN OP 130 ===');
  for (const op of data.operations) {
    if ((op.operationNumber || op.opNumber) === '130') {
      const jsonStr = JSON.stringify(op);
      const re = /embalaje/gi;
      let match;
      while ((match = re.exec(jsonStr)) !== null) {
        const start = Math.max(0, match.index - 40);
        const end = Math.min(jsonStr.length, match.index + 50);
        console.log(`  Found at index ${match.index}: "...${jsonStr.substring(start, end)}..."`);
      }
    }
  }

  // Also check OP naming standards
  console.log('\n=== NAMING STANDARDS CHECK ===');
  for (const op of data.operations) {
    const opNum = op.operationNumber || op.opNumber || '?';
    const opName = op.operationName || op.name || '?';
    // Check English terms in operation names
    const englishTerms = ['WRAPPING', 'EDGE FOLDING', 'TRIMMING', 'FIXING', 'PRE-FIXING'];
    for (const term of englishTerms) {
      if (opName.toUpperCase().includes(term)) {
        console.log(`  OP ${opNum}: Contains English term "${term}" in name "${opName}"`);
      }
    }
  }
}
main().catch(e => console.error(e));
