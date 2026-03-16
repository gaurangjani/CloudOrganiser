// OCR routes
import { Router } from 'express';
import express from 'express';
import { extractText, getSupportedTypes } from '../controllers/ocr.controller';

const router = Router();

// Accept raw binary uploads (images, PDFs)
router.use(express.raw({ type: '*/*', limit: '50mb' }));

/**
 * @route  GET /ocr/supported-types
 * @desc   Returns the MIME types supported by the configured OCR provider
 */
router.get('/supported-types', getSupportedTypes);

/**
 * @route  POST /ocr/extract
 * @desc   Extract text and metadata from an image or PDF
 * @query  mimeType {string}  – MIME type of the file (required)
 * @query  fileName {string}  – Original file name (optional)
 * @query  language {string}  – Language hint, e.g. 'en' (optional)
 * @body   Raw binary file content (application/octet-stream)
 */
router.post('/extract', extractText);

export default router;
