import { Router } from 'express';
import { createJob, getJobs, getJobById, updateJob, deleteJob, getCategories, getJobStats, applyToJob, getApplyStatus } from '../controllers/jobController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// CRUD endpoints for jobs
// Place categories BEFORE dynamic :id to avoid shadowing
router.get('/categories', getCategories);
router.get('/stats', getJobStats);
router.get('/', getJobs);
router.post('/', createJob);
router.post('/:id/apply', requireAuth, applyToJob);
router.get('/:id/apply/status', requireAuth, getApplyStatus);
router.get('/:id', getJobById);
router.put('/:id', updateJob);
router.delete('/:id', deleteJob);

export default router;