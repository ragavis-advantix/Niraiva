import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, Loader2, CheckCircle2, AlertCircle, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { listDriveFiles, importDriveFiles } from '@/lib/googleApi';
import { useAuth } from '@/contexts/AuthContext';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size: string;
    modifiedTime: string;
}

interface DrivePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: () => void;
}

export default function DrivePickerModal({ isOpen, onClose, onImportComplete }: DrivePickerModalProps) {
    const { session } = useAuth();
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchFiles();
        } else {
            // Reset state when modal closes
            setFiles([]);
            setSelectedFiles(new Set());
            setError(null);
        }
    }, [isOpen]);

    const fetchFiles = async () => {
        if (!session?.access_token) {
            setError('Please login to import from Drive');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await listDriveFiles(session.access_token);
            setFiles(data.files || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load Drive files');
            toast({
                title: 'Error',
                description: 'Failed to load Google Drive files. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleFile = (fileId: string) => {
        setSelectedFiles((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            return newSet;
        });
    };

    const toggleAll = (checked: boolean) => {
        if (checked) {
            setSelectedFiles(new Set(files.map((f) => f.id)));
        } else {
            setSelectedFiles(new Set());
        }
    };

    const handleImport = async () => {
        if (selectedFiles.size === 0) {
            toast({
                title: 'No files selected',
                description: 'Please select at least one file to import.',
                variant: 'destructive',
            });
            return;
        }

        setImporting(true);
        try {
            const fileIds = Array.from(selectedFiles);
            const result = await importDriveFiles(session?.access_token || '', fileIds);

            toast({
                title: 'Import successful',
                description: `Imported ${result.count} file(s) from Google Drive`,
            });

            onImportComplete();
            onClose();
        } catch (err: any) {
            toast({
                title: 'Import failed',
                description: err.message || 'Failed to import files',
                variant: 'destructive',
            });
        } finally {
            setImporting(false);
        }
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-600" />;
        if (mimeType.includes('image')) return <Image className="w-5 h-5 text-blue-600" />;
        return <FileText className="w-5 h-5 text-gray-600" />;
    };

    const formatFileSize = (bytes: string) => {
        const size = parseInt(bytes);
        if (isNaN(size)) return 'Unknown';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
                                <FolderOpen className="w-6 h-6 text-blue-600" />
                                <div>
                                    <h2 className="text-xl font-semibold">Import from Google Drive</h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Select medical documents to import
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
                                    <p className="text-gray-600 dark:text-gray-400">Loading files...</p>
                                </div>
                            )}

                            {error && !loading && (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">{error}</p>
                                    <Button onClick={fetchFiles} className="mt-4">
                                        Try Again
                                    </Button>
                                </div>
                            )}

                            {!loading && !error && files.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <FolderOpen className="w-12 h-12 text-gray-400 mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">No medical documents found in Drive</p>
                                    <p className="text-sm text-gray-500 mt-2">Upload PDFs or images to your Google Drive</p>
                                </div>
                            )}

                            {!loading && files.length > 0 && (
                                <div className="space-y-3">
                                    {/* Select All */}
                                    <div className="flex items-center gap-2 pb-2 border-b dark:border-gray-800">
                                        <input
                                            type="checkbox"
                                            checked={selectedFiles.size === files.length && files.length > 0}
                                            onChange={(e) => toggleAll(e.target.checked)}
                                        />
                                        <span className="text-sm font-medium">Select All ({files.length} files)</span>
                                    </div>

                                    {/* File List */}
                                    {files.map((file) => {
                                        const isSelected = selectedFiles.has(file.id);
                                        return (
                                            <label
                                                key={file.id}
                                                className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all ${isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-600'
                                                    : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 border-2 border-transparent'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleFile(file.id)}
                                                    className="w-4 h-4"
                                                />
                                                <div className="flex-shrink-0">{getFileIcon(file.mimeType)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{file.name}</p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                                        {file.mimeType.split('/')[1]?.toUpperCase()} • {formatFileSize(file.size)} •{' '}
                                                        {new Date(file.modifiedTime).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-6 border-t dark:border-gray-800">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {selectedFiles.size} file(s) selected
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={onClose} disabled={importing}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={importing || selectedFiles.size === 0}
                                    className="min-w-[120px]"
                                >
                                    {importing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        `Import ${selectedFiles.size}`
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
