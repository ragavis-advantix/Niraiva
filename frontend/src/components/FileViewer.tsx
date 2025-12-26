import React from 'react';
import { cn } from '@/lib/utils';

interface FileViewerProps {
    url: string;
    type: 'pdf' | 'image' | string;
    className?: string;
}

const FileViewer: React.FC<FileViewerProps> = ({ url, type, className }) => {
    const isPDF = url.toLowerCase().endsWith('.pdf') || type.includes('pdf');
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url) || type.includes('image');

    return (
        <div className={cn("w-full h-full min-h-[400px] flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden", className)}>
            {isPDF ? (
                <iframe
                    src={`${url}#toolbar=0&navpanes=0`}
                    className="w-full h-full border-none"
                    title="PDF Viewer"
                />
            ) : isImage ? (
                <img
                    src={url}
                    alt="Medical Document"
                    className="max-w-full max-h-full object-contain"
                />
            ) : (
                <div className="text-center p-8">
                    <p className="text-slate-500">Preview not available for this file type.</p>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-niraiva-600 hover:underline mt-2 inline-block font-medium"
                    >
                        Open in new tab
                    </a>
                </div>
            )}
        </div>
    );
};

export default FileViewer;
