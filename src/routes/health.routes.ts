// Health check routes
import { Router } from 'express';
import { healthCheck, livenessCheck, readinessCheck } from '../controllers/health.controller';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// General health check (used by HEALTHCHECK instruction in Dockerfile)
router.get('/', asyncHandler(healthCheck));
router.get('/health', asyncHandler(healthCheck));

// Kubernetes / Azure Container Apps liveness probe – is the process alive?
router.get('/health/live', livenessCheck);

// Kubernetes / Azure Container Apps readiness probe – can the app serve traffic?
router.get('/health/ready', asyncHandler(readinessCheck));

export default router;
