import React, { useState, useEffect, useRef } from 'react';
import { Send, Shield, Trash2, MessageSquare, Volume2 } from 'lucide-react';
import { ChatMessage } from '../types/game.ts';
import { AvatarBadge } from './AvatarBadge.tsx';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  isHost: boolean;
  onSendMessage: (text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  compact?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  isHost,
  onSendMessage,
  onDeleteMessage,
  compact = false,
}) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;
    onSendMessage(clean);
    setInputText('');
  };

  return (
    <div
      className={`flex flex-col bg-[#131B2E] border border-slate-800/90 rounded-2xl overflow-hidden ${
        compact ? 'h-[280px]' : 'h-[380px]'
      }`}
    >
      {/* Chat Header */}
      <div className="px-4 py-2.5 border-b border-slate-800/80 bg-[#0F172A]/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-slate-100">Live Match Room Chat</span>
          <span className="text-[11px] font-mono text-slate-400">({messages.length})</span>
        </div>
        {isHost && (
          <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>Host Moderation</span>
          </span>
        )}
      </div>

      {/* Messages Scroll View */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs text-slate-200"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-6">
            <MessageSquare className="w-6 h-6 mb-1 text-slate-600" />
            <p className="text-xs">No chatter yet in this room.</p>
            <p className="text-[11px] text-slate-600">Send tactical banter or say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div
                  key={msg.id}
                  className="py-1 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 font-mono text-center"
                >
                  {msg.text}
                </div>
              );
            }

            const isMe = msg.senderId === currentUserId;

            return (
              <div
                key={msg.id}
                className={`group flex items-start gap-2.5 ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <AvatarBadge avatarId={msg.senderAvatarId} size="sm" />

                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    isMe
                      ? 'bg-amber-500/20 border border-amber-500/30 text-slate-100'
                      : 'bg-[#0B0F17] border border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span
                      className={`font-semibold text-[11px] truncate ${
                        isMe ? 'text-amber-300' : 'text-slate-300'
                      }`}
                    >
                      {msg.senderName}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500 shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="break-words leading-relaxed text-xs">{msg.text}</p>
                </div>

                {/* Host Moderation: delete message button */}
                {isHost && onDeleteMessage && (
                  <button
                    type="button"
                    onClick={() => onDeleteMessage(msg.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded cursor-pointer self-center"
                    title="Moderate: Delete message"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-2 border-t border-slate-800/80 bg-[#0B0F17]/90 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          maxLength={180}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message (Enter to send)..."
          className="flex-1 px-3 py-2 bg-[#131B2E] border border-slate-800 rounded-xl text-base sm:text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 transition-colors shrink-0 cursor-pointer"
          aria-label="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
