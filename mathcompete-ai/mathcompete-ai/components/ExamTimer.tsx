import React, { useEffect, useState } from 'react';
import { TimerMode } from '../types';
import { Clock, Hourglass } from 'lucide-react';

interface Props {
  mode: TimerMode;
  totalSeconds: number;
  onExpire: () => void;
}

export const ExamTimer: React.FC<Props> = ({ mode, totalSeconds, onExpire }) => {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (mode === TimerMode.TIMED || mode === TimerMode.CUSTOM) {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            onExpire();
            return 0;
          }
          return prev - 1;
        });
      } else {
        setElapsed(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mode, onExpire]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isCountdown = mode === TimerMode.TIMED || mode === TimerMode.CUSTOM;
  const displayTime = isCountdown ? formatTime(secondsLeft) : formatTime(elapsed);
  const isUrgent = isCountdown && secondsLeft < 300; // 5 mins

  return (
    <div className={`fixed top-4 right-4 z-50 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 font-mono font-bold text-xl transition-colors duration-500 ${isUrgent ? 'bg-red-100 text-red-600 animate-pulse border border-red-200' : 'bg-white text-slate-700 border border-slate-100'}`}>
      {isCountdown ? <Hourglass size={20} className={isUrgent ? "text-red-500" : "text-indigo-500"} /> : <Clock size={20} className="text-emerald-500"/>}
      {displayTime}
    </div>
  );
};