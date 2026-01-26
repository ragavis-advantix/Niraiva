
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Check, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useReports } from '@/contexts/ReportContext';


export function ReportUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { reports, addReport, removeReport, isProcessing } = useReports();

  // Allowed MIME types
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'application/json', 'application/pdf'];
  const maxSizeMB = 10;

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);

      // CRITICAL: Reset input value to allow selecting the same file again
      e.target.value = '';
    }
  };

  // Process files
  const handleFiles = (files: File[]) => {
    // Filter for valid files (PNG, JPG, JSON, PDF)
    const validFiles = files.filter(file => {
      // Check MIME type or extension for PDF
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!allowedMimeTypes.includes(file.type) && !isPdf) {
        return false;
      }

      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds ${maxSizeMB}MB limit.`,
          variant: "destructive"
        });
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) {
      toast({
        title: "Invalid file format",
        description: "Please upload PNG, JPG, PDF, or JSON files only.",
        variant: "destructive"
      });
      return;
    }

    if (validFiles.length > 0) {
      // Add to pending files
      setPendingFiles(prev => [...prev, ...validFiles]);

      // Show success toast
      toast({
        title: "Files Added",
        description: `${validFiles.length} file(s) ready for upload.`,
      });
    }
  };

  // Remove a pending file
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload files to the context
  const uploadFiles = async () => {
    if (pendingFiles.length === 0) return;

    for (const file of pendingFiles) {
      await addReport(file);
    }

    // Clear pending files after upload
    setPendingFiles([]);

    // Reset file input to allow re-uploading
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="glass-panel p-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upload Health Reports</h3>

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging
          ? 'border-niraiva-500 bg-niraiva-50 dark:bg-niraiva-900/10'
          : 'border-gray-300 dark:border-gray-700'
          }`}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-2" />
        <p className="text-gray-700 dark:text-gray-300 mb-2">
          Drag and drop your health reports here
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Supported formats: <strong>PNG, JPG, PDF, JSON</strong>
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mb-4">
          ✨ New: You can now upload PDF reports directly for analysis
        </p>

        <label className="inline-block">
          <span className="cursor-pointer px-4 py-2 bg-niraiva-100 text-niraiva-700 dark:bg-niraiva-900/30 dark:text-niraiva-400 rounded-lg hover:bg-niraiva-200 dark:hover:bg-niraiva-900/50 transition-colors">
            Browse Files
          </span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,application/json,application/pdf"
            multiple
            onChange={handleFileInputChange}
          />
        </label>
      </div>

      {pendingFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Ready to Upload:</h4>
          <ul className="space-y-2 max-h-[200px] overflow-y-auto">
            {pendingFiles.map((file, index) => (
              <li key={`pending-${index}`} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                    {file.name}
                  </span>
                </div>
                <button
                  onClick={() => removePendingFile(index)}
                  className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={uploadFiles}
            disabled={isProcessing}
            className={`mt-4 w-full py-2 px-4 rounded-lg flex items-center justify-center transition-colors ${isProcessing
              ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              : 'bg-niraiva-600 text-white hover:bg-niraiva-700'
              }`}
          >
            {isProcessing ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-2"
                >
                  <Upload className="h-4 w-4" />
                </motion.div>
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Upload and Process Files
              </>
            )}
          </motion.button>
        </div>
      )}

      {reports.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Processed Reports:</h4>
          <ul className="space-y-3 max-h-[400px] overflow-y-auto">
            {reports.map((report) => (
              <li key={report.id} className="p-3 bg-niraiva-50 dark:bg-niraiva-900/10 rounded-lg border border-niraiva-200 dark:border-niraiva-800">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start">
                    <FileText className="h-4 w-4 text-niraiva-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="truncate">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                        {report.name}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(report.date).toLocaleDateString()} • {report.patientId}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeReport(report.id)}
                    className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors flex-shrink-0 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Extracted Data Summary */}
                {report.content && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {report.content.profile?.bloodType && (
                      <div className="p-1.5 bg-white dark:bg-gray-800 rounded">
                        <span className="text-gray-500 dark:text-gray-400">Blood Type:</span>
                        <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">{report.content.profile.bloodType}</span>
                      </div>
                    )}
                    {report.content.extractedParameters?.length > 0 && (
                      <div className="p-1.5 bg-white dark:bg-gray-800 rounded">
                        <span className="text-gray-500 dark:text-gray-400">Parameters:</span>
                        <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">{report.content.extractedParameters.length}</span>
                      </div>
                    )}
                    {report.content.extractedMedications?.length > 0 && (
                      <div className="p-1.5 bg-white dark:bg-gray-800 rounded">
                        <span className="text-gray-500 dark:text-gray-400">Medications:</span>
                        <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">{report.content.extractedMedications.length}</span>
                      </div>
                    )}
                    {report.content.extractedAllergies?.length > 0 && (
                      <div className="p-1.5 bg-white dark:bg-gray-800 rounded">
                        <span className="text-gray-500 dark:text-gray-400">Allergies:</span>
                        <span className="ml-1 font-medium text-niraiva-600 dark:text-niraiva-400">{report.content.extractedAllergies.length}</span>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}


    </div>
  );
}
