import { ExamLevel, Problem, ExamConfig, ProblemSource, ExamMode } from "../types";
import { AMC8_START_YEAR, AMC10_12_START_YEAR, CURRENT_YEAR, MODEL_FLASH } from "../constants";
import { fetchAoPSProblem, fetchMockProblem, generateAIProblem, gradeProblemsByDifficulty } from "./geminiService";

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Construct AoPS URL & Return Metadata
const getAoPSUrlAndMeta = (level: ExamLevel): { url: string, problemNum: number } => {
  let year = CURRENT_YEAR;
  let url = "";
  let problemNum = 1;

  if (level === ExamLevel.AMC8) {
    year = randomInt(AMC8_START_YEAR, CURRENT_YEAR);
    problemNum = randomInt(1, 25);
    if (year <= 1998) {
      url = `https://artofproblemsolving.com/wiki/index.php?title=${year}_AJHSME_Problems/Problem_${problemNum}`;
    } else {
      url = `https://artofproblemsolving.com/wiki/index.php?title=${year}_AMC_8_Problems/Problem_${problemNum}`;
    }
  } else {
    // AMC 10 or 12
    year = randomInt(AMC10_12_START_YEAR, CURRENT_YEAR);
    problemNum = randomInt(1, 25);
    const is10 = level === ExamLevel.AMC10;
    const type = is10 ? "10" : "12";
    
    if (year >= 2000 && year <= 2001) {
       url = `https://artofproblemsolving.com/wiki/index.php?title=${year}_AMC_${type}P_Problems/Problem_${problemNum}`;
    } else if (year === 2021) {
       const variants = ["AMC_" + type + "A", "AMC_" + type + "B", "Fall_AMC_" + type + "A", "Fall_AMC_" + type + "B"];
       const variant = variants[randomInt(0, 3)];
       url = `https://artofproblemsolving.com/wiki/index.php?title=${year}_${variant}/Problem_${problemNum}`;
    } else {
       const variant = Math.random() > 0.5 ? "A" : "B";
       url = `https://artofproblemsolving.com/wiki/index.php?title=${year}_AMC_${type}${variant}/Problem_${problemNum}`;
    }
  }
  
  return { url, problemNum };
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateExam = async (levels: ExamLevel[], config: ExamConfig, mode: ExamMode, onProgress: (msg: string, percent: number) => void): Promise<Problem[]> => {
  const problems: Problem[] = [];
  const isWarmup = mode === ExamMode.WARMUP;
  const totalTasks = config.realCount + config.mockCount + config.aiCount;
  let completedTasks = 0;

  const updateProgress = (msg: string) => {
    completedTasks++;
    const percent = Math.min(90, Math.floor((completedTasks / totalTasks) * 90));
    onProgress(msg, percent);
  };

  const getRandomLevel = () => levels[randomInt(0, levels.length - 1)];

  // 1. Real Problems
  const generatedUrls = new Set<string>();
  
  for (let i = 0; i < config.realCount; i++) {
    const lvl = getRandomLevel();
    let p: Problem | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    let chosenProblemNum = 1;

    while (!p && attempts < MAX_ATTEMPTS) {
        const { url, problemNum } = getAoPSUrlAndMeta(lvl);
        chosenProblemNum = problemNum;
        
        if (generatedUrls.has(url)) {
            attempts++;
            continue;
        }

        try {
            p = await fetchAoPSProblem(url, `real-${i}`, lvl);
        } catch (e) {
            // fail silent
        }

        if (p) {
            generatedUrls.add(url);
            // Apply Warmup Difficulty Heuristic: (Num / 25) * 10
            if (isWarmup) {
                p.difficulty = Math.ceil((chosenProblemNum / 25) * 10);
                // Ensure range [1, 10]
                p.difficulty = Math.max(1, Math.min(10, p.difficulty));
            }
            await delay(750);
        } else {
            attempts++;
            await delay(200); 
        }
    }

    if (p) {
        problems.push(p);
    } else {
        console.warn(`Could not find a valid real problem for slot ${i} after ${MAX_ATTEMPTS} attempts.`);
    }

    updateProgress(`Fetching AoPS Archives... (${problems.length} found)`);
  }

  // 2. Mock Problems
  for (let i = 0; i < config.mockCount; i++) {
    const lvl = getRandomLevel();
    try {
        const p = await fetchMockProblem(lvl, `mock-${i}`);
        if (p) problems.push(p);
    } catch (e) {
        console.error("Mock fetch failed", e);
    }
    updateProgress(`Finding Online Mocks...`);
  }

  // 3. AI Problems
  const difficulties: ('Easy' | 'Medium' | 'Hard')[] = ['Easy', 'Medium', 'Hard'];
  for (let i = 0; i < config.aiCount; i++) {
    const lvl = getRandomLevel();
    const diff = difficulties[i % 3];
    try {
        const p = await generateAIProblem(lvl, diff, `ai-${i}`);
        if (p) problems.push(p);
    } catch(e) {
        console.error("AI generation failed", e);
    }
    updateProgress(`Generating Fresh Problems...`);
  }

  // 4. Grading & Sorting (SKIP FOR WARMUP)
  if (problems.length > 0) {
      if (isWarmup) {
          onProgress("Sorting warmup problems...", 98);
          // Just sort based on the heuristic difficulty we already assigned
          return problems.sort((a, b) => a.difficulty - b.difficulty);
      } else {
          onProgress("AI is grading problem difficulties...", 95);
          const sortedProblems = await gradeProblemsByDifficulty(problems);
          onProgress("Finalizing exam...", 100);
          return sortedProblems;
      }
  }
  
  return problems;
};

export const generateMiniQuiz = async (topic: string, level: ExamLevel): Promise<Problem[]> => {
    const problems: Problem[] = [];
    for(let i=0; i<5; i++) {
        const diff = i < 2 ? 'Easy' : i < 4 ? 'Medium' : 'Hard';
        try {
            const p = await generateAIProblem(level, diff, `quiz-${i}`, topic, MODEL_FLASH);
            if (p) problems.push(p);
        } catch (e) {}
    }
    return gradeProblemsByDifficulty(problems);
};

export const fetchRandomProblem = async (levels: ExamLevel[]): Promise<Problem | null> => {
    return null; 
};