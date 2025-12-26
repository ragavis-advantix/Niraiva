import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Info, Calendar as CalendarIcon } from 'lucide-react';
import Navbar from '@/components/Navbar';
import TimelineEvent from '@/components/TimelineEvent';
import { VoiceCommand } from '@/components/VoiceCommand';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';

const Timeline = () => {
  const { timelineEvents } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState(timelineEvents);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredEvents(timelineEvents);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = timelineEvents.filter(event =>
      event.title?.toLowerCase().includes(query) ||
      event.description?.toLowerCase().includes(query) ||
      event.category?.toLowerCase().includes(query)
    );
    setFilteredEvents(filtered);
  }, [searchQuery, timelineEvents]);

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
          <div>
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

            <div className="space-y-2 relative">
              {/* Vertical Line */}
              <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-slate-50 dark:bg-gray-800 hidden md:block" />

              <AnimatePresence mode="popLayout">
                {filteredEvents.length > 0 ? (
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
                      Events will appear here once reports are uploaded or clinical notes are added.
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
