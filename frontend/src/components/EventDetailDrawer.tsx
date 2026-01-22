import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Info, Calendar, FileText, User } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/fhir';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface EventDetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    event: any;
}

const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({ isOpen, onClose, event }) => {
    const { session } = useAuth();
    const [details, setDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && event?.id) {
            fetchDetails();
        }
    }, [isOpen, event?.id]);

    const fetchDetails = async () => {
        try {
            setLoading(true);
            const apiBase = getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/reports/timeline/event/${event.id}/details`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`,
                    'Accept': 'application/json'
                }
            });
            const result = await response.json();
            if (result.success) {
                setDetails(result);
            }
        } catch (err) {
            console.error('Error fetching event details:', err);
        } finally {
            setLoading(false);
        }
    };

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'improved': return <TrendingDown className="h-4 w-4 text-emerald-500" />; // Decreasing glucose is good
            case 'worsened': return <TrendingUp className="h-4 w-4 text-red-500" />;
            default: return <Minus className="h-4 w-4 text-slate-400" />;
        }
    };

    const getInterpretationColor = (interp: string) => {
        switch (interp?.toLowerCase()) {
            case 'normal': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'warning': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'critical': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    if (!event) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-md overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-niraiva-600 uppercase tracking-widest mb-2">
                        <Calendar className="h-3 w-3" />
                        {new Date(event.event_time).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <SheetTitle className="text-2xl font-black text-slate-800 tracking-tight">
                        {event.title}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">
                            {event.event_type}
                        </Badge>
                        <Badge className={cn("text-[10px] font-bold uppercase tracking-widest",
                            event.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-amber-500/10 text-amber-600 border-amber-200'
                        )}>
                            {event.status}
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="space-y-8">
                    {/* Source Info */}
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                            <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source Authority</p>
                            <p className="text-sm font-bold text-slate-700">{event.source || 'Clinical System'}</p>
                        </div>
                    </div>

                    {/* Description */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5" />
                            Observations
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            {event.description}
                        </p>
                    </section>

                    {/* Parameters */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Info className="h-3.5 w-3.5" />
                            Clinical Parameters
                        </h3>

                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-2xl" />)}
                            </div>
                        ) : details?.parameters?.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {details.parameters.map((param: any) => {
                                    const trend = details.trends?.find((t: any) => t.parameter_code === param.parameter_code);
                                    return (
                                        <Card key={param.id} className="p-4 border-slate-100 shadow-sm hover:shadow-md transition-shadow rounded-2xl">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{param.parameter_name}</p>
                                                    <div className="flex items-baseline gap-1 mt-1">
                                                        <span className="text-xl font-black text-slate-800">{param.value}</span>
                                                        <span className="text-xs font-bold text-slate-500">{param.unit}</span>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", getInterpretationColor(param.interpretation))}>
                                                    {param.interpretation}
                                                </Badge>
                                            </div>

                                            {trend && (
                                                <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-2">
                                                    <div className="flex items-center gap-1.5">
                                                        {getTrendIcon(trend.trend)}
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                            {trend.trend}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        {trend.delta_value > 0 ? '+' : ''}{trend.delta_value} {param.unit} vs last
                                                    </span>
                                                </div>
                                            )}

                                            {!trend && (
                                                <div className="flex items-center gap-1.5 pt-3 border-t border-slate-50 mt-2">
                                                    <Minus className="h-3 h-3 text-slate-300" />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No previous record</span>
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No parameters extracted</p>
                            </div>
                        )}
                    </section>

                    {/* Historical Comparison */}
                    {details?.trends?.length > 0 && (
                        <section className="p-4 bg-niraiva-50/50 rounded-2xl border border-niraiva-100">
                            <h3 className="text-[10px] font-black text-niraiva-700 uppercase tracking-widest mb-2">
                                Historical Context
                            </h3>
                            <p className="text-xs text-niraiva-600 leading-relaxed font-medium">
                                We've detected {details.trends.filter((t: any) => t.trend === 'improved').length} improved parameters since your last check-up.
                                Keep maintaining your current routine.
                            </p>
                        </section>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default EventDetailDrawer;
