import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import HealthParametersModalNew from './HealthParametersModalNew';

interface TimelineEventProps {
    event: any;
    isLast?: boolean;
}

const TimelineEvent: React.FC<TimelineEventProps> = ({ event, isLast = false }) => {
    const [modalOpen, setModalOpen] = useState(false);

    const category = event.event_type || 'note';
    const status = event.status || 'completed';

    const eventDate = new Date(event.event_time).toISOString().split('T')[0];

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
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                {new Date(event.event_time).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </span>
                            <div className="flex items-center gap-3">
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest",
                                    status === 'completed' ? "text-[#10B981]" : "text-[#F59E0B]"
                                )}>
                                    {status}
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

                        <button
                            onClick={() => setModalOpen(true)}
                            className="mt-4 text-[11px] font-black text-[#0891B2] dark:text-cyan-400 flex items-center gap-1.5 uppercase tracking-widest hover:translate-x-1 transition-transform hover:gap-2"
                        >
                            Show details <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Health Parameters Modal */}
            <HealthParametersModalNew
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                eventDate={eventDate}
                eventTitle={event.title}
            />
        </>
    );
};

export default TimelineEvent;
