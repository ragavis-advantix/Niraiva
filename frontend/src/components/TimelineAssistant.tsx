import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/fhir';

interface TimelineAssistantProps {
    eventContext?: any;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    followUpType?: string;
}

interface ChatResponse {
    token?: string;
    sessionId?: string;
    done?: boolean;
    suggestedFollowUps?: string[];
    currentTopic?: string;
    disclaimer?: string;
}

const TimelineAssistant: React.FC<TimelineAssistantProps> = ({ eventContext }) => {
    const { user, session } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false); // STEP 9: New typing indicator
    const [chatSessionId, setChatSessionId] = useState<string | null>(null);
    const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]); // STEP 10: Dynamic follow-ups
    const [currentTopic, setCurrentTopic] = useState<string>(''); // STEP 8: Track current topic
    const [disclaimer, setDisclaimer] = useState<string>('');

    // 🔴 CRITICAL FIX: AbortController for stream lifecycle management
    // Keep one controller per component instance, abort old stream before starting new one
    const abortRef = useRef<AbortController | null>(null);

    console.log('🤖 TimelineAssistant rendered:', { eventContext: !!eventContext, isOpen });

    // Auto-scroll to bottom
    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Reset chat when event context changes
    useEffect(() => {
        if (eventContext) {
            console.log('📍 TimelineAssistant: eventContext changed, opening chat');
            // New event = fresh chat
            setMessages([]);
            setChatSessionId(null);
            setInputValue('');
            setIsOpen(true);
        }
    }, [eventContext?.id]);

    // CLEANUP ON UNMOUNT (FIX B) + CRITICAL STREAM ABORT
    useEffect(() => {
        return () => {
            console.log('🧹 TimelineAssistant: Cleanup - aborting stream and resetting state');

            // 🔴 ABORT STREAM FIRST before resetting state
            if (abortRef.current) {
                console.log('🛑 Aborting active stream');
                abortRef.current.abort();
                abortRef.current = null;
            }

            // THEN reset state
            setMessages([]);
            setInputValue('');
            setChatSessionId(null);
            setIsLoading(false);
            setIsOpen(false);
            setIsTyping(false); // STEP 9: Clean up typing state
            setSuggestedFollowUps([]); // STEP 10: Clean up follow-ups
            setCurrentTopic(''); // STEP 8: Clean up topic
            setDisclaimer(''); // STEP 7: Clean up disclaimer
        };
    }, []);


    const handleSend = async (overrideText?: string) => {
        const text = overrideText || inputValue;
        // FIX D: Guard without early return - proper guard with logging
        if (!text.trim() || !eventContext) return;
        if (isLoading) {
            console.warn('⚠️ Already loading, ignoring duplicate send');
            return;
        }

        // 🔴 CRITICAL: Abort old stream before starting new one
        if (abortRef.current) {
            console.log('🛑 Aborting previous stream before starting new request');
            abortRef.current.abort();
        }

        // Create NEW AbortController for THIS request
        const controller = new AbortController();
        abortRef.current = controller;
        const signal = controller.signal;

        // 1. Add User Message
        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);
        setIsTyping(true); // STEP 9: Start typing indicator

        try {
            // CRITICAL FIX: Extract parameters from event context
            // Frontend MUST send exact structured data to backend
            const parameters = eventContext.metadata?.report_json?.data?.parameters ||
                eventContext.parameters ||
                [];

            console.log('📤 Sending to chat API:', {
                timelineEventId: eventContext.id,
                parametersCount: parameters.length,
                parameterNames: parameters.map((p: any) => p.name || p.parameter_name)
            });

            // 2. Call Backend API (Streaming) with AbortSignal and CORRECT URL
            const apiBaseUrl = getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/api/chat/timeline/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    patientId: user?.id,
                    timelineEventId: eventContext.id,
                    question: text,
                    sessionId: chatSessionId,
                    // CRITICAL: Send parameters as single source of truth
                    parameters: parameters,
                    // Also send summary flags if available
                    summaryFlags: eventContext.metadata?.summary_flags || {}
                }),
                signal: signal // 🔴 PASS ABORT SIGNAL
            });

            if (!response.ok) {
                throw new Error("Failed to get response");
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";
            let frontendBuffer = "";

            if (!reader) throw new Error("No reader available");

            // Add empty assistant message to fill in
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            setIsTyping(false); // Stop typing after first response starts

            while (true) {
                // 🔴 Check if stream was aborted
                if (signal.aborted) {
                    console.log('📡 Stream aborted by user or component unmount');
                    break;
                }

                const { done, value } = await reader.read();
                if (done) break;

                frontendBuffer += decoder.decode(value, { stream: true });
                const lines = frontendBuffer.split('\n\n');
                frontendBuffer = lines.pop() || ""; // Keep tail for next chunk

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const data: ChatResponse = JSON.parse(trimmed.slice(6));

                            if (data.error) {
                                console.error("Stream Error:", data.error);
                                throw new Error(data.error);
                            }

                            if (data.token && data.token.trim()) {
                                accumulatedText += data.token;
                                setMessages(prev => {
                                    const next = [...prev];
                                    if (next.length > 0) {
                                        next[next.length - 1] = {
                                            ...next[next.length - 1],
                                            content: accumulatedText
                                        };
                                    }
                                    return next;
                                });
                            }
                            // STEP 8: Capture metadata from backend
                            if (data.sessionId) {
                                setChatSessionId(data.sessionId);
                            }
                            if (data.done) {
                                // STEP 10: Capture dynamic follow-ups
                                if (data.suggestedFollowUps) {
                                    console.log('📌 Received follow-ups:', data.suggestedFollowUps);
                                    setSuggestedFollowUps(data.suggestedFollowUps);
                                }
                                if (data.currentTopic) {
                                    setCurrentTopic(data.currentTopic);
                                }
                                if (data.disclaimer) {
                                    setDisclaimer(data.disclaimer);
                                }
                            }
                        } catch (e) {
                            // JSON fragment or malformed
                        }
                    }
                }
            }

        } catch (error: any) {
            // Don't show error if it was an abort
            if (error.name === 'AbortError' || signal.aborted) {
                console.log('ℹ️ Stream was cleanly aborted');
            } else {
                console.error('❌ Error:', error);
                const errorMsg = typeof error === 'string' ? error : (error.message || "I'm having trouble connecting to the medical database.");
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Sorry, I encountered an error: ${errorMsg}`
                }]);
            }
        } finally {
            setIsLoading(false);
            setIsTyping(false); // STEP 9: Always stop typing indicator
        }
    };

    if (!eventContext) return null; // Don't show if no event selected

    // STEP 10: Use dynamic follow-ups from backend if available, otherwise fall back to defaults
    const displayFollowUps = suggestedFollowUps.length > 0 ? suggestedFollowUps : [
        "What does this report mean?",
        "Are these results normal?",
        "What should I focus on next?"
    ];

    return (
        <div className="fixed bottom-8 right-8 z-[60]">
            {/* Guided Entry Screen (shown when chat opens but no messages yet) */}
            <AnimatePresence>
                {isOpen && messages.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="absolute bottom-0 right-0 w-[400px] h-[600px] bg-white shadow-2xl rounded-3xl border border-slate-100 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <Bot className="h-5 w-5 text-niraiva-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black tracking-tight">Medical Assistant</h3>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            Reviewing: {eventContext.title.substring(0, 20)}...
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-white/10 text-slate-400"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Guided Welcome Message */}
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                            <div className="mb-6">
                                <div className="inline-block p-4 bg-niraiva-50 rounded-3xl mb-4">
                                    <Sparkles className="h-8 w-8 text-niraiva-600" />
                                </div>
                                <h2 className="text-lg font-black text-slate-800 mb-2">
                                    Hi {user?.user_metadata?.full_name?.split(' ')[0] || 'there'}
                                </h2>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    I can help explain this report in simple terms. You can ask things like:
                                </p>
                            </div>

                            <div className="space-y-2 w-full mb-8">
                                {displayFollowUps.map((q, i) => (
                                    <div key={i} className="flex items-start gap-2 text-left text-xs text-slate-600">
                                        <span className="text-niraiva-600 font-bold">•</span>
                                        <span>{q}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 space-y-2">
                            {displayFollowUps.map((question, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(question)}
                                    className="w-full text-left px-4 py-3 rounded-xl bg-white border border-slate-200 hover:border-niraiva-400 hover:bg-niraiva-50 transition-all text-sm font-medium text-slate-700 hover:text-niraiva-700"
                                >
                                    {question}
                                </button>
                            ))}
                        </div>

                        {/* Disclaimer */}
                        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
                            <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
                            <p className="text-[9px] font-bold text-amber-700 leading-tight uppercase tracking-tight">
                                Informational only. Not a medical diagnosis.
                            </p>
                        </div>

                        {/* Input (Manual Entry) */}
                        <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Ask about this report..."
                                className="flex-1 bg-slate-50 border-none px-4 py-2 rounded-xl text-sm font-medium focus:ring-2 focus:ring-niraiva-500/20"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                disabled={isLoading}
                                autoFocus
                            />
                            <Button
                                size="icon"
                                className="bg-niraiva-600 hover:bg-niraiva-700 rounded-xl"
                                onClick={() => handleSend()}
                                disabled={isLoading || !inputValue.trim()}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Active Chat Window (with conversation) */}
            <AnimatePresence>
                {isOpen && messages.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="absolute bottom-0 right-0 w-[400px] h-[600px] bg-white shadow-2xl rounded-3xl border border-slate-100 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <Bot className="h-5 w-5 text-niraiva-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black tracking-tight">Medical Assistant</h3>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            Reviewing: {eventContext.title.substring(0, 20)}...
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-white/10 text-slate-400"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                            {messages.map((msg, i) => (
                                <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                    <div className={cn(
                                        "max-w-[70%] p-3 text-sm leading-[1.4] text-left word-break break-word", // FIXED: text-align left, proper line-height, word-break
                                        msg.role === 'user'
                                            ? "bg-niraiva-600 text-white rounded-2xl rounded-tr-none shadow-md shadow-niraiva-100"
                                            : "bg-white text-slate-700 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm"
                                    )}>
                                        {msg.content.split('\n').map((line: string, j: number) => (
                                            <p key={j} className={`text-left whitespace-normal ${j > 0 ? "mt-1" : ""}`}>{line}</p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {/* STEP 9: Show typing indicator when generating response */}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-.15s]" />
                                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-.3s]" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Suggested Follow Ups (Dynamic from Backend) */}
                        {!isLoading && messages.length > 1 && displayFollowUps.length > 0 && (
                            <div className="px-4 py-2 bg-white border-t border-slate-50 flex gap-2 overflow-x-auto no-scrollbar">
                                {displayFollowUps.map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(suggestion)}
                                        className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Disclaimer - Dynamic from Backend */}
                        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
                            <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
                            <p className="text-[9px] font-bold text-amber-700 leading-tight uppercase tracking-tight">
                                {disclaimer || "This information is educational only. Please discuss any concerns with your doctor."}
                            </p>
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Ask about this report..."
                                className="flex-1 bg-slate-50 border-none px-4 py-2 rounded-xl text-sm font-medium focus:ring-2 focus:ring-niraiva-500/20"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                disabled={isLoading}
                            />
                            <Button
                                size="icon"
                                className="bg-niraiva-600 hover:bg-niraiva-700 rounded-xl"
                                onClick={() => handleSend()}
                                disabled={isLoading || !inputValue.trim()}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Icon */}
            {!isOpen && eventContext && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center group"
                    onClick={() => setIsOpen(true)}
                >
                    <Bot className="h-6 w-6 text-niraiva-400 group-hover:text-niraiva-300 transition-colors" />
                </motion.button>
            )}
        </div>
    );
};

export default TimelineAssistant;
