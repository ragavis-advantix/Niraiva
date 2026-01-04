import React, { useState } from 'react';
import { ChevronRight, Pill } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

import { TimelineEvent as TimelineEventType } from '@/utils/healthData';

interface TimelineEventProps {
  event: any;
  isLast?: boolean;
}

function LabResults({ data }: { data: any }) {
  if (!data?.labs) return <p className="text-xs text-slate-500 italic">No lab values found.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Object.entries(data.labs).map(([key, value]) => (
        <div key={key} className="rounded-xl bg-white dark:bg-gray-800 p-3 shadow-sm border border-slate-100 dark:border-gray-700 flex flex-col">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{key}</p>
          <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{value as string}</p>
        </div>
      ))}
    </div>
  );
}

function MedicationList({ data }: { data: any }) {
  if (!data?.medications) return <p className="text-xs text-slate-500 italic">No medications detected.</p>;

  return (
    <div className="space-y-2">
      {data.medications.map((med: any, i: number) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <Pill className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-white">{med.name}</div>
            <div className="text-xs text-slate-500">{med.dosage} · {med.frequency}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const iconMap: Record<string, string> = {
  appointment: 'A',
  test: 'T',
  medication: 'M',
  report: 'R',
  note: 'D',
  ai_summary: 'S'
};

const statusConfig: Record<string, { color: string; bg: string; border: string }> = {
  completed: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  pending: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' }
};

const TimelineEvent: React.FC<TimelineEventProps> = ({ event, isLast = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const category = event.event_type || 'note';
  const icon = iconMap[category.toLowerCase()] || '•';
  const status = event.status || 'completed';
  const currentStatus = statusConfig[status] || statusConfig.completed;

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
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold text-niraiva-600 hover:text-niraiva-700 flex items-center mt-2 group transition-colors"
          >
            {isExpanded ? 'HIDE DETAILS' : 'SHOW DETAILS'}
            <ChevronRight className={cn("h-3 w-3 ml-0.5 transition-transform", isExpanded ? "rotate-90" : "group-hover:translate-x-0.5")} />
          </button>
        </div>

        {/* Right Badges */}
        <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
          <div className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors",
            currentStatus.bg, currentStatus.color, currentStatus.border
          )}>
            {status}
          </div>
          <div className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
            getCategoryLightColor(category)
          )}>
            {category}
          </div>
        </div>
      </motion.div>

      {/* Expandable Details Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-1 md:ml-12"
          >
            <div className="mt-2 p-5 bg-slate-50/80 dark:bg-gray-800/50 rounded-2xl border border-slate-100 dark:border-gray-700 shadow-inner">
              {category === 'test' && event.metadata?.report_json && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <div className="w-1 h-3 bg-purple-500 rounded-full" />
                    Lab Investigations
                  </h4>
                  <LabResults data={event.metadata.report_json} />
                </div>
              )}

              {category === 'medication' && event.metadata?.report_json && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <div className="w-1 h-3 bg-amber-500 rounded-full" />
                    Prescription Details
                  </h4>
                  <MedicationList data={event.metadata.report_json} />
                </div>
              )}

              {(category === 'report' || category === 'note') && (
                <div className="prose prose-sm dark:prose-invert">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <div className="w-1 h-3 bg-cyan-500 rounded-full" />
                    Clinical Note
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-200/50 dark:border-gray-700 flex justify-end">
                <button
                  onClick={() => window.location.href = `/patient/dashboard`}
                  className="text-[10px] font-bold text-slate-400 hover:text-niraiva-600 transition-colors uppercase tracking-widest flex items-center gap-1"
                >
                  View in health metrics <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimelineEvent;
