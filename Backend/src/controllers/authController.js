import { signToken, findOrCreateUser, getUserById, getUserByEmail, getDemoUsers, getAllUsers } from '../services/authService.js';

function formatAuthRedirect(frontendUrl, paramStr) {
  const cleanBase = (frontendUrl || 'http://localhost:3000').replace(/\/+$/, '');
  return `${cleanBase}/login?${paramStr}`;
}

/**
 * GET /api/auth/google - Initiate Google OAuth
 */
export async function initiateGoogleOAuth(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5050/api/auth/google/callback';

  if (!clientId || clientId.includes('your_google_client_id')) {
    return res.status(400).json({
      success: false,
      message: 'Google OAuth is not configured yet. Please supply GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Backend/.env, or use Quick Dev Login.',
    });
  }

  const scope = encodeURIComponent('openid email profile');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  res.redirect(googleAuthUrl);
}

/**
 * GET /api/auth/google/callback - Handle Google OAuth Callback
 */
export async function handleGoogleCallback(req, res) {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error || !code) {
    return res.redirect(formatAuthRedirect(frontendUrl, `error=${encodeURIComponent(error || 'Authorization denied')}`));
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5050/api/auth/google/callback';

    // 1. Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || 'Failed to exchange Google OAuth code');
    }

    // 2. Fetch User Profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.email) {
      throw new Error('Google account has no verified email address');
    }

    // 3. Find or Create User in PostgreSQL (No ORM)
    const user = await findOrCreateUser({
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      avatarUrl: profile.picture,
      provider: 'google',
      providerId: profile.sub,
    });

    // 4. Generate JWT
    const token = signToken(user);

    // 5. Redirect to Frontend with token
    res.redirect(formatAuthRedirect(frontendUrl, `token=${token}`));
  } catch (err) {
    console.error('Google OAuth Callback Error:', err);
    res.redirect(formatAuthRedirect(frontendUrl, `error=${encodeURIComponent(err.message)}`));
  }
}

/**
 * GET /api/auth/github - Initiate GitHub OAuth
 */
export async function initiateGithubOAuth(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL || 'http://localhost:5050/api/auth/github/callback';

  if (!clientId || clientId.includes('your_github_client_id')) {
    return res.status(400).json({
      success: false,
      message: 'GitHub OAuth is not configured yet. Please supply GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Backend/.env, or use Quick Dev Login.',
    });
  }

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  res.redirect(githubAuthUrl);
}

/**
 * GET /api/auth/github/callback - Handle GitHub OAuth Callback
 */
export async function handleGithubCallback(req, res) {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error || !code) {
    return res.redirect(formatAuthRedirect(frontendUrl, `error=${encodeURIComponent(error || 'Authorization denied')}`));
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_CALLBACK_URL || 'http://localhost:5050/api/auth/github/callback';

    // 1. Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      throw new Error(tokenData.error_description || 'Failed to exchange GitHub OAuth code');
    }

    // 2. Fetch User Profile
    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'Bug-Tracker-PERN',
      },
    });
    const profile = await profileRes.json();

    // Fetch primary email if private
    let email = profile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'Bug-Tracker-PERN',
        },
      });
      const emails = await emailRes.json();
      const primary = emails.find((e) => e.primary) || emails[0];
      email = primary?.email;
    }

    if (!email) {
      email = `${profile.login}@users.noreply.github.com`;
    }

    // 3. Find or Create User in PostgreSQL (No ORM)
    const user = await findOrCreateUser({
      email,
      name: profile.name || profile.login,
      avatarUrl: profile.avatar_url,
      provider: 'github',
      providerId: String(profile.id),
    });

    // 4. Generate JWT
    const token = signToken(user);

    // 5. Redirect to Frontend with token
    res.redirect(formatAuthRedirect(frontendUrl, `token=${token}`));
  } catch (err) {
    console.error('GitHub OAuth Callback Error:', err);
    res.redirect(formatAuthRedirect(frontendUrl, `error=${encodeURIComponent(err.message)}`));
  }
}

/**
 * POST /api/auth/dev-login - 1-Click Instant Developer / Demo Login
 * STRICT SECURITY: Only permits designated demo accounts (@company.com or is_demo=true).
 * Real OAuth accounts (Google/GitHub) are strictly forbidden from bypassing authentication.
 */
export async function devLogin(req, res, next) {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required for dev login' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Strict Security Guard: Protect Real Accounts from Authentication Bypass
    const existing = await getUserByEmail(cleanEmail);

    if (existing) {
      const isOAuth = existing.provider === 'google' || existing.provider === 'github';
      const isRealAccount = !existing.is_demo && !cleanEmail.endsWith('@company.com');

      if (isOAuth || isRealAccount) {
        return res.status(403).json({
          success: false,
          code: 'OAUTH_REQUIRED',
          message: `The account "${cleanEmail}" is a real protected account (${existing.provider}). Instant 1-Click login is strictly forbidden for real accounts. Please sign in via Google or GitHub OAuth.`,
        });
      }
    } else {
      // For brand new accounts trying to dev-login: only permit simulated demo company emails in production
      const isCompanyDemo = cleanEmail.endsWith('@company.com');
      if (!isCompanyDemo && process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          code: 'DEMO_ACCOUNTS_ONLY',
          message: 'Instant dev login is only permitted for simulated demo accounts (@company.com).',
        });
      }
    }

    // 2. Safe execution for permitted demo users
    const user = await findOrCreateUser({
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
      provider: 'local',
      isDemo: true,
    });

    const token = signToken(user);

    res.json({
      success: true,
      message: `Logged in as demo user ${user.name}`,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        provider: user.provider,
        is_demo: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/users - Retrieve list of designated demo accounts for testing
 * Strictly returns only demo accounts, never real OAuth accounts.
 */
export async function getAuthUsers(req, res, next) {
  try {
    const users = await getDemoUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me - Retrieve current authenticated user profile
 */
export async function getCurrentUser(req, res, next) {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

