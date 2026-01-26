
import { MultiLLMService } from '../../services/MultiLLMService';
import { supabase } from '../../lib/supabase';

// Enum for valid follow-up types
export type FollowUpType =
    | "parameter_explanation"
    | "normal_range_meaning"
    | "severity_clarification"
    | "trend_comparison"
    | "next_steps_general"
    | "data_source_question";

// Helper to classify user question deterministically
function classifyQuestion(question: string): FollowUpType | "blocked" {
    const q = question.toLowerCase();

    // Block diagnostic and medical advice questions
    if (q.includes("do i have") || q.includes("am i sick") || q.includes("diagnose")) return "blocked";
    if (q.includes("should i take") || q.includes("is this treatment good")) return "blocked";

    // Allowable categories
    if (q.includes("what does") || q.includes("mean") || q.includes("explain")) return "parameter_explanation";
    if (q.includes("normal") || q.includes("range") || q.includes("limit")) return "normal_range_meaning";
    if (q.includes("high") || q.includes("low") || q.includes("severe") || q.includes("danger") || q.includes("critical")) return "severity_clarification";
    if (q.includes("previous") || q.includes("before") || q.includes("compare") || q.includes("trend")) return "trend_comparison";
    if (q.includes("what should i do") || q.includes("next step")) return "next_steps_general";
    if (q.includes("source") || q.includes("where") || q.includes("file") || q.includes("report")) return "data_source_question";

    return "parameter_explanation";
}

// Helper to detect user intent for response routing
function detectUserIntent(question: string): "EXPLANATION" | "NORMALITY_CHECK" | "NEXT_STEPS" | "GENERAL" {
    const q = question.toLowerCase();

    if (q.includes("normal") || q.includes("range") || q.includes("supposed to be") || q.includes("should be")) {
        return "NORMALITY_CHECK";
    }
    if (q.includes("should i") || q.includes("do next") || q.includes("next step") || q.includes("what about") || q.includes("follow")) {
        return "NEXT_STEPS";
    }
    if (q.includes("what does") || q.includes("mean") || q.includes("explain") || q.includes("why") || q.includes("how")) {
        return "EXPLANATION";
    }
    return "GENERAL";
}

// Helper to extract only relevant data from full report
function extractRelevantContext(reportData: any, userQuestion: string): any {
    const q = userQuestion.toLowerCase();

    // Find key findings (abnormal values)
    const keyFindings = (reportData.parameters || reportData.tests || [])
        .filter((p: any) => p.status === 'high' || p.status === 'low' || p.status === 'abnormal' || p.flag === 'abnormal')
        .slice(0, 20)
        .map((p: any) => ({
            name: p.name || p.parameter_name,
            value: p.value,
            unit: p.unit,
            status: p.status || p.flag
        }));

    // Find normal findings
    const normalFindings = (reportData.parameters || reportData.tests || [])
        .filter((p: any) => p.status === 'normal' || p.flag === 'normal' || !p.status)
        .slice(0, 20)
        .map((p: any) => ({
            name: p.name || p.parameter_name,
            value: p.value,
            unit: p.unit
        }));

    return {
        age: reportData.profile?.age,
        gender: reportData.profile?.gender,
        keyFindings,
        normalFindings,
        conditions: reportData.conditions || [],
        medications: reportData.medications || []
    };
}

