import Category from '../models/Category.js';

export const createOrUpdateCategory = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const imageUrl = String(req.body?.imageUrl || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

    const existing = await Category.findOne({ name });
    let category;
    if (existing) {
      existing.imageUrl = imageUrl;
      category = await existing.save();
    } else {
      category = await Category.create({ name, imageUrl });
    }
    return res.status(existing ? 200 : 201).json(category);
  } catch (err) {
    return res.status(400).json({ error: err?.message || 'Failed to save category' });
  }
};

export const getAllCategories = async (_req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 }).lean();
    return res.json({ categories, totalCategories: categories.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

