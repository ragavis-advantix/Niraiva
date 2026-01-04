import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Info, Calendar as CalendarIcon } from 'lucide-react';
import Navbar from '@/components/Navbar';
import TimelineEvent from '@/components/TimelineEvent';
import { VoiceCommand } from '@/components/VoiceCommand';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';
import { useReports } from '@/contexts/ReportContext';

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z\s]/g, '').trim();

const Timeline = () => {
  const { reports, loading: reportsLoading } = useReports();
  const [searchQuery, setSearchQuery] = useState('');

  const derivedEvents = useMemo(() => {
    if (!reports || reports.length === 0) return [];

    const events: any[] = [];

    reports.forEach((r) => {
      const data = r.report_json?.data;
      const title = r.title || 'Medical Report';
      const date = r.date || r.uploaded_at || new Date().toISOString();
      const content = JSON.stringify(data || {}).toLowerCase();

      // Detection logic
      let type: 'test' | 'medication' | 'appointment' | 'report' = 'report';
      let status: 'completed' | 'pending' | 'critical' = 'completed';
      let description = r.summary || 'Clinical record processed';

      if (data?.parameters && data.parameters.length > 0) {
        type = 'test';
        description = `Diagnostic findings: ${data.parameters.slice(0, 2).map((p: any) => p.name).join(', ')}...`;

        // Check for critical status
        if (data.parameters.some((p: any) => p.status === 'critical')) {
          status = 'critical';
        }
      } else if (data?.medications && data.medications.length > 0) {
        type = 'medication';
        description = `Prescription: ${data.medications.slice(0, 2).map((m: any) => m.name).join(', ')}...`;
      } else if (content.includes('follow up') || content.includes('dr.') || content.includes('consultation')) {
        type = 'appointment';
        description = 'Doctor consultation recorded';
      }

      events.push({
        id: r.id,
        title,
        description,
        type,
        status,
        event_time: date,
        metadata: data,
        source_report: r
      });
    });

    return events.sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());
  }, [reports]);

  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredEvents(derivedEvents);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = derivedEvents.filter(event =>
      event.title?.toLowerCase().includes(query) ||
      event.description?.toLowerCase().includes(query) ||
      event.type?.toLowerCase().includes(query)
    );
    setFilteredEvents(filtered);
  }, [searchQuery, derivedEvents]);

  // Reset page position on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Navbar />

      <div className="container mx-auto px-4 pt-28 pb-20 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl font-black tracking-tight text-slate-800 dark:text-white mb-2">
              Health <span className="text-niraiva-600">Journey</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Complete chronological record of your clinical history.
            </p>
          </div>

          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-niraiva-500 transition-colors" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border-none bg-white dark:bg-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none focus:ring-2 focus:ring-niraiva-400 transition-all text-sm font-medium"
            />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-6 md:p-10 border-slate-100/50 dark:border-gray-800"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-niraiva-600 rounded-xl shadow-lg shadow-niraiva-200">
                  <CalendarIcon className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">Recent Events</h2>
              </div>

              <div className="flex items-center flex-wrap gap-4 px-4 py-2 bg-slate-50 dark:bg-gray-800/50 rounded-2xl border border-slate-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Completed</span>
                </div>
                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-gray-700 pl-4">
                  <span className="w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.5)]"></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
                </div>
                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-gray-700 pl-4">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Critical</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 relative">
              {/* Vertical Line */}
              <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-slate-50 dark:bg-gray-800 hidden md:block" />

              <AnimatePresence mode="popLayout">
                {reportsLoading ? (
                  <div className="text-center py-20">
                    <div className="w-12 h-12 border-4 border-niraiva-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-slate-500 font-medium">Loading medical journey...</p>
                  </div>
                ) : filteredEvents.length > 0 ? (
                  filteredEvents.map((event, index) => (
                    <TimelineEvent
                      key={event.id}
                      event={event}
                      isLast={index === filteredEvents.length - 1}
                    />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20 bg-slate-50/50 dark:bg-gray-800/20 rounded-3xl border-2 border-dashed border-slate-100 dark:border-gray-800"
                  >
                    <Info className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400">No medical history available yet.</h3>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto mt-2">
                      All your uploaded reports (9 total) will appear here once processed.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <VoiceCommand className="shadow-2xl hover:scale-105 transition-transform" />
      </div>
    </div>
  );
};

export default Timeline;
