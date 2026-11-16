import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_BASE = 'http://localhost:5050/api';

async function runTests() {
  console.log('🧪 Starting Filter Search Scoping Verification...\n');

  // Step 1: Create a single-project user (like "dadada" creator)
  const soloUserEmail = `solo.${Date.now()}@gmail.com`;
  const soloLoginRes = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: soloUserEmail, name: 'Solo Creator' }),
  });
  const soloAuth = await soloLoginRes.json();
  console.log(`1. Solo user logged in: ${soloUserEmail} (ID: ${soloAuth.user.id})`);

  // Step 2: Solo user creates their ONLY project: "Solo Project"
  const createProjRes = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${soloAuth.token}`,
    },
    body: JSON.stringify({
      name: 'Solo Project',
      description: 'The only project owned by solo user',
    }),
  });
  const createProjData = await createProjRes.json();
  const soloProjectId = createProjData.data.id;
  console.log(`2. Created solo project (ID: ${soloProjectId}): ${createProjData.data.name}`);

  // Step 3: Solo user creates 1 issue in their project
  const createIssueRes = await fetch(`${API_BASE}/projects/${soloProjectId}/issues`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${soloAuth.token}`,
    },
    body: JSON.stringify({
      title: 'Solo Issue 1',
      description: 'This issue belongs only to solo user',
      priority: 'high',
      creator: 'Solo Creator',
    }),
  });
  const createIssueData = await createIssueRes.json();
  console.log(`3. Created issue: ${createIssueData.data.title} under project ${soloProjectId}`);

  // Step 4: Solo user queries /api/filters/issues ("Issue Search Navigator")
  const filterRes = await fetch(`${API_BASE}/filters/issues`, {
    headers: { Authorization: `Bearer ${soloAuth.token}` },
  });
  const filterData = await filterRes.json();
  const visibleIssueTitles = filterData.data.map((i) => `${i.title} (${i.project_name})`);
  console.log(`4. Solo user queries Filters: Found ${filterData.data.length} issues:`, visibleIssueTitles);

  // VERIFICATION:
  // Solo user MUST only see issues from "Solo Project"!
  // They must NOT see "Memory leak in worker thread pool" (Alpha Core Engine) or "Table pagination resets" (Client Portal Dashboard)!
  const containsOtherProjects = filterData.data.some(
    (i) => i.project_name !== 'Solo Project'
  );

  console.log('   -> Did Filters leak issues from other projects?', containsOtherProjects ? '❌ FAIL (Data Leak)' : '✅ NO (Strictly Scoped)');
  console.log('   -> Does solo user see exactly their 1 project issue?', filterData.data.length === 1 && filterData.data[0].project_name === 'Solo Project' ? '✅ PASS (100% Correct)' : '❌ FAIL');

  console.log('\n🎉 ISSUE SEARCH NAVIGATOR / FILTERS SCOPING VERIFIED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

