import {
  getUserProjectTeams,
  removeProjectMember,
} from '../services/teamService.js';

// GET /api/teams - List all project teams that the authenticated user belongs to
export async function getTeams(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const projectTeams = await getUserProjectTeams(userId);
    res.json({
      success: true,
      count: projectTeams.length,
      data: projectTeams,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/teams/:projectId/members/:userId - Remove a member from a project team
export async function removeMember(req, res, next) {
  try {
    const { projectId, userId } = req.params;
    const requestingUserId = req.user.id;

    const removed = await removeProjectMember(
      parseInt(projectId, 10),
      parseInt(userId, 10),
      requestingUserId
    );

    if (!removed) {
      return res.status(404).json({ success: false, message: 'Member not found in this project' });
    }

    res.json({
      success: true,
      message: 'Member removed from project team',
      data: removed,
    });
  } catch (err) {
    next(err);
  }
}
