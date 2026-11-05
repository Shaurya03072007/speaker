import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

type LanguageGateMode = 'english-only-until-asked' | 'telugu-explicitly-enabled';

interface ManagedLiveSession {
  id: string;
  voiceName: 'Kore' | 'Zephyr';
  languageGate: LanguageGateMode;
  suppressCurrentTurn: boolean;
  currentTurnInputAcc: string;
  isClosed: boolean;
  lastActiveAt: number;
  eventsQueue: Array<Record<string, unknown>>;
  sessionPromise: Promise<any>;
  pushEvent: (ev: Record<string, unknown>) => void;
  close: () => void;
}

const EXPLICIT_TELUGU_RE =
  /\b(talk|speak|reply|answer|chat|switch|converse)\b.*\b(in\s+)?telugu\b|\btelugu\s+(lo|la)\s+(matladu|matladandi|cheppu|cheppandi)\b|\bcan\s+you\s+(speak|talk)\s+telugu\b|\btelugu\s+please\b/i;
const EXPLICIT_ENGLISH_RE =
  /\b(talk|speak|reply|answer|switch|back)\b.*\b(in\s+|to\s+)?english\b|\bonly\s+english\b|\benglish\s+only\b/i;
const TELUGU_SCRIPT_RE = /[\u0C00-\u0C7F]/;
const OTHER_INDIC_SCRIPT_RE = /[\u0900-\u0BFF\u0C80-\u0D7F]/; // Hindi/Devanagari, Tamil, Kannada, Malayalam
const ACCIDENTAL_ROMAN_TELUGU_RE =
  /^\s*(em\s+chestunnav|ela\s+unnav|enti\s+sangati|cheppu\s+ra|em\s+ledu|avuna|sare\s+le|ekkada\s+unnav|bojanam\s+chesava)(\s+ra|\s+amma|\s+babu)?\s*[?.!]*$/i;

