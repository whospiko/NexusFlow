import crypto from 'crypto';
import { query } from '../config/db.js';
import { sendProjectInvitationEmail } from '../services/mailService.js';

/**
 * POST /api/projects/:projectId/invitations - Invite a user by email to join project team
 */
export async function inviteMember(req, res, next) {
  try {
    const { projectId } = req.params;
    const { invitee_email, role = 'member' } = req.body;
    const inviterId = req.user.id;
    const inviterName = req.user.name;

    if (!invitee_email || !invitee_email.trim()) {
      return res.status(400).json({ success: false, message: 'Invitee email address is required' });
    }

    const cleanEmail = invitee_email.trim().toLowerCase();

    // 1. Check project existence and verify caller is owner or admin
    const projectSql = `
      SELECT p.id, p.name, p.owner_id, pm.role AS caller_role
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
      WHERE p.id = $2;
    `;
    const projResult = await query(projectSql, [inviterId, projectId]);
    if (projResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = projResult.rows[0];
    const isOwner = project.owner_id === inviterId;
    const isAdmin = project.caller_role === 'admin' || project.caller_role === 'owner';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the project owner or administrators can invite new team members.',
      });
    }

    // 2. Check if the user is ALREADY an active verified member of this project
    const existingMemberSql = `
      SELECT pm.*, u.email 
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1 AND LOWER(u.email) = $2;
    `;
    const memberCheck = await query(existingMemberSql, [projectId, cleanEmail]);
    if (memberCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `User with email ${cleanEmail} is already an active member of this project.`,
      });
    }

    // 3. Generate cryptographic 32-byte hex token and 7-day expiration
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 4. Upsert pending invitation in PostgreSQL (replace any previous pending invite for this email on this project)
    const existingInviteSql = `
      SELECT id FROM project_invitations 
      WHERE project_id = $1 AND LOWER(invitee_email) = $2 AND status = 'pending'
      LIMIT 1;
    `;
    const existingInvite = await query(existingInviteSql, [projectId, cleanEmail]);

    let invitation;
    if (existingInvite.rows.length > 0) {
      const updateSql = `
        UPDATE project_invitations
        SET inviter_id = $1, role = $2, token = $3, expires_at = $4, created_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *;
      `;
      const updateRes = await query(updateSql, [
        inviterId,
        role,
        token,
        expiresAt,
        existingInvite.rows[0].id,
      ]);
      invitation = updateRes.rows[0];
    } else {
      const insertSql = `
        INSERT INTO project_invitations (project_id, inviter_id, invitee_email, role, token, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const insertRes = await query(insertSql, [
        projectId,
        inviterId,
        cleanEmail,
        role,
        token,
        expiresAt,
      ]);
      invitation = insertRes.rows[0];
    }

    // 5. Send Gmail notification / verification link
    const mailResult = await sendProjectInvitationEmail({
      toEmail: cleanEmail,
      inviterName,
      projectName: project.name,
      role,
      token,
    });

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${cleanEmail}. The recipient must verify via Gmail before accessing the team.`,
      data: invitation,
      emailResult: mailResult,
      inviteLink: mailResult.inviteLink,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/projects/:projectId/members - List all members of a project (both verified active & pending Gmail verification)
 */
export async function getProjectMembers(req, res, next) {
  try {
    const { projectId } = req.params;

    // 1. Active verified members
    const membersSql = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.avatar_url,
        pm.role,
        pm.joined_at,
        'active' AS membership_status,
        (p.owner_id = u.id) AS is_owner
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      JOIN projects p ON pm.project_id = p.id
      WHERE pm.project_id = $1
      ORDER BY is_owner DESC, pm.joined_at ASC;
    `;
    const membersResult = await query(membersSql, [projectId]);

    // 2. Pending invitations waiting for Gmail verification
    const pendingSql = `
      SELECT 
        pi.id,
        pi.project_id,
        pi.invitee_email,
        pi.role,
        pi.status,
        pi.token,
        pi.expires_at,
        pi.created_at,
        u.name AS inviter_name,
        'pending_verification' AS membership_status
      FROM project_invitations pi
      JOIN users u ON pi.inviter_id = u.id
      WHERE pi.project_id = $1 AND pi.status = 'pending' AND pi.expires_at > CURRENT_TIMESTAMP
      ORDER BY pi.created_at DESC;
    `;
    const pendingResult = await query(pendingSql, [projectId]);

    res.json({
      success: true,
      data: membersResult.rows,
      pending: pendingResult.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/projects/:projectId/invitations - List pending invitations for this project
 */
export async function getProjectPendingInvitations(req, res, next) {
  try {
    const { projectId } = req.params;

    const sql = `
      SELECT 
        pi.id,
        pi.project_id,
        pi.invitee_email,
        pi.role,
        pi.status,
        pi.token,
        pi.expires_at,
        pi.created_at,
        u.name AS inviter_name
      FROM project_invitations pi
      JOIN users u ON pi.inviter_id = u.id
      WHERE pi.project_id = $1 AND pi.status = 'pending' AND pi.expires_at > CURRENT_TIMESTAMP
      ORDER BY pi.created_at DESC;
    `;
    const result = await query(sql, [projectId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/invitations/:invitationId/resend - Resend Gmail verification email
 */
export async function resendInvitation(req, res, next) {
  try {
    const { projectId, invitationId } = req.params;
    const inviterName = req.user.name;

    const sql = `
      SELECT pi.*, p.name AS project_name
      FROM project_invitations pi
      JOIN projects p ON pi.project_id = p.id
      WHERE pi.id = $1 AND pi.project_id = $2;
    `;
    const result = await query(sql, [invitationId, projectId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invitation record not found' });
    }

    const invitation = result.rows[0];

    // Extend expiry 7 days
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query('UPDATE project_invitations SET expires_at = $1, status = \'pending\' WHERE id = $2', [
      newExpiresAt,
      invitationId,
    ]);

    const mailResult = await sendProjectInvitationEmail({
      toEmail: invitation.invitee_email,
      inviterName,
      projectName: invitation.project_name,
      role: invitation.role,
      token: invitation.token,
    });

    res.json({
      success: true,
      message: `Verification email resent to ${invitation.invitee_email}`,
      inviteLink: mailResult.inviteLink,
      emailResult: mailResult,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/projects/:projectId/invitations/:invitationId - Revoke / Cancel a pending invitation
 */
export async function cancelInvitation(req, res, next) {
  try {
    const { projectId, invitationId } = req.params;
    const sql = `
      DELETE FROM project_invitations
      WHERE id = $1 AND project_id = $2
      RETURNING *;
    `;
    const result = await query(sql, [invitationId, projectId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invitation record not found' });
    }
    res.json({ success: true, message: 'Invitation canceled successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/invitations/:token - Inspect invitation details
 */
export async function getInvitationByToken(req, res, next) {
  try {
    const { token } = req.params;

    const sql = `
      SELECT 
        pi.id,
        pi.project_id,
        pi.invitee_email,
        pi.role,
        pi.status,
        pi.expires_at,
        p.name AS project_name,
        p.description AS project_description,
        u.name AS inviter_name,
        u.email AS inviter_email,
        u.avatar_url AS inviter_avatar
      FROM project_invitations pi
      JOIN projects p ON pi.project_id = p.id
      JOIN users u ON pi.inviter_id = u.id
      WHERE pi.token = $1
      LIMIT 1;
    `;
    const result = await query(sql, [token]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invitation not found or invalid link.' });
    }

    const invitation = result.rows[0];
    const isExpired = new Date(invitation.expires_at) < new Date();

    res.json({
      success: true,
      data: {
        ...invitation,
        isExpired,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/invitations/accept - Accept invitation after verifying Gmail recipient identity
 */
export async function acceptInvitation(req, res, next) {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    const userEmail = (req.user.email || '').toLowerCase().trim();

    if (!token) {
      return res.status(400).json({ success: false, message: 'Invitation token is required.' });
    }

    // 1. Fetch valid pending invitation
    const inviteSql = `
      SELECT pi.*, p.name AS project_name
      FROM project_invitations pi
      JOIN projects p ON pi.project_id = p.id
      WHERE pi.token = $1
      LIMIT 1;
    `;
    const inviteResult = await query(inviteSql, [token]);

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invitation not found or invalid link.' });
    }

    const invitation = inviteResult.rows[0];

    if (invitation.status === 'accepted') {
      return res.json({
        success: true,
        message: 'This invitation was already verified and accepted.',
        projectId: invitation.project_id,
      });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This invitation link has expired. Please ask the project owner to re-send the invitation.',
      });
    }

    // 2. STRICT GMAIL IDENTITY VERIFICATION:
    // Only the user who is logged into the exact invited Gmail address can verify and join!
    const targetEmail = invitation.invitee_email.toLowerCase().trim();
    if (userEmail !== targetEmail) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_MISMATCH',
        message: `Gmail Verification Required: This invitation is addressed specifically to ${targetEmail}. You are currently logged in as ${userEmail}. Please switch and sign in with ${targetEmail} to verify your identity and join the team.`,
        expectedEmail: targetEmail,
        currentEmail: userEmail,
      });
    }

    // 3. Add user to project_members (Pure SQL with ON CONFLICT DO UPDATE)
    const memberSql = `
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, user_id) 
      DO UPDATE SET role = EXCLUDED.role
      RETURNING *;
    `;
    await query(memberSql, [invitation.project_id, userId, invitation.role]);

    // 4. Mark invitation as accepted
    const updateInviteSql = `
      UPDATE project_invitations
      SET status = 'accepted'
      WHERE id = $1;
    `;
    await query(updateInviteSql, [invitation.id]);

    res.json({
      success: true,
      message: `Gmail verified successfully! You are now an active team member of "${invitation.project_name}".`,
      projectId: invitation.project_id,
    });
  } catch (err) {
    next(err);
  }
}
