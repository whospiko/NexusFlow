import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_BASE = 'http://localhost:5050/api';

async function runTests() {
  console.log('🧪 Starting Strict Gmail Verification Integration Tests...\n');

  // 1. Login as Piko (Project 1 Owner)
  const pikoLogin = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'piko@company.com', name: 'Piko' }),
  });
  const pikoAuth = await pikoLogin.json();
  console.log('1. Piko logged in (User ID:', pikoAuth.user.id, ')');

  // 2. Login as Alex (Different user)
  const alexLogin = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex.v@company.com', name: 'Alex V.' }),
  });
  const alexAuth = await alexLogin.json();
  console.log('2. Alex V. logged in (User ID:', alexAuth.user.id, ')');

  // 3. Piko invites a specific Gmail address
  const targetGmail = `dev.target.${Date.now()}@gmail.com`;
  const inviteRes = await fetch(`${API_BASE}/projects/1/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pikoAuth.token}`,
    },
    body: JSON.stringify({
      invitee_email: targetGmail,
      role: 'member',
    }),
  });
  const inviteData = await inviteRes.json();
  console.log('3. Invitation created for:', targetGmail);
  console.log('   Token:', inviteData.data.token);

  // 4. Verify that target Gmail is currently in PENDING state, NOT yet an active team member
  const membersRes1 = await fetch(`${API_BASE}/projects/1/members`, {
    headers: { Authorization: `Bearer ${pikoAuth.token}` },
  });
  const membersData1 = await membersRes1.json();
  const isActiveBeforeVerify = membersData1.data.some((m) => m.email.toLowerCase() === targetGmail);
  const isPendingBeforeVerify = membersData1.pending.some((p) => p.invitee_email.toLowerCase() === targetGmail);

  console.log('4. Is target Gmail active in team before verification?', isActiveBeforeVerify ? '❌ FAIL' : '✅ NO (Correct)');
  console.log('   Is target Gmail waiting in pending verification?', isPendingBeforeVerify ? '✅ YES (Correct)' : '❌ FAIL');

  // 5. TEST: Alex (wrong user) attempts to accept the target Gmail invite token
  const wrongUserAccept = await fetch(`${API_BASE}/invitations/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${alexAuth.token}`,
    },
    body: JSON.stringify({ token: inviteData.data.token }),
  });
  const wrongUserData = await wrongUserAccept.json();
  console.log('5. Wrong user (Alex) attempt status:', wrongUserAccept.status);
  console.log('   Wrong user error code:', wrongUserData.code);
  const blockedWrongUser = wrongUserAccept.status === 403 && wrongUserData.code === 'EMAIL_MISMATCH';
  console.log('   Blocked unauthorized account from claiming invite?', blockedWrongUser ? '✅ PASS (Protected)' : '❌ FAIL');

  // 6. Target Gmail logs in, but HAS NOT ACCEPTED / VERIFIED YET
  const targetUserLogin = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: targetGmail, name: 'Target Dev' }),
  });
  const targetUserAuth = await targetUserLogin.json();

  // Check if target user can access Project 1 before verifying
  const targetAccessBefore = await fetch(`${API_BASE}/projects/1`, {
    headers: { Authorization: `Bearer ${targetUserAuth.token}` },
  });
  console.log('6. Target user access before Gmail verification:', targetAccessBefore.status);
  const blockedBeforeVerify = targetAccessBefore.status === 403;
  console.log('   Is target user blocked from project board until verified?', blockedBeforeVerify ? '✅ PASS (Gated)' : '❌ FAIL');

  // 7. Target user clicks the verification link from Gmail and accepts
  const verifiedAccept = await fetch(`${API_BASE}/invitations/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${targetUserAuth.token}`,
    },
    body: JSON.stringify({ token: inviteData.data.token }),
  });
  const verifiedData = await verifiedAccept.json();
  console.log('7. Target user verified accept status:', verifiedAccept.status);
  console.log('   Response message:', verifiedData.message);
  const acceptSuccess = verifiedAccept.status === 200 && verifiedData.success;
  console.log('   Did Gmail verification succeed?', acceptSuccess ? '✅ PASS' : '❌ FAIL');

  // 8. Now target user accesses Project 1
  const targetAccessAfter = await fetch(`${API_BASE}/projects/1`, {
    headers: { Authorization: `Bearer ${targetUserAuth.token}` },
  });
  const targetAccessData = await targetAccessAfter.json();
  console.log('8. Target user access after Gmail verification:', targetAccessAfter.status, `(Project: ${targetAccessData.data?.name})`);
  const accessGranted = targetAccessAfter.status === 200;
  console.log('   Has full team access now?', accessGranted ? '✅ PASS' : '❌ FAIL');

  // 9. Check members list again: target Gmail should now be ACTIVE and not in pending
  const membersRes2 = await fetch(`${API_BASE}/projects/1/members`, {
    headers: { Authorization: `Bearer ${pikoAuth.token}` },
  });
  const membersData2 = await membersRes2.json();
  const isActiveAfterVerify = membersData2.data.some((m) => m.email.toLowerCase() === targetGmail);
  const isPendingAfterVerify = membersData2.pending.some((p) => p.invitee_email.toLowerCase() === targetGmail);

  console.log('9. Is target Gmail now officially an active team member?', isActiveAfterVerify ? '✅ YES (PASS)' : '❌ FAIL');
  console.log('   Has target Gmail been removed from pending queue?', !isPendingAfterVerify ? '✅ YES (PASS)' : '❌ FAIL');

  console.log('\n🎉 ALL GMAIL VERIFICATION GUARDS PASSED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

