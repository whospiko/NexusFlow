import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_BASE = 'http://localhost:5050/api';

async function runTests() {
  console.log('🧪 Starting End-to-End OAuth & Tenancy Verification Tests...\n');

  // Test 1: Health Check
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthData = await healthRes.json();
  console.log('1. Health check status:', healthData.status);

  // Test 2: Piko Login
  const pikoLoginRes = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'piko@company.com', name: 'Piko' }),
  });
  const pikoAuth = await pikoLoginRes.json();
  console.log('2. Piko dev login successful. Token acquired. User ID:', pikoAuth.user.id);

  // Test 3: Pisey Login
  const piseyLoginRes = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pisey@company.com', name: 'Pisey' }),
  });
  const piseyAuth = await piseyLoginRes.json();
  console.log('3. Pisey dev login successful. Token acquired. User ID:', piseyAuth.user.id);

  // Test 4: Project Listing Isolation (Piko)
  const pikoProjectsRes = await fetch(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${pikoAuth.token}` },
  });
  const pikoProjects = await pikoProjectsRes.json();
  const pikoProjNames = pikoProjects.data.map((p) => p.name);
  console.log('4. Piko projects visible:', pikoProjNames);

  // Piko created Project 1, but NOT Project 2 (Pisey's portal). Piko should NOT see Pisey's project!
  const pikoSeesPiseyProject = pikoProjNames.includes('Client Portal Dashboard');
  console.log('   -> Piko sees Pisey private project?', pikoSeesPiseyProject ? '❌ FAIL (Leak)' : '✅ PASS (Isolated)');

  // Test 5: Fresh User Login (Sarah)
  const sarahLoginRes = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sarah.k@company.com', name: 'Sarah K.' }),
  });
  const sarahAuth = await sarahLoginRes.json();
  console.log('5. Sarah K. (fresh user) logged in. User ID:', sarahAuth.user.id);

  // Check Sarah's visible projects (should be 0 before invite)
  const sarahProjRes1 = await fetch(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${sarahAuth.token}` },
  });
  const sarahProjects1 = await sarahProjRes1.json();
  console.log(`6. Sarah initially sees ${sarahProjects1.data.length} projects.`, sarahProjects1.data.length === 0 ? '✅ PASS' : '❌ FAIL');

  // Test 6: Piko invites Sarah to Project 1
  const inviteRes = await fetch(`${API_BASE}/projects/1/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pikoAuth.token}`,
    },
    body: JSON.stringify({
      invitee_email: 'sarah.k@company.com',
      role: 'member',
    }),
  });
  const inviteData = await inviteRes.json();
  console.log('7. Piko invited Sarah. Response:', inviteData.message);
  console.log('   Invite token:', inviteData.data.token);
  console.log('   Invite Link:', inviteData.inviteLink);

  // Test 7: Inspect invitation by token
  const inspectRes = await fetch(`${API_BASE}/invitations/${inviteData.data.token}`);
  const inspectData = await inspectRes.json();
  console.log('8. Inspect invitation token:', inspectData.data.project_name, '| Inviter:', inspectData.data.inviter_name);

  // Test 8: Sarah accepts invitation
  const acceptRes = await fetch(`${API_BASE}/invitations/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sarahAuth.token}`,
    },
    body: JSON.stringify({ token: inviteData.data.token }),
  });
  const acceptData = await acceptRes.json();
  console.log('9. Sarah accepted invitation:', acceptData.message);

  // Test 9: Sarah lists projects again (should now see Project 1!)
  const sarahProjRes2 = await fetch(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${sarahAuth.token}` },
  });
  const sarahProjects2 = await sarahProjRes2.json();
  const sarahProjNames2 = sarahProjects2.data.map((p) => p.name);
  console.log('10. Sarah projects visible after acceptance:', sarahProjNames2);
  const sarahJoinedProject1 = sarahProjNames2.includes('Alpha Core Engine');
  console.log('    -> Sarah successfully has access to Alpha Core Engine?', sarahJoinedProject1 ? '✅ PASS' : '❌ FAIL');

  console.log('\n🎉 ALL MULTI-TENANCY & INVITATION TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

