import { Router } from 'express';
import { getEngagementOverTime, getTotals, recordSearchTerm, getPopularSearches } from '../controllers/analyticsController.js';

const router = Router();

router.get('/engagement', getEngagementOverTime);
router.get('/totals', getTotals);
router.post('/search', recordSearchTerm);
router.get('/popular-searches', getPopularSearches);

export default router;