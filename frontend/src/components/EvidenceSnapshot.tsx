
import React from 'react';
import { X, FileText, Calendar, Database, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EvidenceSnapshot({ evidence, onClose }: any) {
    if (!evidence) return null;

    // Handle nested or flat structure depending on join
    const report = evidence.parsed_reports?.health_reports;
    const parsed = evidence.parsed_reports;

    return (
        <div className="absolute right-0 top-0 h-full w-[380px] bg-white shadow-2xl border-l border-slate-200 overflow-y-auto animate-in slide-in-from-right duration-300 z-50">
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 p-4 flex justify-between items-center z-10">
                <div>
                    <h3 className="font-bold text-lg text-slate-900">Evidence Snapshot</h3>
                    <p className="text-xs text-slate-500">Source of truth for selected finding</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="p-4 space-y-6">

                {/* Event Header */}
                <section className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-white rounded-md shadow-sm text-teal-600">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-sm mb-1">Clinical Finding</h4>
                            <p className="text-base font-medium text-slate-800 leading-tight">{evidence.event_name}</p>
                            <div className="flex gap-2 mt-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Database className="h-3 w-3" /> {evidence.event_type}</span>
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {evidence.event_date || 'No Date'}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Extracted Values */}
                {evidence.metadata && Object.keys(evidence.metadata).length > 0 && (
                    <section>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Extracted Data</h4>
                        <div className="bg-slate-900 rounded-lg p-3 overflow-hidden shadow-inner">
                            <pre className="text-xs text-blue-300 font-mono overflow-x-auto">
                                {JSON.stringify(evidence.metadata, null, 2)}
                            </pre>
                        </div>
                        {parsed?.confidence && (
                            <div className="mt-2 flex items-center justify-between text-xs">
                                <span className="text-slate-500">Extraction Confidence</span>
                                <span className={cn(
                                    "font-bold",
                                    parsed.confidence > 0.8 ? "text-green-600" : "text-amber-500"
                                )}>
                                    {Math.round(parsed.confidence * 100)}%
                                </span>
                            </div>
                        )}
                    </section>
                )}

                {/* Source Report */}
                {report && (
                    <section className="relative">
                        <div className="absolute -left-2 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                        <div className="pl-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Source Document</h4>

                            <div className="bg-white border boundary-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-3">
                                    <FileText className="h-8 w-8 text-slate-300" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 mb-1">
                                            {report.provider || 'Medical Report'}
                                        </p>
                                        <p className="text-xs text-slate-500 mb-2">
                                            Uploaded: {new Date(report.uploaded_at).toLocaleDateString()}
                                        </p>

                                        {report.file_url && (
                                            <a
                                                href={report.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline"
                                            >
                                                View Original PDF <span aria-hidden="true">&rarr;</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
