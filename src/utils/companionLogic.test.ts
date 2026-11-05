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
} from './companionLogic';

test('countWords accurately counts words in casual Indian-English sentences', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords('Arey yaar what is happening'), 5);
  assert.equal(countWords('I swear pigeons are secretly judging my driving today.'), 9);
});

test('computeTargetWordRange adapts dynamically to short, casual, and longer inputs', () => {
  const shortRange = computeTargetWordRange('Yaar I am bored');
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
  const userTurn = 'Yaar why do ceiling fans look so philosophical at 1 AM?';
  const proportionalReply = 'Arey because at 1 AM your brain is running on zero battery and pure vibes.';
  const metrics = analyzeTurnMirroring(userTurn, proportionalReply);
  assert.equal(metrics.fitLabel, 'Proportional Match');

  const tinyReply = 'Haha.';
  const conciseMetrics = analyzeTurnMirroring(userTurn, tinyReply);
  assert.equal(conciseMetrics.fitLabel, 'Slightly Concise');

  const hugeReply = Array.from({ length: 45 }, () => 'word').join(' ');
  const expandedMetrics = analyzeTurnMirroring(userTurn, hugeReply);
  assert.equal(expandedMetrics.fitLabel, 'Slightly Expanded');
});

test('buildCompanionSystemInstruction includes female persona, length mirroring, and memory notes', () => {
  const prompt = buildCompanionSystemInstruction({
    voiceName: 'Kore',
    vibeMode: 'banter',
    userNickname: 'Shaurya',
    indianEnglishNuance: 'natural',
    memoryNotes: ['Drinks ginger chai at midnight', 'Talks random nonsense when tired'],
    englishCoachingFocus: 'sentence-clarity',
  });

  assert.ok(prompt.includes('Aanya'));
  assert.ok(prompt.includes('Shaurya'));
  assert.ok(prompt.includes('MIRROR HIS LENGTH AND PACE'));
  assert.ok(prompt.includes('Drinks ginger chai at midnight'));
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
  // 0.8 * 2.0 = 1.6, soft limiter keeps it strictly <= 1.0 and > 0.85
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
      text: 'Arey that happens to everyone yaar when your brain runs faster than your mouth.',
      timestamp: '10:00 PM',
      wordCount: 14,
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
