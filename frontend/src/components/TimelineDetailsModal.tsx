import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink, Loader2 } from 'lucide-react';
import FileViewer from './FileViewer';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface TimelineDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: any;
}

const TimelineDetailsModal: React.FC<TimelineDetailsModalProps> = ({ isOpen, onClose, event }) => {
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [showFile, setShowFile] = useState(false);

    useEffect(() => {
        if (isOpen && event?.source_file_id) {
            fetchFileUrl();
        } else {
            setFileUrl(null);
            setShowFile(false);
        }
    }, [isOpen, event]);

    const fetchFileUrl = async () => {
        try {
            setIsLoadingFile(true);
            // First find the file path from medical_documents
            const { data, error } = await supabase
                .from('medical_documents')
                .select('file_path')
                .eq('id', event.source_file_id)
                .single();

            if (error) throw error;

            // Get signed URL from storage
            const { data: signData, error: signError } = await supabase
                .storage
                .from('medical-documents')
                .createSignedUrl(data.file_path, 3600);

            if (signError) throw signError;
            setFileUrl(signData.signedUrl);
        } catch (err) {
            console.error('Error fetching file URL:', err);
            toast.error('Failed to load original document');
        } finally {
            setIsLoadingFile(false);
        }
    };

    if (!event) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-md border-niraiva-100 dark:bg-gray-900/95 dark:border-gray-800">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-niraiva-50 dark:bg-niraiva-900/30 rounded-lg">
                            <FileText className="h-5 w-5 text-niraiva-600" />
                        </div>
                        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-niraiva-700 to-blue-600 bg-clip-text text-transparent">
                            {event.title}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-sm font-medium text-slate-500">
                        {new Date(event.event_time).toLocaleString('en-US', {
                            dateStyle: 'full',
                            timeStyle: 'short'
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-6 space-y-6">
                    <div className="prose dark:prose-invert max-w-none">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Description / Summary</h4>
                        <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-xl border border-slate-100 dark:border-gray-700 whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed capitalize-first">
                            {event.description || "No description provided."}
                        </div>
                    </div>

                    {event.source_file_id && (
                        <div className="pt-4 border-t border-slate-100 dark:border-gray-800">
                            {!showFile ? (
                                <Button
                                    onClick={() => setShowFile(true)}
                                    disabled={isLoadingFile}
                                    className="w-full bg-niraiva-600 hover:bg-niraiva-700 text-white flex items-center justify-center gap-2 py-6 rounded-xl shadow-lg shadow-niraiva-200 transition-all hover:scale-[1.02]"
                                >
                                    {isLoadingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <ExternalLink className="h-5 w-5" />}
                                    View Original Diagnostic Report
                                </Button>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Original Document</h4>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs gap-1"
                                            onClick={() => window.open(fileUrl!, '_blank')}
                                        >
                                            <Download className="h-3 w-3" /> Download
                                        </Button>
                                    </div>
                                    {fileUrl && (
                                        <FileViewer url={fileUrl} type="auto" className="border shadow-inner" />
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default TimelineDetailsModal;
