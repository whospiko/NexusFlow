import { query } from '../config/db.js';

/**
 * Ensures team tables exist (Backward-compatible fallback)
 */
export async function ensureTeamTableExists() {
  try {
    const ddl = `
      CREATE TABLE IF NOT EXISTS project_members (
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, user_id)
      );
    `;
    await query(ddl);
  } catch (err) {
    console.warn('Team table check notice:', err.message);
  }
}

/**
 * Fetch all Project Teams that a specific user belongs to (Pure SQL Scoped Multi-Tenancy)
 * If a new user has not created any project and has not accepted any invitation,
 * this returns an empty list: []
 */
export async function getUserProjectTeams(userId) {
  if (!userId) {
    return [];
  }

  const sql = `
    SELECT 
      p.id AS project_id,
      p.name AS project_name,
      p.description AS project_description,
      p.created_at AS project_created_at,
      p.owner_id,
      owner.name AS owner_name,
      owner.email AS owner_email,
      owner.avatar_url AS owner_avatar,
      (p.owner_id = $1) AS is_owner,
      pm.role AS my_role,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'avatar_url', u.avatar_url,
            'role', pm_all.role,
            'joined_at', pm_all.joined_at,
            'is_owner', (p.owner_id = u.id)
          )
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS members,
      COALESCE(
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', pi.id,
              'invitee_email', pi.invitee_email,
              'role', pi.role,
              'token', pi.token,
              'created_at', pi.created_at,
              'status', pi.status
            )
          )
          FROM project_invitations pi
          WHERE pi.project_id = p.id AND pi.status = 'pending' AND pi.expires_at > CURRENT_TIMESTAMP
        ),
        '[]'
      ) AS pending_invitations
    FROM projects p
    JOIN users owner ON p.owner_id = owner.id
    JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
    JOIN project_members pm_all ON p.id = pm_all.project_id
    JOIN users u ON pm_all.user_id = u.id
    GROUP BY p.id, owner.name, owner.email, owner.avatar_url, pm.role
    ORDER BY p.created_at DESC;
  `;

  const result = await query(sql, [userId]);
  return result.rows;
}

/**
 * Remove a member from a project team
 */
export async function removeProjectMember(projectId, targetUserId, requestingUserId) {
  // Check permission: caller must be project owner or removing themselves
  const projSql = 'SELECT owner_id FROM projects WHERE id = $1;';
  const projRes = await query(projSql, [projectId]);
  if (projRes.rows.length === 0) {
    throw new Error('Project not found');
  }

  const ownerId = projRes.rows[0].owner_id;
  const isOwner = ownerId === requestingUserId;
  const isSelf = targetUserId === requestingUserId;

  if (!isOwner && !isSelf) {
    throw new Error('Only the project owner can remove team members');
  }

  // Owner cannot be removed from their own project
  if (targetUserId === ownerId) {
    throw new Error('Cannot remove the project owner from the project team');
  }

  const deleteSql = `
    DELETE FROM project_members
    WHERE project_id = $1 AND user_id = $2
    RETURNING *;
  `;
  const result = await query(deleteSql, [projectId, targetUserId]);
  return result.rows[0] || null;
}
