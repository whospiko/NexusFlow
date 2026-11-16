import {
  getAllTags,
  createTag,
  getTagsForIssue,
  attachTagToIssue,
  removeTagFromIssue,
} from '../services/tagService.js';

// GET /api/tags - List all available tags
export async function getTags(req, res, next) {
  try {
    const tags = await getAllTags();
    res.json({ success: true, count: tags.length, data: tags });
  } catch (err) {
    next(err);
  }
}

// POST /api/tags - Create a new tag
export async function createTagHandler(req, res, next) {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tag name is required' });
    }
    const tag = await createTag(name, color);
    res.status(201).json({ success: true, data: tag });
  } catch (err) {
    next(err);
  }
}

// GET /api/tasks/:taskId/tags (or /issues/:issueId/tags)
export async function getIssueTags(req, res, next) {
  try {
    const id = req.params.taskId || req.params.issueId;
    const tags = await getTagsForIssue(id);
    res.json({ success: true, count: tags.length, data: tags });
  } catch (err) {
    next(err);
  }
}

export const getTaskTags = getIssueTags;

// POST /api/tasks/:taskId/tags (or /issues/:issueId/tags)
export async function attachTag(req, res, next) {
  try {
    const id = req.params.taskId || req.params.issueId;
    const { tagId, actor = 'Piko' } = req.body;

    if (!tagId) {
      return res.status(400).json({ success: false, message: 'tagId is required' });
    }

    const updatedTags = await attachTagToIssue(id, tagId, actor);
    res.json({ success: true, message: 'Tag attached successfully', data: updatedTags });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tasks/:taskId/tags/:tagId (or /issues/:issueId/tags/:tagId)
export async function removeTag(req, res, next) {
  try {
    const id = req.params.taskId || req.params.issueId;
    const { tagId } = req.params;
    const { actor = 'Piko' } = req.body || {};

    const updatedTags = await removeTagFromIssue(id, tagId, actor);
    res.json({ success: true, message: 'Tag removed successfully', data: updatedTags });
  } catch (err) {
    next(err);
  }
}

