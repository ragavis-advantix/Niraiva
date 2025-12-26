/**
 * OCR Service - OCR.space API Integration
 * Handles text extraction from images and PDFs
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export interface OCRResult {
    text: string;
    confidence: number;
    language: string;
}

export class OCRService {
    private apiKey: string;
    private baseUrl = 'https://api.ocr.space/parse/image';

    constructor() {
        this.apiKey = process.env.OCRSPACE_API_KEY || '';
        if (!this.apiKey) {
            console.warn('⚠️  OCRSPACE_API_KEY not configured - OCR will not work');
        }
    }

    /**
     * Process a file with OCR.space API
     * @param filePath - Absolute path to file
     * @param language - OCR language (default: 'eng')
     * @returns Extracted text and confidence
     */
    async processFile(filePath: string, language = 'eng'): Promise<OCRResult> {
        if (!this.apiKey) {
            throw new Error('OCR.space API key not configured');
        }

        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const form = new FormData();
        form.append('apikey', this.apiKey);
        form.append('language', language);
        form.append('isOverlayRequired', 'false');
        form.append('detectOrientation', 'true');
        form.append('scale', 'true');
        form.append('OCREngine', '2'); // Engine 2 is more accurate
        form.append('file', fs.createReadStream(filePath));

        try {
            console.log(`📄 Processing OCR for file: ${filePath}`);

            const response = await axios.post(this.baseUrl, form, {
                headers: form.getHeaders(),
                timeout: 60000, // 60s timeout for large files
            });

            if (response.data.IsErroredOnProcessing) {
                throw new Error(`OCR failed: ${response.data.ErrorMessage || 'Unknown error'}`);
            }

            const parsedResults = response.data.ParsedResults;
            if (!parsedResults || parsedResults.length === 0) {
                throw new Error('No OCR results returned');
            }

            const parsedText = parsedResults[0].ParsedText || '';
            const confidence = parsedResults[0].FileParseExitCode === 1 ? 0.9 : 0.5;

            console.log(`✅ OCR completed. Extracted ${parsedText.length} characters`);

            return {
                text: parsedText,
                confidence,
                language,
            };
        } catch (error: any) {
            if (error.response) {
                console.error('OCR.space API error:', error.response.data);
                throw new Error(`OCR API error: ${error.response.data.ErrorMessage || error.message}`);
            }
            console.error('OCR processing error:', error.message);
            throw new Error(`OCR processing failed: ${error.message}`);
        }
    }

    /**
     * Process a file from URL (alternative method)
     * @param fileUrl - Public URL to file
     * @param language - OCR language
     * @returns Extracted text and confidence
     */
    async processUrl(fileUrl: string, language = 'eng'): Promise<OCRResult> {
        if (!this.apiKey) {
            throw new Error('OCR.space API key not configured');
        }

        try {
            console.log(`📄 Processing OCR from URL: ${fileUrl}`);

            const response = await axios.post(this.baseUrl, {
                apikey: this.apiKey,
                url: fileUrl,
                language,
                isOverlayRequired: false,
                detectOrientation: true,
                scale: true,
                OCREngine: 2,
            }, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 60000,
            });

            if (response.data.IsErroredOnProcessing) {
                throw new Error(`OCR failed: ${response.data.ErrorMessage || 'Unknown error'}`);
            }

            const parsedResults = response.data.ParsedResults;
            if (!parsedResults || parsedResults.length === 0) {
                throw new Error('No OCR results returned');
            }

            const parsedText = parsedResults[0].ParsedText || '';
            const confidence = parsedResults[0].FileParseExitCode === 1 ? 0.9 : 0.5;

            console.log(`✅ OCR completed. Extracted ${parsedText.length} characters`);

            return {
                text: parsedText,
                confidence,
                language,
            };
        } catch (error: any) {
            console.error('OCR URL processing error:', error.message);
            throw new Error(`OCR processing failed: ${error.message}`);
        }
    }
}
