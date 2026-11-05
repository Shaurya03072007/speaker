export type FemaleVoiceName = 'Kore' | 'Zephyr';

export type VibeMode = 'banter' | 'late-night' | 'warm-partner';

export interface AudioBoostConfig {
  speakerBoost: number; // 1.0 to 2.5 (100% to 250%)
  micBoost: number; // 1.0 to 2.5 (100% to 250%)
  vocalClarityEq: boolean; // High-presence vocal clarity filter
}

export interface CompanionConfig {
  voiceName: FemaleVoiceName;
  vibeMode: VibeMode;
  userNickname: string;
  indianEnglishNuance: 'natural' | 'light' | 'expressive';
  memoryNotes: string[];
  englishCoachingFocus: 'fluency-flow' | 'sentence-clarity' | 'natural-vocabulary';
}

export interface TurnMirrorMetrics {
  userWords: number;
  partnerWords: number;
  targetMin: number;
  targetMax: number;
  ratio: number;
  fitLabel: 'Proportional Match' | 'Slightly Concise' | 'Slightly Expanded';
}

export interface ConversationMessage {
  id: string;
  speaker: 'user' | 'partner';
  text: string;
  timestamp: string;
  wordCount: number;
  mirrorFit?: 'Proportional Match' | 'Slightly Concise' | 'Slightly Expanded';
  bookmarked?: boolean;
  via: 'voice' | 'text';
}

export interface LineUpgradeItem {
  exactSpokenText: string;
  diagnosis: string;
  casualNaturalUpgrade: string;
  polishedFluentUpgrade: string;
}

export interface EnglishAnalysisReport {
  analyzedByModel: string;
  analyzedAt: string;
  overallAssessment: string;
  clarityScore: number;
  fluencyAndFlowScore: number;
  grammarAndStructureScore: number;
  speakingStyleSummary: string;
  strengths: string[];
  habitsToRefine: string[];
  lineByLineUpgrades: LineUpgradeItem[];
  nextCallMicroDrills: string[];
}

export interface CallSessionRecord {
  id: string;
  title: string;
  recordedAt: string;
  durationLabel: string;
  userUtterances: string[];
  fullTurns: Array<{ speaker: 'user' | 'partner'; text: string; timestamp: string }>;
  totalUserWords: number;
  analysisReport?: EnglishAnalysisReport;
}

export const FEMALE_VOICE_OPTIONS: Array<{
  id: FemaleVoiceName;
  name: string;
  personaTitle: string;
  description: string;
}> = [
  {
    id: 'Kore',
    name: 'Kore (Female)',
    personaTitle: 'Warm & Grounded',
    description: 'Natural, expressive female voice with relaxed warmth—great for late-night nonsense and partner talk.',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr (Female)',
    personaTitle: 'Bright & Playful',
    description: 'Lively, quick-witted female voice that jumps right into playful teasing and random tangents.',
  },
];

export const VIBE_MODE_OPTIONS: Array<{
  id: VibeMode;
  label: string;
  shortDesc: string;
}> = [
  {
    id: 'banter',
    label: 'Nonsense & Banter',
    shortDesc: 'Rolls with random thoughts, silly hypotheticals, and playful desi-English back-and-forth.',
  },
  {
    id: 'late-night',
    label: 'Late-Night Partner',
    shortDesc: 'Cozy, unhurried, like talking on the balcony over chai after a long day.',
  },
  {
    id: 'warm-partner',
    label: 'Real & Grounded',
    shortDesc: 'Attentive, affectionate, honest reactions without ever sounding like an assistant.',
  },
];

export function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function computeTargetWordRange(userText: string): {
  userWords: number;
  minTargetWords: number;
  maxTargetWords: number;
  pacingLabel: string;
} {
  const userWords = countWords(userText);
  if (userWords === 0) {
    return { userWords: 0, minTargetWords: 4, maxTargetWords: 12, pacingLabel: 'Short opener' };
  }
  if (userWords <= 5) {
    return {
      userWords,
      minTargetWords: Math.max(2, userWords - 1),
      maxTargetWords: userWords + 6,
      pacingLabel: 'Quick quip',
    };
  }
  if (userWords <= 18) {
    return {
      userWords,
      minTargetWords: Math.max(5, Math.floor(userWords * 0.7)),
      maxTargetWords: Math.ceil(userWords * 1.4) + 3,
      pacingLabel: 'Casual turn',
    };
  }
  return {
    userWords,
    minTargetWords: Math.max(12, Math.floor(userWords * 0.75)),
    maxTargetWords: Math.ceil(userWords * 1.3),
    pacingLabel: 'Story flow',
  };
}

export function analyzeTurnMirroring(userText: string, partnerText: string): TurnMirrorMetrics {
  const { userWords, minTargetWords, maxTargetWords } = computeTargetWordRange(userText);
  const partnerWords = countWords(partnerText);
  const baseline = Math.max(1, userWords);
  const ratio = Number((partnerWords / baseline).toFixed(2));

  let fitLabel: TurnMirrorMetrics['fitLabel'] = 'Proportional Match';
  if (partnerWords < minTargetWords) {
    fitLabel = 'Slightly Concise';
  } else if (partnerWords > maxTargetWords) {
    fitLabel = 'Slightly Expanded';
  }

  return {
    userWords,
    partnerWords,
    targetMin: minTargetWords,
    targetMax: maxTargetWords,
    ratio,
    fitLabel,
  };
}