function createManagedLiveSession(options: {
  voiceName: 'Kore' | 'Zephyr';
  languageGate: LanguageGateMode;
  systemInstruction: string;
  onEvent?: (ev: Record<string, unknown>) => void;
}): ManagedLiveSession {
  const id = crypto.randomUUID();
  const eventsQueue: Array<Record<string, unknown>> = [];

  const managed: ManagedLiveSession = {
    id,
    voiceName: options.voiceName,
    languageGate: options.languageGate,
    suppressCurrentTurn: false,
    currentTurnInputAcc: '',
    isClosed: false,
    lastActiveAt: Date.now(),
    eventsQueue,
    sessionPromise: Promise.resolve(null),
    pushEvent: (ev: Record<string, unknown>) => {
      if (managed.isClosed) return;
      managed.lastActiveAt = Date.now();
      if (options.onEvent) {
        options.onEvent(ev);
      } else {
        eventsQueue.push(ev);
        // Prevent unbounded memory growth if client stops polling
        if (eventsQueue.length > 600) {
          eventsQueue.splice(0, eventsQueue.length - 600);
        }
      }
    },
    close: () => {
      if (managed.isClosed) return;
      managed.isClosed = true;
      managed.sessionPromise
        .then((s) => {
          if (s && typeof s.close === 'function') {
            s.close();
          }
        })
        .catch(() => {});
    },
  };

  const ai = getGenAIClient();
  managed.sessionPromise = ai.live
    .connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: managed.voiceName,
            },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: options.systemInstruction,
      },
      callbacks: {
        onopen: () => {
          managed.pushEvent({
            type: 'ready',
            sessionId: managed.id,
            voiceName: managed.voiceName,
            model: 'gemini-3.8-live',
            languageGate: managed.languageGate,
          });
        },
        onmessage: (message: LiveServerMessage) => {
          const content = message.serverContent;
          if (!content) return;

          if (content.inputTranscription?.text) {
            const chunkText = content.inputTranscription.text;
            managed.currentTurnInputAcc += chunkText;

            if (EXPLICIT_ENGLISH_RE.test(managed.currentTurnInputAcc)) {
              managed.languageGate = 'english-only-until-asked';
              managed.suppressCurrentTurn = false;
              managed.pushEvent({
                type: 'languageGateChanged',
                languageGate: managed.languageGate,
              });
            } else if (EXPLICIT_TELUGU_RE.test(managed.currentTurnInputAcc)) {
              managed.languageGate = 'telugu-explicitly-enabled';
              managed.suppressCurrentTurn = false;
              managed.pushEvent({
                type: 'languageGateChanged',
                languageGate: managed.languageGate,
              });
            } else if (managed.languageGate === 'english-only-until-asked') {
              if (
                TELUGU_SCRIPT_RE.test(managed.currentTurnInputAcc) ||
                OTHER_INDIC_SCRIPT_RE.test(managed.currentTurnInputAcc) ||
                ACCIDENTAL_ROMAN_TELUGU_RE.test(managed.currentTurnInputAcc.trim())
              ) {
                managed.suppressCurrentTurn = true;
                managed.pushEvent({
                  type: 'suppressedAccidentalTelugu',
                  text: managed.currentTurnInputAcc.trim(),
                });
                return;
              }
            }

            managed.pushEvent({
              type: 'inputTranscript',
              text: chunkText,
            });
          }

          if (managed.suppressCurrentTurn) {
            if (content.turnComplete) {
              managed.suppressCurrentTurn = false;
              managed.currentTurnInputAcc = '';
              managed.pushEvent({ type: 'turnComplete' });
            }
            return;
          }

          if (content.outputTranscription?.text) {
            const outText = content.outputTranscription.text;
            if (
              OTHER_INDIC_SCRIPT_RE.test(outText) ||
              (managed.languageGate === 'english-only-until-asked' &&
                TELUGU_SCRIPT_RE.test(outText))
            ) {
              managed.suppressCurrentTurn = true;
              managed.pushEvent({ type: 'interrupted' });
              return;
            }
            managed.pushEvent({
              type: 'outputTranscript',
              text: outText,
            });
          }

          for (const part of content.modelTurn?.parts ?? []) {
            if (part.inlineData?.data && !managed.suppressCurrentTurn) {
              managed.pushEvent({
                type: 'audio',
                audio: part.inlineData.data,
              });
            }
            if (part.text && !managed.suppressCurrentTurn) {
              managed.pushEvent({
                type: 'modelText',
                text: part.text,
              });
            }
          }

          if (content.interrupted) {
            managed.pushEvent({ type: 'interrupted' });
          }

          if (content.turnComplete) {
            managed.suppressCurrentTurn = false;
            managed.currentTurnInputAcc = '';
            managed.pushEvent({ type: 'turnComplete' });
          }
        },
        onerror: (err: unknown) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          managed.pushEvent({
            type: 'error',
            message: errMsg || 'Live voice session encountered an error.',
          });
        },
        onclose: (ev: any) => {
          const reason = ev?.reason ? String(ev.reason) : '';
          if (reason && !managed.isClosed) {
            managed.pushEvent({
              type: 'error',
              message: `Gemini Live session closed: ${reason}`,
            });
          }
          managed.pushEvent({ type: 'closed' });
        },
      },
    })
    .catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      managed.pushEvent({
        type: 'error',
        message:
          errMsg ||
          'Unable to connect to Gemini Live. Please verify GEMINI_API_KEY in Settings > Secrets.',
      });
      return null;
    });

  return managed;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Active HTTP-bridged Gemini Live sessions (works reliably behind HTTP/1.0 Nginx reverse proxies)
  const liveSessions = new Map<string, ManagedLiveSession>();

  // Clean up stale HTTP live sessions every 60s
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of liveSessions.entries()) {
      if (session.isClosed || now - session.lastActiveAt > 5 * 60 * 1000) {
        session.close();
        liveSessions.delete(id);
      }
    }
  }, 60_000).unref();

  // 1. Start a new Gemini Live session over HTTP (bypasses proxy WebSocket upgrade issues)
  app.post('/api/live/start', async (req, res) => {
    try {
      const {
        voiceName = 'Kore',
        languageGate = 'english-only-until-asked',
        systemInstruction = '',
      } = req.body || {};

      const chosenVoice: 'Kore' | 'Zephyr' = voiceName === 'Zephyr' ? 'Zephyr' : 'Kore';
      const chosenGate: LanguageGateMode =
        languageGate === 'telugu-explicitly-enabled'
          ? 'telugu-explicitly-enabled'
          : 'english-only-until-asked';

      const instruction =
        typeof systemInstruction === 'string' && systemInstruction.trim()
          ? systemInstruction
          : 'You are Aanya, a warm, witty female partner. Speak ONLY in English unless explicitly asked to speak in Telugu. Mirror the exact length and casual energy of the user.';

      const managed = createManagedLiveSession({
        voiceName: chosenVoice,
        languageGate: chosenGate,
        systemInstruction: instruction,
      });

      const liveConn = await managed.sessionPromise;
      if (!liveConn) {
        const errEv = managed.eventsQueue.find((e) => e.type === 'error');
        res.status(500).json({
          error:
            (errEv?.message as string) ||
            'Could not open Gemini Live session. Please check GEMINI_API_KEY.',
        });
        return;
      }

      liveSessions.set(managed.id, managed);
      const initialEvents = managed.eventsQueue.splice(0, managed.eventsQueue.length);

      res.json({
        ok: true,
        sessionId: managed.id,
        voiceName: chosenVoice,
        languageGate: chosenGate,
        model: 'gemini-3.8-live',
        events: initialEvents,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        error: errMsg || 'Failed to initialize Gemini Live session.',
      });
    }
  });

  // 2. Send realtime audio / text / languageGate update to an active Gemini Live session
  app.post('/api/live/send', async (req, res) => {
    try {
      const { sessionId, audio, audioChunks, text, languageGate } = req.body || {};
      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ error: 'Missing sessionId' });
        return;
      }

      const managed = liveSessions.get(sessionId);
      if (!managed || managed.isClosed) {
        res.status(404).json({ error: 'Live session expired or closed.', closed: true });
        return;
      }

      managed.lastActiveAt = Date.now();

      if (
        languageGate === 'telugu-explicitly-enabled' ||
        languageGate === 'english-only-until-asked'
      ) {
        managed.languageGate = languageGate;
      }

      const session = await managed.sessionPromise;
      if (!session) {
        res.status(500).json({ error: 'Gemini Live session is not active.' });
        return;
      }

      if (Array.isArray(audioChunks)) {
        for (const chunk of audioChunks) {
          if (typeof chunk === 'string' && chunk) {
            session.sendRealtimeInput({
              audio: {
                data: chunk,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          }
        }
      } else if (typeof audio === 'string' && audio) {
        session.sendRealtimeInput({
          audio: {
            data: audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      }

      if (typeof text === 'string' && text.trim()) {
        session.sendRealtimeInput({
          text: text.trim(),
        });
      }

      const events = managed.eventsQueue.splice(0, managed.eventsQueue.length);
      res.json({
        ok: true,
        events,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errMsg });
    }
  });

  // 3. Drain queued realtime audio & transcript events from an active Gemini Live session
  app.get('/api/live/events', (req, res) => {
    const sessionId = String(req.query.sessionId || '');
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    const managed = liveSessions.get(sessionId);
    if (!managed) {
      res.status(404).json({ error: 'Session not found', closed: true });
      return;
    }

    managed.lastActiveAt = Date.now();
    const events = managed.eventsQueue.splice(0, managed.eventsQueue.length);

    res.json({
      ok: true,
      closed: managed.isClosed,
      events,
    });
  });

  // 4. Close an active Gemini Live session
  app.post('/api/live/stop', (req, res) => {
    const { sessionId } = req.body || {};
    if (sessionId && typeof sessionId === 'string') {
      const managed = liveSessions.get(sessionId);
      if (managed) {
        managed.close();
        liveSessions.delete(sessionId);
      }
    }
    res.json({ ok: true });
  });

  // Direct WebSocket upgrade on /live (for direct non-proxied environments)
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs: WebSocket, request) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const initialVoice = url.searchParams.get('voice') === 'Zephyr' ? 'Zephyr' : 'Kore';
    const initialGate: LanguageGateMode =
      url.searchParams.get('languageGate') === 'telugu-explicitly-enabled'
        ? 'telugu-explicitly-enabled'
        : 'english-only-until-asked';

    let managed: ManagedLiveSession | null = null;

    const sendSafe = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    clientWs.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        if (msg.type === 'init') {
          const voiceName: 'Kore' | 'Zephyr' =
            msg.voiceName === 'Zephyr' ? 'Zephyr' : initialVoice;
          const gate: LanguageGateMode =
            msg.languageGate === 'telugu-explicitly-enabled'
              ? 'telugu-explicitly-enabled'
              : initialGate;
          const systemInstruction: string =
            typeof msg.systemInstruction === 'string' && msg.systemInstruction.trim()
              ? msg.systemInstruction
              : 'You are Aanya, a warm, witty female partner. Speak ONLY in English unless explicitly asked to speak in Telugu. Mirror the exact length and casual energy of the user.';

          managed = createManagedLiveSession({
            voiceName,
            languageGate: gate,
            systemInstruction,
            onEvent: sendSafe,
          });
          await managed.sessionPromise;
          return;
        }

        if (msg.type === 'setLanguageGate' && managed) {
          if (
            msg.languageGate === 'telugu-explicitly-enabled' ||
            msg.languageGate === 'english-only-until-asked'
          ) {
            managed.languageGate = msg.languageGate;
          }
          return;
        }

        if (!managed) {
          managed = createManagedLiveSession({
            voiceName: initialVoice,
            languageGate: initialGate,
            systemInstruction:
              'You are Aanya, a warm, witty female partner. Speak ONLY in English unless explicitly asked to speak in Telugu. Mirror the exact length and casual energy of the user.',
            onEvent: sendSafe,
          });
        }

        const session = await managed.sessionPromise;
        if (!session) return;

        if (msg.audio) {
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (typeof msg.text === 'string' && msg.text.trim()) {
          session.sendRealtimeInput({
            text: msg.text.trim(),
          });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        sendSafe({ type: 'error', message: errMsg });
      }
    });

    clientWs.on('close', () => {
      if (managed) {
        managed.close();
      }
    });
  });

  // Companion text + voice banter endpoint with strict English/Telugu-only-when-asked gate
  app.post('/api/companion/banter', async (req, res) => {
    try {
      const {
        userText,
        systemInstruction,
        voiceName = 'Kore',
        allowedLanguage = 'english',
        history = [],
        targetMin = 5,
        targetMax = 18,
        speakReply = true,
      } = req.body || {};

      if (!userText || typeof userText !== 'string' || !userText.trim()) {
        res.status(400).json({ error: 'Please say or type something first.' });
        return;
      }

      const ai = getGenAIClient();
      const chosenVoice: 'Kore' | 'Zephyr' = voiceName === 'Zephyr' ? 'Zephyr' : 'Kore';

      const recentContext = Array.isArray(history)
        ? history
            .slice(-8)
            .map(
              (h: { speaker?: string; text?: string }) =>
                `${h.speaker === 'user' ? 'Partner' : 'Aanya'}: ${h.text || ''}`
            )
            .join('\n')
        : '';

      const languageRule =
        allowedLanguage === 'telugu'
          ? `LANGUAGE RULE: He has explicitly asked for Telugu! Reply naturally in conversational Telugu (or smooth Telugu-English mix as fits his sentence). NEVER use Hindi or any other language.`
          : `LANGUAGE RULE: Reply strictly in 100% natural, clear English ONLY. NEVER use Hindi words (no "yaar", "arey", "acha", "matlab", "kuch bhi") and do NOT use Telugu unless he explicitly asks to speak in Telugu.`;

      const prompt = [
        recentContext ? `Recent conversation:\n${recentContext}\n` : '',
        `He just said (${userText.trim().split(/\s+/).length} words): "${userText.trim()}"`,
        languageRule,
        `FLOW & PACING RULE: Keep the conversation flowing smoothly like a real human partner on a phone call. Connect directly to what he just said, match his exact length and vibe (aim for ${targetMin} to ${targetMax} words—not huge, not tiny, not a stiff paragraph), and output ONLY what Aanya says aloud.`,
      ]
        .filter(Boolean)
        .join('\n');

      const textResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            systemInstruction ||
            'You are Aanya, a warm, witty female partner. Speak ONLY in English unless explicitly asked to speak in Telugu. Mirror the user length and keep the conversation flowing naturally.',
        },
      });

      const replyText = (textResponse.text || '').trim().replace(/^["']|["']$/g, '');

      let wavBase64: string | null = null;
      if (speakReply && replyText) {
        try {
          const ttsInteraction = await ai.interactions.create({
            model: 'gemini-3.8-flash-lite-tts',
            input: [
              {
                type: 'text',
                text: replyText,
                annotations: [
                  {
                    type: 'speech_metadata',
                    style:
                      chosenVoice === 'Zephyr'
                        ? 'Warm, playful, lively young Indian woman speaking natural conversational English'
                        : 'Warm, grounded, affectionate young Indian woman speaking natural conversational English',
                  },
                ],
              },
            ],
            response_format: { type: 'audio' },
            generation_config: {
              speech_config: [
                {
                  language: allowedLanguage === 'telugu' ? 'te-IN' : 'en-IN',
                  voice: chosenVoice,
                },
              ],
            },
          });
          if (ttsInteraction.output_audio?.data) {
            wavBase64 = ttsInteraction.output_audio.data;
          }
        } catch {
          // Non-fatal if TTS audio synthesis fails; still return text reply
        }
      }

      res.json({
        replyText,
        wavBase64,
        voiceName: chosenVoice,
        languageUsed: allowedLanguage === 'telugu' ? 'TE' : 'EN',
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        error:
          errMsg ||
          'Could not reach Gemini API. Please check your GEMINI_API_KEY in Settings > Secrets.',
      });
    }
  });

  // Deep English & Conversation Clarity Analysis on Verbatim Call Text using gemini-3.1-flash-lite
  app.post('/api/companion/analyze-english', async (req, res) => {
    try {
      const {
        callTitle = 'Recorded Call',
        userUtterances = [],
        fullTurns = [],
        coachingFocus = 'sentence-clarity',
      } = req.body || {};

      if (!Array.isArray(userUtterances) || userUtterances.length === 0) {
        res.status(400).json({
          error: 'No spoken text found in this call record yet. Speak or type a few lines first.',
        });
        return;
      }

      const ai = getGenAIClient();
      const verbatimBlock = userUtterances
        .map((line: string, i: number) => `${i + 1}. "${line}"`)
        .join('\n');

      const dialogueContext = Array.isArray(fullTurns)
        ? fullTurns
            .map(
              (t: { speaker?: string; text?: string }) =>
                `${t.speaker === 'user' ? 'User (Exact Spoken Text)' : 'Aanya'}: "${t.text || ''}"`
            )
            .join('\n')
        : verbatimBlock;

      const focusInstruction =
        coachingFocus === 'fluency-flow'
          ? 'Focus deeply on conversational rhythm, hesitation/filler patterns, and smooth sentence transitions.'
          : coachingFocus === 'natural-vocabulary'
          ? 'Focus deeply on word choice, natural idioms, and replacing repetitive phrasing with effortless everyday English.'
          : 'Focus deeply on conversation clarity, direct sentence framing, and untangling run-on or half-finished thoughts.';

      const prompt = [
        `You are an expert English communication coach for an Indian English speaker who talks casually (sometimes rambling or talking playful nonsense) with his companion Aanya.`,
        `Below is the EXACT verbatim text that came out of his mouth during "${callTitle}" (no audio recording, text-only transcript):`,
        `\n--- EXACT SPOKEN LINES FROM USER ---\n${verbatimBlock}`,
        `\n--- FULL CONVERSATION CONTEXT ---\n${dialogueContext}`,
        `\n${focusInstruction}`,
        `Perform a deep, constructive analysis of how he speaks—his conversation clarity, sentence framing, grammar flow, Indian-English charm vs. moments where his point gets slightly unclear, and give concrete line-by-line upgrades that still sound like a real human (never stiff textbook English).`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallAssessment: {
                type: Type.STRING,
                description:
                  'Warm, honest 2-3 sentence summary of how he sounds and communicates overall.',
              },
              clarityScore: {
                type: Type.INTEGER,
                description: 'Conversation clarity score from 0 to 100.',
              },
              fluencyAndFlowScore: {
                type: Type.INTEGER,
                description: 'Fluency and natural rhythm score from 0 to 100.',
              },
              grammarAndStructureScore: {
                type: Type.INTEGER,
                description: 'Sentence framing and grammar structure score from 0 to 100.',
              },
              speakingStyleSummary: {
                type: Type.STRING,
                description:
                  'Detailed observation of the way he speaks, his pacing, and how he frames thoughts.',
              },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 specific strengths in his current conversational English.',
              },
              habitsToRefine: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 specific speaking or sentence-framing habits he can sharpen.',
              },
              lineByLineUpgrades: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    exactSpokenText: { type: Type.STRING },
                    diagnosis: { type: Type.STRING },
                    casualNaturalUpgrade: { type: Type.STRING },
                    polishedFluentUpgrade: { type: Type.STRING },
                  },
                  required: [
                    'exactSpokenText',
                    'diagnosis',
                    'casualNaturalUpgrade',
                    'polishedFluentUpgrade',
                  ],
                },
              },
              nextCallMicroDrills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 practical speaking habits to try in his next call with Aanya.',
              },
            },
            required: [
              'overallAssessment',
              'clarityScore',
              'fluencyAndFlowScore',
              'grammarAndStructureScore',
              'speakingStyleSummary',
              'strengths',
              'habitsToRefine',
              'lineByLineUpgrades',
              'nextCallMicroDrills',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        report: {
          ...parsed,
          analyzedByModel: 'gemini-3.1-flash-lite',
          analyzedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        error:
          errMsg ||
          'Could not run Gemini Flash Lite analysis. Please check GEMINI_API_KEY in Settings > Secrets.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
