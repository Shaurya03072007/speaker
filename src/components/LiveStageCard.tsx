import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, PhoneCall, Volume2, Send, Sparkles, AlertCircle } from 'lucide-react';
import {
  AudioBoostConfig,
  CompanionConfig,
  computeTargetWordRange,
} from '../utils/companionLogic';

export type LiveConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

interface LiveStageCardProps {
  config: CompanionConfig;
  audioBoost: AudioBoostConfig;
  recordedUtteranceCount: number;
  connectionState: LiveConnectionState;
  isMuted: boolean;
  isModelSpeaking: boolean;
  audioLevel: number;
  liveInputText: string;
  liveOutputText: string;
  errorMessage: string | null;
  isSendingText: boolean;
  onStartLiveCall: () => void;
  onEndLiveCall: () => void;
  onToggleMute: () => void;
  onUpdateAudioBoost: (updater: (prev: AudioBoostConfig) => AudioBoostConfig) => void;
  onSendMessage: (text: string) => Promise<void>;
}

const NONSENSE_SPARKS = [
  'Yaar why do ceiling fans look so philosophical at 2 AM?',
  'Acha listen, if pigeons started paying rent on my balcony, how much should I charge?',
  'Bro my brain is doing zero work today, just pure vibes and chai.',
  'Tell me honestly, is eating Maggi at midnight a lifestyle or a cry for help?',
];

