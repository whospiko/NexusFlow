import { query } from '../config/db.js';
import { logActivity } from '../services/activityService.js';

// GET /api/tasks/:taskId/comments (or /issues/:issueId/comments)
export async function getCommentsByTask(req, res, next) {
  try {
    const taskId = req.params.taskId || req.params.issueId;

    // Verify task exists
    const taskCheck = await query('SELECT id FROM tasks WHERE id = $1', [taskId]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const sql = `
      SELECT 
        id,
        task_id,
        task_id AS issue_id,
        author,
        content,
        created_at
      FROM comments
      WHERE task_id = $1
      ORDER BY created_at ASC;
    `;
    const result = await query(sql, [taskId]);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
}

export const getCommentsByIssue = getCommentsByTask;

// POST /api/tasks/:taskId/comments (or /issues/:issueId/comments)
export async function createComment(req, res, next) {
  try {
    const taskId = req.params.taskId || req.params.issueId;
    const { author, content } = req.body;

    if (!author || !author.trim()) {
      return res.status(400).json({ success: false, message: 'Comment author is required' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content cannot be empty' });
    }

    // Check parent task exists
    const taskCheck = await query('SELECT id FROM tasks WHERE id = $1', [taskId]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parent task not found' });
    }

    const sql = `
      INSERT INTO comments (task_id, author, content)
      VALUES ($1, $2, $3)
      RETURNING *, task_id AS issue_id;
    `;
    const result = await query(sql, [taskId, author.trim(), content.trim()]);
    const createdComment = result.rows[0];

    // Log comment added audit trail
    await logActivity({
      taskId,
      actor: author.trim(),
      actionType: 'comment_added',
      newValue: content.trim().length > 70 ? content.trim().substring(0, 70) + '...' : content.trim(),
    });

    res.status(201).json({ success: true, data: createdComment });
  } catch (err) {
    next(err);
  }
}

// PUT /api/comments/:id - Edit / Update a comment
export async function updateComment(req, res, next) {
  try {
    const { id } = req.params;
    const { content, author } = req.body;
    const actor = req.user?.name || author || 'User';

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content cannot be empty' });
    }

    // Verify existing comment
    const checkSql = 'SELECT * FROM comments WHERE id = $1;';
    const checkRes = await query(checkSql, [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    const oldComment = checkRes.rows[0];

    const sql = `
      UPDATE comments
      SET content = $1
      WHERE id = $2
      RETURNING *, task_id AS issue_id;
    `;
    const result = await query(sql, [content.trim(), id]);
    const updatedComment = result.rows[0];

    // Log comment edit activity
    await logActivity({
      taskId: oldComment.task_id,
      actor,
      actionType: 'comment_edited',
      oldValue: oldComment.content.length > 60 ? oldComment.content.substring(0, 60) + '...' : oldComment.content,
      newValue: content.trim().length > 60 ? content.trim().substring(0, 60) + '...' : content.trim(),
    });

    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: updatedComment,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/comments/:id - Delete a comment
export async function deleteComment(req, res, next) {
  try {
    const { id } = req.params;
    const sql = `
      DELETE FROM comments
      WHERE id = $1
      RETURNING *;
    `;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    res.json({ success: true, message: 'Comment deleted successfully', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
