import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Sparkles, Trophy, MousePointer2, Brain } from 'lucide-react';
import { Problem } from '../types';

interface Props {
  message: string;
  percent: number;
}

const MATH_FACTS = [
  "The number 0 does not have a Roman numeral representation.",
  "There are 86,400 seconds in a day.",
  "Pi has been calculated to over 62.8 trillion digits.",
  "A 'jiffy' is an actual unit of time for 1/100th of a second.",
  "40 is the only number that is spelled with letters arranged in alphabetical order.",
  "Zero is an even number.",
  "Multiplying 111,111,111 by 111,111,111 results in 12,345,678,987,654,321.",
  "The spiral shapes of sunflowers follow a Fibonacci sequence.",
  "In a room of 23 people, there's a 50% chance two share a birthday.",
  "111,111,111 x 111,111,111 = 12,345,678,987,654,321",
  "A Googol is the number 1 followed by 100 zeros.",
  "7 is the most popular favorite number.",
  "Calculus was invented by both Newton and Leibniz independently.",
];

type LoaderMode = 'facts' | 'zen' | 'game';

export const FunLoader: React.FC<Props> = ({ message, percent }) => {
  const [mode, setMode] = useState<LoaderMode>('facts');

  useEffect(() => {
    const modes: LoaderMode[] = ['facts', 'zen', 'game'];
    setMode(modes[Math.floor(Math.random() * modes.length)]);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] relative overflow-hidden flex flex-col items-center justify-center text-slate-200 font-sans selection:bg-indigo-500/30">
      
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse-slow delay-1000"></div>
      </div>

      <div className="z-10 w-full max-w-3xl px-6 flex flex-col items-center">
        
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 w-full shadow-2xl min-h-[500px] flex flex-col relative overflow-hidden transition-all duration-500">
          
          <div className="w-full mb-8 relative z-20">
             <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                     <div className="p-2 bg-indigo-500/20 rounded-xl">
                        <Loader2 className="animate-spin text-indigo-400 w-5 h-5" />
                     </div>
                     <span className="font-medium text-indigo-200 text-sm tracking-wide">{message}</span>
                 </div>
                 <span className="font-mono text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded-lg border border-white/5">{percent}%</span>
             </div>
             
             <div className="w-full bg-slate-800/50 rounded-full h-1.5 overflow-hidden">
                <div 
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 h-full transition-all duration-700 ease-out relative"
                    style={{ width: `${percent}%` }}
                >
                    <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                </div>
             </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-center relative z-10 min-h-[300px]">
            {mode === 'facts' && <FactsView />}
            {mode === 'zen' && <ZenView />}
            {mode === 'game' && <BubblePopGame />}
          </div>

          <div className="mt-8 flex justify-center gap-2 relative z-20 flex-wrap">
              <ModeButton active={mode === 'facts'} onClick={() => setMode('facts')} icon={<Brain size={14}/>} label="Facts" />
              <ModeButton active={mode === 'zen'} onClick={() => setMode('zen')} icon={<Sparkles size={14}/>} label="Zen" />
              <ModeButton active={mode === 'game'} onClick={() => setMode('game')} icon={<Trophy size={14}/>} label="Play" />
          </div>

        </div>
      </div>

      <style>{`
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        .animate-shimmer {
            animation: shimmer 2s infinite linear;
        }
        @keyframes pulse-slow {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
        }
        .animate-pulse-slow {
            animation: pulse-slow 8s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

const ModeButton = ({ active, onClick, icon, label }: any) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 ${
            active 
            ? 'bg-white/10 text-white shadow-lg shadow-indigo-500/20 border border-white/10' 
            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
        }`}
    >
        {icon} {label}
    </button>
);

const FactsView = () => {
    const [fact, setFact] = useState(MATH_FACTS[0]);
    const [opacity, setOpacity] = useState(1);
  
    useEffect(() => {
      const interval = setInterval(() => {
        setOpacity(0);
        setTimeout(() => {
            setFact(MATH_FACTS[Math.floor(Math.random() * MATH_FACTS.length)]);
            setOpacity(1);
        }, 600);
      }, 6000);
      return () => clearInterval(interval);
    }, []);

    return (
        <div className="text-center max-w-lg mx-auto px-4">
            <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20 transform rotate-3">
                <Sparkles className="text-white w-6 h-6" />
            </div>
            <div className="h-32 flex items-center justify-center">
                <p 
                    className="text-xl md:text-2xl font-light leading-relaxed text-slate-200 transition-all duration-700 ease-in-out transform"
                    style={{ opacity, filter: `blur(${opacity === 1 ? '0px' : '10px'})`, transform: `scale(${opacity === 1 ? '1' : '0.95'})` }}
                >
                    "{fact}"
                </p>
            </div>
        </div>
    );
};

const ZenView = () => {
    return (
        <div className="relative w-full h-[300px] flex items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full shadow-[0_0_50px_rgba(255,255,255,0.4)] relative z-10 animate-pulse-slow"></div>
            
            <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-48 h-48 border border-white/10 rounded-full animate-spin-slow">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-400 rounded-full shadow-[0_0_15px_rgba(129,140,248,0.6)]"></div>
                 </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-72 h-72 border border-white/5 rounded-full animate-spin-reverse-slow">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-6 bg-purple-400 rounded-full shadow-[0_0_15px_rgba(192,132,252,0.6)] flex items-center justify-center text-[10px] font-bold text-purple-900">π</div>
                 </div>
            </div>
             <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-96 h-96 border border-white/5 rounded-full animate-spin-slow" style={{ animationDuration: '20s' }}>
                    <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.6)]"></div>
                 </div>
            </div>

            <style>{`
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes spin-reverse-slow { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                .animate-spin-slow { animation: spin-slow 12s linear infinite; }
                .animate-spin-reverse-slow { animation: spin-reverse-slow 15s linear infinite; }
            `}</style>
        </div>
    );
};

