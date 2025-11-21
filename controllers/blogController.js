import Blog from '../models/Blog.js';
import Subscription from '../models/Subscription.js';
import transporter from '../config/mailer.js';
import BlogView from '../models/BlogView.js';

export const createBlog = async (req, res) => {
  try {
    const payload = { ...req.body };

    // Basic validation
    if (!payload.title || !payload.author || !payload.category || !payload.content) {
      return res.status(400).json({ error: 'title, author, category, and content are required.' });
    }

    // Normalize tags to array
    if (typeof payload.tags === 'string') {
      payload.tags = payload.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // publishedAt default if not provided
    if (!payload.publishedAt) {
      payload.publishedAt = new Date();
    } else {
      const ts = new Date(payload.publishedAt).getTime();
      payload.publishedAt = Number.isFinite(ts) ? new Date(ts) : new Date();
    }

    const blog = await Blog.create(payload);
    // Fire-and-forget notifications to Blog subscribers
    (async () => {
      try {
        const subs = await Subscription.find({ unsubscribed: { $ne: true }, types: 'blog' }).lean();
        if (subs && subs.length) {
          const FRONTEND_BASE = process.env.FRONTEND_BASE || 'http://localhost:5174';
          const blogUrl = `${FRONTEND_BASE}/blog/${blog._id}`;
          const subject = `New Blog Posted: ${blog.title}`;
          const imageUrl = String(blog.image || '').trim();
          const shortDesc = String(blog.shortDesc || '').trim();

          const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
              <h2 style="margin:0 0 12px">${blog.title}</h2>
              ${shortDesc ? `<p style="margin:0 0 12px">${shortDesc}</p>` : ''}
              ${imageUrl ? `<img src="${imageUrl}" alt="${blog.title}" width="100%" style="border-radius:8px;margin:10px 0" />` : ''}
              <a href="${blogUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px" target="_blank" rel="noopener noreferrer">Read Full Blog</a>
              <p style="margin-top:16px;font-size:12px;color:#64748b">You’re receiving this because you subscribed to Blog Alerts.</p>
            </div>
          `;

          console.log(`Sending blog alerts to ${subs.length} subscribers`);
          const sends = subs
            .map(s => s?.email)
            .filter(Boolean)
            .map((to) => transporter.sendMail({
              from: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
              to,
              subject,
              text: `${blog.title}\n\n${shortDesc}\n\nRead: ${blogUrl}`,
              html,
            }));

          const results = await Promise.allSettled(sends);
          const failed = results.filter(r => r.status === 'rejected');
          if (failed.length) console.warn(`Blog alert emails failed for ${failed.length} recipient(s)`);
        }
      } catch (err) {
        console.error('Blog alert notify error', err?.message || err);
      }
    })();
    return res.status(201).json(blog);
  } catch (err) {
    console.error('createBlog error', err);
    return res.status(400).json({ error: err.message || 'Invalid blog data' });
  }
};

export const getBlogs = async (_req, res) => {
  try {
    const blogs = await Blog.find().sort({ publishedAt: -1, createdAt: -1 });
    return res.json(blogs);
  } catch (err) {
    console.error('getBlogs error', err);
    return res.status(500).json({ error: 'Failed to fetch blogs' });
  }
};

export const getBlogById = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id || !id.match(/^[a-f0-9]{24}$/i)) {
      return res.status(400).json({ error: 'Invalid blog id' });
    }
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    return res.json(blog);
  } catch (err) {
    console.error('getBlogById error', err);
    return res.status(400).json({ error: 'Invalid blog id' });
  }
};

// GET /api/blogs/categories
// Returns list of unique blog categories
export const getCategories = async (_req, res) => {
  try {
    const categories = await Blog.distinct('category');
    return res.status(200).json(categories);
  } catch (error) {
    console.error('getCategories error', error);
    return res.status(500).json({ message: 'Failed to fetch categories', error: error?.message || error });
  }
};

// (Optional) GET /api/blogs/category/:category
// Returns blogs filtered by a specific category
export const getBlogsByCategory = async (req, res) => {
  try {
    const category = String(req.params.category || '').trim();
    if (!category) return res.status(400).json({ error: 'Category is required' });
    const blogs = await Blog.find({ category }).sort({ publishedAt: -1, createdAt: -1 });
    return res.status(200).json(blogs);
  } catch (error) {
    console.error('getBlogsByCategory error', error);
    return res.status(500).json({ message: 'Failed to fetch blogs by category', error: error?.message || error });
  }
};

// POST /api/blogs/:id/view
// Records a view event for the given blog
export const trackView = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id || !id.match(/^[a-f0-9]{24}$/i)) {
      return res.status(400).json({ error: 'Invalid blog id' });
    }
    const blogExists = await Blog.exists({ _id: id });
    if (!blogExists) return res.status(404).json({ error: 'Blog not found' });
    await BlogView.create({ blog: id });
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('trackView error', err);
    return res.status(500).json({ error: 'Failed to record blog view' });
  }
};

// GET /api/blogs/:id/views
// Returns total recorded views count for the blog
export const getViewsCount = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id || !id.match(/^[a-f0-9]{24}$/i)) {
      return res.status(400).json({ error: 'Invalid blog id' });
    }
    const blogExists = await Blog.exists({ _id: id });
    if (!blogExists) return res.status(404).json({ error: 'Blog not found' });
    const count = await BlogView.countDocuments({ blog: id });
    return res.json({ views: count });
  } catch (err) {
    console.error('getViewsCount error', err);
    return res.status(500).json({ error: 'Failed to fetch views count' });
  }
};