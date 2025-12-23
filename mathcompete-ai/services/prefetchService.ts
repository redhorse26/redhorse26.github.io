import { ExamLevel, Problem } from "../types";
import { fetchAoPSProblem } from "./geminiService";
import { AMC8_START_YEAR, AMC10_12_START_YEAR, CURRENT_YEAR } from "../constants";

interface PrefetchTask {
    url: string;
    id: string;
    level: ExamLevel;
    year: number;
    examType: string; // "AMC 8", "AMC 10A", etc.
}

export interface PrefetchStats {
    total: number;
    success: number;
    failed: number;
    currentYear: number;
    currentExam: string;
}

// Generate the FULL catalog in specific order: AMC8 -> AMC10 -> AMC12, Newest to Oldest
export const generateFullCatalogQueue = (): PrefetchTask[] => {
    const queue: PrefetchTask[] = [];

    // Helper to push tasks
    const addTask = (y: number, lvl: ExamLevel, wikiName: string, display: string, idSuffix: string, count: number) => {
         for (let i = 1; i <= count; i++) {
            queue.push({
                url: `https://artofproblemsolving.com/wiki/index.php?title=${y}_${wikiName}_Problems/Problem_${i}`,
                id: `${y}-${idSuffix}-${i}`,
                level: lvl,
                year: y,
                examType: display
            });
        }
    };

    // 1. AMC 8 (Current -> 1985)
    for (let y = CURRENT_YEAR; y >= AMC8_START_YEAR; y--) {
        const isAjhsme = y <= 1998;
        const name = isAjhsme ? "AJHSME" : "AMC_8";
        const display = isAjhsme ? "AJHSME" : "AMC 8";
        addTask(y, ExamLevel.AMC8, name, display, "amc8", 25);
    }

    // 2. AMC 10 (Current -> 2000)
    for (let y = CURRENT_YEAR; y >= AMC10_12_START_YEAR; y--) {
        if (y === 2000 || y === 2001) {
            addTask(y, ExamLevel.AMC10, "AMC_10", "AMC 10", "amc10", 25);
        } else {
            // A and B
            addTask(y, ExamLevel.AMC10, "AMC_10A", "AMC 10A", "amc10a", 25);
            addTask(y, ExamLevel.AMC10, "AMC_10B", "AMC 10B", "amc10b", 25);
        }
    }

    // 3. AMC 12 (Current -> 2000)
    for (let y = CURRENT_YEAR; y >= AMC10_12_START_YEAR; y--) {
        if (y === 2000 || y === 2001) {
            addTask(y, ExamLevel.AMC12, "AMC_12", "AMC 12", "amc12", 25);
        } else {
            // A and B
            addTask(y, ExamLevel.AMC12, "AMC_12A", "AMC 12A", "amc12a", 25);
            addTask(y, ExamLevel.AMC12, "AMC_12B", "AMC 12B", "amc12b", 25);
        }
    }

    return queue;
};

// Generate a random 10-question queue for testing
export const generateTestQueue = (): PrefetchTask[] => {
    const full = generateFullCatalogQueue();
    const testQueue: PrefetchTask[] = [];
    // Pick 10 random unique indices
    const indices = new Set<number>();
    while (indices.size < 10 && indices.size < full.length) {
        indices.add(Math.floor(Math.random() * full.length));
    }
    indices.forEach(i => testQueue.push(full[i]));
    return testQueue;
};

// Delay helper
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

// Runner
export const processPrefetchQueue = async (
    queue: PrefetchTask[], 
    onProgress: (stats: PrefetchStats, log: string, result?: Problem) => void,
    stopSignal: { stop: boolean }
) => {
    let success = 0;
    let failed = 0;

    for (let i = 0; i < queue.length; i++) {
        if (stopSignal.stop) break;

        const task = queue[i];
        onProgress({
            total: queue.length,
            success,
            failed,
            currentYear: task.year,
            currentExam: task.examType
        }, `Fetching [${i+1}/${queue.length}]: ${task.examType} #${task.id.split('-').pop()}...`);

        try {
            // Attempt fetch
            const problem = await fetchAoPSProblem(task.url, task.id, task.level);
            
            if (problem) {
                success++;
                onProgress({
                    total: queue.length,
                    success,
                    failed,
                    currentYear: task.year,
                    currentExam: task.examType
                }, `SUCCESS: ${task.id}`, problem);
            } else {
                failed++;
                onProgress({
                    total: queue.length,
                    success,
                    failed,
                    currentYear: task.year,
                    currentExam: task.examType
                }, `FAILED: ${task.id} (No data returned)`);
            }
        } catch (e) {
            failed++;
            console.error(e);
            onProgress({
                total: queue.length,
                success,
                failed,
                currentYear: task.year,
                currentExam: task.examType
            }, `ERROR: ${task.id} - ${(e as Error).message}`);
        }

        // Reduced delay for speed (was 2500)
        await wait(800); 
    }
};