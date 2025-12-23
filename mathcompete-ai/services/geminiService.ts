import { GoogleGenAI, Schema, Type } from "@google/genai";
import { MODEL_FLASH, MODEL_PRO } from "../constants";
import { ExamLevel, Problem, ProblemSource, ChatMessage } from "../types";

// Helper to get client
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found in environment");
  return new GoogleGenAI({ apiKey });
};

// --- Utilities ---

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper for API calls to handle 429 Rate Limits
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota');
    const isServerErr = error?.status >= 500;
    
    if (retries > 0 && (isRateLimit || isServerErr)) {
      console.warn(`API Error (${error.status || 'Unknown'}). Retrying in ${delay}ms... (${retries} left)`);
      await wait(delay);
      return retryWithBackoff(fn, retries - 1, delay * 2); // Exponential backoff
    }
    throw error;
  }
}

// Robust JSON Parser
const parseJsonFromResponse = (text: string | undefined): any => {
  if (!text) return null;
  
  // 1. Clean Markdown wrappers
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').replace(/```/g, '').trim();
  
  // 2. Extract JSON object boundaries
  const first = clean.indexOf('{');
  const firstArr = clean.indexOf('[');
  const last = clean.lastIndexOf('}');
  const lastArr = clean.lastIndexOf(']');
  
  // Detect if array or object is outer
  if (firstArr !== -1 && (first === -1 || firstArr < first)) {
       if (lastArr !== -1) clean = clean.substring(firstArr, lastArr + 1);
  } else if (first !== -1 && last !== -1) {
       clean = clean.substring(first, last + 1);
  }

  // 3. Try parsing
  try {
    return JSON.parse(clean);
  } catch (e) {
    // 4. Heuristic fix for LaTeX backslashes
    // Replace single backslashes with double, but try to avoid messing up already escaped ones
    const fixed = clean.replace(/\\/g, "\\\\").replace(/\\\\\\/g, "\\\\"); 
    try {
        return JSON.parse(fixed);
    } catch (e2) {
        return null;
    }
  }
};

// --- SCRAPER HELPERS ---

const fetchViaProxy = async (url: string, retries = 1): Promise<string> => {
    try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Primary Proxy Error: ${res.status}`);
        const text = await res.text();
        if (!text || text.length < 100) throw new Error("Empty contents");
        return text; 
    } catch (e) {
        if (retries > 0) {
            try {
                const backupUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
                const res = await fetch(backupUrl);
                if (!res.ok) throw new Error(`Backup Proxy Error: ${res.status}`);
                const data = await res.json();
                if (!data.contents) throw new Error("Empty contents from backup");
                return data.contents;
            } catch (e2) {
                console.warn("Both proxies failed");
                throw e2;
            }
        }
        throw e;
    }
};

const cleanAndRestoreLatex = (rawHtml: string): { html: string, images: string[] } => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${rawHtml}</div>`, 'text/html');
    const images: string[] = [];

    const latexImages = doc.querySelectorAll('img.latex, img.latexcenter');
    latexImages.forEach(img => {
        const alt = img.getAttribute('alt');
        if (alt && !alt.trim().startsWith('[asy]')) {
            const span = doc.createElement('span');
            span.textContent = ` ${alt} `; 
            img.replaceWith(span);
        }
    });

    const contentImages = doc.querySelectorAll('img'); 
    contentImages.forEach(img => {
        let src = img.getAttribute('src');
        if (src) {
            if (src.startsWith('//')) src = 'https:' + src;
            else if (src.startsWith('/')) src = 'https://artofproblemsolving.com' + src;
            img.setAttribute('src', src);
            if (!images.includes(src)) images.push(src);
        }
    });

    const links = doc.querySelectorAll('a');
    links.forEach(a => {
        const href = a.getAttribute('href');
        if (href && href.startsWith('/')) {
            a.setAttribute('href', `https://artofproblemsolving.com${href}`);
            a.setAttribute('target', '_blank');
        }
    });

    return { html: doc.body.innerHTML, images };
};

// Helper: If regex fails to find the answer, ask Gemini Flash to find it in the solution text.
const extractCorrectOptionWithAI = async (solutionText: string): Promise<string> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: `Identify the final answer letter (A, B, C, D, or E) from this math solution text.
            
            Solution: "${solutionText.substring(0, 1000)}..."
            
            Return ONLY the letter. If not found, return X.`,
        });
        const text = response.text?.trim().toUpperCase().replace(/[^A-E]/g, '') || "";
        return text.length > 0 ? text[0] : "";
    } catch (e) {
        return "";
    }
};

