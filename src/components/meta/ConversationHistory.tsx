//@ts-nocheck
'use client';
import React, { useEffect, useRef } from 'react';
import { MessageSquare, User, Bot } from 'lucide-react';

const ConversationHistory = ({ fullTranscript }) => {
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // --- Auto-scroll only when new messages arrive ---
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [fullTranscript]);

  return (
    <div
      className="flex flex-col h-full border-t border-gray-200"
      style={{
        backgroundColor: '#fafafa',
        maxHeight: 'calc(100vh - 200px)', // keeps chat limited to right panel
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-6 pt-4">
        <MessageSquare className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-bold text-gray-800">Conversation History</h3>
      </div>

      {/* Scrollable Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-3 px-6 pb-6 pr-2 scroll-smooth"
        style={{
          scrollbarWidth: 'thin',
          scrollBehavior: 'smooth',
        }}
      >
        {fullTranscript.map((item, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl shadow-sm transition-all hover:shadow-md ${
              item.speaker === 'user' ? 'ml-4 bg-blue-50' : 'mr-4 bg-gray-50'
            }`}
            style={{
              borderLeft:
                item.speaker === 'user'
                  ? '4px solid #3b82f6'
                  : '4px solid #10b981',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {item.speaker === 'user' ? (
                <User className="w-4 h-4 text-blue-600" />
              ) : (
                <Bot className="w-4 h-4 text-green-600" />
              )}
              <span className="text-xs font-bold text-gray-700">
                {item.speaker === 'user' ? 'You' : 'Denver'}
              </span>

              {item.expression && (
                <span
                  className="text-xs font-semibold text-blue-600 px-2 py-0.5 rounded"
                  style={{ backgroundColor: '#dbeafe' }}
                >
                  {item.expression}
                </span>
              )}

              {item.timestamp && (
                <span className="text-xs text-gray-400 ml-auto">
                  {item.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{item.text}</p>
          </div>
        ))}

        {/* Keeps view pinned to bottom */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ConversationHistory;
