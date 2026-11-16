import { signToken, findOrCreateUser, getUserById, getAllUsers } from '../services/authService.js';

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
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error || 'Authorization denied')}`);
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
    res.redirect(`${frontendUrl}/login?token=${token}`);
  } catch (err) {
    console.error('Google OAuth Callback Error:', err);
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
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
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error || 'Authorization denied')}`);
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
    res.redirect(`${frontendUrl}/login?token=${token}`);
  } catch (err) {
    console.error('GitHub OAuth Callback Error:', err);
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
  }
}

/**
 * POST /api/auth/dev-login - 1-Click Instant Developer / Demo Login
 */
export async function devLogin(req, res, next) {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required for dev login' });
    }

    const user = await findOrCreateUser({
      email: email.trim().toLowerCase(),
      name: name || email.split('@')[0],
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      provider: 'local',
    });

    const token = signToken(user);

    res.json({
      success: true,
      message: `Logged in as ${user.name}`,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        provider: user.provider,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/users - Retrieve list of available accounts for demo switching
 */
export async function getAuthUsers(req, res, next) {
  try {
    const users = await getAllUsers();
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

