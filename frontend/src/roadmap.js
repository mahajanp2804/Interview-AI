// Tasks are plain strings, or { text, auto } when finished sessions can tick them off:
// auto.count sessions matching its other fields (interview_type, difficulty, num_questions).
export const ROADMAP = [
  {
    title: 'Foundation: Interview Mindset',
    color: '#4f8ef7', bg: 'rgba(79,142,247,.15)',
    duration: 'Week 1',
    tasks: [
      'Understand the STAR method (Situation, Task, Action, Result)',
      'Practice "Tell me about yourself" — craft a 90-second pitch',
      'Research the company and role before each practice session',
      'Set up a dedicated practice schedule (3× per week minimum)',
      'Record yourself answering questions and review playback',
      { text: 'Complete 2 Easy sessions on the simulator', auto: { difficulty: 'Easy', count: 2 } },
    ],
  },
  {
    title: 'Technical Core: Data Structures & Algorithms',
    color: '#10b981', bg: 'rgba(16,185,129,.15)',
    duration: 'Weeks 2–4',
    tasks: [
      'Review Big-O notation and complexity analysis',
      'Master Arrays, Strings, HashMaps, Stacks & Queues',
      'Study Trees, Graphs, BFS/DFS traversal',
      'Practice Dynamic Programming patterns (top 20 problems)',
      'Solve 50+ LeetCode Medium problems',
      { text: 'Complete 3 Technical sessions at Medium difficulty', auto: { interview_type: 'Technical', difficulty: 'Medium', count: 3 } },
      'Practice coding on a whiteboard without IDE',
      'Study recursion and backtracking patterns',
    ],
  },
  {
    title: 'System Design & Architecture',
    color: '#f59e0b', bg: 'rgba(245,158,11,.15)',
    duration: 'Weeks 3–5',
    tasks: [
      'Study CAP theorem, consistency models, distributed systems',
      'Design 5 common systems: URL shortener, chat, feed, search, rate limiter',
      'Understand horizontal vs vertical scaling',
      'Learn caching (Redis), SQL/NoSQL, load balancing',
      'Practice drawing architecture diagrams under time pressure',
      { text: 'Complete 2 System Design sessions', auto: { interview_type: 'System Design', count: 2 } },
      'Read "Designing Data-Intensive Applications" chapters 1–5',
    ],
  },
  {
    title: 'Behavioral Mastery',
    color: '#7c3aed', bg: 'rgba(124,58,237,.15)',
    duration: 'Weeks 4–5',
    tasks: [
      'Prepare 5 STAR stories: leadership, conflict, failure, success, teamwork',
      "Map your stories to the company's values",
      'Practice "Why this company?" convincingly',
      'Prepare for: biggest weakness, 5-year plan, salary questions',
      { text: 'Complete 3 Behavioral sessions', auto: { interview_type: 'Behavioral', count: 3 } },
      'Practice live with a friend or mentor',
      'Work on pace, filler words, confident body language',
    ],
  },
  {
    title: 'Role-Specific Deep Dive',
    color: '#ec4899', bg: 'rgba(236,72,153,.15)',
    duration: 'Weeks 5–6',
    tasks: [
      'Study the top 20 technical concepts for your role',
      'Review recent papers, frameworks, or tools for the role',
      { text: 'Complete 2 Hard difficulty sessions', auto: { difficulty: 'Hard', count: 2 } },
      'Study company-specific interview patterns',
      'Build or update a project showing your core skills',
      'Prepare deep-dives on your most impressive past projects',
      'Practice explaining code and architecture decisions aloud',
    ],
  },
  {
    title: 'Final Prep & Polish',
    color: '#ef4444', bg: 'rgba(239,68,68,.15)',
    duration: 'Week 6–7',
    tasks: [
      { text: 'Complete a full 10-question Hard mock interview', auto: { difficulty: 'Hard', num_questions: 10, count: 1 } },
      'Review all weak areas from past sessions',
      'Prepare thoughtful questions to ask the interviewer',
      'Prepare salary negotiation talking points',
      'Run a logistics check: tech setup, location, backup plans',
      'Review your best-performing past sessions for confidence',
      'Get 8 hours of sleep and arrive mentally fresh',
    ],
  },
]

// Which phase helps most with each skill
export const METRIC_PHASE = { technical: 1, problem_solving: 1, communication: 3, clarity: 3, confidence: 3 }

export const taskText = (task) => task.text ?? task

// { done, count } for tasks that sessions can complete, otherwise null
export function autoProgress(task, sessions) {
  if (!task.auto) return null
  const { count, ...match } = task.auto
  const done = sessions.filter(s => s.answers_count > 0 && Object.entries(match).every(([k, v]) => s[k] === v)).length
  return { done: Math.min(done, count), count }
}
