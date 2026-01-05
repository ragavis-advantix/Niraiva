import fetch from 'node-fetch';
import { ParsedReport } from './geminiService';

export interface AIProvider {
    name: string;
    parse(ocrText: string, prompt: string): Promise<ParsedReport>;
}

export class MultiLLMService {
    private providers: AIProvider[] = [];

    constructor() {
        this.initializeProviders();
    }

    private initializeProviders() {
        // 1. Gemini (Primary)
        if (process.env.GEMINI_API_KEY) {
            this.providers.push({
                name: 'Gemini',
                parse: async (ocrText, prompt) => this.callGemini(ocrText, prompt)
            });
        }

        // 2. Mistral
        if (process.env.MISTRAL_API_KEY) {
            this.providers.push({
                name: 'Mistral',
                parse: async (ocrText, prompt) => this.callOpenAICompatible(
                    'https://api.mistral.ai/v1/chat/completions',
                    process.env.MISTRAL_API_KEY!,
                    'mistral-large-latest',
                    ocrText,
                    prompt
                )
            });
        }

        // 3. OpenRouter (GPT-Free)
        if (process.env.OPENROUTER_API_KEY) {
            this.providers.push({
                name: 'OpenRouter',
                parse: async (ocrText, prompt) => this.callOpenAICompatible(
                    'https://openrouter.ai/api/v1/chat/completions',
                    process.env.OPENROUTER_API_KEY!,
                    'google/gemini-2.0-flash-exp:free', // Using a free model from OpenRouter
                    ocrText,
                    prompt,
                    { 'HTTP-Referer': 'https://niraiva.com', 'X-Title': 'Niraiva' }
                )
            });
        }

        // 4. NVIDIA NIM
        if (process.env.NVIDIA_API_KEY) {
            this.providers.push({
                name: 'NVIDIA',
                parse: async (ocrText, prompt) => this.callOpenAICompatible(
                    'https://integrate.api.nvidia.com/v1/chat/completions',
                    process.env.NVIDIA_API_KEY!,
                    'meta/llama-3.1-405b-instruct', // Example NVIDIA model
                    ocrText,
                    prompt
                )
            });
        }

        // 5. Qwen (via OpenRouter)
        if (process.env.OPENROUTER_API_KEY) {
            this.providers.push({
                name: 'Qwen',
                parse: async (ocrText, prompt) => this.callOpenAICompatible(
                    'https://openrouter.ai/api/v1/chat/completions',
                    process.env.OPENROUTER_API_KEY!,
                    'alibaba/qwen-2.5-72b-instruct', // Using Qwen via OpenRouter
                    ocrText,
                    prompt,
                    { 'HTTP-Referer': 'https://niraiva.com', 'X-Title': 'Niraiva' }
                )
            });
        }

        console.log(`🤖 MultiLLMService initialized with ${this.providers.length} providers: ${this.providers.map(p => p.name).join(', ')}`);
    }

    async parseReport(ocrText: string, customPrompt?: string): Promise<{ data: ParsedReport; provider: string }> {
        const prompt = customPrompt || this.getDefaultPrompt(ocrText);

        for (const provider of this.providers) {
            try {
                console.log(`🤖 Attempting parsing with ${provider.name}...`);
                const result = await provider.parse(ocrText, prompt);
                console.log(`✅ ${provider.name} parsing successful`);
                return { data: result, provider: provider.name };
            } catch (error: any) {
                console.warn(`⚠️ ${provider.name} failed: ${error.message}`);
                // Continue to next provider
            }
        }

        throw new Error('All AI providers failed to parse the report');
    }

    private async callGemini(ocrText: string, prompt: string): Promise<ParsedReport> {
        const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.status}`);
        }

        const json: any = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error('Empty response from Gemini');

        return this.extractJSON(text, ocrText);
    }

    private async callOpenAICompatible(
        url: string,
        apiKey: string,
        model: string,
        ocrText: string,
        prompt: string,
        extraHeaders: Record<string, string> = {}
    ): Promise<ParsedReport> {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...extraHeaders
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: 'You are a medical document analyzer. Extract structured JSON data.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error (${url}): ${response.status}`);
        }

        const json: any = await response.json();
        const text = json.choices?.[0]?.message?.content;

        if (!text) throw new Error('Empty response from API');

        return this.extractJSON(text, ocrText);
    }

    private extractJSON(text: string, rawText: string): ParsedReport {
        try {
            // Try direct parse
            return { ...JSON.parse(text), raw_text: rawText };
        } catch (e) {
            // Regex fallback
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                return { ...JSON.parse(match[0]), raw_text: rawText };
            }
            throw new Error('Failed to find valid JSON in AI response');
        }
    }

    private getDefaultPrompt(ocrText: string): string {
        return `Analyze this medical document text and convert it into EXACTLY one JSON object.

CRITICAL: Return ONLY valid JSON.

Schema:
{
  "type": "lab_report" | "prescription" | "discharge_summary" | "radiology" | "unknown",
  "patient_name": string | null,
  "report_date": "YYYY-MM-DD" | null,
  "tests": [
    { "name": string, "value": string, "unit": string, "ref_range": string, "flag": "normal" | "high" | "low" }
  ],
  "medications": [
    { "name": string, "dosage": string, "frequency": string, "duration": string }
  ],
  "diagnosis": string | null,
  "confidence": number,
  "fhir_bundle": { "resourceType": "Bundle", ... }
}

TEXT:
${ocrText}`;
    }
}
