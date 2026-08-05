const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

async function groqChat(messages) {
  if (!GROQ_API_KEY) throw new Error('VITE_GROQ_API_KEY is not set in .env');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.7 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Break a weekly goal into daily tasks.
 * @param {string} weeklyGoal
 * @param {string[]} availableDays  e.g. ['Monday','Wednesday','Friday']
 * @returns {Promise<Array<{day: string|null, task: string}>>}
 */
export async function breakdownWeeklyGoal(weeklyGoal, availableDays) {
  const system = `You are a supportive planning assistant helping someone break down a goal into manageable tasks. The goal could be for work, study, health, a personal project, or any other area of life. Break the goal into smaller tasks distributed across the available days. Do NOT assign any clock times — only assign which day of the week each task belongs to, or leave a task unassigned if it's better done whenever there is time. Output ONLY valid JSON: [{"day": "Monday" or null, "task": "short description"}]. Keep each task under 10 words. Distribute realistically — not every day needs a task.`;

  const user = `Weekly goal: "${weeklyGoal}"\nAvailable days: ${availableDays.join(', ')}`;

  const text = await groqChat([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);

  // Strip markdown code fences if present
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/**
 * Generate a coaching insight for the week.
 * @param {string} weeklyGoalTitle
 * @param {Array<{description: string, done: boolean}>} tasks
 * @returns {Promise<string>}
 */
export async function getCoachInsight(weeklyGoalTitle, tasks) {
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;

  const prompt = `You are an encouraging life-goal coach. Someone's weekly goal is: "${weeklyGoalTitle}". They have ${done} of ${total} tasks completed. Write a short 2-3 sentence motivational insight. Never mention clock times, never guilt-trip about gaps. Be warm and specific to their progress.`;

  return groqChat([{ role: 'user', content: prompt }]);
}
