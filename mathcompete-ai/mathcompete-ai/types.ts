
export enum ExamLevel {
  AMC8 = 'AMC 8',
  AMC10 = 'AMC 10',
  AMC12 = 'AMC 12',
}

export enum ExamMode {
  INSTANT = 'Instant Feedback',
  ALL_AT_END = 'Submit All at End',
  WARMUP = 'Warmup Mode',
}

export enum TimerMode {
  TIMED = 'Standard',
  CUSTOM = 'Custom',
  UNTIMED = 'Untimed',
}

export enum ProblemSource {
  AOPS = 'AoPS Archive',
  MOCK = 'Online Mock',
  AI_GENERATED = 'Gemini Generated',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface Problem {
  id: string;
  source: ProblemSource;
  originalUrl?: string; // For AoPS
  questionHtml: string;
  images: string[]; // URLs of images
  options: string[]; // Array of 5 strings (A-E)
  correctOption: string; // 'A', 'B', 'C', 'D', 'E'
  solutionHtml: string;
  difficulty: number; // 1-10 scale
  userAnswer?: string;
  isCorrect?: boolean;
  hints: string[];
  solutionChat: ChatMessage[];
  topic?: string; // For AI generated problems
}

export interface ExamConfig {
  realCount: number;
  mockCount: number;
  aiCount: number;
}

export interface ExamSettings {
  levels: ExamLevel[]; // Now supports multiple
  mode: ExamMode;
  timerMode: TimerMode;
  customTimeLimit: number; // in minutes
  config: ExamConfig;
}

export type AppView = 'SETUP' | 'LOADING' | 'EXAM' | 'ANALYSIS' | 'MINI_QUIZ_SETUP';

export interface ExamState {
  view: AppView;
  problems: Problem[];
  currentProblemIndex: number;
  startTime: number;
  endTime: number | null;
  analysis?: string; // AI Text analysis
  suggestedTopics?: string[]; // Topics for mini-quiz
}
