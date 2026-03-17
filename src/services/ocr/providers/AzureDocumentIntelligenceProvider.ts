// Azure Document Intelligence OCR provider implementation
import { AzureKeyCredential, DocumentAnalysisClient } from '@azure/ai-form-recognizer';
import {
  OCRProvider,
  OCRProviderConfig,
  OCRProviderType,
  OCRRequest,
  OCRResult,
  OCRPage,
  OCRLine,
  OCRWord,
  OCRKeyValuePair,
  OCRTable,
  OCRTableCell,
  OCRError,
} from '../../../types/ocr.types';
import { logger } from '../../../config/logger';

/**
 * AzureDocumentIntelligenceProvider uses the Azure AI Document Intelligence
 * service (formerly Form Recognizer) to extract text and structured data from
 * images and PDFs.
 */
export class AzureDocumentIntelligenceProvider implements OCRProvider {
  private client: DocumentAnalysisClient | null = null;
  private ready = false;

  async initialize(config: OCRProviderConfig): Promise<void> {
    if (!config.endpoint) {
      throw new OCRError('Azure Document Intelligence endpoint is required', 'azure-document-intelligence');
    }
    if (!config.apiKey) {
      throw new OCRError('Azure Document Intelligence API key is required', 'azure-document-intelligence');
    }

    this.client = new DocumentAnalysisClient(config.endpoint, new AzureKeyCredential(config.apiKey));
    this.ready = true;
    logger.info('AzureDocumentIntelligenceProvider initialised');
  }

  isReady(): boolean {
    return this.ready;
  }

  getName(): OCRProviderType {
    return 'azure-document-intelligence';
  }

  async extractText(request: OCRRequest): Promise<OCRResult> {
    if (!this.ready || !this.client) {
      throw new OCRError('Azure Document Intelligence provider is not initialised', 'azure-document-intelligence');
    }

    const startTime = Date.now();

    try {
      const poller = await this.client.beginAnalyzeDocument('prebuilt-read', request.content);
      const result = await poller.pollUntilDone();

      if (!result) {
        throw new OCRError('Azure Document Intelligence returned no result', 'azure-document-intelligence');
      }

      const pages: OCRPage[] = (result.pages ?? []).map((page) => {
        const lines: OCRLine[] = (page.lines ?? []).map((line): OCRLine => {
          // `line.words` is a generator function in the Azure SDK
          const words: OCRWord[] = Array.from(line.words()).map((word): OCRWord => ({
            text: word.content,
            confidence: word.confidence ?? 0,
            boundingBox: this.buildBoundingBox(word.polygon),
          }));

          return {
            text: line.content,
            confidence: this.averageConfidence(words.map((w) => w.confidence)),
            words,
            boundingBox: this.buildBoundingBox(line.polygon),
          };
        });

        const text = lines.map((l) => l.text).join('\n');

        return {
          pageNumber: page.pageNumber,
          text,
          confidence: this.averageConfidence(lines.map((l) => l.confidence)),
          lines,
          width: page.width,
          height: page.height,
        };
      });

      const fullText = pages.map((p) => p.text).join('\n\n');
      const overallConfidence = this.averageConfidence(pages.map((p) => p.confidence));

      // Extract key-value pairs from structured documents when available
      const keyValuePairs: OCRKeyValuePair[] = (result.keyValuePairs ?? []).map((kv): OCRKeyValuePair => ({
        key: kv.key.content,
        value: kv.value?.content ?? '',
        confidence: kv.confidence,
      }));

      // Extract tables
      const tables: OCRTable[] = (result.tables ?? []).map((table): OCRTable => {
        const cells: OCRTableCell[] = table.cells.map((cell): OCRTableCell => ({
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          text: cell.content,
          confidence: 0,
        }));

        return {
          rowCount: table.rowCount,
          columnCount: table.columnCount,
          cells,
        };
      });

      const wordCount = pages.reduce((acc, p) => acc + p.lines.reduce((a, l) => a + l.words.length, 0), 0);

      return {
        text: fullText,
        pages,
        metadata: {
          confidence: overallConfidence,
          language: result.languages?.[0]?.locale,
          pageCount: pages.length,
          wordCount,
          keyValuePairs: keyValuePairs.length > 0 ? keyValuePairs : undefined,
          tables: tables.length > 0 ? tables : undefined,
        },
        provider: 'azure-document-intelligence',
        processingTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      if (err instanceof OCRError) {
        throw err;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      throw new OCRError(
        `Azure Document Intelligence extraction failed: ${error.message}`,
        'azure-document-intelligence',
        error
      );
    }
  }

  /**
   * Convert an Azure polygon (array of Point2D) to a bounding box.
   */
  private buildBoundingBox(
    polygon: { x: number; y: number }[] | undefined
  ): { x: number; y: number; width: number; height: number } | undefined {
    if (!polygon || polygon.length < 4) {
      return undefined;
    }
    const xs = polygon.map((p) => p.x);
    const ys = polygon.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const width = Math.max(...xs) - x;
    const height = Math.max(...ys) - y;
    return { x, y, width, height };
  }

  private averageConfidence(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}
