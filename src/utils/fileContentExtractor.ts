// File content extraction utilities for different file types

import { FileContext } from '../types/context.types';

/**
 * FileContentExtractor extracts readable content from various file types
 */
export class FileContentExtractor {
  /**
   * Extract text content from a file based on its MIME type
   * @param context - The file context
   * @returns Promise resolving to extracted text content
   */
  static async extractContent(context: FileContext): Promise<string> {
    const { metadata, content } = context;

    if (!content) {
      return '';
    }

    // Convert Buffer to string if needed
    const contentStr = Buffer.isBuffer(content) ? content.toString('utf-8') : content;

    // Handle different MIME types
    switch (metadata.mimeType) {
      case 'text/plain':
      case 'text/html':
      case 'text/css':
      case 'text/javascript':
      case 'application/json':
      case 'application/xml':
      case 'text/xml':
        return contentStr;

      case 'application/pdf':
        return this.extractPDFContent(content);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return this.extractDOCXContent(content);

      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/webp':
      case 'image/svg+xml':
        return this.extractImageContent(context);

      default:
        // For unknown types, try to read as text
        try {
          return contentStr.substring(0, 10000); // Limit to first 10KB
        } catch {
          return '';
        }
    }
  }

  /**
   * Extract text from PDF files
   * Note: This is a placeholder. In production, you'd use a library like pdf-parse
   */
  private static extractPDFContent(content: Buffer | string): string {
    // TODO: Implement PDF parsing using pdf-parse or similar library
    // For now, return basic info
    const size = Buffer.isBuffer(content) ? content.length : content.length;
    return `[PDF Document - ${size} bytes - Content extraction requires pdf-parse library]`;
  }

  /**
   * Extract text from DOCX files
   * Note: This is a placeholder. In production, you'd use a library like mammoth
   */
  private static extractDOCXContent(content: Buffer | string): string {
    // TODO: Implement DOCX parsing using mammoth or similar library
    // For now, return basic info
    const size = Buffer.isBuffer(content) ? content.length : content.length;
    return `[DOCX Document - ${size} bytes - Content extraction requires mammoth library]`;
  }

  /**
   * Extract information from image files
   * Note: For actual OCR, you'd use a library like tesseract.js
   */
  private static extractImageContent(context: FileContext): string {
    const { name, metadata } = context;
    // For images, we return metadata as that's what we can extract without OCR
    return `[Image: ${name}, Type: ${metadata.mimeType}, Size: ${metadata.size} bytes]`;
  }

  /**
   * Get a summary of file information for classification
   * @param context - The file context
   * @returns A string summary for AI classification
   */
  static async getFileSummary(context: FileContext): Promise<string> {
    const { name, metadata, location } = context;
    const content = await this.extractContent(context);

    const summary = [
      `File Name: ${name}`,
      `MIME Type: ${metadata.mimeType}`,
      `Extension: ${metadata.extension}`,
      `Size: ${metadata.size} bytes`,
      `Location: ${location.fullPath}`,
      `Provider: ${location.provider}`,
      `Created: ${metadata.createdAt.toISOString()}`,
      `Modified: ${metadata.modifiedAt.toISOString()}`,
    ];

    if (content && content.length > 0) {
      const contentPreview = content.length > 2000 ? content.substring(0, 2000) + '...' : content;
      summary.push(`Content Preview: ${contentPreview}`);
    }

    return summary.join('\n');
  }

  /**
   * Detect if content might contain PII (Personal Identifiable Information)
   * This is a basic heuristic check
   */
  static detectPII(content: string): boolean {
    if (!content) return false;

    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
      /\b\d{16}\b/g, // Credit card pattern
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone number
      /\b(?:password|pwd|passwd|secret|token|api[_-]?key)[\s:=]+\S+/gi, // Credentials
    ];

    return piiPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Detect the primary language of text content
   * This is a very basic implementation
   */
  static detectLanguage(content: string): string | undefined {
    if (!content || content.length < 50) return undefined;

    // Very basic language detection based on character sets
    // In production, use a proper library like franc or languagedetect

    // Check for common English words
    const englishWords = /\b(the|is|at|which|on|a|an|and|or|but|in|with|to|for|of)\b/gi;
    const englishMatches = (content.match(englishWords) || []).length;

    // Check for non-ASCII characters
    // eslint-disable-next-line no-control-regex
    const hasNonAscii = /[^\x00-\x7F]/.test(content);

    if (englishMatches > 5) return 'en';
    if (hasNonAscii) return 'unknown-non-ascii';

    return 'unknown';
  }
}
