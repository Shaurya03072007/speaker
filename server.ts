import 'dotenv/config';
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Upgrade HTTP to WebSocket on /live for Gemini Live API
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

    let sessionPromise: Promise<any> | null = null;
    let isClosed = false;

    const sendSafe = (payload: Record<string, unknown>) => {
      if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const connectLiveSession = (voiceName: 'Kore' | 'Zephyr', systemInstruction: string) => {
      if (sessionPromise) return sessionPromise;

      const ai = getGenAIClient();
      sessionPromise = ai.live
        .connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
          },
          callbacks: {
            onopen: () => {
              sendSafe({ type: 'ready', voiceName, model: 'gemini-3.8-live' });
            },
            onmessage: (message: LiveServerMessage) => {
              const content = message.serverContent;
              if (!content) return;

              if (content.inputTranscription?.text) {
                sendSafe({
                  type: 'inputTranscript',
                  text: content.inputTranscription.text,
                });
              }

              if (content.outputTranscription?.text) {
                sendSafe({
                  type: 'outputTranscript',
                  text: content.outputTranscription.text,
                });
              }

              for (const part of content.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  sendSafe({
                    type: 'audio',
                    audio: part.inlineData.data,
                  });
                }
                if (part.text) {
                  sendSafe({
                    type: 'modelText',
                    text: part.text,
                  });
                }
              }

              if (content.interrupted) {
                sendSafe({ type: 'interrupted' });
              }

              if (content.turnComplete) {
                sendSafe({ type: 'turnComplete' });
              }
            },
            onerror: (err: unknown) => {
              const errMsg = err instanceof Error ? err.message : String(err);
              sendSafe({ type: 'error', message: errMsg || 'Live voice session encountered an error.' });
            },
            onclose: () => {
              sendSafe({ type: 'closed' });
            },
          },
        })
        .catch((err: unknown) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          sendSafe({
            type: 'error',
            message: errMsg || 'Unable to connect to Gemini Live. Please verify GEMINI_API_KEY in Settings > Secrets.',
          });
          throw err;
        });

      return sessionPromise;
    };

    clientWs.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        if (msg.type === 'init') {
          const voiceName: 'Kore' | 'Zephyr' = msg.voiceName === 'Zephyr' ? 'Zephyr' : initialVoice;
          const systemInstruction: string =
            typeof msg.systemInstruction === 'string' && msg.systemInstruction.trim()
              ? msg.systemInstruction
              : 'You are Aanya, a warm, witty Indian-English speaking female partner. Mirror the exact length and casual energy of the user.';
          await connectLiveSession(voiceName, systemInstruction);
          return;
        }

        if (!sessionPromise) {
          await connectLiveSession(
            initialVoice,
            'You are Aanya, a warm, witty Indian-English speaking female partner. Mirror the exact length and casual energy of the user.'
          );
        }

        const session = await sessionPromise;
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
      isClosed = true;
      if (sessionPromise) {
        sessionPromise
          .then((session) => {
            if (session && typeof session.close === 'function') {
              session.close();
            }
          })
          .catch(() => {});
      }
    });
  });

  // Companion text + voice banter endpoint for instant text or voice-spark turns
  app.post('/api/companion/banter', async (req, res) => {
    try {
      const {
        userText,
        systemInstruction,
        voiceName = 'Kore',
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
            .slice(-6)
            .map((h: { speaker?: string; text?: string }) =>
              `${h.speaker === 'user' ? 'Partner' : 'Aanya'}: ${h.text || ''}`
            )
            .join('\n')
        : '';

      const prompt = [
        recentContext ? `Recent conversation:\n${recentContext}\n` : '',
        `He just said (${userText.trim().split(/\s+/).length} words): "${userText.trim()}"`,
        `Reply naturally as Aanya in English (Indian conversational rapport).`,
        `Match his length and energy: aim for roughly ${targetMin} to ${targetMax} words—not huge, not tiny, not a stiff medium paragraph, just reasonable and human like his talk. Output ONLY what Aanya says aloud.`,
      ]
        .filter(Boolean)
        .join('\n');

      const textResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            systemInstruction ||
            'You are Aanya, a warm, witty Indian-English speaking female partner. Mirror the user length and casual banter.',
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
                        ? 'Warm, playful, lively young Indian woman speaking casual conversational English'
                        : 'Warm, grounded, affectionate young Indian woman speaking natural conversational English',
                  },
                ],
              },
            ],
            response_format: { type: 'audio' },
            generation_config: {
              speech_config: [
                {
                  language: 'en-IN',
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
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        error: errMsg || 'Could not reach Gemini API. Please check your GEMINI_API_KEY in Settings > Secrets.',
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
                description: 'Warm, honest 2-3 sentence summary of how he sounds and communicates overall.',
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
                description: 'Detailed observation of the way he speaks, his pacing, and how he frames thoughts.',
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
      server: { middlewareMode: true },
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
