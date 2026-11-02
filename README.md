# InterviewAI Simulator

Practice mock interviews with an AI interviewer. Pick a role, level and interview style, answer questions in a chat, get each answer scored as you go, and finish with a full feedback report.

## Features

- **Accounts:** sign in with email and password. Your sessions and progress are private to your account.
- **Configurable interviews:** 8 roles (SWE, AI/ML, data science, frontend, backend, full stack, DevOps, PM), 4 experience levels, Technical / Behavioral / Mixed / System Design / Coding, Easy–Hard, optional company style, 3–10 questions.
- **Tailored questions:** upload a PDF resume or paste one, add a job description, and questions are written around your experience and the role. Questions you've already had are avoided.
- **Live evaluation:** every answer is scored on technical depth, communication, clarity, confidence and problem solving, and the interviewer's feedback streams in as it's written.
- **Adaptive follow-ups:** a weak answer gets one probing follow-up about its biggest gap. A better follow-up answer lifts that question's score; a worse one never lowers it.
- **Timers:** each question has a soft countdown (2 min behavioral, 3 technical, 5 system design, 10 coding) that shows overtime but doesn't stop you. Time taken appears in the report.
- **Code editor:** coding questions open a syntax-highlighted editor (Python, JavaScript, Java, C++), and any question can switch to it. The AI reviews the code; it isn't run.
- **Voice:** dictate answers and have questions read aloud, using your browser's speech features.
- **Hints and skips:** one hint per question, costing 5 points.
- **Feedback report:** overall score and grade, per-skill scores, prioritised recommendations, a verdict for each question, follow-ups, time taken, and what a strong answer would include.
- **History:** past sessions with average and best score and a daily streak. Open any session to reread its full report.
- **Progress dashboard:** score trend, skills from weakest up, and your weakest topics, with a one-click drill on the three weakest.
- **Smart roadmap:** a 6-phase prep checklist that recommends a phase from your weakest skill and ticks "complete N sessions" tasks from your real sessions.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, React Router, CodeMirror, Web Speech API |
| Backend | FastAPI, SQLAlchemy (async), Alembic, SQLite or Postgres, pypdf |
| Deployment | Docker, nginx |
| AI | Google Gemini via the [`google-genai`](https://pypi.org/project/google-genai/) SDK, with structured JSON output |

## Getting started

**Requirements:** Python 3.11+, Node 22.12+, and a free Gemini API key from [Google AI Studio](https://aistudio.google.com).

```bash
make install        # creates backend/venv, installs deps, copies .env.example → backend/.env
```

Open `backend/.env` and set `GEMINI_API_KEY`. Then run each server in its own terminal:

```bash
make backend        # http://localhost:8000  (API docs at /docs)
make frontend       # http://localhost:5173
```

`make backend` applies database migrations first. If you have an older local database, its sessions are kept and go to the first account you create.

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

## Run with Docker

This runs everything (Postgres, the API, and nginx serving the built app) on one port:

```bash
cp .env.example .env    # then set GEMINI_API_KEY and POSTGRES_PASSWORD
docker compose up --build
```

Open http://localhost:8080. Data is kept in a Docker volume, and migrations run when the backend starts. Behind HTTPS, set `COOKIE_SECURE=true`.

## Configuration (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | — (required) | Google AI Studio key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Any current Gemini model id |
| `DATABASE_URL` | `sqlite+aiosqlite:///./interviewai.db` | SQLAlchemy async URL |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins |
| `COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS |
| `LOG_FORMAT` | `text` | `json` for one JSON object per line |
| `AI_RATE_LIMIT` | `30/minute` | Per account, on each AI endpoint |
| `AUTH_RATE_LIMIT` | `10/minute` | Per IP address, on sign-in and sign-up |

## How to use

1. **Setup tab:** pick your role, level, type, difficulty, company style and question count. Optionally add your resume and a job description.
2. Click **Start Interview**. Your AI interviewer introduces themselves and asks the first question.
3. **Type or dictate your answers** (Ctrl/⌘ + Enter to submit quickly). Use **Code** to answer in the editor.
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
| `POST /api/auth/register`, `login`, `logout`, `GET /api/auth/me` | Accounts. Everything under `/api/interview` and `/api/sessions` needs sign-in |
| `POST /api/interview/resume` | Extract text from a PDF resume (5 MB limit, first 10 pages). The file isn't kept |
| `POST /api/interview/questions` | Generate questions, optionally from `resume_text`, `job_description` and `focus_areas`, avoiding your recent questions for that role. Falls back to a built-in bank if Gemini is unavailable (`fallback: true`) |
| `POST /api/interview/evaluate` | Score one answer. Streams server-sent events: `delta` (feedback text), then `result` or `error` |
| `POST /api/interview/feedback` | Build the final report |
| `POST /api/interview/hint` | One-sentence hint |
| `POST /api/sessions/save`, `GET /api/sessions/`, `GET/DELETE /api/sessions/{uid}`, `GET /api/sessions/stats/summary`, `GET /api/sessions/stats/progress` | Session history and progress |

If Gemini fails (bad key, rate limit, network), the feedback and hint endpoints return **HTTP 503** with a readable `detail`, and evaluate sends an `error` event with the same message. The UI shows that message and lets you retry. It never invents a score.

## Project structure

```
backend/
  app/
    main.py          FastAPI app, CORS, error handling
    ai_service.py    Gemini prompts, structured output schemas, fallback questions
    resume.py        PDF resume text extraction
    auth.py          passwords, sign-in tokens, the current_user dependency
    limits.py        rate limits
    logs.py          text and JSON logging
    routers/         interview + sessions endpoints
    database.py      SQLAlchemy model (sessions table)
    schemas.py       request/response models
  migrations/        Alembic database migrations
  tests/             pytest suite (Gemini mocked)
frontend/
  src/
    pages/           Setup, Interview, Feedback, History, Roadmap
    ProgressDashboard.jsx  score trend, skills, weakest topics, drill button
    AppContext.jsx   global state (config + active session)
    api.js           API client
    App.test.jsx     Vitest interview-flow tests
```

## Development

```bash
make test           # backend pytest + frontend Vitest
make lint           # ruff + ESLint
```

CI (`.github/workflows/ci.yml`) runs lint, tests on SQLite and Postgres, the production build and a Docker smoke test on every push to `main` and every pull request. The Gemini client is mocked in tests, so no API key is needed.

After changing a model in `backend/app/database.py`, add a migration with `venv/bin/python -m alembic revision --autogenerate -m "describe it"` from `backend/`. A test fails if models and migrations drift apart.

### Observability

Every request logs its method, path, status and duration. Every Gemini call logs an `ai_call` line with the operation, model, outcome, latency and token counts. Prompts, answers and resumes are never logged. Set `LOG_FORMAT=json` (the Docker default) to feed these into a log tool.

The frontend uses client-side routes (`/interview`, `/feedback/:uid`, ...). When you host the built `dist/`, configure the server to serve `index.html` for unknown paths.

## Roadmap

See [PLANNER.md](PLANNER.md) for the improvement plan.

## Limitations

- There's no password reset yet, because that needs an email service. A forgotten password has to be changed in the database.
- Rate limits are counted in memory per backend process, so they reset on restart and don't work across several instances.
- Roadmap progress is stored in your browser's localStorage, and clearing it resets the checklist.
- An interview in progress is kept in the browser's localStorage, so it survives a refresh but not a switch to another browser.
- Code answers are reviewed by the AI but not executed.
- Dictation needs a browser with the Web Speech API (Chrome, Edge, Safari) and your browser may send audio to its speech service. The mic button is hidden where it isn't supported.
- Resume and job description text is sent to Google Gemini to write questions, and isn't saved by this app. Scanned PDFs have no readable text, so paste those instead.

## License

Built as a personal practice tool. Free to use and extend.
