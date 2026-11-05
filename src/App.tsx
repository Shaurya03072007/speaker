/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  analyzeTurnMirroring,
  applyAudioBoostToSamples,
  AudioBoostConfig,
  buildCallRecordFromMessages,
  buildCompanionSystemInstruction,
  CallSessionRecord,
  CompanionConfig,
  computeTargetWordRange,
  ConversationMessage,
  countWords,
  float32ToInt16Pcm,
  int16PcmToFloat32,
} from './utils/companionLogic';
import { LiveConnectionState, LiveStageCard } from './components/LiveStageCard';
import { PersonaSidebar } from './components/PersonaSidebar';
import { TranscriptPanel } from './components/TranscriptPanel';
import { EnglishCoachPanel } from './components/EnglishCoachPanel';

const INITIAL_SAMPLE_MESSAGES: ConversationMessage[] = [
  {
    id: 'seed-1',
    speaker: 'user',
    text: 'Yaar I am just sitting here thinking why auto-wallahs always say no to the exact place I want to go.',
    timestamp: '11:42 PM',
    wordCount: 20,
    via: 'voice',
  },
  {
    id: 'seed-2',
    speaker: 'partner',
    text: 'Arey honestly, they could be going to that exact street themselves and they will still shake their head out of pure principle.',
    timestamp: '11:42 PM',
    wordCount: 22,
    mirrorFit: 'Proportional Match',
    bookmarked: true,
    via: 'voice',
  },
  {
    id: 'seed-3',
    speaker: 'user',
    text: 'Actually the thing is when I talk fast in meetings my words get mixed up only and I repeat same point twice.',
    timestamp: '11:44 PM',
    wordCount: 22,
    via: 'voice',
  },
  {
    id: 'seed-4',
    speaker: 'partner',
    text: 'Happens to everyone yaar when your brain runs faster than your mouth—take a half-second breath and drop the extra "only" at the end.',
    timestamp: '11:44 PM',
    wordCount: 24,
    mirrorFit: 'Proportional Match',
    via: 'voice',
  },
];

const INITIAL_CALL_RECORDS: CallSessionRecord[] = [
  {
    id: 'call-seed-1',
    title: 'Call #1 · Auto-Wallahs & Fast-Talking Habits',
    recordedAt: 'Tonight, 11:44 PM',
    durationLabel: '4 min text-only log',
    userUtterances: [
      'Yaar I am just sitting here thinking why auto-wallahs always say no to the exact place I want to go.',
      'Actually the thing is when I talk fast in meetings my words get mixed up only and I repeat same point twice.',
      'Full nonsense mood tonight, tell me if I am making sense or just rambling.',
    ],
    fullTurns: [
      {
        speaker: 'user',
        text: 'Yaar I am just sitting here thinking why auto-wallahs always say no to the exact place I want to go.',
        timestamp: '11:42 PM',
      },
      {
        speaker: 'partner',
        text: 'Arey honestly, they could be going to that exact street themselves and they will still shake their head out of pure principle.',
        timestamp: '11:42 PM',
      },
      {
        speaker: 'user',
        text: 'Actually the thing is when I talk fast in meetings my words get mixed up only and I repeat same point twice.',
        timestamp: '11:44 PM',
      },
      {
        speaker: 'partner',
        text: 'Happens to everyone yaar when your brain runs faster than your mouth—take a half-second breath and drop the extra "only" at the end.',
        timestamp: '11:44 PM',
      },
    ],
    totalUserWords: 56,
    analysisReport: {
      analyzedByModel: 'gemini-3.1-flash-lite',
      analyzedAt: '11:45 PM',
      overallAssessment:
        'You speak with warm, relatable storytelling energy and natural Indian-English charm. Your ideas are vivid and engaging, though when you speed up, stack-on openers ("Actually the thing is...") and trailing emphasis words ("mixed up only") slightly soften your punch.',
      clarityScore: 84,
      fluencyAndFlowScore: 87,
      grammarAndStructureScore: 79,
      speakingStyleSummary:
        'Expressive, spontaneous, and conversational. You build rapport effortlessly in one breath, and pausing briefly before your main verb will make your spoken sentences land with 100% crispness.',
      strengths: [
        'Strong storytelling hook ("sitting here thinking why auto-wallahs always say no") with natural rhythm.',
        'Self-aware and expressive flow that keeps a listener naturally engaged.',
        'Good sentence length variety—comfortable with both 20-word observations and quick banter.',
      ],
      habitsToRefine: [
        'Trim stacked warm-up openers like "Actually the thing is" when making a direct point.',
        'Replace Indian-English trailing "only" ("mixed up only") with a clean verb or adjective for universal clarity.',
        'Include articles ("the same point" instead of "repeat same point") so rapid speech still sounds complete.',
      ],
      lineByLineUpgrades: [
        {
          exactSpokenText:
            'Actually the thing is when I talk fast in meetings my words get mixed up only and I repeat same point twice.',
          diagnosis: 'Stacked opener ("Actually the thing is") + trailing "only" + missing article ("the")',
          casualNaturalUpgrade:
            'Honestly, when I talk fast in meetings, my words get tangled up and I end up repeating the same point.',
          polishedFluentUpgrade:
            'Whenever I speak too quickly in meetings, I stumble over my words and repeat the same point.',
        },
        {
          exactSpokenText:
            'Yaar I am just sitting here thinking why auto-wallahs always say no to the exact place I want to go.',
          diagnosis: 'Great casual rhythm; "wondering why" flows even more smoothly than "thinking why"',
          casualNaturalUpgrade:
            'Yaar, I am just sitting here wondering why auto-wallahs always say no to the exact place I want to go.',
          polishedFluentUpgrade:
            'I was just wondering why auto drivers always refuse to go to the exact destination you ask for.',
        },
      ],
      nextCallMicroDrills: [
        'Start your next 3 sentences directly with the subject ("When I speak fast...") instead of "Actually the thing is...".',
        'Pause for half a beat after your main clause instead of adding "only" at the end of the phrase.',
        'When explaining a thought to Aanya, aim for one clear idea per breath.',
      ],
    },
  },
];

