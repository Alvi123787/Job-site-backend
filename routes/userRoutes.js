import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Blog from '../models/Blog.js';
import JobPost from '../models/JobPost.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Helper to ensure ObjectId
const toId = (id) => {
  try { return new mongoose.Types.ObjectId(String(id)); } catch (_) { return null; }
};

// Save job
router.post('/save-job/:jobId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const jobId = toId(req.params.jobId);
    if (!userId || !jobId) return res.status(400).json({ error: 'Invalid user or job id' });
    // optional existence check
    const exists = await JobPost.findById(jobId).select('_id').lean();
    if (!exists) return res.status(404).json({ error: 'Job not found' });
    await User.updateOne({ _id: userId }, { $addToSet: { savedJobs: jobId } });
    return res.json({ message: 'Job saved' });
  } catch (err) {
    console.error('save-job error', err);
    return res.status(500).json({ error: 'Failed to save job' });
  }
});

// Save blog
router.post('/save-blog/:blogId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const blogId = toId(req.params.blogId);
    if (!userId || !blogId) return res.status(400).json({ error: 'Invalid user or blog id' });
    const exists = await Blog.findById(blogId).select('_id').lean();
    if (!exists) return res.status(404).json({ error: 'Blog not found' });
    await User.updateOne({ _id: userId }, { $addToSet: { savedBlogs: blogId } });
    return res.json({ message: 'Blog saved' });
  } catch (err) {
    console.error('save-blog error', err);
    return res.status(500).json({ error: 'Failed to save blog' });
  }
});

// Remove saved job
router.delete('/remove-saved-job/:jobId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const jobId = toId(req.params.jobId);
    if (!userId || !jobId) return res.status(400).json({ error: 'Invalid user or job id' });
    await User.updateOne({ _id: userId }, { $pull: { savedJobs: jobId } });
    return res.json({ message: 'Job removed from saved' });
  } catch (err) {
    console.error('remove-saved-job error', err);
    return res.status(500).json({ error: 'Failed to remove saved job' });
  }
});

// Remove saved blog
router.delete('/remove-saved-blog/:blogId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const blogId = toId(req.params.blogId);
    if (!userId || !blogId) return res.status(400).json({ error: 'Invalid user or blog id' });
    await User.updateOne({ _id: userId }, { $pull: { savedBlogs: blogId } });
    return res.json({ message: 'Blog removed from saved' });
  } catch (err) {
    console.error('remove-saved-blog error', err);
    return res.status(500).json({ error: 'Failed to remove saved blog' });
  }
});

// Get saved items for user
router.get('/saved-items', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId)
      .populate({ path: 'savedJobs', model: JobPost })
      .populate({ path: 'savedBlogs', model: Blog })
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ jobs: user.savedJobs || [], blogs: user.savedBlogs || [] });
  } catch (err) {
    console.error('saved-items error', err);
    return res.status(500).json({ error: 'Failed to fetch saved items' });
  }
});

// Profile: get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select('-password -resetPasswordToken -resetPasswordExpires').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    console.error('get profile error', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Profile: update current user
router.put('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['name','role','country','location','profession','bio','phone','avatarUrl','notifications'];
    const update = {};
    for (const k of allowed) {
      if (typeof req.body?.[k] !== 'undefined') update[k] = req.body[k];
    }
    // Basic validation
    if (update.role && !['Job Seeker','Employer','Admin'].includes(update.role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(req.user?.id, update, { new: true })
      .select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ message: 'Profile updated', user });
  } catch (err) {
    console.error('update profile error', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Account: change password
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    const user = await User.findById(req.user?.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await (await import('bcryptjs')).default.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    if (String(newPassword).length < 8 || !/[0-9]/.test(newPassword) || !/[A-Za-z]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers' });
    }
    user.password = await (await import('bcryptjs')).default.hash(newPassword, 10);
    await user.save();
    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('change password error', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

// Account: delete
router.delete('/me', requireAuth, async (req, res) => {
  try {
    await User.deleteOne({ _id: req.user?.id });
    return res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('delete account error', err);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Role-based: my blogs (by author name)
router.get('/my-blogs', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const q = { author: (req.user?.email ? undefined : undefined) };
    // We store author as name in Blog model
    const me = await User.findById(req.user?.id).select('name').lean();
    const authorName = me?.name || '';
    const cursor = Blog.find({ author: authorName }).sort({ createdAt: -1 });
    const total = await Blog.countDocuments({ author: authorName });
    const items = await cursor.skip((Number(page)-1)*Number(limit)).limit(Number(limit)).lean();
    return res.json({ total, page: Number(page), limit: Number(limit), items });
  } catch (err) {
    console.error('my-blogs error', err);
    return res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

// Role-based: my jobs (by postedBy)
router.get('/my-jobs', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { postedBy: req.user?.id };
    if (status && ['Active','Draft','Expired'].includes(String(status))) filter.status = String(status);
    const now = new Date();
    // If status=Expired but jobs don’t have status set, fallback to endDate < now
    if (status === 'Expired') {
      filter.$or = [{ status: 'Expired' }, { endDate: { $lt: now } }];
      delete filter.status;
    }
    const total = await JobPost.countDocuments(filter);
    const items = await JobPost.find(filter).sort({ createdAt: -1 }).skip((Number(page)-1)*Number(limit)).limit(Number(limit)).lean();
    return res.json({ total, page: Number(page), limit: Number(limit), items });
  } catch (err) {
    console.error('my-jobs error', err);
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

export default router;