export function buildCompanionSystemInstruction(config: CompanionConfig): string {
  const vibeMap: Record<VibeMode, string> = {
    'banter':
      'You love playful nonsense, random shower thoughts, silly hypotheticals, and teasing banter. Never try to make the conversation "productive" or serious unless the user is serious.',
    'late-night':
      'You have a cozy, unhurried late-night vibe—like two close partners sitting together talking about random things, laughing softly, and keeping each other company.',
    'warm-partner':
      'You are affectionate, grounded, and genuinely invested in whatever is on his mind, whether it is complete nonsense, a random rant, or how his day went.',
  };

  const nuanceMap: Record<CompanionConfig['indianEnglishNuance'], string> = {
    natural:
      'Speak in natural, everyday Indian English—comfortable with casual expressions like "yaar", "acha", "arey", "matlab", "honestly", or "tell me one thing" when it fits organically, without forcing slang into every sentence.',
    light:
      'Speak in warm, contemporary conversational English with subtle Indian cultural familiarity and effortless flow.',
    expressive:
      'Speak in lively desi-English with natural warmth, playful expressions ("arey yaar", "acha listen", "kuch bhi!"), and effortless familiarity.',
  };

  const notesSection =
    config.memoryNotes.length > 0
      ? `\nThings you remember about ${config.userNickname || 'him'}:\n${config.memoryNotes.map((n) => `- ${n}`).join('\n')}`
      : '';

  return [
    `You are Aanya, a warm, witty, human-like female companion and partner talking in English with ${config.userNickname || 'your partner'} (who is Indian).`,
    `CRITICAL RULE — MIRROR HIS LENGTH AND PACE ("JUST AS FROM HIS TALK"):`,
    `- Your reply length MUST dynamically match how much and how casually he just spoke.`,
    `- Do NOT give huge paragraphs, do NOT give robotic one-word replies, and do NOT default to a fixed medium paragraph every time.`,
    `- If he says a short 4-word line or random nonsense, reply with a natural 4-to-10-word remark that matches his exact energy.`,
    `- If he talks for two sentences of random nonsense or banter, reply in about two sentences.`,
    `- If he shares a longer thought, match him with a thoughtful, conversational reply of similar weight.`,
    `CRITICAL RULE — BE A REAL PARTNER, NEVER AN AI ASSISTANT:`,
    `- Never say "How can I help you today?", "As an AI", or give bulleted lists or formal advice.`,
    `- When he talks nonsense, talks about random weird ideas, or just rambles, roll right along with it! Laugh with him, tease him gently, add to the nonsense, or react like a real girlfriend/partner hanging out with him.`,
    `- Model clear, natural, effortless conversational English in your own speech so that just talking with you naturally elevates his English rhythm and phrasing, without ever interrupting the flow to lecture him like a teacher during the call.`,
    vibeMap[config.vibeMode],
    nuanceMap[config.indianEnglishNuance],
    notesSection,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Applies clean audio gain boost (1.0x to 2.5x) with soft-knee limiting
 * so quiet speech or playback becomes loud and clear without harsh digital clipping.
 */
export function applyAudioBoostToSamples(
  samples: Float32Array,
  boostMultiplier: number
): Float32Array {
  const safeBoost = Math.max(0.5, Math.min(3.0, boostMultiplier));
  if (Math.abs(safeBoost - 1.0) < 0.001) {
    return new Float32Array(samples);
  }
  const boosted = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const raw = samples[i] * safeBoost;
    // Soft-knee saturation above 0.85 to preserve clarity at high boost
    if (Math.abs(raw) <= 0.85) {
      boosted[i] = raw;
    } else {
      const sign = raw < 0 ? -1 : 1;
      const excess = Math.abs(raw) - 0.85;
      boosted[i] = sign * (0.85 + 0.15 * Math.tanh(excess / 0.15));
    }
  }
  return boosted;
}

export function float32ToInt16Pcm(float32Array: Float32Array): Int16Array {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return int16;
}

export function int16PcmToFloat32(int16Array: Int16Array): Float32Array {
  const float32 = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

/**
 * Extracts exact verbatim user utterances from a list of conversation turns
 * (Text-only call recording — no audio blobs stored).
 */
export function buildCallRecordFromMessages(
  messages: ConversationMessage[],
  customTitle?: string
): CallSessionRecord {
  const userTurns = messages.filter((m) => m.speaker === 'user');
  const userUtterances = userTurns.map((m) => m.text);
  const totalUserWords = userTurns.reduce((sum, m) => sum + m.wordCount, 0);
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    id: `call-${Date.now()}`,
    title:
      customTitle?.trim() ||
      `Call Transcript · ${userUtterances[0]?.slice(0, 32) || 'Casual Banter'}...`,
    recordedAt: `Today, ${nowStr}`,
    durationLabel: `${Math.max(1, Math.ceil(messages.length * 0.6))} min text-only log`,
    userUtterances,
    fullTurns: messages.map((m) => ({
      speaker: m.speaker,
      text: m.text,
      timestamp: m.timestamp,
    })),
    totalUserWords,
  };
}
