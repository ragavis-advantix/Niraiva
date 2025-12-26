import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { listGmailMessages, importGmailAttachments } from '@/lib/googleApi';
import { useAuth } from '@/contexts/AuthContext';

interface GmailMessage {
    id: string;
    subject: string;
    from: string;
    date: string;
    snippet: string;
    attachments: Array<{
        id: string;
        filename: string;
        mimeType: string;
        size: number;
    }>;
}

interface GmailPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: () => void;
}

export default function GmailPickerModal({ isOpen, onClose, onImportComplete }: GmailPickerModalProps) {
    const { session } = useAuth();
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<GmailMessage[]>([]);
    const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchMessages();
        } else {
            // Reset state when modal closes
            setMessages([]);
            setSelectedAttachments(new Set());
            setError(null);
        }
    }, [isOpen]);

    const fetchMessages = async () => {
        if (!session?.access_token) {
            setError('Please login to import from Gmail');
            setLoading(false);
            return;
        }
        try {
            const data = await listGmailMessages(session.access_token);
            setMessages(data.messages || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load Gmail messages');
            toast({
                title: 'Error',
                description: 'Failed to load Gmail messages. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleAttachment = (messageId: string, attachmentId: string) => {
        const key = `${messageId}:${attachmentId}`;
        setSelectedAttachments((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    const toggleAllMessageAttachments = (message: GmailMessage, checked: boolean) => {
        setSelectedAttachments((prev) => {
            const newSet = new Set(prev);
            message.attachments.forEach((att) => {
                const key = `${message.id}:${att.id}`;
                if (checked) {
                    newSet.add(key);
                } else {
                    newSet.delete(key);
                }
            });
            return newSet;
        });
    };

    const handleImport = async () => {
        if (selectedAttachments.size === 0) {
            toast({
                title: 'No attachments selected',
                description: 'Please select at least one attachment to import.',
                variant: 'destructive',
            });
            return;
        }

        setImporting(true);
        try {
            // Build items array for import
            const items: any[] = [];
            messages.forEach((msg) => {
                msg.attachments.forEach((att) => {
                    const key = `${msg.id}:${att.id}`;
                    if (selectedAttachments.has(key)) {
                        items.push({
                            messageId: msg.id,
                            attachmentId: att.id,
                            filename: att.filename,
                            mimeType: att.mimeType,
                        });
                    }
                });
            });

            const result = await importGmailAttachments(session?.access_token || '', items);

            toast({
                title: 'Import successful',
                description: `Imported ${result.count} file(s) from Gmail`,
            });

            onImportComplete();
            onClose();
        } catch (err: any) {
            toast({
                title: 'Import failed',
                description: err.message || 'Failed to import attachments',
                variant: 'destructive',
            });
        } finally {
            setImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-4xl max-h-[80vh] m-4"
                >
                    <Card className="flex flex-col h-full bg-white dark:bg-gray-900">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b dark:border-gray-800">
                            <div className="flex items-center gap-3">
                                <Mail className="w-6 h-6 text-red-600" />
                                <div>
                                    <h2 className="text-xl font-semibold">Import from Gmail</h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Select medical report attachments to import
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} disabled={importing}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loading && (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">Loading messages...</p>
                                </div>
                            )}

                            {error && !loading && (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">{error}</p>
                                    <Button onClick={fetchMessages} className="mt-4">
                                        Try Again
                                    </Button>
                                </div>
                            )}

                            {!loading && !error && messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Mail className="w-12 h-12 text-gray-400 mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">No medical reports found in Gmail</p>
                                    <p className="text-sm text-gray-500 mt-2">Try linking your account again or check your email</p>
                                </div>
                            )}

                            {!loading && messages.length > 0 && (
                                <div className="space-y-4">
                                    {messages.map((message) => (
                                        <Card key={message.id} className="p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="mt-1"
                                                    checked={message.attachments.every((att) =>
                                                        selectedAttachments.has(`${message.id}:${att.id}`)
                                                    )}
                                                    onChange={(e) => toggleAllMessageAttachments(message, e.target.checked)}
                                                />
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-sm mb-1">{message.subject}</h3>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                                        From: {message.from} • {new Date(message.date).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{message.snippet}</p>

                                                    <div className="space-y-2">
                                                        {message.attachments.map((att) => {
                                                            const key = `${message.id}:${att.id}`;
                                                            const isSelected = selectedAttachments.has(key);
                                                            return (
                                                                <label
                                                                    key={att.id}
                                                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                                                        }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => toggleAttachment(message.id, att.id)}
                                                                    />
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium">{att.filename}</p>
                                                                        <p className="text-xs text-gray-500">
                                                                            {att.mimeType} • {(att.size / 1024).toFixed(1)} KB
                                                                        </p>
                                                                    </div>
                                                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-6 border-t dark:border-gray-800">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {selectedAttachments.size} attachment(s) selected
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={onClose} disabled={importing}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={importing || selectedAttachments.size === 0}
                                    className="min-w-[120px]"
                                >
                                    {importing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        `Import ${selectedAttachments.size}`
                                    )}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
