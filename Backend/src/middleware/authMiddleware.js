import { verifyToken } from '../services/authService.js';
import { query } from '../config/db.js';

/**
 * Require valid JWT authentication token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Bearer token missing.',
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please log in again.',
    });
  }
}

/**
 * Optional authentication token (extracts user if present)
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = verifyToken(token);
    } catch {
      req.user = null;
    }
  }
  next();
}

/**
 * Ensure the authenticated user is either the project owner or an invited member
 */
export async function requireProjectAccess(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id || req.body.project_id;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project ID is required' });
    }

    const userId = req.user.id;

    const sql = `
      SELECT 
        p.id, 
        p.name, 
        p.owner_id,
        pm.role AS member_role
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
      WHERE p.id = $2 AND (p.owner_id = $1 OR pm.user_id = $1)
      LIMIT 1;
    `;
    const result = await query(sql, [userId, projectId]);

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view or modify this project unless invited.',
      });
    }

    const row = result.rows[0];
    req.projectMembership = {
      projectId: row.id,
      projectName: row.name,
      isOwner: row.owner_id === userId,
      role: row.owner_id === userId ? 'owner' : (row.member_role || 'member'),
    };

    next();
  } catch (err) {
    next(err);
  }
}