export const fetchAoPSProblem = async (url: string, id: string, level: ExamLevel): Promise<Problem | null> => {
  try {
      const html = await fetchViaProxy(url);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const contentDiv = doc.querySelector('.mw-parser-output');
      if (!contentDiv) throw new Error("Could not find content (.mw-parser-output)");

      contentDiv.querySelectorAll('.toc, #toc').forEach(e => e.remove());
      contentDiv.querySelectorAll('dl').forEach(e => {
         if (e.textContent?.includes('following problem is from') || e.textContent?.includes('redirects to this page')) {
             e.remove();
         }
      });

      let curr: Element | null = null;
      let mode: 'question' | 'solution' | 'done' = 'question';
      
      const problemHeader = Array.from(contentDiv.querySelectorAll('h2')).find(h => 
          h.id === 'Problem' || h.textContent?.trim() === 'Problem' || h.querySelector('#Problem')
      );

      if (problemHeader) {
          curr = problemHeader.nextElementSibling;
      } else {
          curr = contentDiv.firstElementChild;
      }

      let questionAccumulator = "";
      let solutionAccumulator = "";

      while (curr) {
          const tag = curr.tagName;
          const text = curr.textContent || "";
          const id = curr.id || curr.querySelector('.mw-headline')?.id || "";

          if (tag === 'H2') {
               if (text.includes("Solution") || id.includes("Solution") || text.includes("Video Solution")) {
                   mode = 'solution';
                   const h3Title = curr.textContent?.trim();
                   solutionAccumulator += `<h3 class="font-bold text-lg mt-6 mb-3 text-slate-800 border-b border-slate-200 pb-2">${h3Title}</h3>`;
                   curr = curr.nextElementSibling;
                   continue;
               } 
               
               if (text.includes("See also") || text.includes("See Also") || id.includes("See_Also")) {
                   mode = 'done';
                   break;
               }
          }

          if (mode === 'question') {
              questionAccumulator += curr.outerHTML;
          } else if (mode === 'solution') {
              solutionAccumulator += curr.outerHTML;
          }

          curr = curr.nextElementSibling;
      }

      if (!questionAccumulator.trim()) throw new Error("No question content found");

      const questionData = cleanAndRestoreLatex(questionAccumulator);
      const solutionData = cleanAndRestoreLatex(solutionAccumulator || "<p>Solution parsing failed.</p>");

      // Regex Extraction
      let correctOption = "";
      const boxedMatch = solutionData.html.match(/\\boxed\s*\{\s*\\?textbf\s*\{\s*\(?\s*([A-E])\s*\)?\s*\}\s*\}/i) 
                      || solutionData.html.match(/\\boxed\s*\{\s*\(?\s*([A-E])\s*\)?\s*\}/i);

      if (boxedMatch) {
          correctOption = boxedMatch[1];
      } else {
          const cleanSolText = solutionData.html.replace(/<[^>]+>/g, '');
          const textMatch = cleanSolText.match(/answer is\s*\(?([A-E])\)?/i);
          if (textMatch) correctOption = textMatch[1];
      }

      // Fallback: AI Extraction if regex fails
      if (!correctOption) {
          correctOption = await extractCorrectOptionWithAI(solutionData.html);
      }

      return {
          id,
          source: ProblemSource.AOPS,
          originalUrl: url,
          questionHtml: questionData.html,
          images: questionData.images,
          options: ["A", "B", "C", "D", "E"],
          correctOption: correctOption || "", // Empty string handled in UI
          solutionHtml: solutionData.html,
          difficulty: 5, // Placeholder, will be graded by AI or Heuristic later
          hints: [],
          solutionChat: []
      };

  } catch (e) {
      console.warn(`Scraping error for ${url}:`, e);
      return null;
  }
};

export const fetchMockProblem = async (level: ExamLevel, id: string): Promise<Problem | null> => {
  const ai = getAiClient();
  const prompt = `
    Find a unique practice problem from a mock ${level} competition online.
    Extract problem text, solve it, and provide the correct option.
    OUTPUT JSON: { "questionHtml": "...", "correctOption": "A", "solutionHtml": "..." }
  `;

  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
        model: MODEL_FLASH, 
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    
    const data = parseJsonFromResponse(response.text);
    if (!data || !data.questionHtml) throw new Error("Failed to parse JSON content.");

    return {
        id,
        source: ProblemSource.MOCK,
        questionHtml: data.questionHtml,
        images: [],
        options: ["A", "B", "C", "D", "E"],
        correctOption: data.correctOption?.toString() || "",
        solutionHtml: data.solutionHtml || "",
        difficulty: 5, // Graded later
        hints: [],
        solutionChat: []
    };
  });
};