export const LiveStageCard: React.FC<LiveStageCardProps> = ({
  config,
  audioBoost,
  recordedUtteranceCount,
  connectionState,
  isMuted,
  isModelSpeaking,
  audioLevel,
  liveInputText,
  liveOutputText,
  errorMessage,
  isSendingText,
  onStartLiveCall,
  onEndLiveCall,
  onToggleMute,
  onUpdateAudioBoost,
  onSendMessage,
}) => {
  const [draftText, setDraftText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(audioLevel);
  const speakingRef = useRef(isModelSpeaking);
  const stateRef = useRef(connectionState);

  useEffect(() => {
    levelRef.current = audioLevel;
    speakingRef.current = isModelSpeaking;
    stateRef.current = connectionState;
  }, [audioLevel, isModelSpeaking, connectionState]);

  // Draw smooth, calm acoustic waveform bars on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barCount = 32;
      const gap = 4;
      const totalGap = gap * (barCount - 1);
      const barWidth = Math.max(2, (width - totalGap) / barCount);
      const active = stateRef.current === 'connected' || speakingRef.current;
      const energy = speakingRef.current
        ? Math.max(0.42, levelRef.current)
        : stateRef.current === 'connected'
        ? Math.max(0.12, levelRef.current)
        : 0.05;

      phase += active ? 0.09 : 0.02;

      for (let i = 0; i < barCount; i++) {
        const centerDist = 1 - Math.abs(i - barCount / 2) / (barCount / 2);
        const wave = Math.sin(phase + i * 0.38) * 0.5 + 0.5;
        const barHeight = Math.max(
          4,
          Math.min(height - 4, (6 + wave * (height - 10) * energy) * (0.35 + 0.65 * centerDist))
        );
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = speakingRef.current
          ? '#c2410c'
          : stateRef.current === 'connected'
          ? '#0f766e'
          : '#94a3b8';

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const previewRange = computeTargetWordRange(draftText);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftText.trim()) {
      setInputError('Say or type a quick line first so Aanya can match your talk.');
      return;
    }
    setInputError(null);
    const toSend = draftText.trim();
    setDraftText('');
    await onSendMessage(toSend);
  };

  const handleSparkClick = async (spark: string) => {
    setInputError(null);
    await onSendMessage(spark);
  };

  return (
    <section
      aria-label="Live Voice Companion Stage"
      className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col justify-between gap-6"
    >
      {/* Top companion identity & live status row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-200">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-amber-100 border border-stone-200 shrink-0">
            {!imgError ? (
              <img
                src="/src/assets/images/companion_aanya_portrait_1793892725866.jpg"
                alt="Aanya — Warm Indian-English voice companion"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100 to-orange-200 text-amber-900 font-display text-xl font-semibold">
                A
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-stone-900 tracking-tight">
                Aanya
              </h2>
              <span className="text-stone-300" aria-hidden="true">·</span>
              <span className="text-xs font-medium text-stone-600">
                {config.voiceName} Female Voice
              </span>
            </div>
            <p className="text-sm text-stone-600 mt-0.5">
              Casual Indian-English partner · Replies scaled to match your exact talk length
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 mt-1.5 tabular-nums">
              <span className="whitespace-nowrap">Model: gemini-3.8-live</span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">Input: 16kHz PCM</span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">Output: 24kHz Female Audio</span>
            </div>
          </div>
        </div>

        {/* Call state indicator + primary audio call controls */}
        <div className="flex items-center gap-3 shrink-0">
          {connectionState === 'connected' ? (
            <>
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 ${
                  isMuted
                    ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                    : 'bg-stone-100 border-stone-300 text-stone-800 hover:bg-stone-200'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? 'Mic Muted' : 'Mic On'}</span>
              </button>

              <button
                type="button"
                onClick={onEndLiveCall}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Live Call</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartLiveCall}
              disabled={connectionState === 'connecting'}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-60 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>
                {connectionState === 'connecting'
                  ? 'Connecting Live Voice...'
                  : 'Start Live Voice Call'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Error banner if microphone or WebSocket fails */}
      {errorMessage && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex items-start gap-3 text-xs text-red-800"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Live Audio Notice</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Acoustic Visualizer & Live Stream Transcript Box */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <Volume2 className="w-4 h-4 text-stone-700" />
            <span className="font-medium text-stone-800">
              {isModelSpeaking
                ? `Aanya (${config.voiceName}) is speaking...`
                : connectionState === 'connected'
                ? isMuted
                  ? 'Live call connected · Microphone muted'
                  : 'Listening to you — talk anything, nonsense welcome'
                : 'Voice stream ready — click Start Live Voice Call or send a line below'}
            </span>
          </div>

          <span className="text-xs text-stone-500 font-mono tabular-nums whitespace-nowrap shrink-0">
            {connectionState === 'connected' ? '24kHz STREAM ACTIVE' : 'STANDBY'}
          </span>
        </div>

        <div className="w-full h-16 flex items-center justify-center bg-white border border-stone-200 rounded-lg px-4">
          <canvas
            ref={canvasRef}
            width={520}
            height={52}
            data-testid="voice-waveform-canvas"
            className="w-full h-12"
          />
        </div>

        {/* Live real-time captions during voice call */}
        {(liveInputText || liveOutputText) && (
          <div className="pt-2 border-t border-stone-200 space-y-1.5 text-sm">
            {liveInputText && (
              <p className="text-stone-600">
                <span className="font-semibold text-stone-800">You: </span>
                {liveInputText}
              </p>
            )}
            {liveOutputText && (
              <p className="text-amber-950">
                <span className="font-semibold text-amber-800">Aanya: </span>
                {liveOutputText}
              </p>
            )}
          </div>
        )}

        {/* Audio Boost & Text-Only Call Recording Bar */}
        <div className="pt-3 border-t border-stone-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Speaker Output Volume Boost */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="speaker-boost-slider"
                className="font-semibold text-stone-800"
              >
                Aanya Voice Boost
              </label>
              <span className="font-mono text-amber-900 font-medium tabular-nums">
                {Math.round(audioBoost.speakerBoost * 100)}%
              </span>
            </div>
            <input
              id="speaker-boost-slider"
              type="range"
              min={1.0}
              max={2.5}
              step={0.1}
              value={audioBoost.speakerBoost}
              onChange={(e) =>
                onUpdateAudioBoost((prev) => ({
                  ...prev,
                  speakerBoost: parseFloat(e.target.value),
                }))
              }
              className="w-full accent-amber-800 cursor-pointer"
            />
          </div>

          {/* Mic Input Sensitivity Boost */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="mic-boost-slider"
                className="font-semibold text-stone-800"
              >
                Mic Pickup Boost
              </label>
              <span className="font-mono text-amber-900 font-medium tabular-nums">
                {Math.round(audioBoost.micBoost * 100)}%
              </span>
            </div>
            <input
              id="mic-boost-slider"
              type="range"
              min={1.0}
              max={2.5}
              step={0.1}
              value={audioBoost.micBoost}
              onChange={(e) =>
                onUpdateAudioBoost((prev) => ({
                  ...prev,
                  micBoost: parseFloat(e.target.value),
                }))
              }
              className="w-full accent-stone-900 cursor-pointer"
            />
          </div>

          {/* Vocal Presence EQ + Verbatim Text Recorder Status */}
          <div className="flex flex-col items-start md:items-end justify-between gap-1.5">
            <button
              type="button"
              onClick={() =>
                onUpdateAudioBoost((prev) => ({
                  ...prev,
                  vocalClarityEq: !prev.vocalClarityEq,
                }))
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                audioBoost.vocalClarityEq
                  ? 'bg-amber-900 text-white border-amber-900'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              {audioBoost.vocalClarityEq
                ? 'Crisp Vocal Clarity EQ: ON'
                : 'Crisp Vocal Clarity EQ: OFF'}
            </button>
            <span className="text-xs text-stone-500 font-mono tabular-nums whitespace-nowrap">
              Text-only log: {recordedUtteranceCount} lines
            </span>
          </div>
        </div>
      </div>

      {/* Talk / Banter Input Bar with live response-size mirroring preview */}
      <div className="space-y-3">
        <form onSubmit={handleFormSubmit} className="space-y-2" noValidate>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
            <label htmlFor="partner-talk-input" className="font-medium text-stone-700 whitespace-nowrap">
              Talk or type nonsense to Aanya (replies in her female voice)
            </label>
            <span className="font-mono tabular-nums whitespace-nowrap">
              Your words: {previewRange.userWords} · Target reply: {previewRange.minTargetWords}–{previewRange.maxTargetWords} words ({previewRange.pacingLabel})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="partner-talk-input"
              type="text"
              value={draftText}
              onChange={(e) => {
                setDraftText(e.target.value);
                if (inputError) setInputError(null);
              }}
              placeholder="Say anything... e.g. 'Yaar I am talking random nonsense, why is adulting just paying bills?'"
              className="flex-1 bg-stone-50 border border-stone-300 rounded-lg px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900"
            />
            <button
              type="submit"
              disabled={isSendingText}
              className="px-4 py-2.5 bg-amber-800 hover:bg-amber-900 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingText ? 'Replying...' : 'Say to Aanya'}</span>
            </button>
          </div>

          {inputError && (
            <p role="alert" className="text-xs text-red-600 font-medium">
              {inputError}
            </p>
          )}
        </form>

        {/* Quick Nonsense Sparks for instant testing */}
        <div className="pt-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-stone-600 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>Try a random nonsense opener (instant voice + length match):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {NONSENSE_SPARKS.map((spark, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isSendingText}
                onClick={() => handleSparkClick(spark)}
                className="text-left text-xs text-stone-700 bg-stone-50 hover:bg-amber-50/70 border border-stone-200 hover:border-amber-300 rounded-lg px-3 py-2 transition-colors truncate cursor-pointer"
                title={spark}
              >
                “{spark}”
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
