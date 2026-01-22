import React, { createContext, useContext, useState } from 'react';

export type ChatState = 'open' | 'minimized' | 'closed';

export interface ChatContextValue {
    chatState: ChatState;
    chatContext: any;
    openChat: (context: any) => void;
    minimizeChat: () => void;
    closeChat: () => void;
    restoreChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [chatState, setChatState] = useState<ChatState>('closed');
    const [chatContext, setChatContext] = useState<any>(null);

    const value: ChatContextValue = {
        chatState,
        chatContext,
        openChat: (ctx: any) => {
            setChatContext(ctx);
            setChatState('open');
            // Prevent background scroll when chat is open
            document.body.style.overflow = 'hidden';
        },
        minimizeChat: () => {
            setChatState('minimized');
            document.body.style.overflow = 'auto';
        },
        closeChat: () => {
            setChatState('closed');
            setChatContext(null);
            document.body.style.overflow = 'auto';
        },
        restoreChat: () => {
            setChatState('open');
            document.body.style.overflow = 'hidden';
        },
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = (): ChatContextValue => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within ChatProvider');
    }
    return context;
};
