import React, { useRef, useState, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { MessageCircle, Minus, X, Send } from 'lucide-react';

export const ChatbotModal: React.FC = () => {
    const { chatState, chatContext, minimizeChat, closeChat, restoreChat } = useChat();
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
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

    // FIX 3 & 4: Handle message sending
    const handleSendMessage = async () => {
        if (!input.trim() || loading) return;

        const question = input.trim();
        setInput(""); // Clear input immediately
        setMessages((prev) => [...prev, { role: "user", content: question }]);
        setLoading(true);

        try {
            // Send to backend with chat context parameters
            const response = await fetch('/api/chat/timeline/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: chatContext?.userId,
                    timelineEventId: chatContext?.eventId,
                    question,
                    parameters: chatContext?.parameters,
                    summaryFlags: chatContext?.summaryFlags
                })
            });

            // Stream the response
            const reader = response.body?.getReader();
            let assistantMessage = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = new TextDecoder().decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.token) {
                                    assistantMessage += data.token;
                                    // Update last message in real-time
                                    setMessages((prev) => {
                                        const updated = [...prev];
                                        if (updated[updated.length - 1]?.role === 'assistant') {
                                            updated[updated.length - 1].content = assistantMessage;
                                        } else {
                                            updated.push({ role: 'assistant', content: assistantMessage });
                                        }
                                        return updated;
                                    });
                                }
                            } catch (e) {
                                // Ignore parsing errors
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[ChatBot] Stream error:', error);
            setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I'm having trouble responding. Please try again." }]);
        } finally {
            setLoading(false);
            // Ensure input gets focus after response completes
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
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
                        {messages.length === 0 ? (
                            <>
                                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
                                    <p className="font-semibold mb-2">👋 Hello! I'm Niraiva AI.</p>
                                    <p>I can help you understand your health parameters, answer medical questions, and provide personalized insights based on your reports.</p>
                                </div>

                                {chatContext && (
                                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
                                        <p className="font-medium mb-1">📊 Current Context Ready:</p>
                                        <p>I have access to your recent reports and health history.</p>
                                        {chatContext.parameters && (
                                            <p className="mt-2">{chatContext.parameters.length} parameters loaded</p>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-xs rounded-lg p-3 ${msg.role === 'user'
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                                        }`}>
                                        <p className="text-sm">{msg.content}</p>
                                    </div>
                                </div>
                            ))
                        )}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Thinking...</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ===== INPUT AREA (ALWAYS ENABLED AND PROMINENT) ===== */}
                    <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-slate-900 rounded-b-xl space-y-3">
                        {/* CRITICAL: Input field MUST be visible and responsive */}
                        <div className="flex gap-2 items-stretch">
                            {/* FIX 3: Input ALWAYS enabled, auto-focused, and ALWAYS visible */}
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && input.trim() && !loading) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                autoFocus
                                placeholder="Type your question here..."
                                className="flex-1 border-2 border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm font-medium placeholder-gray-500 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!input.trim() || loading}
                                className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg transition-all text-sm font-bold flex items-center gap-1.5 whitespace-nowrap"
                                title={loading ? "Waiting for response..." : "Send message (or press Enter)"}
                            >
                                <Send className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
                                {loading ? 'Sending...' : 'Send'}
                            </button>
                        </div>

                        {/* FIX 4: Suggestions appear BELOW input, not instead of it */}
                        {messages.length === 0 && (
                            <div className="space-y-2 mt-2">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-0.5">Quick suggestions:</p>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {["What does this report mean?", "Are these results normal?", "What should I focus on next?"].map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            onClick={() => {
                                                setInput(suggestion);
                                                setTimeout(() => inputRef.current?.focus(), 50);
                                            }}
                                            className="w-full text-left text-xs px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-900/40 hover:border-teal-400 transition-colors font-medium"
                                        >
                                            💡 {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Helpful hint text */}
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center font-medium mt-1">
                            Type anything or click a suggestion above
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatbotModal;