export const generateAIProblem = async (
    level: ExamLevel, 
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme', 
    id: string,
    topic?: string,
    model: string = MODEL_PRO
): Promise<Problem> => {
  const ai = getAiClient();
  const topicInstruction = topic ? `The problem MUST be about: ${topic}.` : "The problem topic should be random.";
  const prompt = `
    Create a unique math competition problem for ${level}. Difficulty: ${difficulty}. ${topicInstruction}
    Use LaTeX. Provide 5 options. Step-by-step solution.
    
    OUTPUT JSON with keys: questionHtml, options (array of A-E texts), correctOption (Letter), solutionHtml, estimatedDifficulty (1-10 integer).
  `;

  return retryWithBackoff(async () => {
    const config: any = { responseMimeType: "application/json" };
    if (model === MODEL_PRO) config.thinkingConfig = { thinkingBudget: 1024 };

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config
    });

    const data = parseJsonFromResponse(response.text);
    if (!data) throw new Error("Invalid JSON from AI Generation");
    
    // Fallback logic for difficulty if AI returns "Medium" string instead of int
    let numDiff = 5;
    if (typeof data.estimatedDifficulty === 'number') {
        numDiff = data.estimatedDifficulty;
    } else {
        const dStr = String(data.estimatedDifficulty || difficulty);
        if (dStr.includes('Easy')) numDiff = 3;
        else if (dStr.includes('Medium')) numDiff = 5;
        else if (dStr.includes('Hard')) numDiff = 8;
        else if (dStr.includes('Extreme')) numDiff = 10;
    }

    // Ensure 1-10 range
    numDiff = Math.max(1, Math.min(10, numDiff));

    return {
        id,
        source: ProblemSource.AI_GENERATED,
        questionHtml: data.questionHtml,
        images: [],
        options: data.options || ["A", "B", "C", "D", "E"],
        correctOption: data.correctOption?.toString(),
        solutionHtml: data.solutionHtml,
        difficulty: numDiff,
        hints: [],
        solutionChat: [],
        topic: topic
    };
  });
};

// --- AI GRADING & RANKING ---
export const gradeProblemsByDifficulty = async (problems: Problem[]): Promise<Problem[]> => {
    const ai = getAiClient();
    
    // Create concise summaries to save tokens
    const problemSummaries = problems.map((p, i) => ({
        id: p.id,
        text: p.questionHtml.substring(0, 200).replace(/<[^>]+>/g, '') // strip html
    }));

    const prompt = `
        Assign a difficulty level (1-10) to each math problem. 
        1 is very easy (early AMC 8). 10 is very hard (late AMC 10/12).
        Ensure the full range 1-10 is used appropriately based on standard competition difficulty.
        Input: ${JSON.stringify(problemSummaries)}
        Output JSON: [{ "id": "problem_id", "difficulty": 5 }, ...]
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const grades = parseJsonFromResponse(response.text);
        if (Array.isArray(grades)) {
            // Apply grades
            grades.forEach((g: any) => {
                const p = problems.find(pr => pr.id === g.id);
                if (p && typeof g.difficulty === 'number') {
                    p.difficulty = Math.max(1, Math.min(10, g.difficulty));
                }
            });
        }
    } catch (e) {
        console.warn("Grading failed, keeping original difficulties", e);
    }

    // Sort ascending by difficulty
    return problems.sort((a, b) => a.difficulty - b.difficulty);
};

export const getProblemHint = async (problem: Problem): Promise<string> => {
  const ai = getAiClient();
  const prompt = `
    You are an expert math competition coach. A student is stuck.
    
    Problem: ${problem.questionHtml}
    Correct Answer: ${problem.correctOption}
    Official Solution Snippet: ${problem.solutionHtml.substring(0, 500)}...
    
    Previous hints given: ${JSON.stringify(problem.hints)}
    
    Give a subtle, nudging hint. 
    1. Do NOT reveal the answer.
    2. Do NOT just say "Use the formula". Explain the intuition.
    3. Keep it short (under 30 words).
    4. Use LaTeX for math.
  `;

  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
    });
    return response.text || "Try visualizing the problem or working backwards.";
  });
};

export const getSolutionExplanation = async (problem: Problem, userQuery: string, history: ChatMessage[]): Promise<string> => {
  const ai = getAiClient();
  const historyText = history.map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`).join('\n');
  
  const prompt = `
    You are a friendly math tutor.
    Problem: ${problem.questionHtml}
    Solution: ${problem.solutionHtml}
    
    Chat History:
    ${historyText}
    
    Student: ${userQuery}
    
    Explain the concept clearly. Use LaTeX. Be encouraging.
  `;

  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 1024 } }
    });
    return response.text || "I'm having trouble explaining that right now.";
  });
};

export const analyzePerformance = async (problems: Problem[]): Promise<{ analysis: string, topics: string[] }> => {
  const ai = getAiClient();
  const data = problems.map(p => ({
    diff: p.difficulty,
    topic: p.topic || "General",
    correct: p.isCorrect
  }));

  const prompt = `
    Analyze this student's math test performance: ${JSON.stringify(data)}
    
    1. Short analysis (strength/weakness).
    2. 3 specific topics to practice.
    Output JSON: { "analysis": "...", "topics": [...] }
  `;

  try {
      const response = await ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const res = parseJsonFromResponse(response.text);
      return {
          analysis: res.analysis || "Great job completing the exam!",
          topics: res.topics || ["Algebra", "Geometry", "Counting"]
      };
  } catch (e) {
      return { analysis: "Analysis unavailable.", topics: ["General Math"] };
  }
};