// NEW: Build structured patient context (Step 1)
function buildPatientContext(reportData: any, patient_profile?: any): any {
    const abnormalParams = (reportData.parameters || reportData.tests || [])
        .filter((p: any) => p.status === 'high' || p.status === 'low' || p.status === 'abnormal' || p.flag === 'abnormal')
        .map((p: any) => ({
            name: p.name || p.parameter_name,
            value: p.value,
            unit: p.unit,
            status: p.status || p.flag,
            normal_range: p.normal_range || p.reference_range
        }));

    const normalParams = (reportData.parameters || reportData.tests || [])
        .filter((p: any) => p.status === 'normal' || p.flag === 'normal' || !p.status)
        .map((p: any) => ({
            name: p.name || p.parameter_name,
            value: p.value,
            unit: p.unit
        }));

    return {
        patient: {
            age: reportData.profile?.age || patient_profile?.age,
            gender: reportData.profile?.gender || patient_profile?.gender,
            known_conditions: (reportData.conditions || []).map((c: any) =>
                typeof c === 'string' ? c : c.name || c.condition_name
            )
        },
        abnormal_parameters: abnormalParams,
        normal_parameters: normalParams,
        all_parameters: reportData.parameters || reportData.tests || [],
        medications: reportData.medications || [],
        report_date: reportData.metadata?.documentDate || reportData.metadata?.report_date || new Date().toISOString().split('T')[0]
    };
}

// NEW: Lightweight intent detection (Step 2)
function enhancedDetectIntent(question: string): {
    type: "cause_explanation" | "normality_check" | "next_steps" | "parameter_explanation" | "trend" | "safety" | "general";
    targetParameter?: string;
} {
    const q = question.toLowerCase();

    // Extract parameter name if mentioned
    const parameterMatch = q.match(/\b(creatinine|bp|blood pressure|glucose|sugar|hemoglobin|hba1c|kidney|liver|heart|cholesterol|triglyceride|potassium|sodium|albumin|platelet|wbc|rbc)\b/i);
    const targetParameter = parameterMatch ? parameterMatch[1] : undefined;

    if (q.includes("why") || q.includes("cause") || q.includes("reason") || q.includes("happen")) {
        return { type: "cause_explanation", targetParameter };
    }
    if (q.includes("normal") || q.includes("range") || q.includes("should be") || q.includes("ok")) {
        return { type: "normality_check", targetParameter };
    }
    if (q.includes("next") || q.includes("should i") || q.includes("do") || q.includes("care")) {
        return { type: "next_steps", targetParameter };
    }
    if (q.includes("dangerous") || q.includes("urgent") || q.includes("severe") || q.includes("emergency")) {
        return { type: "safety", targetParameter };
    }
    if (q.includes("trend") || q.includes("before") || q.includes("compare") || q.includes("change")) {
        return { type: "trend", targetParameter };
    }
    if (q.includes("what is") || q.includes("mean") || q.includes("explain")) {
        return { type: "parameter_explanation", targetParameter };
    }
    return { type: "general", targetParameter };
}

