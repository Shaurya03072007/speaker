import React from 'react';
import {
  FileText,
  Sparkles,
  Volume2,
  CheckCircle2,
  ArrowUpRight,
  PlusCircle,
  AlertCircle,
} from 'lucide-react';
import {
  CallSessionRecord,
  CompanionConfig,
} from '../utils/companionLogic';

interface EnglishCoachPanelProps {
  callRecords: CallSessionRecord[];
  selectedCallId: string;
  coachingFocus: CompanionConfig['englishCoachingFocus'];
  isAnalyzing: boolean;
  analysisError: string | null;
  onSelectCall: (id: string) => void;
  onChangeCoachingFocus: (focus: CompanionConfig['englishCoachingFocus']) => void;
  onSaveCurrentCallRecord: () => void;
  onAnalyzeSelectedCall: (callId: string) => Promise<void>;
  onSpeakUpgradeLine: (text: string) => void;
}

export const EnglishCoachPanel: React.FC<EnglishCoachPanelProps> = ({
  callRecords,
  selectedCallId,
  coachingFocus,
  isAnalyzing,
  analysisError,
  onSelectCall,
  onChangeCoachingFocus,
  onSaveCurrentCallRecord,
  onAnalyzeSelectedCall,
  onSpeakUpgradeLine,
}) => {
  const selectedCall =
    callRecords.find((c) => c.id === selectedCallId) || callRecords[0] || null;
  const report = selectedCall?.analysisReport;

  return (
    <section
      aria-label="Verbatim Call Recorder and Gemini Flash Lite English Coach"
      className="bg-white border border-stone-200 rounded-xl p-6 space-y-6"
    >
      {/* Top Header: Verbatim Text-Only Recording Guarantee + Save Current Call Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-stone-900">
              Recorded Call Text & Deep English Clarity Coach
            </h3>
            <span className="text-stone-300" aria-hidden="true">·</span>
            <span className="text-xs font-mono text-amber-900 tabular-nums">
              gemini-3.1-flash-lite
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Records the exact words coming from your mouth as text only (zero voice/audio file recording) so Gemini Flash Lite can deeply analyze your conversation clarity, sentence framing, and speaking flow.
          </p>
        </div>

        <button
          type="button"
          onClick={onSaveCurrentCallRecord}
          className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5 text-amber-800" />
          <span>Snapshot Current Call Text</span>
        </button>
      </div>

      {/* Recorded Call Selector Strip + Coaching Focus Switcher */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left: Recorded Calls List (Text-Only) */}
        <div className="md:col-span-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="font-semibold text-stone-800">
              Recorded Calls (Exact Spoken Text)
            </span>
            <span className="tabular-nums">{callRecords.length} saved</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {callRecords.map((call) => {
              const isSelected = selectedCall?.id === call.id;
              return (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => onSelectCall(call.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/70 border-amber-700 text-stone-900'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">
                      {call.title}
                    </span>
                    <span className="text-xs text-stone-500 font-mono tabular-nums whitespace-nowrap shrink-0">
                      {call.totalUserWords}w
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 mt-1 tabular-nums">
                    <span className="whitespace-nowrap">{call.recordedAt}</span>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap">{call.userUtterances.length} lines</span>
                    {call.analysisReport && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 font-medium whitespace-nowrap">
                          Clarity {call.analysisReport.clarityScore}/100
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Verbatim Words From Your Mouth in Selected Call + Analyze Trigger */}
        <div className="md:col-span-7 bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-4">
          {selectedCall ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
                <div>
                  <h4 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-800" />
                    <span>Exact Words Spoken By You</span>
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
                    {selectedCall.recordedAt} · {selectedCall.userUtterances.length} utterances · {selectedCall.totalUserWords} words total · No audio stored
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => onAnalyzeSelectedCall(selectedCall.id)}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {isAnalyzing
                      ? 'Analyzing with Flash Lite...'
                      : 'Deep Analyze My English'}
                  </span>
                </button>
              </div>

              {/* Coaching Focus Segmented Control */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-stone-700">
                  Deep Research & Analysis Focus:
                </span>
                <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-lg">
                  {(
                    [
                      { id: 'sentence-clarity', label: 'Conversation Clarity' },
                      { id: 'fluency-flow', label: 'Speaking Flow' },
                      { id: 'natural-vocabulary', label: 'Natural Phrasing' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangeCoachingFocus(item.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        coachingFocus === item.id
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verbatim Spoken Lines List */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {selectedCall.userUtterances.map((utterance, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-800 flex items-start gap-2"
                  >
                    <span className="font-mono text-stone-400 tabular-nums shrink-0">
                      0{idx + 1}.
                    </span>
                    <span className="leading-relaxed">“{utterance}”</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-stone-500">
              No recorded calls yet. Start talking with Aanya to record your spoken text.
            </p>
          )}
        </div>
      </div>

      {analysisError && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-amber-900"
        >
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>{analysisError}</span>
        </div>
      )}

      {/* Deep English & Conversation Clarity Report */}
      {report && (
        <div
          data-testid="english-clarity-report"
          className="pt-4 border-t border-stone-200 space-y-6"
        >
          {/* Scoreboard Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <div className="text-xs text-stone-500 font-medium">
                Conversation Clarity
              </div>
              <div className="text-2xl font-semibold text-stone-900 mt-1 font-mono tabular-nums">
                {report.clarityScore}
                <span className="text-sm font-normal text-stone-500"> / 100</span>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                How directly and clearly your ideas land
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <div className="text-xs text-stone-500 font-medium">
                Fluency & Speaking Flow
              </div>
              <div className="text-2xl font-semibold text-stone-900 mt-1 font-mono tabular-nums">
                {report.fluencyAndFlowScore}
                <span className="text-sm font-normal text-stone-500"> / 100</span>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                Natural rhythm, transitions & comfort
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <div className="text-xs text-stone-500 font-medium">
                Sentence Framing & Grammar
              </div>
              <div className="text-2xl font-semibold text-stone-900 mt-1 font-mono tabular-nums">
                {report.grammarAndStructureScore}
                <span className="text-sm font-normal text-stone-500"> / 100</span>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                Tense consistency & clean structure
              </p>
            </div>
          </div>

          {/* Overall Assessment & The Way You Speak */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-amber-50/40 border border-amber-200/80 rounded-lg p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-amber-900">
                <span className="font-semibold">How You Sound Overall</span>
                <span className="font-mono tabular-nums">
                  Analyzed by {report.analyzedByModel} · {report.analyzedAt}
                </span>
              </div>
              <p className="text-sm text-stone-800 leading-relaxed">
                {report.overallAssessment}
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-1.5">
              <div className="text-xs font-semibold text-stone-900">
                The Way You Speak (Cadence & Framing)
              </div>
              <p className="text-sm text-stone-700 leading-relaxed">
                {report.speakingStyleSummary}
              </p>
            </div>
          </div>

          {/* Strengths vs Habits to Refine */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-stone-200 rounded-lg p-4 space-y-2.5">
              <h5 className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>What Works Great in Your Natural Talk</span>
              </h5>
              <ul className="space-y-1.5 text-xs text-stone-700">
                {report.strengths.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-stone-200 rounded-lg p-4 space-y-2.5">
              <h5 className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-amber-700" />
                <span>Speaking Habits to Sharpen</span>
              </h5>
              <ul className="space-y-1.5 text-xs text-stone-700">
                {report.habitsToRefine.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Line-by-Line Verbatim Upgrades */}
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-stone-900">
              Line-by-Line Clarity Upgrades (From Your Exact Spoken Words)
            </h5>
            <div className="space-y-3">
              {report.lineByLineUpgrades.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-200">
                    <div className="text-xs text-stone-600">
                      <span className="font-semibold text-stone-900">
                        Exact words from your mouth:{' '}
                      </span>
                      <span className="italic text-stone-800">
                        “{item.exactSpokenText}”
                      </span>
                    </div>
                    <span className="text-xs text-amber-900 font-medium">
                      {item.diagnosis}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white border border-stone-200 rounded-lg p-3 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-stone-900 block mb-1">
                          Natural Casual Upgrade (Everyday Partner Talk)
                        </span>
                        <p className="text-stone-700 leading-relaxed">
                          “{item.casualNaturalUpgrade}”
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSpeakUpgradeLine(item.casualNaturalUpgrade)}
                        aria-label={`Hear Aanya speak '${item.casualNaturalUpgrade.slice(0, 20)}'`}
                        className="text-stone-400 hover:text-amber-800 p-1 shrink-0 cursor-pointer"
                        title="Hear Aanya pronounce this naturally"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-white border border-stone-200 rounded-lg p-3 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-stone-900 block mb-1">
                          Crisp & Fluent Upgrade (High Clarity)
                        </span>
                        <p className="text-stone-700 leading-relaxed">
                          “{item.polishedFluentUpgrade}”
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSpeakUpgradeLine(item.polishedFluentUpgrade)}
                        aria-label={`Hear Aanya speak '${item.polishedFluentUpgrade.slice(0, 20)}'`}
                        className="text-stone-400 hover:text-amber-800 p-1 shrink-0 cursor-pointer"
                        title="Hear Aanya pronounce this clearly"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Micro-Drills for Next Call */}
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-2">
            <h5 className="text-xs font-semibold text-stone-900">
              Try This in Your Next Call with Aanya
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-stone-700">
              {report.nextCallMicroDrills.map((drill, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-stone-200 rounded-lg p-3 leading-relaxed"
                >
                  <span className="font-mono font-semibold text-amber-800 mr-1.5 tabular-nums">
                    0{idx + 1}.
                  </span>
                  {drill}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
