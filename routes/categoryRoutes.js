import { Router } from 'express';
import { createOrUpdateCategory, getAllCategories } from '../controllers/categoryController.js';

const router = Router();

router.get('/', getAllCategories);
router.post('/', createOrUpdateCategory);

export default router;

