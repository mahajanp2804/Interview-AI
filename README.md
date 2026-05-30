# 🎯 InterviewAI Simulator

> A fully AI-powered interview practice platform built inside Claude. Conduct realistic mock interviews, get instant feedback, track your progress, and follow a structured roadmap to interview mastery.

---

## What It Does

InterviewAI Simulator acts as a real interviewer. You configure your target role, experience level, and interview type — then an AI interviewer asks you questions, evaluates your answers in real time, probes with follow-ups, and delivers comprehensive post-interview feedback.

---

## Features

### Interview Setup
- **8 roles supported:** AI/ML Engineer, Software Engineer, Data Scientist, Frontend Dev, Backend Dev, Full Stack, DevOps, Product Manager
- **4 experience levels:** Intern/Fresher, Junior, Mid-level, Senior
- **4 interview types:** Technical, Behavioral, Mixed, System Design
- **3 difficulty levels:** Easy, Medium, Hard
- **Company style presets:** FAANG, Startup, Consulting, or a custom company name
- **Flexible length:** 3, 5, 8, or 10 questions per session

### Live Interview
- AI-generated, role-specific questions on every session
- Real-time answer evaluation after each response
- Live scoring dashboard (Technical, Communication, Clarity, Confidence)
- Hint system — request a subtle nudge without spoiling the answer
- Skip questions (noted in your final score)
- End the interview at any time for immediate feedback

### Feedback & Analysis
- Overall score (0–100) with letter grade (A+ through D)
- Five-axis breakdown: Technical, Communication, Clarity, Confidence, Problem Solving
- Strengths and improvement areas per question
- Question-by-question review with expandable detail
- Personalized recommendations with priority levels
- Readiness assessment for your next career level

### History Tracking
- Full session history stored locally in your browser
- Stats: total sessions, average score, best score, streak counter
- Per-session details: role, level, difficulty, date, duration, score

### Roadmap
- 6-phase structured learning path from foundation to final prep
- ~45 actionable tasks with checkboxes
- Progress bars per phase and overall
- Tasks persist across browser sessions via localStorage

---

## How to Use

1. **Setup tab** — pick your role, level, type, difficulty, company style, and question count
2. Click **Start Interview** — your AI interviewer introduces themselves and begins
3. **Type your answers** in the text area (Ctrl+Enter to submit quickly)
4. Use the **sidebar** to monitor your live score, view question status, or request a hint
5. After all questions (or when you click "End & get feedback"), you're taken to the **Feedback tab**
6. Review your scores, read recommendations, then check the **Roadmap tab** to plan next steps
7. All past sessions appear in the **History tab**

---

## Tips for Best Results

- **Behavioral questions:** Use the STAR method — Situation, Task, Action, Result
- **Technical questions:** Think out loud, explain your reasoning before jumping to an answer
- **System design:** Start with requirements, then components, then scale concerns
- **Be specific:** Vague answers score lower than detailed ones with real examples
- **Practice consistently:** Aim for 3 sessions per week, varying difficulty and role

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| AI Engine | Claude Sonnet 4 via Anthropic API |
| Persistence | Browser localStorage |
| Hosting | Runs as a Claude Artifact (no server needed) |

---

## Limitations

- Requires an active Anthropic API connection (handled automatically inside Claude)
- Session history and roadmap progress are stored per-browser — clearing localStorage resets them
- Coding interview mode (live code execution) is planned for a future version
- Resume-based question generation requires manual paste of resume content in the Custom Company field as a workaround until the feature is built

---

## Roadmap Phases (Summary)

| Phase | Focus | Timeline |
|---|---|---|
| 1 | Interview mindset & STAR method | Week 1 |
| 2 | Data structures & algorithms | Weeks 2–4 |
| 3 | System design & architecture | Weeks 3–5 |
| 4 | Behavioral mastery | Weeks 4–5 |
| 5 | Role-specific deep dive | Weeks 5–6 |
| 6 | Final prep & polish | Week 6–7 |

---

## License

Built as a personal practice tool. Free to use and extend.
