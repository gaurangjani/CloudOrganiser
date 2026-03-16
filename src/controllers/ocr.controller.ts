// OCR controller – handles file uploads and returns OCR results
import { Request, Response } from 'express';
import { OCRService, SUPPORTED_MIME_TYPES } from '../services/ocr/OCRService';
import { OCRError, OCRRequest } from '../types/ocr.types';
import { config } from '../config';
import { logger } from '../config/logger';

/**
 * Lazily-initialised OCR service instance shared across requests.
 * The promise ensures concurrent first-requests wait for the same
 * initialisation rather than creating multiple workers.
 */
let ocrServicePromise: Promise<OCRService> | null = null;

async function getOCRService(): Promise<OCRService> {
  if (!ocrServicePromise) {
    ocrServicePromise = (async () => {
      const service = new OCRService();
      await service.initProvider({
        provider: config.ocr.provider,
        apiKey: config.ocr.apiKey,
        endpoint: config.ocr.endpoint,
        language: config.ocr.language,
        timeout: config.ocr.timeout,
      });
      return service;
    })();
  }
  return ocrServicePromise;
}

/**
 * POST /ocr/extract
 *
 * Accepts a raw file buffer sent as `application/octet-stream` (or multipart
 * form-data with a `file` field), along with the query parameters:
 *   - mimeType  (required) – MIME type of the uploaded file
 *   - fileName  (optional) – original file name
 *   - language  (optional) – language hint (ISO 639-1)
 *
 * Returns the full OCR result as JSON.
 */
export async function extractText(req: Request, res: Response): Promise<void> {
  const { mimeType, fileName = 'unknown', language } = req.query as Record<string, string>;

  if (!mimeType) {
    res.status(400).json({
      status: 'error',
      message: 'Query parameter "mimeType" is required',
    });
    return;
  }

  let content: Buffer;
  if (Buffer.isBuffer(req.body)) {
    content = req.body;
  } else if (req.body instanceof Uint8Array) {
    content = Buffer.from(req.body);
  } else if (typeof req.body === 'string') {
    content = Buffer.from(req.body, 'binary');
  } else {
    res.status(400).json({
      status: 'error',
      message: 'Request body must be the raw file content (application/octet-stream)',
    });
    return;
  }

  if (content.length === 0) {
    res.status(400).json({ status: 'error', message: 'Request body is empty' });
    return;
  }

  const service = await getOCRService();

  if (!service.isSupportedMimeType(mimeType)) {
    res.status(415).json({
      status: 'error',
      message: `Unsupported MIME type: ${mimeType}`,
    });
    return;
  }

  const ocrRequest: OCRRequest = { content, mimeType, fileName, language };

  try {
    const result = await service.extractText(ocrRequest);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    if (err instanceof OCRError) {
      logger.warn(`OCR error for file ${fileName}: ${err.message}`);
      res.status(422).json({ status: 'error', message: err.message, provider: err.provider });
      return;
    }
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`Unexpected OCR error for file ${fileName}:`, error);
    res.status(500).json({ status: 'error', message: 'Internal server error during OCR processing' });
  }
}

/**
 * GET /ocr/supported-types
 *
 * Returns the list of MIME types supported by the active OCR provider.
 */
export async function getSupportedTypes(_req: Request, res: Response): Promise<void> {
  const service = await getOCRService();
  res.status(200).json({
    status: 'success',
    data: {
      provider: service.getProviderName(),
      supportedMimeTypes: SUPPORTED_MIME_TYPES,
    },
  });
}