function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export default function App() {
  const [config, setConfig] = useState<CompanionConfig>({
    voiceName: 'Kore',
    vibeMode: 'banter',
    userNickname: 'Yaar',
    indianEnglishNuance: 'natural',
    memoryNotes: [
      'Talks random nonsense to unwind',
      'Likes replies that match his exact talk length—not huge, not tiny',
    ],
    englishCoachingFocus: 'sentence-clarity',
  });

  const [audioBoost, setAudioBoost] = useState<AudioBoostConfig>({
    speakerBoost: 1.5, // Default 150% boosted clear output
    micBoost: 1.4, // Default 140% sensitive mic pickup
    vocalClarityEq: true,
  });

  const [messages, setMessages] = useState<ConversationMessage[]>(INITIAL_SAMPLE_MESSAGES);
  const [callRecords, setCallRecords] = useState<CallSessionRecord[]>(INITIAL_CALL_RECORDS);
  const [selectedCallId, setSelectedCallId] = useState<string>(INITIAL_CALL_RECORDS[0].id);
  const [isAnalyzingEnglish, setIsAnalyzingEnglish] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [connectionState, setConnectionState] = useState<LiveConnectionState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveInputText, setLiveInputText] = useState('');
  const [liveOutputText, setLiveOutputText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSendingText, setIsSendingText] = useState(false);

  // Refs for WebSocket and Web Audio API to prevent stale closures
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef(isMuted);
  const audioBoostRef = useRef(audioBoost);
  const pendingInputRef = useRef('');
  const pendingOutputRef = useRef('');
  const lastUserTextRef = useRef('Full nonsense mood tonight.');

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    audioBoostRef.current = audioBoost;
  }, [audioBoost]);

  const stopAllPlayback = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Ignore already stopped sources
      }
    }
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setIsModelSpeaking(false);
  }, []);

  const playPcm24kChunk = useCallback((base64Data: string) => {
    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const int16 = base64ToInt16Array(base64Data);
      const unboostedFloat32 = int16PcmToFloat32(int16);
      // Apply user's Speaker Audio Boost with soft-knee limiting
      const float32 = applyAudioBoostToSamples(
        unboostedFloat32,
        audioBoostRef.current.speakerBoost
      );

      // Compute RMS audio level for visualizer
      let sumSq = 0;
      for (let i = 0; i < float32.length; i++) {
        sumSq += float32[i] * float32[i];
      }
      const rms = Math.min(1, Math.sqrt(sumSq / Math.max(1, float32.length)) * 3.5);
      setAudioLevel(rms);
      setIsModelSpeaking(true);

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Optional Vocal Clarity High-Shelf EQ Filter
      if (audioBoostRef.current.vocalClarityEq) {
        const eqFilter = ctx.createBiquadFilter();
        eqFilter.type = 'highshelf';
        eqFilter.frequency.value = 3000;
        eqFilter.gain.value = 5.0;
        source.connect(eqFilter);
        eqFilter.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setIsModelSpeaking(false);
          setAudioLevel(0);
        }
      };
    } catch {
      // Ignore transient audio decode issues
    }
  }, []);

  const cleanupLiveCall = useCallback(() => {
    stopAllPlayback();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setConnectionState('idle');
    setAudioLevel(0);
    setIsModelSpeaking(false);
  }, [stopAllPlayback]);

  useEffect(() => {
    return () => {
      cleanupLiveCall();
    };
  }, [cleanupLiveCall]);

  const formatNow = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const startLiveCall = async () => {
    setErrorMessage(null);
    setConnectionState('connecting');
    pendingInputRef.current = '';
    pendingOutputRef.current = '';
    setLiveInputText('');
    setLiveOutputText('');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live?voice=${encodeURIComponent(config.voiceName)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        ws.send(
          JSON.stringify({
            type: 'init',
            voiceName: config.voiceName,
            systemInstruction: buildCompanionSystemInstruction(config),
          })
        );

        // Request microphone 16kHz input
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          micStreamRef.current = stream;

          const inputCtx = new AudioContext({ sampleRate: 16000 });
          inputAudioCtxRef.current = inputCtx;

          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          source.connect(processor);
          processor.connect(inputCtx.destination);

          processor.onaudioprocess = (e) => {
            if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
            const rawChannelData = e.inputBuffer.getChannelData(0);
            // Apply Mic Pickup Audio Boost before encoding to 16kHz PCM
            const channelData = applyAudioBoostToSamples(
              rawChannelData,
              audioBoostRef.current.micBoost
            );

            // Compute mic input RMS for visualizer
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) {
              sum += channelData[i] * channelData[i];
            }
            const rms = Math.min(1, Math.sqrt(sum / channelData.length) * 4);
            setAudioLevel(rms);

            const pcm16 = float32ToInt16Pcm(channelData);
            const base64Audio = arrayBufferToBase64(pcm16.buffer);
            ws.send(JSON.stringify({ audio: base64Audio }));
          };
        } catch {
          setErrorMessage(
            'Microphone access was unavailable or blocked, so Live Voice is connected in text-to-voice mode. You can still type below and hear Aanya speak live!'
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            setConnectionState('connected');
          } else if (msg.type === 'audio' && msg.audio) {
            playPcm24kChunk(msg.audio);
          } else if (msg.type === 'inputTranscript' && msg.text) {
            pendingInputRef.current += msg.text;
            setLiveInputText(pendingInputRef.current);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            pendingOutputRef.current += msg.text;
            setLiveOutputText(pendingOutputRef.current);
          } else if (msg.type === 'interrupted') {
            stopAllPlayback();
          } else if (msg.type === 'turnComplete') {
            const finalUser = pendingInputRef.current.trim();
            const finalPartner = pendingOutputRef.current.trim();

            if (finalUser) {
              lastUserTextRef.current = finalUser;
              setMessages((prev) => [
                ...prev,
                {
                  id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  speaker: 'user',
                  text: finalUser,
                  timestamp: formatNow(),
                  wordCount: countWords(finalUser),
                  via: 'voice',
                },
              ]);
              pendingInputRef.current = '';
            }

            if (finalPartner) {
              const metrics = analyzeTurnMirroring(lastUserTextRef.current, finalPartner);
              setMessages((prev) => [
                ...prev,
                {
                  id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  speaker: 'partner',
                  text: finalPartner,
                  timestamp: formatNow(),
                  wordCount: countWords(finalPartner),
                  mirrorFit: metrics.fitLabel,
                  via: 'voice',
                },
              ]);
              pendingOutputRef.current = '';
            }
          } else if (msg.type === 'error') {
            setErrorMessage(msg.message || 'Live voice session encountered an error.');
          }
        } catch {
          // Ignore malformed WS frames
        }
      };

      ws.onerror = () => {
        setErrorMessage('WebSocket connection error. You can still talk with Aanya using the input box below.');
        cleanupLiveCall();
      };

      ws.onclose = () => {
        setConnectionState('idle');
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setConnectionState('idle');
    }
  };

  const playWavBase64 = (wavBase64: string) => {
    try {
      const audio = new Audio(`data:audio/wav;base64,${wavBase64}`);
      // Route through Web Audio GainNode so >100% Speaker Boost works on WAV TTS too
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new AudioContext();
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const mediaSource = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = audioBoostRef.current.speakerBoost;

      if (audioBoostRef.current.vocalClarityEq) {
        const eqFilter = ctx.createBiquadFilter();
        eqFilter.type = 'highshelf';
        eqFilter.frequency.value = 3000;
        eqFilter.gain.value = 5.0;
        mediaSource.connect(gainNode);
        gainNode.connect(eqFilter);
        eqFilter.connect(ctx.destination);
      } else {
        mediaSource.connect(gainNode);
        gainNode.connect(ctx.destination);
      }

      setIsModelSpeaking(true);
      setAudioLevel(0.65);
      audio.onended = () => {
        setIsModelSpeaking(false);
        setAudioLevel(0);
      };
      audio.onerror = () => {
        setIsModelSpeaking(false);
        setAudioLevel(0);
      };
      audio.play().catch(() => {
        setIsModelSpeaking(false);
        setAudioLevel(0);
      });
    } catch {
      setIsModelSpeaking(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    lastUserTextRef.current = trimmed;

    const userMsg: ConversationMessage = {
      id: `user-${Date.now()}`,
      speaker: 'user',
      text: trimmed,
      timestamp: formatNow(),
      wordCount: countWords(trimmed),
      via: connectionState === 'connected' ? 'voice' : 'text',
    };
    setMessages((prev) => [...prev, userMsg]);

    // Also append to the currently selected call transcript's verbatim utterances
    setCallRecords((prev) =>
      prev.map((call, idx) =>
        idx === 0
          ? {
              ...call,
              userUtterances: [...call.userUtterances, trimmed],
              fullTurns: [
                ...call.fullTurns,
                { speaker: 'user', text: trimmed, timestamp: formatNow() },
              ],
              totalUserWords: call.totalUserWords + countWords(trimmed),
            }
          : call
      )
    );

    // If connected to Gemini Live WebSocket, send into the live voice session
    if (connectionState === 'connected' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: trimmed }));
      return;
    }

    // Otherwise call the companion banter endpoint (which also synthesizes her female voice)
    setIsSendingText(true);
    try {
      const range = computeTargetWordRange(trimmed);
      const response = await fetch('/api/companion/banter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: trimmed,
          systemInstruction: buildCompanionSystemInstruction(config),
          voiceName: config.voiceName,
          history: messages.slice(-6).map((m) => ({ speaker: m.speaker, text: m.text })),
          targetMin: range.minTargetWords,
          targetMax: range.maxTargetWords,
          speakReply: true,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Could not generate reply');
      }

      const replyText = data.replyText || 'Arey yaar, tell me more!';
      const metrics = analyzeTurnMirroring(trimmed, replyText);

      const partnerMsg: ConversationMessage = {
        id: `partner-${Date.now()}`,
        speaker: 'partner',
        text: replyText,
        timestamp: formatNow(),
        wordCount: countWords(replyText),
        mirrorFit: metrics.fitLabel,
        via: 'text',
      };
      setMessages((prev) => [...prev, partnerMsg]);

      setCallRecords((prev) =>
        prev.map((call, idx) =>
          idx === 0
            ? {
                ...call,
                fullTurns: [
                  ...call.fullTurns,
                  { speaker: 'partner', text: replyText, timestamp: formatNow() },
                ],
              }
            : call
        )
      );

      if (data.wavBase64) {
        playWavBase64(data.wavBase64);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSendingText(false);
    }
  };

  const handleSaveCurrentCallRecord = () => {
    const userCount = messages.filter((m) => m.speaker === 'user').length;
    if (userCount === 0) {
      setAnalysisError('Say or type at least one line before saving a call transcript.');
      return;
    }
    setAnalysisError(null);
    const newRecord = buildCallRecordFromMessages(
      messages,
      `Call #${callRecords.length + 1} · ${messages.find((m) => m.speaker === 'user')?.text.slice(0, 26) || 'Spoken Session'}...`
    );
    setCallRecords((prev) => [newRecord, ...prev]);
    setSelectedCallId(newRecord.id);
  };

  const handleAnalyzeSelectedCall = async (callId: string) => {
    const targetCall = callRecords.find((c) => c.id === callId);
    if (!targetCall || targetCall.userUtterances.length === 0) {
      setAnalysisError('No spoken lines in this call record yet.');
      return;
    }

    setIsAnalyzingEnglish(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/companion/analyze-english', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callTitle: targetCall.title,
          userUtterances: targetCall.userUtterances,
          fullTurns: targetCall.fullTurns,
          coachingFocus: config.englishCoachingFocus,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.report) {
        throw new Error(data.error || 'Could not complete English clarity analysis.');
      }

      setCallRecords((prev) =>
        prev.map((c) => (c.id === callId ? { ...c, analysisReport: data.report } : c))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAnalysisError(msg);
    } finally {
      setIsAnalyzingEnglish(false);
    }
  };

  const handleSpeakExistingMessage = async (text: string) => {
    try {
      setErrorMessage(null);
      const response = await fetch('/api/companion/banter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: `Repeat this exact line aloud: "${text}"`,
          systemInstruction: `Output ONLY this exact sentence word for word: ${text}`,
          voiceName: config.voiceName,
          speakReply: true,
        }),
      });
      const data = await response.json();
      if (data.wavBase64) {
        playWavBase64(data.wavBase64);
      }
    } catch {
      // Ignore playback error
    }
  };

  const handleToggleBookmark = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, bookmarked: !m.bookmarked } : m))
    );
  };

  const currentRecordedUtterancesCount =
    messages.filter((m) => m.speaker === 'user').length;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-stone-200">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#live-stage"
          className="text-xl font-bold tracking-tight text-stone-900 font-display whitespace-nowrap shrink-0"
        >
          Aanya
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600"
        >
          <a
            href="#live-stage"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Live Voice Room
          </a>
          <a
            href="#english-coach"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            English Clarity Coach
          </a>
          <a
            href="#banter-log"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Banter Log
          </a>
          <a
            href="#persona-tuning"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Voice Timbre
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {connectionState === 'connected' ? (
            <button
              type="button"
              onClick={cleanupLiveCall}
              className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              End Live Call
            </button>
          ) : (
            <button
              type="button"
              onClick={startLiveCall}
              className="px-4 py-2 text-xs font-semibold text-stone-800 bg-stone-100 border border-stone-300 rounded-lg hover:bg-stone-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Connect Mic
            </button>
          )}
        </div>
      </header>

      {/* Main 1440px-ready Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Editorial Intro Header */}
        <div className="max-w-3xl space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight text-balance">
            Talk random nonsense, late-night thoughts, or everyday life—just like a real partner.
          </h1>
          <p className="text-base text-stone-600 leading-relaxed">
            Powered by <span className="font-medium text-stone-800">Gemini Live</span> with a natural female voice ({config.voiceName}) and real-time audio boosting. Every call records the exact text from your mouth (no voice recording) so <span className="font-medium text-stone-800">Gemini Flash Lite</span> can deeply analyze your English clarity and how you speak.
          </p>
        </div>

        {/* Two-column Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left/Main Column: Live Voice Stage + Deep English Coach + Conversation Log */}
          <div id="live-stage" className="lg:col-span-8 space-y-6">
            <LiveStageCard
              config={config}
              audioBoost={audioBoost}
              recordedUtteranceCount={currentRecordedUtterancesCount}
              connectionState={connectionState}
              isMuted={isMuted}
              isModelSpeaking={isModelSpeaking}
              audioLevel={audioLevel}
              liveInputText={liveInputText}
              liveOutputText={liveOutputText}
              errorMessage={errorMessage}
              isSendingText={isSendingText}
              onStartLiveCall={startLiveCall}
              onEndLiveCall={cleanupLiveCall}
              onToggleMute={() => setIsMuted((prev) => !prev)}
              onUpdateAudioBoost={setAudioBoost}
              onSendMessage={handleSendMessage}
            />

            <div id="english-coach">
              <EnglishCoachPanel
                callRecords={callRecords}
                selectedCallId={selectedCallId}
                coachingFocus={config.englishCoachingFocus}
                isAnalyzing={isAnalyzingEnglish}
                analysisError={analysisError}
                onSelectCall={setSelectedCallId}
                onChangeCoachingFocus={(englishCoachingFocus) =>
                  setConfig((prev) => ({ ...prev, englishCoachingFocus }))
                }
                onSaveCurrentCallRecord={handleSaveCurrentCallRecord}
                onAnalyzeSelectedCall={handleAnalyzeSelectedCall}
                onSpeakUpgradeLine={handleSpeakExistingMessage}
              />
            </div>

            <div id="banter-log">
              <TranscriptPanel
                messages={messages}
                onToggleBookmark={handleToggleBookmark}
                onClearHistory={() => setMessages([])}
                onRestoreSampleHistory={() => setMessages(INITIAL_SAMPLE_MESSAGES)}
                onSpeakMessage={handleSpeakExistingMessage}
              />
            </div>
          </div>

          {/* Right Column: Female Voice & Partner Vibe Sidebar */}
          <div id="persona-tuning" className="lg:col-span-4">
            <div id="shared-memory">
              <PersonaSidebar config={config} onUpdateConfig={setConfig} />
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 px-6 text-xs text-stone-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>Aanya — Gemini Live Female Voice Companion</span>
        <span>Audio Boost DSP · Verbatim text-only call recorder · Gemini Flash Lite English Coach</span>
      </footer>
    </div>
  );
}
