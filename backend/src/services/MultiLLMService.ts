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
        console.log('🤖 [MultiLLM] Initializing providers...');

        // 1. Mistral
        if (process.env.MISTRAL_API_KEY) {
            console.log('✅ [MultiLLM] Mistral provider enabled');
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
        } else {
            console.warn('❌ [MultiLLM] Mistral disabled: MISTRAL_API_KEY missing');
        }

        // 2. OpenRouter (GPT-Free)
        if (process.env.OPENROUTER_API_KEY) {
            console.log('✅ [MultiLLM] OpenRouter provider enabled');
            this.providers.push({
                name: 'OpenRouter',
                parse: async (ocrText, prompt) => this.callOpenAICompatible(
                    'https://openrouter.ai/api/v1/chat/completions',
                    process.env.OPENROUTER_API_KEY!,
                    'google/gemini-2.0-flash-exp:free',
                    ocrText,
                    prompt,
                    { 'HTTP-Referer': 'https://niraiva.com', 'X-Title': 'Niraiva' }
                )
            });
        } else {
            console.warn('❌ [MultiLLM] OpenRouter disabled: OPENROUTER_API_KEY missing');
        }

        // 3. NVIDIA NIM
        if (process.env.NVIDIA_API_KEY) {
            console.log('✅ [MultiLLM] NVIDIA provider enabled');
            this.providers.push({
                name: 'NVIDIA',
                parse: async (ocrText, prompt) => this.callOpenAICompatible(
                    'https://integrate.api.nvidia.com/v1/chat/completions',
                    process.env.NVIDIA_API_KEY!,
                    'meta/llama-3.1-405b-instruct',
                    ocrText,
                    prompt
                )
            });
        } else {
            console.warn('❌ [MultiLLM] NVIDIA disabled: NVIDIA_API_KEY missing');
        }

        // 4. Qwen (via OpenRouter)
        if (process.env.OPENROUTER_API_KEY) {
            console.log('✅ [MultiLLM] Qwen provider enabled');
            this.providers.push({
                name: 'Qwen',
                parse: async (ocrText, prompt) => this.callOpenAICompatible(
                    'https://openrouter.ai/api/v1/chat/completions',
                    process.env.OPENROUTER_API_KEY!,
                    'alibaba/qwen-2.5-72b-instruct',
                    ocrText,
                    prompt,
                    { 'HTTP-Referer': 'https://niraiva.com', 'X-Title': 'Niraiva' }
                )
            });
        }

        console.log(`🤖 [MultiLLM] Ready with ${this.providers.length} providers.`);
    }

    async parseReport(ocrText: string, customPrompt?: string): Promise<{ data: ParsedReport; provider: string }> {
        const prompt = customPrompt || this.getDefaultPrompt(ocrText);
        const errors: any[] = [];

        if (this.providers.length === 0) {
            console.error('❌ [MultiLLM] No providers initialized! Check environment variables.');
            throw new Error('No AI providers configured in backend');
        }

        for (const provider of this.providers) {
            try {
                console.log(`🤖 [MultiLLM] Attempting parsing with ${provider.name}...`);
                const result = await provider.parse(ocrText, prompt);
                console.log(`✅ [MultiLLM] ${provider.name} parsing successful`);
                return { data: result, provider: provider.name };
            } catch (error: any) {
                console.warn(`⚠️ [MultiLLM] ${provider.name} failed:`, error.message);
                errors.push({ provider: provider.name, error: error.message });
            }
        }

        const details = errors.map(e => `${e.provider}: ${e.error}`).join(' | ');
        throw new Error(`All AI providers failed: ${details}`);
    }

    // --- NEW: Generic Chat Method ---

    async runLLM(providerName: string, request: { systemPrompt: string; userPrompt: string; temperature?: number }): Promise<string> {
        const provider = this.providers.find(p => p.name.toLowerCase() === providerName.toLowerCase());

        if (!provider) {
            console.warn(`⚠️ [MultiLLM] Provider '${providerName}' not found or disabled. Falling back to first available.`);
            // Fallback logic could go here, or just throw
            if (this.providers.length > 0) {
                return this.runProviderRaw(this.providers[0], request);
            }
            throw new Error(`LLM Provider '${providerName}' not available`);
        }

        return this.runProviderRaw(provider, request);
    }

    async runLLMStream(providerName: string, request: { systemPrompt: string; userPrompt: string; temperature?: number }): Promise<NodeJS.ReadableStream> {
        const provider = this.providers.find(p => p.name.toLowerCase() === providerName.toLowerCase());

        if (!provider) {
            console.warn(`⚠️ [MultiLLM] Provider '${providerName}' not found or disabled. Falling back to first available.`);
            if (this.providers.length > 0) {
                return this.runProviderStreamRaw(this.providers[0], request);
            }
            throw new Error(`LLM Provider '${providerName}' not available`);
        }

        return this.runProviderStreamRaw(provider, request);
    }

    private async runProviderRaw(provider: AIProvider, req: { systemPrompt: string; userPrompt: string; temperature?: number }): Promise<string> {
        // We need to access the internal callOpenAICompatible or similar logic. 
        // Since AIProvider interface currently only exposes `parse`, we need to refactor or cast.
        // For this task, I will implement a helper that switches based on provider name since we know the implementation details.

        // This is a pragmatic implementation to reuse the existing `callOpenAICompatible` logic.

        let url = '';
        let apiKey = '';
        let model = '';
        let extraHeaders = {};

        switch (provider.name) {
            case 'Mistral':
                url = 'https://api.mistral.ai/v1/chat/completions';
                apiKey = process.env.MISTRAL_API_KEY!;
                model = 'mistral-large-latest';
                break;
            case 'OpenRouter':
                url = 'https://openrouter.ai/api/v1/chat/completions';
                apiKey = process.env.OPENROUTER_API_KEY!;
                model = 'google/gemini-2.0-flash-exp:free';
                extraHeaders = { 'HTTP-Referer': 'https://niraiva.com', 'X-Title': 'Niraiva' };
                break;
            case 'NVIDIA':
                url = 'https://integrate.api.nvidia.com/v1/chat/completions';
                apiKey = process.env.NVIDIA_API_KEY!;
                model = 'meta/llama-3.1-405b-instruct';
                break;
            case 'Qwen': // Assuming Qwen is also via OpenRouter as per init
                url = 'https://openrouter.ai/api/v1/chat/completions';
                apiKey = process.env.OPENROUTER_API_KEY!;
                model = 'alibaba/qwen-2.5-72b-instruct';
                extraHeaders = { 'HTTP-Referer': 'https://niraiva.com', 'X-Title': 'Niraiva' };
                break;
            default:
                throw new Error(`Provider implementation for ${provider.name} not found in runLLM`);
        }

        // Call the raw API, but return TEXT not JSON (unlike parseReport)
        return this.callChatCompletion(url, apiKey, model, req.systemPrompt, req.userPrompt, extraHeaders);
    }

    private async runProviderStreamRaw(provider: AIProvider, req: { systemPrompt: string; userPrompt: string; temperature?: number }): Promise<NodeJS.ReadableStream> {
        let url = '';
        let apiKey = '';
        let model = '';
        let extraHeaders = {};

        switch (provider.name) {
            case 'Mistral':
                url = 'https://api.mistral.ai/v1/chat/completions';
                apiKey = process.env.MISTRAL_API_KEY!;
                model = 'mistral-large-latest';
                break;
            case 'OpenRouter':
                url = 'https://openrouter.ai/api/v1/chat/completions';
                apiKey = process.env.OPENROUTER_API_KEY!;
                model = 'google/gemini-2.0-flash-exp:free';
                extraHeaders = { 'HTTP-Referer': 'https://niraiva.com', 'X-Title': 'Niraiva' };
                break;
            case 'NVIDIA':
                url = 'https://integrate.api.nvidia.com/v1/chat/completions';
                apiKey = process.env.NVIDIA_API_KEY!;
                model = 'meta/llama-3.1-405b-instruct';
                break;
            case 'Qwen':
                url = 'https://openrouter.ai/api/v1/chat/completions';
                apiKey = process.env.OPENROUTER_API_KEY!;
                model = 'alibaba/qwen-2.5-72b-instruct';
                extraHeaders = { 'HTTP-Referer': 'https://niraiva.com', 'X-Title': 'Niraiva' };
                break;
            default:
                throw new Error(`Provider implementation for ${provider.name} not found in runLLMStream`);
        }

        return this.callChatCompletionStream(url, apiKey, model, req.systemPrompt, req.userPrompt, extraHeaders);
    }

    private async callChatCompletion(
        url: string,
        apiKey: string,
        model: string,
        systemPrompt: string,
        userPrompt: string,
        extraHeaders: Record<string, string> = {}
    ): Promise<string> {
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
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                // No response_format: { type: 'json_object' } for chat
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error (${url}): ${response.status} - ${err}`);
        }

        const json: any = await response.json();
        const text = json.choices?.[0]?.message?.content;

        if (!text) throw new Error('Empty response from API');

        return text;
    }

    private async callChatCompletionStream(
        url: string,
        apiKey: string,
        model: string,
        systemPrompt: string,
        userPrompt: string,
        extraHeaders: Record<string, string> = {}
    ): Promise<NodeJS.ReadableStream> {
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
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                stream: true
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error (${url}): ${response.status} - ${err}`);
        }

        if (!response.body) {
            throw new Error('No response body for streaming');
        }

        return response.body;
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
