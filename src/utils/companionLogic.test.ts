import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords,
  computeTargetWordRange,
  analyzeTurnMirroring,
  buildCompanionSystemInstruction,
  float32ToInt16Pcm,
  int16PcmToFloat32,
  applyAudioBoostToSamples,
  buildCallRecordFromMessages,
  evaluateLanguagePolicy,
  resampleAudioTo16kHz,
} from './companionLogic';

test('countWords accurately counts words in casual Indian-English sentences', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords('Hey what is happening today'), 5);
  assert.equal(countWords('I swear pigeons are secretly judging my driving today.'), 9);
});

test('computeTargetWordRange adapts dynamically to short, casual, and longer inputs', () => {
  const shortRange = computeTargetWordRange('Man I am bored');
  assert.equal(shortRange.userWords, 4);
  assert.equal(shortRange.pacingLabel, 'Quick quip');
  assert.ok(shortRange.minTargetWords <= 4 && shortRange.maxTargetWords >= 8);

  const casualRange = computeTargetWordRange(
    'Honestly I was thinking what if we opened a midnight Maggi stall on the highway and just quit everything'
  );
  assert.equal(casualRange.pacingLabel, 'Story flow');
  assert.ok(casualRange.minTargetWords >= 12);
});

test('analyzeTurnMirroring classifies proportional vs too short or too long replies', () => {
  const userTurn = 'Why do ceiling fans look so philosophical at 1 AM?';
  const proportionalReply = 'Because at 1 AM your brain is running on zero battery and pure vibes.';
  const metrics = analyzeTurnMirroring(userTurn, proportionalReply);
  assert.equal(metrics.fitLabel, 'Proportional Match');

  const tinyReply = 'Haha.';
  const conciseMetrics = analyzeTurnMirroring(userTurn, tinyReply);
  assert.equal(conciseMetrics.fitLabel, 'Slightly Concise');

  const hugeReply = Array.from({ length: 45 }, () => 'word').join(' ');
  const expandedMetrics = analyzeTurnMirroring(userTurn, hugeReply);
  assert.equal(expandedMetrics.fitLabel, 'Slightly Expanded');
});

test('buildCompanionSystemInstruction enforces strict English/Telugu-only-when-asked rule', () => {
  const prompt = buildCompanionSystemInstruction({
    voiceName: 'Kore',
    vibeMode: 'banter',
    userNickname: 'Shaurya',
    indianEnglishNuance: 'natural',
    languageGate: 'english-only-until-asked',
    memoryNotes: ['Drinks ginger chai at midnight'],
    englishCoachingFocus: 'sentence-clarity',
  });

  assert.ok(prompt.includes('Aanya'));
  assert.ok(prompt.includes('STRICT LANGUAGE RULE (ENGLISH ONLY — IGNORE ACCIDENTAL TELUGU)'));
  assert.ok(prompt.includes('NEVER speak Hindi'));
});

test('evaluateLanguagePolicy blocks accidental Telugu when not requested, and unlocks Telugu only when asked', () => {
  // 1. Normal English sentence -> allowed in English
  const englishTurn = evaluateLanguagePolicy(
    'I had a crazy day in traffic today',
    'english-only-until-asked'
  );
  assert.equal(englishTurn.allowedLanguage, 'english');
  assert.equal(englishTurn.shouldSuppressAccidentalTelugu, false);

  // 2. Accidental Telugu script or phrase spoken by mistake -> suppressed!
  const accidentalScript = evaluateLanguagePolicy(
    'ఏం చేస్తున్నావ్ అక్కడ',
    'english-only-until-asked'
  );
  assert.equal(accidentalScript.shouldSuppressAccidentalTelugu, true);

  const accidentalRoman = evaluateLanguagePolicy(
    'em chestunnav ra',
    'english-only-until-asked'
  );
  assert.equal(accidentalRoman.shouldSuppressAccidentalTelugu, true);

  // 3. Explicit request to speak Telugu -> unlocks Telugu mode
  const explicitRequest = evaluateLanguagePolicy(
    'Hey Aanya, can you talk in Telugu for a bit?',
    'english-only-until-asked'
  );
  assert.equal(explicitRequest.allowedLanguage, 'telugu');
  assert.equal(explicitRequest.nextGateMode, 'telugu-explicitly-enabled');
  assert.equal(explicitRequest.shouldSuppressAccidentalTelugu, false);

  // 4. Subsequent Telugu turn once Telugu is enabled -> allowed!
  const allowedTelugu = evaluateLanguagePolicy(
    'ఏం చేస్తున్నావ్',
    explicitRequest.nextGateMode
  );
  assert.equal(allowedTelugu.allowedLanguage, 'telugu');
  assert.equal(allowedTelugu.shouldSuppressAccidentalTelugu, false);

  // 5. Explicit switch back to English -> locks back to English-only
  const switchBack = evaluateLanguagePolicy(
    'Let us switch back to English only now',
    'telugu-explicitly-enabled'
  );
  assert.equal(switchBack.allowedLanguage, 'english');
  assert.equal(switchBack.nextGateMode, 'english-only-until-asked');
});

test('resampleAudioTo16kHz downsamples 48kHz audio to exact 16kHz length', () => {
  const input48k = new Float32Array(4800);
  for (let i = 0; i < input48k.length; i++) {
    input48k[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
  }
  const output16k = resampleAudioTo16kHz(input48k, 48000);
  assert.equal(output16k.length, 1600);
});

test('PCM audio conversion round-trips Float32 and Int16 accurately', () => {
  const samples = new Float32Array([-1.0, -0.5, 0, 0.5, 1.0]);
  const int16 = float32ToInt16Pcm(samples);
  assert.equal(int16[0], -32768);
  assert.equal(int16[2], 0);
  assert.equal(int16[4], 32767);

  const restored = int16PcmToFloat32(int16);
  assert.ok(Math.abs(restored[0] - -1.0) < 0.001);
  assert.ok(Math.abs(restored[1] - -0.5) < 0.001);
  assert.equal(restored[2], 0);
  assert.ok(Math.abs(restored[3] - 0.5) < 0.001);
  assert.ok(Math.abs(restored[4] - 1.0) < 0.001);
});

test('applyAudioBoostToSamples amplifies quiet signals and soft-limits peaks without clipping', () => {
  const quiet = new Float32Array([0.2, -0.2, 0.8]);
  const boosted = applyAudioBoostToSamples(quiet, 2.0);
  assert.ok(Math.abs(boosted[0] - 0.4) < 0.001);
  assert.ok(Math.abs(boosted[1] - -0.4) < 0.001);
  assert.ok(boosted[2] > 0.85 && boosted[2] <= 1.0);
});

test('buildCallRecordFromMessages extracts only verbatim text utterances with word counts', () => {
  const record = buildCallRecordFromMessages([
    {
      id: '1',
      speaker: 'user',
      text: 'Actually I am thinking why my English gets stuck when I talk fast.',
      timestamp: '10:00 PM',
      wordCount: 13,
      via: 'voice',
    },
    {
      id: '2',
      speaker: 'partner',
      text: 'That happens to everyone when your brain runs faster than your mouth.',
      timestamp: '10:00 PM',
      wordCount: 12,
      via: 'voice',
    },
  ]);

  assert.equal(record.userUtterances.length, 1);
  assert.equal(
    record.userUtterances[0],
    'Actually I am thinking why my English gets stuck when I talk fast.'
  );
  assert.equal(record.totalUserWords, 13);
});
