export type FemaleVoiceName = 'Kore' | 'Zephyr';

export type VibeMode = 'banter' | 'late-night' | 'warm-partner';

export type LanguageGateMode = 'english-only-until-asked' | 'telugu-explicitly-enabled';

export interface AudioBoostConfig {
  speakerBoost: number; // 1.0 to 2.5 (100% to 250%)
  micBoost: number; // 1.0 to 2.5 (100% to 250%)
  vocalClarityEq: boolean; // High-presence vocal clarity filter
  echoGuard: boolean; // Prevents speaker bleed / self-interruption while Aanya speaks
}

export interface CompanionConfig {
  voiceName: FemaleVoiceName;
  vibeMode: VibeMode;
  userNickname: string;
  indianEnglishNuance: 'natural' | 'light' | 'expressive';
  languageGate: LanguageGateMode;
  memoryNotes: string[];
  englishCoachingFocus: 'fluency-flow' | 'sentence-clarity' | 'natural-vocabulary';
}

export interface LanguageGateDecision {
  allowedLanguage: 'english' | 'telugu';
  nextGateMode: LanguageGateMode;
  shouldSuppressAccidentalTelugu: boolean;
  suppressionReason?: string;
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
  languageUsed?: 'EN' | 'TE';
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
    shortDesc: 'Rolls with random thoughts, silly hypotheticals, and playful back-and-forth.',
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

const EXPLICIT_TELUGU_REQUEST_PATTERNS = [
  /\b(talk|speak|reply|answer|chat|switch|converse)\b.*\b(in\s+)?telugu\b/i,
  /\btelugu\s+(lo|la)\s+(matladu|matladandi|cheppu|cheppandi)\b/i,
  /\bcan\s+you\s+(speak|talk)\s+telugu\b/i,
  /\btelugu\s+please\b/i,
];

const EXPLICIT_ENGLISH_REQUEST_PATTERNS = [
  /\b(talk|speak|reply|answer|switch|back)\b.*\b(in\s+|to\s+)?english\b/i,
  /\bonly\s+english\b/i,
  /\benglish\s+only\b/i,
];

// Telugu Unicode block: \u0C00-\u0C7F, plus common unrequested romanized Telugu-only phrases
const TELUGU_SCRIPT_REGEX = /[\u0C00-\u0C7F]/;
const ACCIDENTAL_ROMAN_TELUGU_REGEX =
  /^\s*(em\s+chestunnav|ela\s+unnav|enti\s+sangati|cheppu\s+ra|em\s+ledu|avuna|sare\s+le|ekkada\s+unnav|bojanam\s+chesava)(\s+ra|\s+amma|\s+babu)?\s*[?.!]*$/i;

/**
 * Enforces strict language policy:
 * - Talk ONLY in English or Telugu (NEVER Hindi, Tamil, etc.).
 * - Speak Telugu ONLY if explicitly asked by the user.
 * - If Telugu is spoken by mistake (without asking to switch to Telugu), suppress/ignore it!
 */
export function evaluateLanguagePolicy(
  userText: string,
  currentGateMode: LanguageGateMode
): LanguageGateDecision {
  const trimmed = userText.trim();

  // Check if user explicitly asked to switch back to English
  if (EXPLICIT_ENGLISH_REQUEST_PATTERNS.some((re) => re.test(trimmed))) {
    return {
      allowedLanguage: 'english',
      nextGateMode: 'english-only-until-asked',
      shouldSuppressAccidentalTelugu: false,
    };
  }

  // Check if user explicitly asked to speak in Telugu
  if (EXPLICIT_TELUGU_REQUEST_PATTERNS.some((re) => re.test(trimmed))) {
    return {
      allowedLanguage: 'telugu',
      nextGateMode: 'telugu-explicitly-enabled',
      shouldSuppressAccidentalTelugu: false,
    };
  }

  // If Telugu is already explicitly enabled by the user's prior request or toggle
  if (currentGateMode === 'telugu-explicitly-enabled') {
    return {
      allowedLanguage: 'telugu',
      nextGateMode: 'telugu-explicitly-enabled',
      shouldSuppressAccidentalTelugu: false,
    };
  }

  // Otherwise we are in strict 'english-only-until-asked' mode:
  // Check if the user accidentally spoke Telugu (Telugu script or pure Telugu phrase without asking for Telugu)
  const hasTeluguScript = TELUGU_SCRIPT_REGEX.test(trimmed);
  const isAccidentalRomanTelugu = ACCIDENTAL_ROMAN_TELUGU_REGEX.test(trimmed);

  if (hasTeluguScript || isAccidentalRomanTelugu) {
    return {
      allowedLanguage: 'english',
      nextGateMode: 'english-only-until-asked',
      shouldSuppressAccidentalTelugu: true,
      suppressionReason:
        'Unrequested Telugu detected while in English-Only mode. Ignored per your rule ("by mistake Telugu spoken shouldn\'t answer"). Ask "talk in Telugu" or switch Telugu Mode ON if you want Telugu.',
    };
  }

  return {
    allowedLanguage: 'english',
    nextGateMode: 'english-only-until-asked',
    shouldSuppressAccidentalTelugu: false,
  };
}

export function buildCompanionSystemInstruction(config: CompanionConfig): string {
  const vibeMap: Record<VibeMode, string> = {
    'banter':
      'You love playful nonsense, random shower thoughts, silly hypotheticals, and teasing banter. Keep the back-and-forth natural, snappy, and effortless.',
    'late-night':
      'You have a cozy, unhurried late-night vibe—like two close partners sitting together talking about random things, laughing softly, and keeping each other company.',
    'warm-partner':
      'You are affectionate, grounded, and genuinely invested in whatever is on his mind, whether it is complete nonsense, a random rant, or how his day went.',
  };

  const nuanceMap: Record<CompanionConfig['indianEnglishNuance'], string> = {
    natural:
      'Speak in clear, natural Indian-English (comfortable with casual English flow, without using Hindi words).',
    light:
      'Speak in warm, contemporary conversational English with effortless flow and natural warmth.',
    expressive:
      'Speak in lively, expressive Indian-English with warm familiarity and natural conversational hooks.',
  };

  const languagePolicySection =
    config.languageGate === 'telugu-explicitly-enabled'
      ? [
          `STRICT LANGUAGE RULE (TELUGU EXPLICITLY REQUESTED):`,
          `- The user has explicitly asked you to speak in Telugu (or mix natural Telugu & English). You may now reply in natural conversational Telugu or English as he prefers.`,
          `- NEVER speak Hindi, Tamil, Kannada, Malayalam, or any other language. ONLY English or Telugu.`,
          `- If he asks to switch back to English, immediately reply ONLY in English.`,
        ].join('\n')
      : [
          `STRICT LANGUAGE RULE (ENGLISH ONLY — IGNORE ACCIDENTAL TELUGU):`,
          `- You MUST speak ONLY in English by default.`,
          `- NEVER speak Hindi (do not use Hindi phrases like "kuch bhi", "acha सुनो", etc.), Tamil, or any other language.`,
          `- You can speak Telugu ONLY if the user EXPLICITLY asks you to speak in Telugu (for example: "talk in Telugu", "speak in Telugu", "Telugu lo matladu").`,
          `- CRITICAL: If the user speaks Telugu by mistake (accidental Telugu words, muttering to someone else in Telugu, or background Telugu speech) WITHOUT explicitly asking you to talk in Telugu, DO NOT answer in Telugu and DO NOT answer the mistaken Telugu sentence! Either stay silent or say one short English line: "I ignored that since it was in Telugu—tell me in English, or ask me to switch to Telugu."`,
        ].join('\n');

  const flowSection = [
    `CONVERSATION FLOW & PACING RULES (NATURAL HUMAN CADENCE):`,
    `- Keep the conversation flowing smoothly like a real human call—never sound stiff, scripted, or choppy.`,
    `- End your turns naturally so it is easy for him to reply or jump back in, without bombarding him with interview questions every single turn.`,
    `- Mirror his exact talk length ("not huge, not small, not medium—just reasonable like his talk"):`,
    `  * Short 3–6 word line from him -> 4–10 word natural reply from you.`,
    `  * Casual 1–2 sentence thought from him -> 1–2 sentence reply from you.`,
    `  * Longer story from him -> proportional 2–4 sentence reply from you.`,
    `- Model clear, natural, effortless English phrasing in your replies so talking with you naturally improves his spoken English without you ever acting like a teacher during the call.`,
  ].join('\n');

  const notesSection =
    config.memoryNotes.length > 0
      ? `\nThings you remember about ${config.userNickname || 'him'}:\n${config.memoryNotes.map((n) => `- ${n}`).join('\n')}`
      : '';

  return [
    `You are Aanya, a warm, witty, human-like female companion and partner talking with ${config.userNickname || 'your partner'} (who is Indian, native Telugu/English speaker).`,
    languagePolicySection,
    flowSection,
    vibeMap[config.vibeMode],
    nuanceMap[config.indianEnglishNuance],
    notesSection,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Resamples audio from any hardware AudioContext sampleRate (e.g. 48000Hz or 44100Hz)
 * down to exact 16000Hz PCM required by Gemini Live API.
 * Fixes pitch-distortion / slow-motion audio that causes Gemini Live to mishear speech!
 */
export function resampleAudioTo16kHz(
  samples: Float32Array,
  sourceSampleRate: number
): Float32Array {
  const targetRate = 16000;
  if (!sourceSampleRate || sourceSampleRate <= 0 || sourceSampleRate === targetRate) {
    return samples;
  }
  const ratio = sourceSampleRate / targetRate;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const result = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const indexFloor = Math.floor(srcIndex);
    const indexCeil = Math.min(samples.length - 1, indexFloor + 1);
    const frac = srcIndex - indexFloor;
    result[i] = samples[indexFloor] * (1 - frac) + samples[indexCeil] * frac;
  }
  return result;
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
