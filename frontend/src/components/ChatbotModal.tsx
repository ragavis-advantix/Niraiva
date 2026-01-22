import React, { useRef, useState, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { MessageCircle, Minus, X } from 'lucide-react';

export const ChatbotModal: React.FC = () => {
    const { chatState, chatContext, minimizeChat, closeChat, restoreChat } = useChat();
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });
    const dragRef = useRef<HTMLDivElement>(null);

    // Handle mouse movement for dragging
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!dragging.current) return;

            const newX = e.clientX - offset.current.x;
            const newY = e.clientY - offset.current.y;

            // Clamp to viewport bounds
            const maxX = window.innerWidth - 384; // width-96 = 24rem = 384px
            const maxY = window.innerHeight - 24; // Allow minimal height visibility

            setPosition({
                x: Math.max(0, Math.min(newX, maxX)),
                y: Math.max(0, Math.min(newY, maxY)),
            });
        };

        const onMouseUp = () => {
            dragging.current = false;
        };

        if (chatState === 'open') {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [chatState]);

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        dragging.current = true;
        const rect = dragRef.current?.getBoundingClientRect();
        if (rect) {
            offset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
    };

    if (chatState === 'closed') return null;

    // ===== MINIMIZED STATE (FLOATING BUBBLE) =====
    if (chatState === 'minimized') {
        return (
            <div className="fixed bottom-6 right-6 z-[9999]">
                <button
                    onClick={restoreChat}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                    title="Open AI Assistant"
                >
                    <MessageCircle className="w-6 h-6" />
                </button>
            </div>
        );
    }

    // ===== OPEN STATE (FULL PANEL) =====
    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Dimmed backdrop */}
            <div
                className="absolute inset-0 bg-black/20 pointer-events-auto"
                onClick={closeChat}
            />

            {/* Chat panel */}
            <div
                className="absolute pointer-events-auto"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    right: position.x === 0 ? '1.5rem' : 'auto',
                    bottom: position.y === 0 ? '1.5rem' : 'auto',
                }}
            >
                <div className="w-96 h-[600px] bg-white dark:bg-slate-950 rounded-xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-800">
                    {/* ===== HEADER (DRAGGABLE) ===== */}
                    <div
                        ref={dragRef}
                        onMouseDown={onMouseDown}
                        className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-t-xl cursor-move select-none"
                    >
                        <div className="flex items-center gap-2">
                            <MessageCircle className="w-5 h-5" />
                            <span className="font-semibold text-sm">Niraiva AI Assistant</span>
                        </div>

                        <div className="flex gap-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    minimizeChat();
                                }}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition text-white"
                                title="Minimize"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeChat();
                                }}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition text-white"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* ===== CONTEXT INFO ===== */}
                    <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900 text-xs text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                        <span className="font-medium">Context:</span> {chatContext?.source || 'Health parameters'}
                        {chatContext?.diagnosisDate && <span className="block text-gray-500 mt-1">Date: {chatContext.diagnosisDate}</span>}
                    </div>

                    {/* ===== MESSAGES AREA ===== */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
                            <p className="font-semibold mb-2">👋 Hello! I'm Niraiva AI.</p>
                            <p>I can help you understand your health parameters, answer medical questions, and provide personalized insights based on your reports.</p>
                        </div>

                        {chatContext && (
                            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
                                <p className="font-medium mb-1">📊 Current Context:</p>
                                <p>I'm ready to analyze your <strong>{chatContext.source === 'health-parameters' ? 'health parameters' : 'timeline data'}</strong></p>
                                {chatContext.parameters && (
                                    <p className="mt-2 text-gray-500 dark:text-gray-500">
                                        {chatContext.parameters.length} parameters loaded
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="text-xs text-gray-500 text-center py-2">
                            Messages will appear here
                        </div>
                    </div>

                    {/* ===== INPUT AREA ===== */}
                    <div className="border-t border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-slate-900 rounded-b-xl">
                        <div className="flex gap-2">
                            <input
                                className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-400 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="Ask your question..."
                            />
                            <button className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg transition text-sm font-medium">
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatbotModal;
