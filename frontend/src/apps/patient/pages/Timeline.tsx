import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Info, Calendar as CalendarIcon } from 'lucide-react';
import Navbar from '@/components/Navbar';
import TimelineEvent from '@/components/TimelineEvent';
import TimelineAssistant from '@/components/TimelineAssistant';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { getApiBaseUrl } from '@/lib/fhir';
import { groupTimelineByDate, formatTimelineDate } from '@/lib/timelineDate';

const Timeline = () => {
  const { user, session } = useAuth();
  const { openChat } = useChat();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);
  const [activeChatEvent, setActiveChatEvent] = useState<any>(null);
  const [chatKey, setChatKey] = useState(0);

  // Verify Context is available
  useEffect(() => {
    console.log('✅ Timeline: useChat hook available - openChat:', typeof openChat);
  }, [openChat]);

  const handleOpenChat = (event: any) => {
    console.log('🎯 Timeline: handleOpenChat called with event:', event);
    setChatKey(prev => prev + 1); // Force remount
    setActiveChatEvent(event);
    console.log('✅ Timeline: activeChatEvent state updated with chatKey increment');
  };

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const apiBase = getApiBaseUrl();
        const response = await fetch(`${apiBase}/api/reports/timeline`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch timeline: ${response.status}`);
        }

        const result = await response.json();
        setEvents(result.events || []);
      } catch (err) {
        console.error('Error fetching timeline:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredEvents(events);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = events.filter(event =>
      event.title?.toLowerCase().includes(query) ||
      event.description?.toLowerCase().includes(query) ||
      event.event_type?.toLowerCase().includes(query)
    );
    setFilteredEvents(filtered);
  }, [searchQuery, events]);

  // Reset page position on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950">
      <Navbar />

      <main className="container mx-auto px-4 pt-28 pb-20 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Main Timeline Column (8/12) */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Recent Events</h1>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pending</span>
                </div>
              </div>
            </div>

            <div className="relative pl-4">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <div className="text-center py-20">
                    <div className="w-10 h-10 border-2 border-niraiva-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : filteredEvents.length > 0 ? (
                  <div className="space-y-8">
                    {Array.from(groupTimelineByDate(filteredEvents).entries()).map(([dateStr, eventsForDate]) => (
                      <div key={dateStr}>
                        {/* Date Header */}
                        <div className="flex items-center gap-3 mb-6 bg-[#F8FAFC] dark:bg-gray-950 py-2">
                          <CalendarIcon className="w-5 h-5 text-niraiva-600" />
                          <h2 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                            {formatTimelineDate({ event_time: dateStr } as any, 'EEEE, MMMM dd, yyyy')}
                          </h2>
                          <div className="h-px flex-grow bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700" />
                        </div>

                        {/* Events for this date */}
                        <div className="space-y-0 mb-6">
                          {eventsForDate.map((event, index) => (
                            <TimelineEvent
                              key={event.id}
                              event={event}
                              userId={user?.id}
                              isLast={index === eventsForDate.length - 1}
                              onOpenChat={() => handleOpenChat(event)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100"
                  >
                    <Info className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">No clinical records found</h3>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Sidebar Column (4/12) */}
          <aside className="lg:col-span-4 space-y-8">
            {/* Upload Card */}
            <Card className="p-6 border-slate-100 shadow-sm rounded-2xl bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-niraiva-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
              <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
                Upload Health Reports
              </h3>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer group/upload">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-slate-100 group-hover/upload:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-slate-400 group-hover/upload:text-niraiva-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-600 mb-1">Drag and drop your health reports here</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Supported formats: PDF, JSON</p>
                <button className="bg-[#BFF3F9] hover:bg-[#A5EAF2] text-[#0891B2] text-xs font-black py-2.5 px-6 rounded-xl transition-all uppercase tracking-widest shadow-sm shadow-[#BFF3F9]/50">
                  Browse Files
                </button>
              </div>
            </Card>

            {/* Upcoming Events Card */}
            <Card className="p-6 border-slate-100 shadow-sm rounded-2xl bg-white">
              <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-widest">Upcoming Events</h3>
              <div className="p-4 bg-white rounded-2xl border border-niraiva-50 shadow-sm shadow-niraiva-100/50 flex gap-4 hover:shadow-md transition-shadow cursor-default">
                <div className="p-3 bg-[#BFF3F9] rounded-xl h-fit">
                  <CalendarIcon className="h-5 w-5 text-[#0891B2]" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 tracking-tight">Upcoming Quarterly Check-up</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Oct 15, 2023</p>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Regular check-up with Dr. Smith</p>
                </div>
              </div>
            </Card>

            {/* Summary Card */}
            <Card className="p-6 border-slate-100 shadow-sm rounded-2xl bg-white">
              <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-widest">Health Events Summary</h3>
              <div className="space-y-4">
                {[
                  { label: 'Completed Tests', value: 3 },
                  { label: 'Upcoming Appointments', value: 1 },
                  { label: 'Active Treatments', value: 0 },
                  { label: 'Medication Changes', value: 1 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                    <span className="text-xs font-bold text-slate-500 tracking-wide">{item.label}</span>
                    <span className="text-sm font-black text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </main>

      <TimelineAssistant key={chatKey} eventContext={activeChatEvent} />
    </div>
  );
};

export default Timeline;
