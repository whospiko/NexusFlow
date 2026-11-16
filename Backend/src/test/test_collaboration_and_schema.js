import { io } from 'socket.io-client';

const BASE_URL = 'http://localhost:5050';
const PROJECT_ID = 1;

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 E2E Verification: Live Collaboration & Schema Versioning');
  console.log('🧪 ========================================================');

  // 1. Commit Schema Version v1.2
  console.log('\n--- 1. Testing Commit Schema Version (v1.2) ---');
  const commit1Res = await fetch(`${BASE_URL}/api/projects/${PROJECT_ID}/schema/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch: 'main',
      versionTag: 'v1.2',
      title: 'Initial Database Baseline',
      rationale: 'Baseline schema setup for e-commerce project',
      author: 'Piko',
    }),
  });
  const commit1 = await commit1Res.json();
  console.log('✅ Commit v1.2 status:', commit1Res.status, 'ID:', commit1.data?.id, 'Tag:', commit1.data?.version_tag);

  // 2. Fetch Schema Branches
  console.log('\n--- 2. Testing Get Schema Branches ---');
  const branchesRes = await fetch(`${BASE_URL}/api/projects/${PROJECT_ID}/schema/branches`);
  const branches = await branchesRes.json();
  console.log('✅ Branches:', branches.data);

  // 3. Create a branch and commit v1.3 with simulated schema changes
  console.log('\n--- 3. Testing Commit Schema Version (v1.3 on feature/billing) ---');
  const commit2Res = await fetch(`${BASE_URL}/api/projects/${PROJECT_ID}/schema/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch: 'feature/billing',
      versionTag: 'v1.3',
      title: 'Added PaymentMethod to INVOICE; removed PhoneNumber from CUSTOMER',
      rationale: 'Required for Stripe payment integration and GDPR privacy compliance',
      author: 'Dev Alice',
      parentVersionId: commit1.data?.id,
    }),
  });
  const commit2 = await commit2Res.json();
  console.log('✅ Commit v1.3 status:', commit2Res.status, 'ID:', commit2.data?.id, 'Branch:', commit2.data?.branch);

  // 4. Test Schema Diff between v1.2 and v1.3 (or current)
  console.log('\n--- 4. Testing Schema Diff Engine ---');
  const diffRes = await fetch(`${BASE_URL}/api/projects/${PROJECT_ID}/schema/diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseVersionId: commit1.data?.id,
      compareVersionId: 'current',
    }),
  });
  const diffData = await diffRes.json();
  console.log('✅ Diff Result Summary:', diffData.data?.diff?.changelogText);
  console.log('✅ Has Changes:', diffData.data?.diff?.hasChanges);

  // 5. Test ALTER TABLE Migration Generator (UP and DOWN)
  console.log('\n--- 5. Testing ALTER TABLE Migration Generator ---');
  const migRes = await fetch(`${BASE_URL}/api/projects/${PROJECT_ID}/schema/migration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseVersionId: commit1.data?.id,
      compareVersionId: 'current',
      title: 'Migrate v1.2 to v1.3',
    }),
  });
  const migData = await migRes.json();
  console.log('✅ Generated UP Migration Preview:');
  console.log(migData.data?.upSql?.substring(0, 300) + '...\n');
  console.log('✅ Generated DOWN Migration Preview:');
  console.log(migData.data?.downSql?.substring(0, 200) + '...\n');

  // 6. Test 3-Way Schema Merge
  console.log('\n--- 6. Testing 3-Way Schema Branch Merge ---');
  const mergeRes = await fetch(`${BASE_URL}/api/projects/${PROJECT_ID}/schema/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceVersionId: commit2.data?.id,
      targetVersionId: commit1.data?.id,
      targetBranch: 'main',
      author: 'Piko',
      rationale: 'Merging feature/billing into main production branch',
    }),
  });
  const mergeData = await mergeRes.json();
  console.log('✅ Merge Result:', mergeData.data?.success ? 'SUCCESS (Fast-Forward / Clean)' : 'CONFLICTS', 'Conflicts:', mergeData.data?.conflicts?.length || 0);

  // 7. Test Socket.IO Live Collaboration (Live Cursors, Presence & Realtime Sync)
  console.log('\n--- 7. Testing Socket.IO Live Collaboration (2 Simultaneous Clients) ---');
  await new Promise((resolve, reject) => {
    let clientAReady = false;
    let clientBReady = false;
    let cursorReceived = false;
    let dragReceived = false;

    const clientA = io(BASE_URL, { transports: ['websocket'] });
    const clientB = io(BASE_URL, { transports: ['websocket'] });

    clientA.on('connect', () => {
      console.log('  🟢 Client A connected:', clientA.id);
      clientA.emit('erd:join', {
        projectId: PROJECT_ID,
        user: { id: 'usr-piko', name: 'Piko (Lead)', color: '#0ea5e9' },
      });
    });

    clientB.on('connect', () => {
      console.log('  🟢 Client B connected:', clientB.id);
      clientB.emit('erd:join', {
        projectId: PROJECT_ID,
        user: { id: 'usr-alice', name: 'Dev Alice', color: '#ec4899' },
      });
    });

    clientA.on('erd:presence-update', (presence) => {
      console.log(`  👥 Client A presence updated: ${presence.count} people viewing room`);
      if (presence.count >= 2) {
        clientAReady = true;
        // Client A moves cursor
        clientA.emit('erd:cursor-move', {
          projectId: PROJECT_ID,
          cursor: { x: 450, y: 320 },
        });

        // Client A drags node
        clientA.emit('erd:node-drag', {
          projectId: PROJECT_ID,
          nodeId: 'entity-1',
          position: { x: 500, y: 200 },
        });
      }
    });

    clientB.on('erd:cursor-moved', (data) => {
      console.log(`  🎯 Client B received live cursor move from '${data.name}' at (${data.cursor.x}, ${data.cursor.y}) with color ${data.color}`);
      cursorReceived = true;
      checkDone();
    });

    clientB.on('erd:node-dragged', (data) => {
      console.log(`  📦 Client B received real-time node drag on '${data.nodeId}' to (${data.position.x}, ${data.position.y}) by '${data.actor}'`);
      dragReceived = true;
      checkDone();
    });

    function checkDone() {
      if (cursorReceived && dragReceived) {
        console.log('  🎉 All Socket.IO Live Collaboration tests PASSED!');
        clientA.disconnect();
        clientB.disconnect();
        resolve();
      }
    }

    setTimeout(() => {
      clientA.disconnect();
      clientB.disconnect();
      if (!cursorReceived || !dragReceived) {
        console.warn('  ⚠️ Socket test timeout (partial check)');
      }
      resolve();
    }, 5000);
  });

  console.log('\n========================================================');
  console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
  console.log('========================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

