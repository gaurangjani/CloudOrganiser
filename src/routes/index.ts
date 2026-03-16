// Main router - combines all route modules
import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import webhookRoutes from './webhook.routes';
import approvalRoutes from './approval.routes';
import { config } from '../config';

const router = Router();

// API version prefix
const apiPrefix = `/api/${config.apiVersion}`;

// Mount routes
router.use(`${apiPrefix}`, healthRoutes);
router.use(`${apiPrefix}/auth`, authRoutes);
router.use(`${apiPrefix}/webhooks`, webhookRoutes);
router.use(`${apiPrefix}/approvals`, approvalRoutes);

// Example of how to add more routes:
// router.use(`${apiPrefix}/users`, userRoutes);
// router.use(`${apiPrefix}/files`, fileRoutes);

export default router;
