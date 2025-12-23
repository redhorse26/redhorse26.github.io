import React, { useState, useEffect, useRef } from 'react';
import { Problem, ExamMode, ProblemSource } from '../types';
import { CheckCircle, XCircle, ExternalLink, Lightbulb, MessageCircle, Send, Loader2, BookOpen, SkipForward } from 'lucide-react';

interface Props {
  problem: Problem;
  index: number;
  mode: ExamMode;
  onAnswer: (problemId: string, answer: string) => void;
  onGetHint: (problemId: string) => Promise<void>;
  onChat: (problemId: string, message: string) => Promise<void>;
  showFeedback: boolean; 
}

const fixImageUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://artofproblemsolving.com${url}`;
  return url;
};

export const ProblemCard: React.FC<Props> = ({ problem, index, mode, onAnswer, onGetHint, onChat, showFeedback }) => {
  const [selected, setSelected] = useState<string | undefined>(problem.userAnswer);
  const [submittedInstant, setSubmittedInstant] = useState(false);
  const [skipped, setSkipped] = useState(false);
  
  const [loadingHint, setLoadingHint] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize correct option for comparison
  const correctOpt = problem.correctOption ? problem.correctOption.trim().toUpperCase() : "";

  useEffect(() => {
    if (containerRef.current && (window as any).renderMathInElement) {
       requestAnimationFrame(() => {
           if(!containerRef.current) return;
           try {
               (window as any).renderMathInElement(containerRef.current, {
                  delimiters: [
                      {left: '$$', right: '$$', display: true},
                      {left: '$', right: '$', display: false},
                      {left: '\\(', right: '\\)', display: false},
                      {left: '\\[', right: '\\]', display: true}
                  ],
                  throwOnError: false,
                  output: 'html',
                  strict: 'ignore', 
                  trust: true, 
                  errorCallback: (msg: string, err: any) => {
                      console.warn("KaTeX Error:", msg);
                  }
               });
           } catch (e: any) {
               if (e?.message && !e.message.includes("Cannot read properties of undefined")) {
                   console.warn("Math rendering warning:", e.message);
               }
           }
       });
    }
  }, [problem, selected, showFeedback, problem.hints, problem.solutionChat]);

  const handleSelect = (opt: string) => {
    if (showFeedback && mode === ExamMode.ALL_AT_END) return; 
    if (submittedInstant && (mode === ExamMode.INSTANT || mode === ExamMode.WARMUP)) return; 
    if (skipped) return;
    
    setSelected(opt);
    if (mode === ExamMode.ALL_AT_END) onAnswer(problem.id, opt);
  };

  const handleInstantSubmit = () => {
    if (!selected) return;
    setSubmittedInstant(true);
    onAnswer(problem.id, selected);
  };

  const handleSkip = () => {
      setSkipped(true);
      setSubmittedInstant(true); // Treat as submitted to show review
      onAnswer(problem.id, "SKIPPED");
  };

  const handleRequestHint = async () => {
    if (loadingHint) return;
    setLoadingHint(true);
    try { await onGetHint(problem.id); } finally { setLoadingHint(false); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || loadingChat) return;
    setLoadingChat(true);
    try { await onChat(problem.id, chatInput); setChatInput(""); } finally { setLoadingChat(false); }
  };

  const isInstantReview = (mode === ExamMode.INSTANT || mode === ExamMode.WARMUP) && submittedInstant;
  const isReview = showFeedback || isInstantReview;
  const canGetHint = !isReview && problem.hints.length < 2 && !skipped;
  const labels = ['A', 'B', 'C', 'D', 'E'];

  const showImageGallery = problem.source !== ProblemSource.AOPS && problem.images.length > 0;
  const isWarmup = mode === ExamMode.WARMUP;

  return (
    <div ref={containerRef} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-white/50 hover:shadow-xl hover:shadow-indigo-100/50 p-8 mb-8 transition-all duration-300">
      <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
           <div className="bg-slate-900 text-white text-lg font-bold w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg shadow-slate-200">
             {index + 1}
           </div>
           <div>
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-wider border border-slate-200">
                 {problem.source}
               </span>
               {problem.topic && (
                 <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase tracking-wider border border-emerald-100">
                   {problem.topic}
                 </span>
               )}
             </div>
             <div className="text-xs text-slate-400 mt-1.5 font-medium">Difficulty Level {problem.difficulty}/10</div>
           </div>
        </div>
        {problem.originalUrl && (
          <a href={problem.originalUrl} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-indigo-500 transition-colors p-2 hover:bg-slate-50 rounded-full">
            <ExternalLink size={20}/>
          </a>
        )}
      </div>

      {/* Content */}
      <div className="prose prose-lg max-w-none mb-8 text-slate-800 leading-loose font-serif problem-content"
           dangerouslySetInnerHTML={{ __html: problem.questionHtml }} />
      
      {/* Images */}
      {showImageGallery && (
        <div className="flex gap-4 mb-8 flex-wrap justify-center bg-slate-50/50 border border-slate-100 p-6 rounded-2xl">
          {problem.images.map((img, i) => (
             <img key={i} src={fixImageUrl(img)} alt={`Figure ${i}`} className="max-h-64 object-contain shadow-sm bg-white rounded-lg p-2" 
                  onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
          ))}
        </div>
      )}

      {/* Answer Buttons */}
      <div className="mb-8">
        <div className="flex gap-3 justify-center">
            {labels.map((letter) => {
                let baseClass = "w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl transition-all duration-200 transform hover:-translate-y-1 shadow-sm border-2 ";
                
                if (isReview) {
                    if (letter === correctOpt) baseClass += "bg-emerald-500 border-emerald-600 text-white shadow-emerald-200";
                    else if (selected === letter && !skipped) baseClass += "bg-rose-500 border-rose-600 text-white shadow-rose-200";
                    else baseClass += "bg-slate-50 border-slate-100 text-slate-300 opacity-50";
                } else {
                    if (selected === letter) baseClass += "bg-indigo-600 border-indigo-700 text-white shadow-indigo-200 scale-105";
                    else baseClass += "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600";
                }

                return (
                    <button key={letter} onClick={() => handleSelect(letter)} className={baseClass}>
                        {letter}
                    </button>
                );
            })}
        </div>
      </div>

      {/* Hints */}
      {!isReview && (
          <div className="mb-6 flex items-center justify-between bg-amber-50/80 p-5 rounded-2xl border border-amber-100/50 backdrop-blur-sm">
             <div className="flex-1 space-y-3">
                 {problem.hints.map((hint, i) => (
                     <div key={i} className="flex gap-3 text-amber-900 text-sm font-medium animate-fade-in">
                         <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-500 fill-amber-500" />
                         <span dangerouslySetInnerHTML={{ __html: hint }}></span>
                     </div>
                 ))}
                 {problem.hints.length === 0 && <span className="text-sm text-amber-700/60 font-medium italic flex items-center gap-2"><Lightbulb size={16}/> Stuck? Ask AI for a nudge.</span>}
             </div>
             
             {canGetHint && (
                 <button onClick={handleRequestHint} disabled={loadingHint}
                    className="ml-6 px-5 py-2.5 bg-white border border-amber-200 text-amber-700 rounded-xl font-bold text-sm transition-all hover:bg-amber-100 hover:border-amber-300 flex items-center gap-2 shadow-sm">
                    {loadingHint ? <Loader2 size={16} className="animate-spin"/> : <Lightbulb size={16} />}
                    Hint
                 </button>
             )}
          </div>
      )}

      {/* Instant Mode / Warmup Mode Submit & Skip */}
      {(mode === ExamMode.INSTANT || mode === ExamMode.WARMUP) && !submittedInstant && (
        <div className="flex justify-end gap-3">
            {isWarmup && (
                 <button onClick={handleSkip}
                    className="bg-white border border-slate-200 text-slate-500 px-6 py-4 rounded-2xl font-bold hover:bg-slate-50 hover:text-slate-700 transition-all flex items-center gap-2">
                    <SkipForward size={18} /> Give Up
                 </button>
            )}
            <button onClick={handleInstantSubmit} disabled={!selected}
            className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-200 transition-all transform hover:-translate-y-1 active:translate-y-0">
            Check Answer
            </button>
        </div>
      )}

      {/* Review Section */}
      {isReview && (
        <div className="mt-10 pt-10 border-t border-dashed border-slate-200 animate-fade-in">
           <div className={`flex items-center gap-4 text-xl font-bold mb-8 p-6 rounded-2xl border ${
               skipped ? 'bg-slate-50 border-slate-200 text-slate-600' :
               selected === correctOpt ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
           }`}>
              <div className={`p-2 rounded-full ${
                  skipped ? 'bg-slate-200 text-slate-500' :
                  selected === correctOpt ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-200 text-rose-700'
              }`}>
                {skipped ? <SkipForward className="w-8 h-8"/> : selected === correctOpt ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
              </div>
              <div>
                  <div className="text-sm opacity-70 uppercase tracking-wider font-bold mb-1">Result</div>
                  <span>{skipped ? 'Skipped' : selected === correctOpt ? 'Excellent Analysis!' : 'Good Attempt!'}</span>
                  <div className="text-sm mt-1 font-normal text-slate-500">Correct Answer: <b>{correctOpt || 'Check Solution'}</b></div>
              </div>
           </div>
           
           <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 mb-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><BookOpen size={100}/></div>
             <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-lg relative z-10"><BookOpen size={24} className="text-indigo-600"/> Official Solution</h4>
             <div className="prose prose-slate max-w-none relative z-10" dangerouslySetInnerHTML={{ __html: problem.solutionHtml }} />
           </div>

           {/* Chat */}
           <div className="bg-white rounded-3xl p-1 border border-indigo-100 shadow-xl shadow-indigo-50/50">
               <div className="bg-indigo-50/50 rounded-[20px] p-6">
                    <h5 className="font-bold text-indigo-900 flex items-center gap-2 mb-6">
                        <div className="bg-indigo-100 p-2 rounded-lg"><MessageCircle size={20} className="text-indigo-600" /></div>
                        AI Tutor Chat
                    </h5>
                    <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {problem.solutionChat.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-indigo-100 text-slate-700 rounded-bl-sm'}`}>
                                    <span dangerouslySetInnerHTML={{ __html: msg.text }}></span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                            placeholder="Ask about specific steps..."
                            className="flex-1 border border-indigo-200 rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white shadow-sm" />
                        <button onClick={handleSendChat} disabled={loadingChat || !chatInput.trim()}
                            className="bg-indigo-600 text-white p-4 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200">
                            {loadingChat ? <Loader2 size={20} className="animate-spin"/> : <Send size={20} />}
                        </button>
                    </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};