interface Bubble {
    id: number;
    x: number; // percentage
    y: number; // percentage
    size: number;
    speed: number;
    content: string;
    color: string;
}

const BubblePopGame = () => {
    const [bubbles, setBubbles] = useState<Bubble[]>([]);
    const [score, setScore] = useState(0);
    const requestRef = useRef<number>(0);
    const lastSpawnTime = useRef<number>(0);

    const MATH_SYMBOLS = ['+', '-', '×', '÷', 'π', '∞', '∫', '√', '∑', '1', '2', '3', '4', '5'];
    const COLORS = ['bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-emerald-500'];

    const spawnBubble = useCallback(() => {
        const id = Date.now();
        const size = Math.random() * 40 + 40; // 40-80px
        const bubble: Bubble = {
            id,
            x: Math.random() * 80 + 10,
            y: 110, // Start below view
            size,
            speed: Math.random() * 0.2 + 0.1,
            content: MATH_SYMBOLS[Math.floor(Math.random() * MATH_SYMBOLS.length)],
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        };
        setBubbles(prev => [...prev, bubble]);
    }, []);

    const updateGame = useCallback((time: number) => {
        if (time - lastSpawnTime.current > 800) { // Spawn every 800ms
            spawnBubble();
            lastSpawnTime.current = time;
        }

        setBubbles(prev => {
            return prev
                .map(b => ({ ...b, y: b.y - b.speed }))
                .filter(b => b.y > -20); // Remove if off screen top
        });

        requestRef.current = requestAnimationFrame(updateGame);
    }, [spawnBubble]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(updateGame);
        return () => cancelAnimationFrame(requestRef.current);
    }, [updateGame]);

    const popBubble = (id: number) => {
        setBubbles(prev => prev.filter(b => b.id !== id));
        setScore(s => s + 1);
    };

    return (
        <div className="w-full h-full min-h-[300px] relative bg-slate-800/30 rounded-2xl overflow-hidden border border-white/5 cursor-crosshair">
             <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10">
                 <Trophy size={14} className="text-yellow-400"/>
                 <span className="font-bold font-mono text-white">{score}</span>
             </div>
             
             {score === 0 && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-50">
                     <p className="text-sm text-slate-400 flex items-center gap-2"><MousePointer2 size={16}/> Click bubbles to pop!</p>
                 </div>
             )}

             {bubbles.map(b => (
                 <button
                    key={b.id}
                    onMouseDown={() => popBubble(b.id)}
                    className={`absolute rounded-full flex items-center justify-center text-white font-bold shadow-lg backdrop-blur-sm transition-transform active:scale-90 hover:scale-110 border border-white/20 ${b.color}`}
                    style={{
                        left: `${b.x}%`,
                        top: `${b.y}%`,
                        width: `${b.size}px`,
                        height: `${b.size}px`,
                        fontSize: `${b.size * 0.4}px`
                    }}
                 >
                     {b.content}
                 </button>
             ))}
        </div>
    );
};