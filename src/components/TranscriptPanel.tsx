import React, { useState } from 'react';
import { Bookmark, Search, RotateCcw, Trash2, Volume2 } from 'lucide-react';
import { ConversationMessage } from '../utils/companionLogic';

interface TranscriptPanelProps {
  messages: ConversationMessage[];
  onToggleBookmark: (id: string) => void;
  onClearHistory: () => void;
  onRestoreSampleHistory: () => void;
  onSpeakMessage: (text: string) => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  messages,
  onToggleBookmark,
  onClearHistory,
  onRestoreSampleHistory,
  onSpeakMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'bookmarked' | 'voice'>('all');

  const filteredMessages = messages.filter((msg) => {
    if (filterMode === 'bookmarked' && !msg.bookmarked) return false;
    if (filterMode === 'voice' && msg.via !== 'voice') return false;
    if (searchQuery.trim()) {
      return msg.text.toLowerCase().includes(searchQuery.trim().toLowerCase());
    }
    return true;
  });

  // Compute aggregate word mirroring ratio
  const userMsgs = messages.filter((m) => m.speaker === 'user');
  const partnerMsgs = messages.filter((m) => m.speaker === 'partner');
  const avgUserWords =
    userMsgs.length > 0
      ? Math.round(userMsgs.reduce((acc, m) => acc + m.wordCount, 0) / userMsgs.length)
      : 0;
  const avgPartnerWords =
    partnerMsgs.length > 0
      ? Math.round(partnerMsgs.reduce((acc, m) => acc + m.wordCount, 0) / partnerMsgs.length)
      : 0;

  return (
    <section
      aria-label="Conversation and Pacing Log"
      className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col gap-5"
    >
      {/* Header & Pacing Parity Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h3 className="text-base font-semibold text-stone-900">
            Banter Log & Response Mirroring
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-1 tabular-nums">
            <span>Turns: {messages.length}</span>
            <span aria-hidden="true">·</span>
            <span>Your avg: {avgUserWords} words</span>
            <span aria-hidden="true">·</span>
            <span>Aanya avg: {avgPartnerWords} words</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Interactive Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All Turns' },
                { id: 'bookmarked', label: 'Saved' },
                { id: 'voice', label: 'Live Mic' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterMode === tab.id
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              aria-label="Clear Conversation Log"
              className="px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-red-600 border border-stone-200 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          aria-label="Search conversation log"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter turns by keyword (e.g. chai, pigeons, traffic)..."
          className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900"
        />
      </div>

      {/* Messages list or Empty State */}
      {filteredMessages.length === 0 ? (
        <div className="py-10 px-4 text-center bg-stone-50 border border-stone-200 rounded-lg space-y-3">
          <p className="text-sm font-medium text-stone-800">
            {messages.length === 0
              ? 'No conversation turns yet.'
              : 'No turns match your current search or filter.'}
          </p>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {messages.length === 0
              ? 'Start a Live Voice Call above, type a random thought, or restore the sample banter to see how Aanya matches your talk length.'
              : 'Try clearing your search query or switching back to All Turns.'}
          </p>
          <div className="pt-1">
            {messages.length === 0 ? (
              <button
                type="button"
                onClick={onRestoreSampleHistory}
                className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Sample Banter</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                }}
                className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {filteredMessages.map((msg) => {
            const isPartner = msg.speaker === 'partner';
            return (
              <article
                key={msg.id}
                className={`p-4 rounded-lg border transition-colors ${
                  isPartner
                    ? 'bg-amber-50/40 border-amber-200/80'
                    : 'bg-stone-50 border-stone-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-stone-500 mb-1.5 tabular-nums">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900">
                      {isPartner ? 'Aanya' : 'You'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{msg.timestamp}</span>
                    <span aria-hidden="true">·</span>
                    <span>{msg.wordCount} words</span>
                    {isPartner && msg.mirrorFit && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-900 font-medium">
                          {msg.mirrorFit}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isPartner && (
                      <button
                        type="button"
                        onClick={() => onSpeakMessage(msg.text)}
                        aria-label={`Play voice for '${msg.text.slice(0, 24)}'`}
                        className="text-stone-500 hover:text-amber-900 transition-colors p-1 cursor-pointer"
                        title="Hear Aanya say this line"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleBookmark(msg.id)}
                      aria-label={
                        msg.bookmarked
                          ? `Remove bookmark from '${msg.text.slice(0, 20)}'`
                          : `Bookmark '${msg.text.slice(0, 20)}'`
                      }
                      className={`p-1 transition-colors cursor-pointer ${
                        msg.bookmarked
                          ? 'text-amber-700'
                          : 'text-stone-400 hover:text-stone-700'
                      }`}
                    >
                      <Bookmark
                        className="w-3.5 h-3.5"
                        fill={msg.bookmarked ? 'currentColor' : 'none'}
                      />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-stone-800 leading-relaxed">
                  {msg.text}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
