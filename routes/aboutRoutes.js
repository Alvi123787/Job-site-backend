import { Router } from 'express';
import { getAbout, upsertAbout } from '../controllers/aboutController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', getAbout);
router.put('/', requireAuth, upsertAbout);
router.post('/', requireAuth, upsertAbout);

export default router;