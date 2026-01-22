
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
    try {
        const { patientId, timelineEventId, question, sessionId } = req.body;

        if (!patientId || !timelineEventId || !question) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Ensure headers are sent immediately

        // Send a comment heartbeat to keep connection alive
        res.write(': heartbeat\n\n');

        const stream = chatService.processUserMessageStream(
            patientId,
            timelineEventId,
            question,
            sessionId
        );

        for await (const chunk of stream) {
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
        res.end();
    } catch (error: any) {
        console.error('❌ [ChatRoute] Error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message || 'Internal Server Error' })}\n\n`);
        res.end();
    }
});

export default router;
