import { Request, Response } from 'express';
import { timelineService } from './timeline.service';

export const timelineController = {
    /**
     * Get patient timeline
     * GET /api/timeline/patient/:patientId
     */
    async getPatientTimeline(req: Request, res: Response) {
        try {
            const { patientId } = req.params;
            const { limit, offset } = req.query;

            const events = await timelineService.getPatientTimeline(
                patientId,
                parseInt(limit as string) || 50,
                parseInt(offset as string) || 0
            );

            res.json({ events });
        } catch (error: any) {
            console.error('Error fetching timeline:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get event details with clinical parameters and trends
     * GET /api/timeline/event/:eventId/details
     */
    async getEventDetails(req: Request, res: Response) {
        try {
            const { eventId } = req.params;
            const patientId = (req as any).user?.id;

            if (!patientId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const details = await timelineService.getEventDetails(eventId, patientId);
            res.json(details);
        } catch (error: any) {
            console.error('Error fetching event details:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
