import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Upload, Camera, FileText, CheckCircle, XCircle, Clock,
    RefreshCw, Mail, FolderOpen, Trash2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/Navbar';
import { startGmailOAuth, startDriveOAuth, getGoogleStatus } from '@/lib/googleApi';
import GmailPickerModal from '@/components/GmailPickerModal';
import DrivePickerModal from '@/components/DrivePickerModal';
import { getApiBaseUrl } from '@/lib/fhir';

interface UploadedReport {
    id: string;
    filename: string;
    status: 'uploaded' | 'processing' | 'parsed' | 'failed';
    uploadedAt: string;
    parsedData?: any;
    progress?: number;
    source?: string;
}

export default function HealthReportUpload() {
    const { user, session } = useAuth();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [reports, setReports] = useState<UploadedReport[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [googleStatus, setGoogleStatus] = useState({ gmail: false, drive: false });
    const [showGmailModal, setShowGmailModal] = useState(false);
    const [showDriveModal, setShowDriveModal] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const API_BASE = getApiBaseUrl();

    // ---------------------------
    // Fetch user reports + google status
    // ---------------------------
    useEffect(() => {
        if (user?.id) {
            fetchReports();
            checkGoogleStatus();
        }
    }, [user]);

    // Handle OAuth callback
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('gmailLinked') === 'true' || params.get('driveLinked') === 'true') {
            toast({
                title: 'Connected successfully',
                description: 'Your Google account has been linked',
            });
            checkGoogleStatus();
            window.history.replaceState({}, '', '/patient/upload-reports');
        }
    }, []);

    const checkGoogleStatus = async () => {
        if (!session?.access_token) return;
        try {
            const status = await getGoogleStatus(session.access_token);
            setGoogleStatus(status);
        } catch (error) {
            console.error('Error checking Google status:', error);
        }
    };

    const fetchReports = async () => {
        if (!user?.id) return;

        try {
            const response = await fetch(`${API_BASE}/api/reports/patient/${user.id}`, {
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setReports(data.reports || []);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    // ---------------------------
    // File Upload Handling
    // ---------------------------
    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;

        const validFiles = Array.from(files).filter(file => {
            const validTypes = [
                'image/png', 'image/jpeg', 'image/jpg',
                'application/pdf', 'application/json'
            ];
            const maxSize = 20 * 1024 * 1024;

            if (!validTypes.includes(file.type)) {
                toast({
                    title: 'Invalid file type',
                    description: `${file.name} is not a supported format.`,
                    variant: 'destructive',
                });
                return false;
            }

            if (file.size > maxSize) {
                toast({
                    title: 'File too large',
                    description: `${file.name} exceeds 20MB limit.`,
                    variant: 'destructive',
                });
                return false;
            }

            return true;
        });

        setSelectedFiles(prev => [...prev, ...validFiles]);
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const uploadFiles = async () => {
        if (selectedFiles.length === 0 || !user?.id) return;

        setUploading(true);

        for (const file of selectedFiles) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('patientId', user.id);
                formData.append(
                    'source',
                    file.type.startsWith('image/') ? 'camera' : 'upload'
                );

                const response = await fetch(`${API_BASE}/api/upload-report`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session?.access_token}` },
                    body: formData,
                });

                if (!response.ok) throw new Error('Upload failed');

                const data = await response.json();

                if (data.ai_status === 'failed') {
                    toast({
                        title: 'Upload successful (AI Busy)',
                        description: data.error || `Report uploaded, but AI analysis is temporarily unavailable.`,
                        variant: 'destructive',
                    });
                } else {
                    toast({
                        title: 'Upload successful',
                        description: `${file.name} has been processed and analyzed.`,
                    });
                }

                const reportId = data.reportId || data.report_id;

                setReports(prev => [
                    {
                        id: reportId,
                        filename: file.name,
                        status: 'processing',
                        uploadedAt: new Date().toISOString(),
                        progress: 0,
                    },
                    ...prev,
                ]);

                if (reportId) {
                    pollReportStatus(reportId);
                } else {
                    console.error('No report ID received from server');
                }
            } catch (err) {
                toast({
                    title: 'Upload failed',
                    description: `Failed to upload ${file.name}`,
                    variant: 'destructive',
                });
            }
        }

        setSelectedFiles([]);
        setUploading(false);
    };

    const pollReportStatus = async (reportId: string | undefined) => {
        if (!reportId || reportId === 'undefined') {
            console.warn('⚠️ pollReportStatus called with invalid ID:', reportId);
            return;
        }

        let attempts = 0;
        const maxAttempts = 60; // 5 minutes (5s * 60)

        const poll = setInterval(async () => {
            attempts++;

            try {
                const response = await fetch(
                    `${API_BASE}/api/reports/${reportId}/status`,
                    { headers: { Authorization: `Bearer ${session?.access_token}` } }
                );

                if (response.ok) {
                    const data = await response.json();

                    setReports(prev =>
                        prev.map(r =>
                            r.id === reportId
                                ? {
                                    ...r,
                                    status: data.status,
                                    progress: data.progress,
                                    parsedData: data.parsedReport,
                                }
                                : r
                        )
                    );

                    if (['parsed', 'failed'].includes(data.status) || attempts >= maxAttempts) {
                        clearInterval(poll);
                    }
                } else if (response.status === 404) {
                    console.warn(`Report ${reportId} not found (404). Attempt ${attempts}/${maxAttempts}`);
                    if (attempts >= 10) { // Stop if consistently 404 after 10 tries
                        console.error(`Giving up on report ${reportId} after 10 404s`);
                        clearInterval(poll);
                    }
                }
            } catch (err) {
                console.error('Polling error:', err);
                if (attempts >= maxAttempts) clearInterval(poll);
            }
        }, 5000);

        // Optional: Clean up interval on component unmount
        // This is tricky inside a function, but the clearInterval logic above handles it mostly.
    };

    // ---------------------------
    // Drag & Drop Handlers
    // ---------------------------
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    // ---------------------------
    // Status Badge
    // ---------------------------
    const getStatusBadge = (status: string) => {
        const variants = {
            uploaded: { color: 'bg-blue-100 text-blue-800', icon: <Clock className="w-3 h-3" /> },
            processing: { color: 'bg-yellow-100 text-yellow-800', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
            parsed: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
            failed: { color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> },
        } as const;

        const variant = variants[status] || variants.uploaded;

        return (
            <Badge className={`${variant.color} flex items-center gap-1`}>
                {variant.icon}
                {status === 'failed' ? 'AI Failed (Upload OK)' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
        );
    };

    // ---------------------------
    // UI Rendering
    // ---------------------------
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            <Navbar />

            <div className="container mx-auto px-4 py-8 max-w-6xl">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        📋 Upload Health Reports
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Upload your medical reports for AI-powered analysis and FHIR integration
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    {/* ---------------- UPLOAD SECTION ---------------- */}
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-blue-600" />
                            Upload Files
                        </h2>

                        {/* Drag & Drop */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${isDragging
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-300 dark:border-gray-700'
                                }`}
                        >
                            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-gray-700 dark:text-gray-300 mb-2">
                                Drag and drop files here
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                or click to browse
                            </p>

                            <div className="flex gap-3 justify-center flex-wrap">
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    variant="outline"
                                    className="flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    Browse Files
                                </Button>

                                <Button
                                    onClick={() => cameraInputRef.current?.click()}
                                    variant="outline"
                                    className="flex items-center gap-2"
                                >
                                    <Camera className="w-4 h-4" />
                                    Take Photo
                                </Button>
                            </div>

                            {/* Gmail & Drive */}
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 text-center">
                                    Or import from:
                                </p>
                                <div className="flex gap-3 justify-center flex-wrap">
                                    <Button
                                        onClick={() =>
                                            !googleStatus.gmail ? startGmailOAuth() : setShowGmailModal(true)
                                        }
                                        variant="outline"
                                        className={`flex items-center gap-2 ${googleStatus.gmail
                                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                            : 'border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20'
                                            }`}
                                    >
                                        <Mail
                                            className={`w-4 h-4 ${googleStatus.gmail ? 'text-green-600' : 'text-red-600'
                                                }`}
                                        />
                                        {googleStatus.gmail ? 'Gmail Connected ✓' : 'Link Gmail'}
                                    </Button>

                                    <Button
                                        onClick={() =>
                                            !googleStatus.drive ? startDriveOAuth() : setShowDriveModal(true)
                                        }
                                        variant="outline"
                                        className={`flex items-center gap-2 ${googleStatus.drive
                                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                            : 'border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20'
                                            }`}
                                    >
                                        <FolderOpen
                                            className={`w-4 h-4 ${googleStatus.drive ? 'text-green-600' : 'text-blue-600'
                                                }`}
                                        />
                                        {googleStatus.drive ? 'Drive Connected ✓' : 'Link Google Drive'}
                                    </Button>
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept="image/*,.pdf,.json"
                                multiple
                                onChange={(e) => handleFileSelect(e.target.files)}
                            />

                            <input
                                ref={cameraInputRef}
                                type="file"
                                className="hidden"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleFileSelect(e.target.files)}
                            />
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                            Supported: PNG, JPG, PDF, JSON • Max 20MB
                            <br />
                            <span className="text-blue-600 dark:text-blue-400">
                                ✨ New: Import from Gmail attachments or Google Drive
                            </span>
                        </p>

                        {/* Selected Files */}
                        {selectedFiles.length > 0 && (
                            <div className="mt-6">
                                <h3 className="text-sm font-medium mb-3">
                                    Selected Files ({selectedFiles.length})
                                </h3>

                                <div className="space-y-2">
                                    {selectedFiles.map((file, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <FileText className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm truncate">{file.name}</span>
                                                <span className="text-xs text-gray-500">
                                                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                                </span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => removeFile(index)}
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    onClick={uploadFiles}
                                    disabled={uploading}
                                    className="w-full mt-4"
                                >
                                    {uploading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload {selectedFiles.length} File
                                            {selectedFiles.length > 1 ? 's' : ''}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </Card>

                    {/* ---------------- REPORTS SECTION ---------------- */}
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-600" />
                            Latest Report
                        </h2>

                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                            {reports.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No reports uploaded yet</p>
                                </div>
                            ) : (
                                reports[0] && (
                                    <motion.div
                                        key={reports[0].id || 'latest-report'}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-sm truncate">
                                                    {reports[0].filename}
                                                </h3>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(reports[0].uploadedAt).toLocaleString()}
                                                </p>
                                            </div>
                                            {getStatusBadge(reports[0].status)}
                                        </div>

                                        {reports[0].progress !== undefined &&
                                            reports[0].status === 'processing' && (
                                                <Progress value={reports[0].progress} className="mt-2" />
                                            )}

                                        {/* ---------- PARSED DATA DISPLAY ---------- */}
                                        {reports[0].parsedData && (
                                            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-2">
                                                    ✅ AI Parsing Complete
                                                </p>

                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400">
                                                            Type:
                                                        </span>
                                                        <span className="ml-1 font-medium">
                                                            {reports[0].parsedData.type}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400">
                                                            Confidence:
                                                        </span>
                                                        <span className="ml-1 font-medium">
                                                            {(reports[0].parsedData.confidence * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Steps Info */}
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.3 }}
                                                    className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3"
                                                >
                                                    <Card className="p-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 flex flex-col items-center text-center">
                                                        <Upload className="w-5 h-5 text-blue-600 mb-2" />
                                                        <h3 className="font-bold text-xs text-blue-900 dark:text-blue-300 uppercase tracking-wider mb-1">
                                                            Step 1: Upload
                                                        </h3>
                                                        <p className="text-[10px] leading-tight text-blue-800 dark:text-blue-200">
                                                            Your document is securely uploaded to our HIPAA-compliant storage.
                                                        </p>
                                                    </Card>

                                                    <Card className="p-3 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 flex flex-col items-center text-center">
                                                        <RefreshCw className="w-5 h-5 text-purple-600 mb-2" />
                                                        <h3 className="font-bold text-xs text-purple-900 dark:text-purple-300 uppercase tracking-wider mb-1">
                                                            Step 2: AI OCR
                                                        </h3>
                                                        <p className="text-[10px] leading-tight text-purple-800 dark:text-purple-200">
                                                            AI extracts text and structures medical data using Gemini models.
                                                        </p>
                                                    </Card>

                                                    <Card className="p-3 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 flex flex-col items-center text-center">
                                                        <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
                                                        <h3 className="font-bold text-xs text-green-900 dark:text-green-300 uppercase tracking-wider mb-1">
                                                            Step 3: FHIR
                                                        </h3>
                                                        <p className="text-[10px] leading-tight text-green-800 dark:text-green-200">
                                                            Data is converted to FHIR-standard resources and saved.
                                                        </p>
                                                    </Card>
                                                </motion.div>
                                            </div>
                                        )}
                                    </motion.div>
                                )
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Gmail Modal */}
            {showGmailModal && (
                <GmailPickerModal
                    isOpen={showGmailModal}
                    onClose={() => setShowGmailModal(false)}
                    onImportComplete={fetchReports}
                />
            )}

            {/* Drive Modal */}
            {showDriveModal && (
                <DrivePickerModal
                    isOpen={showDriveModal}
                    onClose={() => setShowDriveModal(false)}
                    onImportComplete={fetchReports}
                />
            )}
        </div>
    );
}
