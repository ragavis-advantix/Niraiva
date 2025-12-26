/**
 * Gemini AI Service - Medical Report Parsing
 * Uses Google Gemini REST API (FREE gemini-2.5-flash model)
 */

import fetch from 'node-fetch';

export interface TestResult {
    name: string;
    value: string | number;
    unit?: string;
    ref_range?: string;
    flag?: 'normal' | 'high' | 'low' | 'critical';
}

export interface Medication {
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
}

export interface ParsedReport {
    type: 'lab_report' | 'prescription' | 'discharge_summary' | 'radiology' | 'unknown';
    patient_name?: string;
    patient_identifier?: string;
    report_date?: string;
    lab_name?: string;
    doctor_name?: string;
    tests?: TestResult[];
    medications?: Medication[];
    diagnosis?: string;
    notes?: string;
    raw_text: string;
    confidence: number;
    fhir_bundle?: any;
}

export class GeminiService {
    private apiKey: string;
    private model: string = 'models/gemini-2.5-flash'; // Latest free tier model

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
            console.warn('⚠️  GEMINI_API_KEY not configured - AI parsing will not work');
            throw new Error('Gemini API key not configured');
        }

        this.apiKey = apiKey;
        console.log(`🤖 Gemini Service initialized with ${this.model} (FREE)`);
    }

    /**
     * Parse medical report OCR text into structured data
     * @param ocrText - Raw OCR extracted text
     * @returns Structured parsed report with FHIR bundle
     */
    async parseReport(ocrText: string): Promise<ParsedReport> {
        if (!ocrText || ocrText.trim().length < 10) {
            throw new Error('OCR text is too short to parse');
        }

        const prompt = this.buildPrompt(ocrText);
        const url = `https://generativelanguage.googleapis.com/v1beta/${this.model}:generateContent?key=${this.apiKey}`;

        try {
            console.log(`🤖 Parsing report with Gemini (${ocrText.length} chars)...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            const json: any = await response.json();

            if (json.error) {
                throw new Error(`Gemini API Error: ${json.error.message || JSON.stringify(json.error)}`);
            }

            if (!json.candidates || json.candidates.length === 0) {
                throw new Error('No response from Gemini API');
            }

            const text = json.candidates[0].content.parts[0].text;

            // Extract JSON from response (Gemini sometimes wraps in markdown)
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('Gemini response:', text.substring(0, 500));
                throw new Error('No valid JSON found in Gemini response');
            }

            const jsonText = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonText);

            console.log(`✅ Gemini parsing completed. Type: ${parsed.type}, Confidence: ${parsed.confidence}`);

            return {
                ...parsed,
                raw_text: ocrText,
            };
        } catch (error: any) {
            console.error('❌ Gemini parsing error:', error.message);

            // Provide helpful error messages
            if (error.message?.includes('API_KEY_INVALID')) {
                throw new Error('Gemini API Error: Invalid API key. Please check your GEMINI_API_KEY in .env file.');
            }

            if (error.message?.includes('PERMISSION_DENIED')) {
                throw new Error('Gemini API Error: Permission denied. Ensure Generative Language API is enabled.');
            }

            if (error.message?.includes('RESOURCE_EXHAUSTED')) {
                throw new Error('Gemini API Error: Quota exceeded. Free tier limit reached.');
            }

            throw new Error(`AI parsing failed: ${error.message}`);
        }
    }

    /**
     * Build the prompt for Gemini with medical report parsing instructions
     */
    private buildPrompt(ocrText: string): string {
        return `You are a medical report parser AI. Extract structured data from the following OCR text.

**CRITICAL INSTRUCTIONS:**
1. Return ONLY valid JSON, no additional text
2. Wrap your JSON response in \`\`\`json code blocks
3. Be conservative with confidence scores - only use >0.8 if data is very clear
4. For missing fields, use null
5. Normalize test names (e.g., "Hb" → "Hemoglobin")

**Required JSON Schema:**
\`\`\`json
{
  "type": "lab_report" | "prescription" | "discharge_summary" | "radiology" | "unknown",
  "patient_name": "string or null",
  "patient_identifier": "string or null",
  "report_date": "YYYY-MM-DD or null",
  "lab_name": "string or null",
  "doctor_name": "string or null",
  "tests": [
    {
      "name": "Test name",
      "value": "numeric or string value WITHOUT unit",
      "unit": "unit of measurement",
      "ref_range": "reference range",
      "flag": "normal" | "high" | "low" | "critical" | null
    }
  ],
  "medications": [
    {
      "name": "Medication name",
      "dosage": "dosage amount",
      "frequency": "frequency",
      "duration": "duration"
    }
  ],
  "diagnosis": "string or null",
  "notes": "any additional notes",
  "confidence": 0.0 to 1.0,
  "fhir_bundle": {
    "resourceType": "Bundle",
    "type": "transaction",
    "entry": [
      {
        "resource": {
          "resourceType": "DiagnosticReport",
          "status": "final",
          "code": {"text": "Lab Report"},
          "effectiveDateTime": "report_date"
        }
      }
    ]
  }
}
\`\`\`

**OCR Text to Parse:**
${ocrText}

**Your JSON Response:**`;
    }
}
