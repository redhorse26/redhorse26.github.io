import { ExamLevel } from "./types";

export const EXAM_TIME_LIMITS: Record<ExamLevel, number> = {
  [ExamLevel.AMC8]: 40 * 60, // 40 minutes
  [ExamLevel.AMC10]: 75 * 60, // 75 minutes
  [ExamLevel.AMC12]: 75 * 60, // 75 minutes
};

// Gemini Models
export const MODEL_FLASH = 'gemini-3-flash-preview';
export const MODEL_PRO = 'gemini-3-pro-preview'; // High reasoning

// AoPS Range Constants
export const AMC8_START_YEAR = 1985;
export const AMC10_12_START_YEAR = 2000;
export const AIME_START_YEAR = 1983;
export const CURRENT_YEAR = 2025;

// SET THIS TO TRUE TO ENTER SCRAPING MODE
export const PRE_FETCH_MODE = false;