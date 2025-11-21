import About from '../models/About.js';
import User from '../models/User.js';

// GET /api/about
export const getAbout = async (_req, res) => {
  try {
    const doc = await About.findOne({}, null, { sort: { updatedAt: -1 } });
    // If no content, return an empty object so frontend can fallback gracefully
    return res.json(doc || {});
  } catch (err) {
    console.error('getAbout error', err);
    return res.status(500).json({ error: 'Failed to fetch About content' });
  }
};

// PUT /api/about
// Requires authentication and admin role
export const upsertAbout = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).select('role');
    if (!user || String(user.role).toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }

    const payload = { ...req.body };
    // Normalize arrays defensively
    if (!Array.isArray(payload.features)) payload.features = [];
    if (!Array.isArray(payload.stats)) payload.stats = [];
    if (!payload.team) payload.team = {};

    let doc = await About.findOne({}, null, { sort: { updatedAt: -1 } });
    if (doc) {
      Object.assign(doc, payload);
      await doc.save();
    } else {
      doc = await About.create(payload);
    }
    return res.json(doc);
  } catch (err) {
    console.error('upsertAbout error', err);
    return res.status(400).json({ error: err.message || 'Failed to update About content' });
  }
};