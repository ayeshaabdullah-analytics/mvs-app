const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Ask Gemini to break a weekly goal into daily tasks.
 * @param {string} weeklyGoal  - the goal title
 * @param {string[]} availableDays - e.g. ['Monday','Wednesday','Friday']
 * @returns {Promise<Array<{day: string|null, task: string}>>}
 */
export async function breakdownWeeklyGoal(weeklyGoal, availableDays) {
  const systemPrompt = `You are a flexible study planning assistant. A student will give you a weekly goal and the days they have available. Break the goal into smaller tasks distributed across those days. Do NOT assign any clock times — only assign which day of the week each task belongs to, or leave a task unassigned to a specific day if it's better done whenever the student has time. Output ONLY valid JSON: [{"day": "Monday" or null, "task": "short description"}]. Keep each task under 10 words. Distribute realistically — not every day needs a task.`;

  const userMessage = `Weekly goal: "${weeklyGoal}"\nAvailable days: ${availableDays.join(', ')}`;

  const body = {
    contents: [
      {
        parts: [
          { text: systemPrompt + '\n\n' + userMessage },
        ],
      },
    ],
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip markdown code fences if present
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/**
 * Generate an AI coaching insight for the week.
 * @param {string} weeklyGoalTitle
 * @param {Array<{description: string, done: boolean}>} tasks
 * @returns {Promise<string>}
 */
export async function getCoachInsight(weeklyGoalTitle, tasks) {
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;

  const prompt = `You are an encouraging study coach. A student's weekly goal is: "${weeklyGoalTitle}". They have ${done} of ${total} tasks completed. Write a short 2-3 sentence motivational insight. Never mention clock times, never guilt-trip about gaps. Be warm and specific to their progress.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('Gemini coach error');
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
