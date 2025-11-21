import { Router } from 'express';
import { createBlog, getBlogs, getBlogById, getCategories, getBlogsByCategory, trackView, getViewsCount } from '../controllers/blogController.js';

const router = Router();

// Place categories endpoints BEFORE dynamic :id route to avoid shadowing
router.get('/categories', getCategories);
router.get('/category/:category', getBlogsByCategory);
router.get('/', getBlogs);
router.post('/', createBlog);
router.post('/:id/view', trackView);
router.get('/:id/views', getViewsCount);
router.get('/:id', getBlogById);

export default router;