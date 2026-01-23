
import express from 'express';
import { ChatService } from '../modules/ai/ChatService';

const router = express.Router();
const chatService = new ChatService();

// POST /api/chat/timeline
router.post('/timeline', async (req, res) => {
    try {
        const { patientId, timelineEventId, question, sessionId } = req.body;

        if (!patientId || !timelineEventId || !question) {
            return res.status(400).json({ error: 'Missing required fields: patientId, timelineEventId, question' });
        }

        const result = await chatService.processUserMessage(
            patientId,
            timelineEventId,
            question,
            sessionId
        );

        res.json(result);
    } catch (error: any) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// POST /api/chat/timeline/stream
router.post('/timeline/stream', async (req, res) => {
    console.log(`📡 [ChatRoute] Received stream request:`, req.body);

    // CREATE ABORT CONTROLLER FOR THIS SPECIFIC STREAM
    const controller = new AbortController();
    const signal = controller.signal;

    // CRITICAL: Listen for client disconnect and abort the stream
    req.on('close', () => {
        console.log(`⚠️ [ChatRoute] Client disconnected, aborting stream`);
        controller.abort();
    });

    // CRITICAL: Handle stream abort errors
    req.on('error', (err) => {
        console.error(`❌ [ChatRoute] Request error:`, err.message);
        controller.abort();
    });

    try {
        const { patientId, timelineEventId, question, sessionId, parameters, summaryFlags } = req.body;

        if (!patientId || !timelineEventId || !question) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // CRITICAL: Log parameter receipt
        console.log(`📊 [ChatRoute] Parameters received: ${parameters?.length || 0} values`);
        if (parameters?.length > 0) {
            console.log(`  → ${parameters.map((p: any) => `${p.name || p.parameter_name}(${p.status})`).join(', ')}`);
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Ensure headers are sent immediately

        // Send a comment heartbeat to keep connection alive
        res.write(': heartbeat\n\n');

        // CRITICAL FIX: Pass parameters to stream processor
        const stream = chatService.processUserMessageStream(
            patientId,
            timelineEventId,
            question,
            sessionId,
            parameters, // Frontend's data becomes source of truth
            summaryFlags
        );

        for await (const chunk of stream) {
            // Check if stream was aborted
            if (signal.aborted) {
                console.log(`🛑 [ChatRoute] Stream aborted by client`);
                break;
            }

            if (chunk.token) {
                res.write(`data: ${JSON.stringify({ token: chunk.token, sessionId: chunk.sessionId })}\n\n`);
            }
            if (chunk.done) {
                res.write(`data: ${JSON.stringify({ done: true, sessionId: chunk.sessionId })}\n\n`);
            }
            // Some environments need an explicit flush
            if ((res as any).flush) (res as any).flush();
        }

        console.log(`✅ [ChatRoute] Stream finished successfully`);
    } catch (error: any) {
        // Don't log abort errors as they're expected when user closes
        if (error.name === 'AbortError' || signal.aborted) {
            console.log(`ℹ️ [ChatRoute] Stream was aborted (client disconnect)`);
        } else {
            console.error('❌ [ChatRoute] Error:', error);
            res.write(`data: ${JSON.stringify({ error: error.message || 'Internal Server Error' })}\n\n`);
        }
    } finally {
        // 🔴 THIS IS MANDATORY - close the response properly
        res.end();
        console.log(`🔒 [ChatRoute] Response closed properly with res.end()`);
    }
});

export default router;
