// Tesseract.js OCR provider implementation
import { createWorker } from 'tesseract.js';
import {
  OCRProvider,
  OCRProviderConfig,
  OCRProviderType,
  OCRRequest,
  OCRResult,
  OCRPage,
  OCRLine,
  OCRWord,
  OCRError,
} from '../../../types/ocr.types';
import { logger } from '../../../config/logger';

/**
 * TesseractOCRProvider uses the open-source Tesseract engine (via tesseract.js)
 * to extract text from images and PDFs.
 */
export class TesseractOCRProvider implements OCRProvider {
  private config: OCRProviderConfig | null = null;
  private ready = false;

  async initialize(config: OCRProviderConfig): Promise<void> {
    this.config = config;
    this.ready = true;
    logger.info('TesseractOCRProvider initialised');
  }

  isReady(): boolean {
    return this.ready;
  }

  getName(): OCRProviderType {
    return 'tesseract';
  }

  async extractText(request: OCRRequest): Promise<OCRResult> {
    if (!this.ready || !this.config) {
      throw new OCRError('Tesseract provider is not initialised', 'tesseract');
    }

    const startTime = Date.now();
    const language = request.language ?? this.config.language ?? 'eng';

    let worker;
    try {
      worker = await createWorker(language, undefined, {
        logger: () => undefined,
      });

      const { data } = await worker.recognize(request.content);

      // Extract lines and words from the block/paragraph/line/word hierarchy
      const mappedLines: OCRLine[] = [];
      const mappedWords: OCRWord[] = [];

      for (const block of data.blocks ?? []) {
        for (const para of block.paragraphs ?? []) {
          for (const line of para.lines ?? []) {
            const lineWords: OCRWord[] = (line.words ?? []).map((w): OCRWord => ({
              text: w.text,
              confidence: w.confidence / 100,
              boundingBox: w.bbox
                ? {
                    x: w.bbox.x0,
                    y: w.bbox.y0,
                    width: w.bbox.x1 - w.bbox.x0,
                    height: w.bbox.y1 - w.bbox.y0,
                  }
                : undefined,
            }));

            mappedWords.push(...lineWords);
            mappedLines.push({
              text: line.text,
              confidence: line.confidence / 100,
              words: lineWords,
              boundingBox: line.bbox
                ? {
                    x: line.bbox.x0,
                    y: line.bbox.y0,
                    width: line.bbox.x1 - line.bbox.x0,
                    height: line.bbox.y1 - line.bbox.y0,
                  }
                : undefined,
            });
          }
        }
      }

      const page: OCRPage = {
        pageNumber: 1,
        text: data.text,
        confidence: data.confidence / 100,
        lines: mappedLines,
      };

      const wordCount = mappedWords.filter((w) => w.text.trim().length > 0).length;

      return {
        text: data.text,
        pages: [page],
        metadata: {
          confidence: data.confidence / 100,
          language,
          pageCount: 1,
          wordCount,
        },
        provider: 'tesseract',
        processingTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new OCRError(`Tesseract extraction failed: ${error.message}`, 'tesseract', error);
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  }
}
