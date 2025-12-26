import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import TimelineDetailsModal from './TimelineDetailsModal';

import { TimelineEvent as TimelineEventType } from '@/utils/healthData';

interface TimelineEventProps {
  event: TimelineEventType;
  isLast?: boolean;
}

const iconMap: Record<string, string> = {
  appointment: 'A',
  test: 'T',
  medication: 'M',
  report: 'R',
  note: 'D',
  ai_summary: 'S'
};

const TimelineEvent: React.FC<TimelineEventProps> = ({ event, isLast = false }) => {
  const [showModal, setShowModal] = useState(false);

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'appointment': return 'from-blue-500 to-blue-600 bg-blue-500';
      case 'test': return 'from-purple-500 to-purple-600 bg-purple-500';
      case 'medication': return 'from-amber-400 to-amber-500 bg-amber-400';
      case 'report': return 'from-cyan-400 to-cyan-500 bg-cyan-400';
      case 'note': return 'from-slate-400 to-slate-500 bg-slate-400';
      default: return 'from-slate-400 to-slate-500 bg-slate-400';
    }
  };

  const getCategoryLightColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'appointment': return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400';
      case 'test': return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400';
      case 'medication': return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400';
      case 'report': return 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-400';
      case 'note': return 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400';
      default: return 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400';
    }
  };

  const category = event.category || 'note';
  const icon = iconMap[category.toLowerCase()] || '•';

  return (
    <div className={cn("relative pl-10", !isLast && "pb-10")}>
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-[2px] bg-slate-100 dark:bg-slate-800" />
      )}

      {/* Left Icon */}
      <div className={cn(
        "absolute left-0 top-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-niraiva-100 bg-gradient-to-br transition-transform hover:scale-110 z-10",
        getCategoryColor(category)
      )}>
        {icon}
      </div>

      {/* Card Wrapper */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="glass-card flex flex-col md:flex-row items-start md:items-center justify-between p-5 gap-4 hover-lift border-slate-100 dark:border-gray-800"
      >
        {/* Card Body */}
        <div className="flex-1 space-y-1">
          <div className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
            {new Date(event.event_time).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">
            {event.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {event.description}
          </p>

          <button
            onClick={() => setShowModal(true)}
            className="text-xs font-bold text-niraiva-600 hover:text-niraiva-700 flex items-center mt-2 group transition-colors"
          >
            SHOW DETAILS
            <ChevronRight className="h-3 w-3 ml-0.5 transform group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Right Badges */}
        <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
          <div className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
            event.status === 'completed'
              ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400"
          )}>
            {event.status || 'completed'}
          </div>
          <div className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
            getCategoryLightColor(category)
          )}>
            {category}
          </div>
        </div>
      </motion.div>

      <TimelineDetailsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        event={event}
      />
    </div>
  );
};

export default TimelineEvent;
