import React, { useState, useEffect } from 'react';
import { ExamLevel, ExamMode, ExamSettings, ExamState, TimerMode } from './types';
import { generateExam, generateMiniQuiz } from './services/problemService';
import { getProblemHint, getSolutionExplanation, analyzePerformance } from './services/geminiService';
import { EXAM_TIME_LIMITS } from './constants';
import { ProblemCard } from './components/ProblemCard';
import { ExamTimer } from './components/ExamTimer';
import { FunLoader } from './components/FunLoader';
import { BrainCircuit, RotateCcw, Settings, Zap, Plus, GraduationCap, Infinity as InfinityIcon, Sliders, Clock, Flame } from 'lucide-react';

export default function App() {
  // --- NORMAL APP STATE ---
  const [settings, setSettings] = useState<ExamSettings>({
    levels: [ExamLevel.AMC8],
    mode: ExamMode.INSTANT,
    timerMode: TimerMode.UNTIMED,
    customTimeLimit: 40,
    // Set default slow sources to 0 as requested
    config: { realCount: 18, mockCount: 0, aiCount: 0 }
  });

  const [state, setState] = useState<ExamState>({
    view: 'SETUP',
    problems: [],
    currentProblemIndex: 0,
    startTime: 0,
    endTime: null,
  });

  const [loadingMsg, setLoadingMsg] = useState("Initializing...");
  const [loadingPct, setLoadingPct] = useState(0);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!process.env.API_KEY) setApiKeyMissing(true);
  }, []);

  // --- HANDLERS ---
  const toggleLevel = (level: ExamLevel) => {
    setSettings(prev => {
      const exists = prev.levels.includes(level);
      const newLevels = exists 
        ? prev.levels.filter(l => l !== level)
        : [...prev.levels, level];
      if (newLevels.length === 0) return prev;
      return { ...prev, levels: newLevels };
    });
  };

  const startExamWithConfig = async (levels: ExamLevel[], config: any, mode: ExamMode = ExamMode.INSTANT) => {
      setState(prev => ({ ...prev, view: 'LOADING' }));
      setLoadingMsg("Generating exam...");
      setLoadingPct(0);
      try {
          const problems = await generateExam(levels, config, mode, (msg, pct) => {
              setLoadingMsg(msg);
              setLoadingPct(pct);
          });
          setState({
              view: 'EXAM',
              problems,
              currentProblemIndex: 0,
              startTime: Date.now(),
              endTime: null
          });
      } catch (e) {
          console.error(e);
          setState(prev => ({ ...prev, view: 'SETUP' }));
      }
  };

  const startExam = () => startExamWithConfig(settings.levels, settings.config, settings.mode);

  const startQuickPractice = () => {
     setSettings(prev => ({ ...prev, levels: [ExamLevel.AMC8], mode: ExamMode.INSTANT }));
     startExamWithConfig([ExamLevel.AMC8], { realCount: 5, mockCount: 0, aiCount: 0 }, ExamMode.INSTANT);
  };

  const startWarmup = () => {
      setSettings(prev => ({ ...prev, mode: ExamMode.WARMUP }));
      // Warmup: 10 real problems, no AI/Mock for speed
      startExamWithConfig(settings.levels, { realCount: 10, mockCount: 0, aiCount: 0 }, ExamMode.WARMUP);
  };

  const handleAnswer = (id: string, ans: string) => {
      setState(prev => ({
          ...prev,
          problems: prev.problems.map(p => p.id === id ? { ...p, userAnswer: ans, isCorrect: ans === p.correctOption } : p)
      }));
  };
  
  const handleHint = async (id: string) => {
      const p = state.problems.find(x => x.id === id);
      if(!p) return;
      const hint = await getProblemHint(p);
      setState(prev => ({
          ...prev,
          problems: prev.problems.map(x => x.id === id ? { ...x, hints: [...x.hints, hint] } : x)
      }));
  };

  const handleChat = async (id: string, text: string) => {
      const p = state.problems.find(x => x.id === id);
      if(!p) return;
      const newMsg = { role: 'user', text } as const;
      const newHistory = [...p.solutionChat, newMsg];
      
      setState(prev => ({
          ...prev,
          problems: prev.problems.map(x => x.id === id ? { ...x, solutionChat: newHistory } : x)
      }));

      const reply = await getSolutionExplanation(p, text, newHistory);
      setState(prev => ({
          ...prev,
          problems: prev.problems.map(x => x.id === id ? { ...x, solutionChat: [...newHistory, { role: 'model', text: reply }] } : x)
      }));
  };

  const finishExam = async () => {
      setAnalyzing(true);
      const { analysis, topics } = await analyzePerformance(state.problems);
      setAnalyzing(false);
      setState(prev => ({
          ...prev,
          view: 'ANALYSIS',
          endTime: Date.now(),
          analysis,
          suggestedTopics: topics
      }));
  };

  const startTopicQuiz = async (topic: string) => {
       setState(prev => ({ ...prev, view: 'LOADING' }));
       setLoadingMsg(`Generating ${topic} Quiz...`);
       setLoadingPct(0);
       try {
            const problems = await generateMiniQuiz(topic, settings.levels[0] || ExamLevel.AMC8);
            setState({
                view: 'EXAM',
                problems,
                currentProblemIndex: 0,
                startTime: Date.now(),
                endTime: null
            });
       } catch(e) {
            console.error("Quiz gen failed", e);
            setState(prev => ({...prev, view: 'ANALYSIS'}));
       }
  };

  if (apiKeyMissing) return <div className="p-10 text-center text-red-600 font-bold">Missing API_KEY in Environment</div>;
  if (state.view === 'LOADING') return (
    <FunLoader 
        message={loadingMsg} 
        percent={loadingPct} 
    />
  );

  // 1. Setup View
  if (state.view === 'SETUP') {
    return (
      <div className="min-h-screen bg-slate-50 relative overflow-hidden flex items-center justify-center p-4">
        {/* Decorative Background */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-50"></div>
            <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-[80px]"></div>
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-400/20 rounded-full blur-[100px]"></div>
        </div>

        <div className="max-w-5xl w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[650px] border border-white/50 z-10 relative">
          {/* Left Panel */}
          <div className="md:w-[35%] bg-slate-900 text-white p-8 flex flex-col justify-between relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/20 to-purple-600/20 z-0"></div>
             
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="bg-white/10 p-2.5 rounded-xl border border-white/10 backdrop-blur-sm">
                        <BrainCircuit size={28} className="text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">MathCompete</h1>
                        <p className="text-xs text-slate-400 tracking-wider font-mono">AI-POWERED PREP</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-default">
                        <div className="flex items-center gap-3 mb-2 text-yellow-400">
                             <GraduationCap size={20} />
                             <span className="font-bold">Smart Analysis</span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Generate exams based on real AMC archives and get instant AI feedback on your solutions.
                        </p>
                    </div>
                </div>
             </div>

             <div className="relative z-10 space-y-3 mt-8">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Quick Start</p>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={startQuickPractice} className="py-3 px-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl hover:brightness-110 transition-all font-bold flex flex-col items-center justify-center gap-1 shadow-lg shadow-orange-900/20 text-xs">
                        <Zap size={16} className="text-white"/> 
                        <span>Lucky 5</span>
                    </button>
                    <button onClick={startWarmup} className="py-3 px-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:brightness-110 transition-all font-bold flex flex-col items-center justify-center gap-1 shadow-lg shadow-teal-900/20 text-xs">
                        <Flame size={16} className="text-white"/> 
                        <span>Warmup</span>
                    </button>
                </div>
             </div>
          </div>

          {/* Right Panel */}
          <div className="md:w-[65%] p-8 md:p-10 overflow-y-auto bg-white/50">
             <div className="flex items-center justify-between mb-8">
                 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="text-slate-400" size={24}/> 
                    Configure Exam
                 </h2>
                 <div className="h-1 flex-1 bg-slate-100 ml-6 rounded-full overflow-hidden">
                     <div className="w-1/3 h-full bg-indigo-500"></div>
                 </div>
             </div>
             
             {/* Levels */}
             <div className="mb-8">
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Competitions</label>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                     {Object.values(ExamLevel).map(l => (
                         <button key={l} onClick={() => toggleLevel(l)}
                            className={`py-3 px-2 rounded-xl text-sm font-bold border-2 transition-all duration-200 transform hover:-translate-y-0.5 ${
                                settings.levels.includes(l) 
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-md shadow-indigo-100' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}>
                            {l}
                         </button>
                     ))}
                 </div>
             </div>

             {/* Mode & Timer */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Exam Mode</label>
                    <div className="space-y-3">
                        <div onClick={() => setSettings({...settings, mode: ExamMode.INSTANT})} 
                            className={`p-3 border-2 rounded-2xl cursor-pointer transition-all ${
                                settings.mode === ExamMode.INSTANT 
                                ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500/20' 
                                : 'border-slate-100 bg-white hover:border-slate-300'
                            }`}>
                            <div className="font-bold text-slate-800 text-sm">Instant Feedback</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Learn as you go.</div>
                        </div>
                        <div onClick={() => setSettings({...settings, mode: ExamMode.ALL_AT_END})} 
                            className={`p-3 border-2 rounded-2xl cursor-pointer transition-all ${
                                settings.mode === ExamMode.ALL_AT_END 
                                ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500/20' 
                                : 'border-slate-100 bg-white hover:border-slate-300'
                            }`}>
                            <div className="font-bold text-slate-800 text-sm">Simulated Exam</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Submit at the end.</div>
                        </div>
                    </div>
                 </div>

                 {/* Timer Config */}
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Time Control</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setSettings({...settings, timerMode: TimerMode.UNTIMED})}
                            className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${settings.timerMode === TimerMode.UNTIMED ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                            <InfinityIcon size={18} />
                            <span className="text-[10px] font-bold">Untimed</span>
                        </button>
                        <button onClick={() => setSettings({...settings, timerMode: TimerMode.TIMED})}
                            className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${settings.timerMode === TimerMode.TIMED ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                            <Clock size={18} />
                            <span className="text-[10px] font-bold">Real</span>
                        </button>
                        <button onClick={() => setSettings({...settings, timerMode: TimerMode.CUSTOM})}
                            className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${settings.timerMode === TimerMode.CUSTOM ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                            <Sliders size={18} />
                            <span className="text-[10px] font-bold">Custom</span>
                        </button>
                    </div>
                    {settings.timerMode === TimerMode.CUSTOM && (
                        <div className="mt-3 bg-white p-3 rounded-xl border border-slate-200 animate-fade-in shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500">Duration</span>
                                <span className="text-sm font-bold text-indigo-600">{settings.customTimeLimit}m</span>
                            </div>
                            <input type="range" min="5" max="180" step="5" value={settings.customTimeLimit} 
                                onChange={(e) => setSettings({...settings, customTimeLimit: parseInt(e.target.value)})}
                                className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"/>
                        </div>
                    )}
                 </div>
             </div>

             {/* Counts */}
             <div className="mb-8">
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Problem Distribution</label>
                 <div className="grid grid-cols-3 gap-4">
                     {[
                        { label: 'Real', val: settings.config.realCount, setter: (v: number) => setSettings({...settings, config: {...settings.config, realCount: v}}) },
                        { label: 'Mock', val: settings.config.mockCount, setter: (v: number) => setSettings({...settings, config: {...settings.config, mockCount: v}}) },
                        { label: 'AI Gen', val: settings.config.aiCount, setter: (v: number) => setSettings({...settings, config: {...settings.config, aiCount: v}}) },
                     ].map((item, i) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                             <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">{item.label}</label>
                             <input type="number" min="0" max="25" className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none" 
                                value={item.val} onChange={e => item.setter(Math.max(0, parseInt(e.target.value)||0))} />
                        </div>
                     ))}
                 </div>
             </div>

             <button onClick={startExam} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-xl shadow-slate-200 hover:bg-slate-800 hover:scale-[1.01] transition-all flex items-center justify-center gap-3">
                 Start Custom Exam <div className="bg-white/20 p-1 rounded-full"><Plus size={16}/></div>
             </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Exam View
  if (state.view === 'EXAM') {
      const currentProblem = state.problems[state.currentProblemIndex];
      const isLast = state.currentProblemIndex === state.problems.length - 1;
      const isWarmup = settings.mode === ExamMode.WARMUP;
      
      return (
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            {settings.timerMode !== TimerMode.UNTIMED && (
                <ExamTimer 
                    mode={settings.timerMode} 
                    totalSeconds={settings.timerMode === TimerMode.CUSTOM ? settings.customTimeLimit * 60 : EXAM_TIME_LIMITS[settings.levels[0]] || 3000} 
                    onExpire={finishExam} 
                />
            )}
            
            <div className="max-w-4xl mx-auto pt-10">
                <div className="mb-4 flex items-center gap-3">
                    {isWarmup && (
                         <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                             <Flame size={12} /> Warmup Mode
                         </div>
                    )}
                </div>

                <ProblemCard 
                    problem={currentProblem}
                    index={state.currentProblemIndex}
                    mode={settings.mode}
                    onAnswer={handleAnswer}
                    onGetHint={handleHint}
                    onChat={handleChat}
                    showFeedback={false}
                />

                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 flex justify-center gap-4 shadow-xl z-40">
                    <button 
                        onClick={() => setState(s => ({ ...s, currentProblemIndex: Math.max(0, s.currentProblemIndex - 1) }))}
                        disabled={state.currentProblemIndex === 0}
                        className="px-6 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200">
                        Previous
                    </button>
                    
                    <span className="flex items-center font-mono font-bold text-slate-400">
                        {state.currentProblemIndex + 1} / {state.problems.length}
                    </span>

                    {isLast ? (
                        <button 
                            onClick={finishExam}
                            className="px-8 py-3 rounded-xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all">
                            Finish Exam
                        </button>
                    ) : (
                        <button 
                            onClick={() => setState(s => ({ ...s, currentProblemIndex: Math.min(s.problems.length - 1, s.currentProblemIndex + 1) }))}
                            className="px-6 py-3 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800">
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
      );
  }

  // 3. Analysis View (remains mostly same, just ensuring correct state view)
  if (state.view === 'ANALYSIS') {
      const correctCount = state.problems.filter(p => p.isCorrect).length;
      const score = Math.round((correctCount / state.problems.length) * 100);

      return (
          <div className="min-h-screen bg-slate-50 p-8">
              <div className="max-w-4xl mx-auto">
                  <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 mb-8 text-center relative overflow-hidden">
                      <div className="relative z-10">
                          <h1 className="text-4xl font-bold text-slate-800 mb-2">Analysis Complete</h1>
                          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-4">
                              {score}%
                          </div>
                          <p className="text-slate-500 max-w-2xl mx-auto mb-8 leading-relaxed">
                              {state.analysis || (analyzing ? "Generating deep insights..." : "")}
                          </p>

                          {state.suggestedTopics && (
                              <div className="flex flex-wrap justify-center gap-3">
                                  {state.suggestedTopics.map(t => (
                                      <button key={t} onClick={() => startTopicQuiz(t)} 
                                          className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2">
                                          <Zap size={14}/> Practice {t}
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <div className="space-y-8 pb-20">
                      {state.problems.map((p, i) => (
                          <ProblemCard 
                              key={p.id} 
                              problem={p} 
                              index={i} 
                              mode={ExamMode.INSTANT} // Force instant to show review UI in analysis
                              onAnswer={() => {}} 
                              onGetHint={async () => {}} 
                              onChat={handleChat}
                              showFeedback={true}
                           />
                      ))}
                  </div>

                  <div className="fixed bottom-8 right-8 z-50">
                      <button onClick={() => setState(s => ({ ...s, view: 'SETUP' }))} 
                          className="px-6 py-4 bg-slate-900 text-white rounded-2xl shadow-2xl hover:scale-105 transition-all font-bold flex items-center gap-2">
                          <RotateCcw size={20}/> New Exam
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return null;
}