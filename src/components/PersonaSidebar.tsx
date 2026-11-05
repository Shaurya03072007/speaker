import React, { useState } from 'react';
import { Trash2, Plus, Volume2, Sliders } from 'lucide-react';
import {
  CompanionConfig,
  FEMALE_VOICE_OPTIONS,
  FemaleVoiceName,
  VIBE_MODE_OPTIONS,
  VibeMode,
} from '../utils/companionLogic';

interface PersonaSidebarProps {
  config: CompanionConfig;
  onUpdateConfig: (updater: (prev: CompanionConfig) => CompanionConfig) => void;
}

export const PersonaSidebar: React.FC<PersonaSidebarProps> = ({
  config,
  onUpdateConfig,
}) => {
  const [newNote, setNewNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  const handleVoiceChange = (voiceName: FemaleVoiceName) => {
    onUpdateConfig((prev) => ({ ...prev, voiceName }));
  };

  const handleVibeChange = (vibeMode: VibeMode) => {
    onUpdateConfig((prev) => ({ ...prev, vibeMode }));
  };

  const handleNuanceChange = (indianEnglishNuance: CompanionConfig['indianEnglishNuance']) => {
    onUpdateConfig((prev) => ({ ...prev, indianEnglishNuance }));
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNote.trim();
    if (!trimmed) {
      setNoteError('Enter a personal detail or inside joke before saving.');
      return;
    }
    if (trimmed.length < 3) {
      setNoteError('Memory note should be at least 3 characters.');
      return;
    }
    setNoteError(null);
    onUpdateConfig((prev) => ({
      ...prev,
      memoryNotes: [...prev.memoryNotes, trimmed],
    }));
    setNewNote('');
  };

  const handleDeleteMemory = (index: number) => {
    onUpdateConfig((prev) => ({
      ...prev,
      memoryNotes: prev.memoryNotes.filter((_, idx) => idx !== index),
    }));
  };

  return (
    <aside
      aria-label="Partner Voice and Vibe Tuning"
      className="bg-white border border-stone-200 rounded-xl p-6 space-y-6"
    >
      {/* Female Voice Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-800" />
            <span>Female Voice Timbre</span>
          </h3>
          <span className="text-xs text-stone-500">Gemini Live</span>
        </div>

        <div className="space-y-2">
          {FEMALE_VOICE_OPTIONS.map((voice) => {
            const active = config.voiceName === voice.id;
            return (
              <button
                key={voice.id}
                type="button"
                onClick={() => handleVoiceChange(voice.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-50/70 border-amber-700 text-stone-900'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-900">
                    {voice.name}
                  </span>
                  <span className="text-xs text-amber-900 font-medium">
                    {voice.personaTitle}
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  {voice.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Partner Vibe Mode */}
      <div className="pt-4 border-t border-stone-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-800" />
            <span>Partner Vibe & Rapport</span>
          </h3>
        </div>

        <div className="space-y-2">
          {VIBE_MODE_OPTIONS.map((vibe) => {
            const active = config.vibeMode === vibe.id;
            return (
              <button
                key={vibe.id}
                type="button"
                onClick={() => handleVibeChange(vibe.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? 'bg-stone-900 border-stone-900 text-white'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="text-xs font-semibold">{vibe.label}</div>
                <p
                  className={`text-xs mt-0.5 leading-relaxed ${
                    active ? 'text-stone-300' : 'text-stone-500'
                  }`}
                >
                  {vibe.shortDesc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Indian-English Cadence & Nickname */}
      <div className="pt-4 border-t border-stone-200 space-y-3">
        <div>
          <label
            htmlFor="partner-nickname-input"
            className="block text-xs font-semibold text-stone-800 mb-1"
          >
            What should Aanya call you?
          </label>
          <input
            id="partner-nickname-input"
            type="text"
            value={config.userNickname}
            onChange={(e) =>
              onUpdateConfig((prev) => ({ ...prev, userNickname: e.target.value }))
            }
            placeholder="e.g. Shaurya, Yaar"
            className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-stone-900"
          />
        </div>

        <div>
          <span className="block text-xs font-semibold text-stone-800 mb-1.5">
            Indian-English Expression Flow
          </span>
          <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-lg">
            {(
              [
                { id: 'light', label: 'Subtle' },
                { id: 'natural', label: 'Natural' },
                { id: 'expressive', label: 'Desi Banter' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleNuanceChange(opt.id)}
                className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  config.indianEnglishNuance === opt.id
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shared Memory & Inside Jokes */}
      <div className="pt-4 border-t border-stone-200 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">
            Shared Memory & Inside Jokes
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Things Aanya remembers when talking with you:
          </p>
        </div>

        <form onSubmit={handleAddMemory} className="space-y-1.5" noValidate>
          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Add a shared memory or inside joke"
              value={newNote}
              onChange={(e) => {
                setNewNote(e.target.value);
                if (noteError) setNoteError(null);
              }}
              placeholder="e.g. Loves late-night random hypotheticals"
              className="flex-1 bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-stone-900"
            />
            <button
              type="submit"
              aria-label="Add Memory Note"
              className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
          {noteError && (
            <p role="alert" className="text-xs text-red-600">
              {noteError}
            </p>
          )}
        </form>

        <ul className="space-y-1.5">
          {config.memoryNotes.map((note, index) => (
            <li
              key={`${note}-${index}`}
              className="flex items-center justify-between gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-700"
            >
              <span className="leading-snug">{note}</span>
              <button
                type="button"
                onClick={() => handleDeleteMemory(index)}
                aria-label={`Remove memory '${note}'`}
                className="text-stone-400 hover:text-red-600 transition-colors p-1 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};
