import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import HealthParametersModal from './HealthParametersModalNew';
import { getDisplayDate, getDateSource, getDateSourceLabel, isDateInferred } from '@/lib/timelineDate';
import { useChat } from '@/contexts/ChatContext';

interface TimelineEventProps {
  event: any;
  isLast?: boolean;
  onOpenChat?: () => void;
}

const TimelineEvent: React.FC<TimelineEventProps> = ({ event, isLast = false, onOpenChat }) => {
  const { openChat } = useChat();
  const [modalOpen, setModalOpen] = useState(false);

  // Use clinical event date if available, otherwise report date, otherwise upload date
  const displayDate = getDisplayDate(event);
  const dateSource = getDateSource(event);
  const dateSourceLabel = getDateSourceLabel(dateSource);
  const isInferred = isDateInferred(event);

  // Extract date in YYYY-MM-DD format for fetching parameters
  const eventDate = displayDate ? displayDate.split('T')[0] : new Date(event.event_time).toISOString().split('T')[0];

  const category = event.event_type || 'note';
  const status = event.status || 'completed';

  // FIX 4: "Ask AI About This" passes structured context, not text
  const handleAskAI = () => {
    console.log('📍 TimelineEvent: Ask AI clicked, opening with structured context', {
      eventId: event.id,
      eventType: category,
      title: event.title,
      date: displayDate
    });

    // Open chat with structured context
    openChat({
      eventId: event.id,
      eventType: category,
      title: event.title,
      date: displayDate,
      context: {
        eventId: event.id,
        eventType: category,
        description: event.description,
        date: displayDate,
        source: dateSource
      }
    });

    // Also trigger the callback if provided (for backwards compatibility)
    if (onOpenChat) {
      onOpenChat();
    }
  };

  return (
    <>
      <div className={cn("relative pl-12", !isLast && "pb-8")}>
        {/* Left Timeline Spine */}
        {!isLast && (
          <div className="absolute left-[19px] top-10 bottom-0 w-[2px] bg-slate-100 dark:bg-slate-800" />
        )}

        {/* Circular Marker */}
        <div className={cn(
          "absolute left-0 top-0 w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-xs z-10 bg-white dark:bg-slate-900 transition-all",
          category === 'test' ? "border-[#06B6D4] text-[#06B6D4] shadow-[0_0_10px_rgba(6,182,212,0.2)]" :
            category === 'appointment' ? "border-slate-300 text-slate-400" : "border-slate-200 text-slate-300"
        )}>
          {category === 'test' ? 'T' : category === 'appointment' ? 'A' : category === 'medication' ? 'M' : 'D'}
        </div>

        {/* Event Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "bg-white dark:bg-slate-900 rounded-2xl border-2 p-6 transition-all duration-300 hover:border-cyan-200 dark:hover:border-cyan-700"
          )}
        >
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {displayDate ? new Date(displayDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : 'Unknown Date'}
                </span>
                {isInferred && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 group cursor-help">
                    <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide hidden group-hover:inline">
                      Inferred
                    </span>
                    <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-[9px] rounded whitespace-nowrap z-20">
                      {dateSourceLabel}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  event.status === 'completed' ? "text-[#10B981]" : "text-[#F59E0B]"
                )}>
                  {event.status || 'completed'}
                </span>
                <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  {category}
                </div>
              </div>
            </div>

            <h3 className="text-base font-black text-slate-800 dark:text-white">
              {event.title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              {event.description}
            </p>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setModalOpen(true)}
                className="text-[11px] font-black text-[#0891B2] dark:text-cyan-400 flex items-center gap-1.5 uppercase tracking-widest hover:translate-x-1 transition-transform hover:gap-2"
              >
                Show details <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {onOpenChat && (
                <button
                  onClick={handleAskAI}
                  className="text-[11px] font-black text-teal-600 dark:text-teal-400 flex items-center gap-1.5 uppercase tracking-widest hover:translate-x-1 transition-transform hover:gap-2"
                >
                  Ask AI
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Health Parameters Modal */}
      <HealthParametersModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        eventDate={eventDate}
        eventTitle={event.title}
        metadata={event.metadata}
        onOpenChat={onOpenChat}
      />
    </>
  );
};

export default TimelineEvent;