// NEW: Sanitize LLM response to remove markdown (Step 4)
function sanitizeResponse(text: string): string {
    return text
        .replace(/\*\*/g, "")       // Remove bold markers
        .replace(/\*/g, "")        // Remove italic markers
        .replace(/#{1,6}\s/g, "")   // Remove heading markers
        .replace(/\`{1,3}/g, "")     // Remove code markers
        .replace(/_{2,}/g, "")      // Remove underline/emphasis
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Remove markdown links, keep text
        .replace(/\n{3,}/g, "\n\n") // Remove extra paragraphs (keep double newlines)
        .trim();                     // Only trim edges, preserve internal spaces
}

// NEW: Generate contextual follow-up questions (Step 6)
function generateFollowUpQuestions(
    parameter?: string,
    patientAge?: number,
    patientConditions?: string[],
    intent?: string
): string[] {
    const questions: string[] = [];

    if (parameter && parameter.toLowerCase().includes("creatinine")) {
        questions.push(
            "What should I be careful about with my kidney health?",
            "Can this improve with lifestyle changes?",
            "How often should I get tests?"
        );
    } else if (parameter && (parameter.toLowerCase().includes("glucose") || parameter.toLowerCase().includes("sugar"))) {
        questions.push(
            "What foods should I avoid?",
            "How does this affect my daily life?",
            "What's the plan to bring this down?"
        );
    } else if (parameter && (parameter.toLowerCase().includes("bp") || parameter.toLowerCase().includes("blood pressure"))) {
        questions.push(
            "What can I do to lower it?",
            "Is this immediately dangerous?",
            "How often should I monitor it?"
        );
    } else {
        // Generic follow-ups
        questions.push(
            "What should I focus on most?",
            "Is this reversible?",
            "What are the next steps?"
        );
    }

    return questions.slice(0, 3);
}

export class ChatService {
    private llmService: MultiLLMService;

    constructor() {
        this.llmService = new MultiLLMService();
    }

    private async getOrCreateSession(patientId: string, timelineEventId: string, sessionId?: string) {
        // FIX C: ALWAYS CREATE NEW SESSION - Never reuse old sessions
        // This ensures every "Ask AI" click gets a fresh chat
        // The sessionId parameter is still accepted for compatibility but always ignored
        try {
            const { data: session, error } = await supabase
                .from('chat_sessions')
                .insert({
                    patient_id: patientId,
                    timeline_event_id: timelineEventId,
                    allowed_followups: [
                        "parameter_explanation",
                        "normal_range_meaning",
                        "severity_clarification",
                        "trend_comparison",
                        "next_steps_general"
                    ]
                })
                .select()
                .single();

            if (error) throw error;
            return session.id;
        } catch (err: any) {
            console.error(`[Error] [ChatService] getOrCreateSession failed:`, err.message);
            return null;
        }
    }

    private async buildMedicalContext(timelineEventId: string, patientId: string) {
        console.log(`🔍 [ChatContext] Building context for Event: ${timelineEventId}, Patient: ${patientId}`);

        // 1. Fetch timeline event with metadata (where structured data often lives)
        const { data: event, error: eventErr } = await supabase
            .from('timeline_events')
            .select('id, source_report_id, event_type, title, metadata')
            .eq('id', timelineEventId)
            .single();

        if (eventErr || !event) {
            console.error(`[Error] [ChatContext] Timeline event not found:`, eventErr?.message);
            throw new Error(`Invalid timeline event: ${eventErr?.message || 'Not found'}`);
        }

        console.log(`[Success] [ChatContext] Event found: "${event.title}", Source Report: ${event.source_report_id}`);

        // 2. Try to get context from metadata first (faster, more reliable if Link is broken)
        let reportData = event.metadata?.report_json?.data || event.metadata?.report_json;

        // 3. If not in metadata, fetch from health_reports table
        if (!reportData && event.source_report_id) {
            console.log(`📡 [ChatContext] Context not in metadata, fetching from health_reports...`);
            const { data: report, error: reportErr } = await supabase
                .from('health_reports')
                .select('report_json, raw_text, uploaded_at')
                .eq('id', event.source_report_id)
                .single();

            if (reportErr || !report) {
                console.error(`❌ [ChatContext] Health report not found in DB:`, reportErr?.message);
            } else {
                reportData = report.report_json?.data || report.report_json || {};
                console.log(`✅ [ChatContext] Report loaded from DB.`);
            }
        }

        if (!reportData) {
            console.warn(`⚠️ [ChatContext] No structured data found in metadata or DB`);
            return { event, context: null, history: [] };
        }

        console.log(`[Success] [ChatContext] Structured data bound. Parameters: ${reportData.parameters?.length || reportData.tests?.length || 0}`);

        // Point 9 from user request: Confirm binding
        console.log("Chat context:", {
            timeline_event_id: timelineEventId,
            report_id: event.source_report_id,
            parsedData: reportData.parameters?.length || reportData.tests?.length
        });

        const context = {
            profile: reportData.profile ?? {},
            conditions: reportData.conditions ?? [],
            parameters: reportData.parameters ?? reportData.tests ?? [],
            medications: reportData.medications ?? []
        };

        // 4. Fetch historical reports for trend analysis
        const { data: history, error: historyErr } = await supabase
            .from('health_reports')
            .select('report_json, uploaded_at')
            .eq('user_id', patientId)
            .neq('id', event.source_report_id)
            .order('uploaded_at', { ascending: false })
            .limit(5);

        if (historyErr) {
            console.warn(`[Warn] [ChatService] Could not fetch report history:`, historyErr.message);
        }

        return { event, context, history: history || [] };
    }

    private detectParameterIntent(message: string, parameters: any[]) {
        const lower = message.toLowerCase();
        return parameters.find(p => {
            const name = (p.name || p.parameter_name || "").toLowerCase();
            return name && (lower.includes(name) || lower.includes(name.split(' ')[0]));
        });
    }

    private getTrendInfo(matchedParam: any, history: any[]) {
        if (!matchedParam || history.length === 0) return null;

        const paramName = (matchedParam.name || matchedParam.parameter_name).toLowerCase();
        const values = history.map(h => {
            const data = h.report_json?.data || h.report_json || {};
            const params = data.parameters || data.tests || [];
            const p = params.find((x: any) => (x.name || x.parameter_name || "").toLowerCase() === paramName);
            return p ? { value: p.value, date: h.uploaded_at } : null;
        }).filter(Boolean);

        if (values.length === 0) return null;

        // Add current value
        values.unshift({ value: matchedParam.value, date: 'Current' });

        return values;
    }

    /**
     * FIX 1: Build comprehensive patient medical context
     * Fetches all recent health events, diagnoses, medications
     * Returns formatted context string for LLM injection
     */
    private async buildPatientContext(patientId: string): Promise<string> {
        try {
            console.log(`📋 [PatientContext] Building context for patient: ${patientId}`);

            // Fetch last 10 health timeline events
            const { data: events, error: eventsErr } = await supabase
                .from('timeline_events')
                .select(`
                    id,
                    event_type,
                    title,
                    description,
                    clinical_event_date,
                    upload_date,
                    metadata
                `)
                .eq('patient_id', patientId)
                .order('clinical_event_date', { ascending: false, nullsFirst: false })
                .limit(10);

            if (eventsErr) {
                console.warn(`⚠️ [PatientContext] Could not fetch timeline events:`, eventsErr.message);
            }

            // Build formatted summary
            let contextStr = `PATIENT MEDICAL HISTORY:
=====================================\n`;

            if (events && events.length > 0) {
                contextStr += `Recent Events (last 10):\n`;
                events.forEach((e: any) => {
                    const dateStr = e.clinical_event_date || e.upload_date?.split('T')[0] || 'Unknown';
                    const summary = e.metadata?.report_json?.summary || e.description || e.title;
                    contextStr += `- ${dateStr} [${e.event_type}]: ${e.title}\n`;
                    if (summary) contextStr += `  Summary: ${summary.substring(0, 100)}\n`;
                });
            } else {
                contextStr += `No timeline events found.\n`;
            }

            // Fetch chronic conditions
            const { data: conditions, error: condErr } = await supabase
                .from('chronic_conditions')
                .select('name, status, diagnosed_date')
                .eq('patient_id', patientId)
                .order('diagnosed_date', { ascending: false });

            if (!condErr && conditions && conditions.length > 0) {
                contextStr += `\nKnown Conditions:\n`;
                conditions.forEach((c: any) => {
                    contextStr += `- ${c.name} (${c.status || 'active'})\n`;
                });
            }

            // Fetch active medications
            const { data: medications, error: medErr } = await supabase
                .from('medications')
                .select('name, dosage, frequency')
                .eq('patient_id', patientId)
                .eq('status', 'active');

            if (!medErr && medications && medications.length > 0) {
                contextStr += `\nCurrent Medications:\n`;
                medications.forEach((m: any) => {
                    contextStr += `- ${m.name} ${m.dosage ? `(${m.dosage})` : ''} ${m.frequency ? `- ${m.frequency}` : ''}\n`;
                });
            }

            contextStr += `=====================================\n`;
            console.log(`✅ [PatientContext] Context built: ${contextStr.length} chars`);
            return contextStr;
        } catch (err: any) {
            console.error(`❌ [PatientContext] Error building context:`, err.message);
            return `PATIENT MEDICAL HISTORY:
(Unable to fetch - will use event-specific data only)
`;
        }
    }

    async processUserMessage(
        patientId: string,
        timelineEventId: string,
        userQuestion: string,
        sessionId?: string
    ) {
        let currentSessionId = sessionId;
        let persistenceEnabled = true;

        try {
            if (!currentSessionId) {
                currentSessionId = await this.getOrCreateSession(patientId, timelineEventId);
            }

            if (currentSessionId) {
                const followUpType = classifyQuestion(userQuestion);
                await supabase.from('chat_messages').insert({
                    session_id: currentSessionId,
                    role: 'user',
                    content: userQuestion,
                    followup_type: followUpType
                });
            } else {
                persistenceEnabled = false;
            }
        } catch (e: any) {
            console.warn(`[Warn] [ChatService] Persistence disabled:`, e.message);
            persistenceEnabled = false;
        }

        const followUpType = classifyQuestion(userQuestion);

        if (followUpType === "blocked") {
            const refused = "I cannot answer questions about diagnosis or medical treatment. I can only explain the medical terms and values found in your report.";
            if (persistenceEnabled && currentSessionId) {
                await supabase.from('chat_messages').insert({
                    session_id: currentSessionId,
                    role: 'assistant',
                    content: refused,
                    llm_used: 'system_block'
                });
            }
            return { response: refused, sessionId: currentSessionId };
        }

        const { event, context, history } = await this.buildMedicalContext(timelineEventId, patientId);

        if (!context) {
            const noDataContext = "I could not find structured data for this report yet. I can only answer general questions about medical terms.";
            return { response: noDataContext, sessionId: currentSessionId };
        }

        // Detect user intent and route response style
        const userIntent = detectUserIntent(userQuestion);

        // Extract only relevant context
        const relevantContext = extractRelevantContext(context, userQuestion);

        const matchedParam = this.detectParameterIntent(userQuestion, context.parameters);
        const trendHistory = matchedParam ? this.getTrendInfo(matchedParam, history) : null;

        // Build intent-specific system prompt
        let systemPrompt = `You are a medical explanation assistant for patients.

    CRITICAL FORMATTING RULES:
    - Do NOT use markdown formatting like headings, lists, or code blocks.
    - Write in plain text only.
    - Use short paragraphs (max 2 sentences each) and simple sentences.
    - Use line breaks only where needed.

    CONTENT RULES:
    - Answer ONLY what the user asked and focus on relevance to their question.
    - Reference the most important abnormal parameter by name when present; include numeric values only if necessary to explain a concept or when the user explicitly asks for them.
    - Do NOT repeat the full report unless explicitly requested.
    - Be calm, supportive, and non-alarming.
    - Do NOT provide medical diagnosis.
    - Keep response concise (aim for 3-6 short paragraphs).
    - End with one gentle follow-up question to keep the conversation helpful.

    Patient Context:
    Age: ${relevantContext.age || 'Unknown'}, Gender: ${relevantContext.gender || 'Unknown'}
    Conditions: ${relevantContext.conditions?.join(', ') || 'None listed'}
    Key Findings: ${relevantContext.keyFindings?.map((f: any) => `${f.name} (${f.value} ${f.unit})`).join(', ') || 'None'}
    `;

        // Add intent-specific guidance
        if (userIntent === "NORMALITY_CHECK") {
            systemPrompt += `\nUser Intent: They are asking if results are normal.
Action: Clearly separate what is normal and what needs attention. Do not explain conditions again. Do not repeat background information.`;
        } else if (userIntent === "NEXT_STEPS") {
            systemPrompt += `\nUser Intent: They are asking what to do next.
Action: Explain general next steps. Do not give medical advice. Do not repeat test explanations.`;
        } else if (userIntent === "EXPLANATION") {
            systemPrompt += `\nUser Intent: They are asking what something means.
Action: Explain what these results mean in simple terms. Focus only on the most relevant findings. Do not repeat numbers unless necessary.`;
        }

        if (trendHistory) {
            systemPrompt += `\n\nHistorical Trend for ${matchedParam.name || matchedParam.parameter_name}:
${JSON.stringify(trendHistory, null, 2)}`;
        }

        const provider = trendHistory ? "Qwen" : "Mistral";
        const responseText = await this.llmService.runLLM(provider, {
            systemPrompt,
            userPrompt: userQuestion,
            temperature: 0.3
        });

        if (persistenceEnabled && currentSessionId) {
            try {
                await supabase.from('chat_messages').insert({
                    session_id: currentSessionId,
                    role: 'assistant',
                    content: responseText,
                    llm_used: provider
                });
            } catch (saveErr: any) {
                console.warn(`⚠️ [ChatService] Failed to save response:`, saveErr.message);
            }
        }

        return {
            response: responseText,
            sessionId: currentSessionId,
            followUpType,
            suggestedFollowUps: [
                "What does this report mean?",
                "Are these results normal?",
                "What should I focus on next?"
            ]
        };
    }

    async *processUserMessageStream(
        patientId: string,
        timelineEventId: string,
        userQuestion: string,
        sessionId?: string,
        // CRITICAL FIX: Accept FULL context from frontend
        providedParameters?: any[],
        providedMedications?: any[],
        providedConditions?: any[],
        summaryFlags?: any
    ) {
        let currentSessionId = sessionId;
        let persistenceEnabled = true;

        try {
            if (!currentSessionId) {
                currentSessionId = await this.getOrCreateSession(patientId, timelineEventId);
            }

            if (currentSessionId) {
                const followUpType = classifyQuestion(userQuestion);
                const { error: msgError } = await supabase.from('chat_messages').insert({
                    session_id: currentSessionId,
                    role: 'user',
                    content: userQuestion,
                    followup_type: followUpType
                });
                if (msgError) throw msgError;
            } else {
                persistenceEnabled = false;
            }
        } catch (e: any) {
            console.warn(`⚠️ [ChatStream] Persistence disabled for this turn: ${e.message}`);
            persistenceEnabled = false;
        }

        const followUpType = classifyQuestion(userQuestion);

        if (followUpType === "blocked") {
            const refused = "I cannot answer questions about diagnosis or medical treatment. I can only explain the medical terms and values found in your report.";
            yield { token: refused, sessionId: currentSessionId, done: true };
            return;
        }

        // CRITICAL FIX: Use provided context as PRIMARY source of truth
        let context: any = null;
        let history: any[] = [];
        let event: any = null;

        if (providedParameters || providedMedications || providedConditions) {
            // Frontend sent context - use it directly
            console.log(`[Success] [ChatStream] Using context from frontend: Params(${providedParameters?.length || 0}), Meds(${providedMedications?.length || 0}), Conds(${providedConditions?.length || 0})`);
            context = {
                parameters: providedParameters || [],
                medications: providedMedications || [],
                conditions: providedConditions || []
            };
        } else {
            // Fallback only if frontend didn't send parameters
            console.log(`[Warn] [ChatStream] No parameters from frontend, attempting to fetch...`);
            const result = await this.buildMedicalContext(timelineEventId, patientId);
            event = result.event;
            context = result.context;
            history = result.history || [];
        }

        // GUARDRAIL: If still no parameters, respond safely
        if (!context || !context.parameters || context.parameters.length === 0) {
            const failsafeMsg = "I cannot access the detailed report information right now. Please try again in a moment.";
            console.warn(`[Warn] [ChatStream] No parameters available - using fail-safe response`);
            yield { token: failsafeMsg, sessionId: currentSessionId, done: true };
            return;
        }

        // Detect user intent and route response style
        const userIntent = detectUserIntent(userQuestion);
        const enhancedIntent = enhancedDetectIntent(userQuestion);

        // Extract only relevant context
        const relevantContext = extractRelevantContext(context, userQuestion);
        const patientContext = buildPatientContext(context);

        const matchedParam = this.detectParameterIntent(userQuestion, context.parameters);
        const trendHistory = matchedParam && history.length > 0 ? this.getTrendInfo(matchedParam, history) : null;

        // CRITICAL: Build parameter status awareness
        const warningParameters = (context.parameters || []).filter((p: any) =>
            p.status === 'warning' || p.status === 'critical' || p.flag === 'abnormal'
        );
        const hasWarnings = warningParameters.length > 0;

        console.log(`📊 [ChatStream] Parameter analysis: ${context.parameters.length} total | ${warningParameters.length} warnings`);

        // FIX 1: FETCH COMPREHENSIVE PATIENT CONTEXT FROM MEDICAL HISTORY
        const patientContextSummary = await this.buildPatientContext(patientId);
        console.log(`[Success] [ChatStream] Patient context ready: ${patientContextSummary.length} chars`);

        // STEP 3: MEDICAL-GRADE SYSTEM PROMPT (with safety enforcement + conversational tone)
        let systemPrompt = `You are Niraiva, a calm and friendly medical assistant.

    RULES (MUST FOLLOW EVERY TIME):
    1. ONLY reference the health parameters provided below.
    2. NEVER state a value is "normal" if status = "warning" or "critical".
    3. If ANY warning values exist, acknowledge them clearly and explain their significance.
    4. Do NOT guess, generalize, or give prescriptive medical advice.
    5. If data is missing, say: "I don't have enough information about that."
    6. Do NOT use markdown, bullet points, headings, or special symbols.
    7. When mentioning numeric values, be concise and include numbers only if necessary to explain the meaning or if the user requests them.
    8. Write ONLY plain text - keep tone warm, supportive, and non-alarming.

    RESPONSE STRUCTURE (MANDATORY - ALWAYS FOLLOW):
    1. What this means (in simple language)
    2. Is this normal? (yes/no/maybe + brief explanation referencing the parameter by name)
    3. What to do next (1-2 gentle, non-prescriptive, actionable suggestions tailored to the parameter type, e.g., monitoring cadence, lifestyle steps, discuss with clinician)
    4. Ask ONE focused follow-up question to help the user continue the conversation

    Be warm, conversational, and personalize when patient's history is relevant.

    PATIENT PROFILE:
    Age: ${patientContext.patient.age || 'Unknown'}
    Gender: ${patientContext.patient.gender || 'Unknown'}

    CURRENT REPORT DATA:
    MEDICATIONS: ${context.medications?.length > 0
                ? context.medications.map((m: any) => `${m.name} (${m.dosage || 'dose unknown'})`).join(', ')
                : 'None listed in this report'}
    CONDITIONS: ${context.conditions?.length > 0
                ? context.conditions.map((c: any) => typeof c === 'string' ? c : (c.name || c.condition_name)).join(', ')
                : 'None listed in this report'}

    ATTENTION: VALUES NEEDING ATTENTION (${warningParameters.length}):
    ${warningParameters.length > 0 ?
                warningParameters.map((p: any) => `${p.name || p.parameter_name}: Status is ${p.status} (Value: ${p.value} ${p.unit || ''})`).join('\n')
                : 'No abnormal values'
            }

    FULL PARAMETER LIST:
    ${context.parameters?.map((p: any) => `${p.name || p.parameter_name}: ${p.value} ${p.unit || ''} (${p.status})`).join('\n')}

    ${patientContextSummary}
    `;

        // IF MULTIPLE WARNINGS AND USER ASKS GENERAL "WHAT DOES THIS MEAN", ASK THEM TO CHOOSE
        if (warningParameters.length > 1 && enhancedIntent.type === "parameter_explanation" && !enhancedIntent.targetParameter) {
            systemPrompt += "\nIMPORTANT: The patient has multiple results that need attention. Instead of explaining all of them, ask them which one they'd like to understand first. Be friendly about it.";
        } else {
            // Add intent-specific guidance for single parameter or specific intent
            if (enhancedIntent.type === "normality_check") {
                systemPrompt += "\nTask: Answer whether the results are normal. Be clear and direct in 1-2 sentences.";
            } else if (enhancedIntent.type === "next_steps") {
                systemPrompt += "\nTask: Suggest 1-2 gentle, lifestyle-focused next steps. Do not prescribe.";
            } else if (enhancedIntent.type === "cause_explanation") {
                systemPrompt += "\nTask: Explain why this value is abnormal in plain language. Connect to daily life.";
            } else if (enhancedIntent.type === "safety") {
                systemPrompt += "\nTask: Reassure if safe, or suggest they talk to their doctor if needed.";
            } else if (enhancedIntent.type === "parameter_explanation") {
                systemPrompt += "\nTask: Explain what this value measures and what it means for this patient's health.";
            }
        }

        if (trendHistory) {
            systemPrompt += "\n\nTrend Information for " + (matchedParam.name || matchedParam.parameter_name) + ":\n" + JSON.stringify(trendHistory, null, 2);
        }

        const provider = trendHistory ? "Qwen" : "Mistral";
        console.log("[ChatStream] Selecting provider: " + provider + " | Intent: " + enhancedIntent.type);

        let stream;
        try {
            stream = await this.llmService.runLLMStream(provider, {
                systemPrompt,
                userPrompt: userQuestion,
                temperature: 0.3
            });
        } catch (err: any) {
            console.error("[ChatStream] LLM Stream initialization failed: ", err);
            yield { token: "Sorry, I'm having trouble connecting to my AI processor (" + provider + ").", sessionId: currentSessionId, done: true };
            return;
        }

        console.log("[ChatStream] Stream started");

        let fullContent = "";
        let buffer = "";

        // Convert stream to async iterator
        const reader = stream as any;

        try {
            for await (const chunk of reader) {
                const chunkStr = chunk.toString();
                buffer += chunkStr;
                const lines = buffer.split('\n');
                buffer = lines.pop() || ""; // Keep incomplete line in buffer

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;

                    const data = trimmed.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const token = json.choices[0]?.delta?.content || json.choices[0]?.text || "";
                        if (token) {
                            fullContent += token;
                            // DO NOT SANITIZE INDIVIDUAL TOKENS - only sanitize final response
                            // Sanitizing tokens breaks word spacing and kills spaces
                            yield { token: token, sessionId: currentSessionId };
                        }
                    } catch (e) {
                        // Incomplete JSON or malformed
                    }
                }
            }
        } catch (streamErr: any) {
            console.error(`[Error] [ChatStream] Error during stream reading: `, streamErr);
            yield { token: `\n\n[Communication with AI was interrupted]`, sessionId: currentSessionId };
        }

        console.log(`[Success] [ChatStream] Stream finished. Tokens captured: ${fullContent.length} `);

        // STEP 4: Final sanitization on complete response
        const sanitizedContent = sanitizeResponse(fullContent);

        // STEP 6: Generate dynamic follow-up questions based on intent and parameter
        const suggestedFollowUps = generateFollowUpQuestions(
            enhancedIntent.targetParameter,
            patientContext.patient.age,
            patientContext.patient.known_conditions,
            enhancedIntent.type
        );

        // STEP 8: Update response interface with new fields
        const responseMetadata = {
            sessionId: currentSessionId,
            currentTopic: enhancedIntent.targetParameter || enhancedIntent.type,
            suggestedFollowUps,
            disclaimer: "This information is educational only. Please discuss any concerns with your doctor."
        };

        // Final store
        if (sanitizedContent && persistenceEnabled && currentSessionId) {
            try {
                await supabase.from('chat_messages').insert({
                    session_id: currentSessionId,
                    role: 'assistant',
                    content: sanitizedContent,
                    llm_used: provider,
                    metadata: responseMetadata
                });
            } catch (saveErr: any) {
                console.warn(`[Warn] [ChatStream] Failed to save assistant response: `, saveErr.message);
            }
        }

        // Yield final metadata
        yield {
            token: "", // Empty token to signal end
            sessionId: currentSessionId,
            done: true,
            suggestedFollowUps,
            currentTopic: enhancedIntent.targetParameter || enhancedIntent.type,
            disclaimer: "This information is educational only. Please discuss any concerns with your doctor."
        };
    }
}
