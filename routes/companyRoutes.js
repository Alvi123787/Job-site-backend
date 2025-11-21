import { Router } from 'express';
import { getCompanies, backfillCompaniesFromJobs } from '../controllers/companyController.js';

const router = Router();

// List companies (top/featured)
router.get('/', getCompanies);

// Backfill companies from existing jobs
router.post('/backfill', backfillCompaniesFromJobs);

export default router;