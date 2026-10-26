# InterviewAI Simulator

Practice mock interviews with an AI interviewer. Pick a role, level and interview style, answer questions in a chat, get each answer scored as you go, and finish with a full feedback report.

## Features

- **Configurable interviews:** 8 roles (SWE, AI/ML, data science, frontend, backend, full stack, DevOps, PM), 4 experience levels, Technical / Behavioral / Mixed / System Design, Easy–Hard, optional company style, 3–10 questions.
- **Live evaluation:** every answer is scored on technical depth, communication, clarity, confidence and problem solving, with strengths and improvements.
- **Hints and skips** during the interview.
- **Feedback report:** overall score and grade, per-skill scores, prioritised recommendations, and a verdict for each question.
- **History:** past sessions with average and best score and a daily streak.
- **Roadmap:** a 6-phase interview prep checklist.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Axios |
| Backend | FastAPI, SQLAlchemy (async), SQLite |
| AI | Google Gemini via the [`google-genai`](https://pypi.org/project/google-genai/) SDK, with structured JSON output |

## Getting started

**Requirements:** Python 3.11+, Node 18+, and a free Gemini API key from [Google AI Studio](https://aistudio.google.com).

```bash
make install        # creates backend/venv, installs deps, copies .env.example → backend/.env
```

Open `backend/.env` and set `GEMINI_API_KEY`. Then run each server in its own terminal:

```bash
make backend        # http://localhost:8000  (API docs at /docs)
make frontend       # http://localhost:5173
```

<details>
<summary>Without make</summary>

```bash
cd backend
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt
cp .env.example .env            # then add your key
venv/bin/python -m uvicorn app.main:app --reload --port 8000

cd frontend
npm install
npm run dev
```
</details>

## Configuration (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | — (required) | Google AI Studio key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Any current Gemini model id |
| `DATABASE_URL` | `sqlite+aiosqlite:///./interviewai.db` | SQLAlchemy async URL |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins |

## How to use

1. **Setup tab:** pick your role, level, type, difficulty, company style and question count.
2. Click **Start Interview**. Your AI interviewer introduces themselves and asks the first question.
3. **Type your answers** in the text area (Ctrl/⌘ + Enter to submit quickly).
4. Use the **sidebar** to watch your live score, see which questions are done, request a hint or skip.
5. After the last question the interview ends on its own (or click **End & get feedback** at any time), and you're taken to the **Feedback tab**.
6. Review your scores and recommendations, then check the **Roadmap tab** to plan next steps.
7. All past sessions appear in the **History tab**.

## Tips for best results

- **Behavioral questions:** use the STAR method (Situation, Task, Action, Result).
- **Technical questions:** think out loud and explain your reasoning before jumping to an answer.
- **System design:** start with requirements, then components, then scale concerns.
- **Be specific:** vague answers score lower than detailed ones with real examples.
- **Practice consistently:** aim for 3 sessions per week, varying difficulty and role.

## How it works

```
React (Vite :5173) ──/api proxy──▶ FastAPI (:8000) ──▶ Gemini
                                        │
                                        └──▶ SQLite (sessions)
```

| Endpoint | Purpose |
|---|---|
| `POST /api/interview/questions` | Generate questions. Falls back to a built-in bank if Gemini is unavailable (`fallback: true`) |
| `POST /api/interview/evaluate` | Score one answer |
| `POST /api/interview/feedback` | Build the final report |
| `POST /api/interview/hint` | One-sentence hint |
| `POST /api/sessions/save`, `GET /api/sessions/`, `GET/DELETE /api/sessions/{uid}`, `GET /api/sessions/stats/summary` | Session history |

If Gemini fails (bad key, rate limit, network), the evaluate, feedback and hint endpoints return **HTTP 503** with a readable `detail`. The UI shows that message and lets you retry. It never invents a score.

## Project structure

```
backend/
  app/
    main.py          FastAPI app, CORS, error handling
    ai_service.py    Gemini prompts, structured output schemas, fallback questions
    routers/         interview + sessions endpoints
    database.py      SQLAlchemy model (sessions table)
    schemas.py       request/response models
frontend/
  src/
    pages/           Setup, Interview, Feedback, History, Roadmap
    AppContext.jsx   global state (config + active session)
    api.js           API client
```

## Roadmap

See [PLANNER.md](PLANNER.md) for the improvement plan.

## Limitations

- No user accounts yet: everyone using the same backend shares one session history.
- Roadmap progress is stored in your browser's localStorage, and clearing it resets the checklist.
- Refreshing the page mid-interview loses the session in progress.
- Coding interviews (live code editor) and resume / job-description based questions are planned. See [PLANNER.md](PLANNER.md).

## License

Built as a personal practice tool. Free to use and extend.
