"""
ai_service.py
All AI interactions — powered by Google Gemini 1.5 Flash (free tier).

Free limits:  15 requests/min  |  1,500 requests/day  |  1M tokens/min
Get your key: https://aistudio.google.com -> Get API Key
"""
import json
import re
import google.generativeai as genai
from app.config import settings

# ── Configure Gemini ─────────────────────────────────────────────
genai.configure(api_key=settings.gemini_api_key)

MODEL_NAME = "gemini-1.5-flash"

# Safety settings — turn off filters that block interview content
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT",        "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH",        "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",  "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT",  "threshold": "BLOCK_NONE"},
]

model = genai.GenerativeModel(
    model_name=MODEL_NAME,
    safety_settings=SAFETY_SETTINGS,
    generation_config=genai.GenerationConfig(
        temperature=0.7,
        top_p=0.9,
        max_output_tokens=2048,
    ),
)


# ── Internal helpers ─────────────────────────────────────────────

def _call(prompt: str, max_tokens: int = 1500) -> str:
    """Call Gemini and return raw text."""
    cfg = genai.GenerationConfig(max_output_tokens=max_tokens, temperature=0.7)
    response = model.generate_content(prompt, generation_config=cfg)
    return response.text


def _parse_json(raw: str) -> dict | list:
    """Strip markdown fences and parse JSON safely."""
    # Remove ```json ... ``` or ``` ... ```
    clean = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
    # Sometimes Gemini adds a trailing comma before closing bracket — fix it
    clean = re.sub(r",\s*([}\]])", r"\1", clean)
    return json.loads(clean)


# ── Fallback questions (used if API call fails) ──────────────────

FALLBACK_QUESTIONS = {
    "AI/ML Engineer": [
        {"q": "Explain the bias-variance tradeoff and how you manage it in practice.", "type": "technical", "hint": "Think about model complexity vs generalisation", "category": "ML Fundamentals", "followup": "How does regularisation help?"},
        {"q": "Design a real-time recommendation system for a streaming platform with 50M users.", "type": "system-design", "hint": "Collaborative vs content-based filtering", "category": "System Design", "followup": "How do you handle the cold-start problem?"},
        {"q": "Describe a time you had to explain a model's predictions to a non-technical stakeholder.", "type": "behavioral", "hint": "Use STAR. Focus on simplification and business impact.", "category": "Communication", "followup": "What did you learn from that experience?"},
        {"q": "What is the difference between L1 and L2 regularisation?", "type": "technical", "hint": "Sparsity vs smoothness", "category": "Regularisation", "followup": "When would you use Elastic Net?"},
        {"q": "Walk me through how you would debug a model whose accuracy dropped 10% after deployment.", "type": "technical", "hint": "Data drift, feature pipeline, label shift", "category": "MLOps", "followup": "How do you monitor models in production?"},
    ],
    "Software Engineer": [
        {"q": "Explain the time and space complexity of quicksort. When would you prefer mergesort?", "type": "technical", "hint": "Average vs worst case", "category": "Algorithms", "followup": "How do you handle many duplicates?"},
        {"q": "Design a URL shortener like bit.ly for 100M daily requests.", "type": "system-design", "hint": "Hashing, storage, redirects, analytics", "category": "System Design", "followup": "How do you scale to 1 billion URLs?"},
        {"q": "Tell me about a time you disagreed with a technical decision on your team.", "type": "behavioral", "hint": "Show empathy and technical reasoning", "category": "Conflict Resolution", "followup": "What was the outcome?"},
        {"q": "What is the difference between a process and a thread?", "type": "technical", "hint": "Memory sharing vs isolation", "category": "OS Concepts", "followup": "How do you avoid deadlocks?"},
        {"q": "How do you ensure code quality in a fast-moving team?", "type": "behavioral", "hint": "Testing, code review, CI/CD", "category": "Engineering Culture", "followup": "Describe a bug that reached production."},
    ],
    "Data Scientist": [
        {"q": "What is the difference between p-value and confidence intervals?", "type": "technical", "hint": "Frequentist statistics fundamentals", "category": "Statistics", "followup": "What are common misinterpretations of p-values?"},
        {"q": "How would you design an A/B test for a new checkout flow?", "type": "technical", "hint": "Sample size, randomisation, metrics", "category": "Experimentation", "followup": "How do you handle novelty effect?"},
        {"q": "Walk me through your approach to a brand-new dataset before building any model.", "type": "technical", "hint": "EDA, missing values, distributions", "category": "Data Exploration", "followup": "What tools do you reach for first?"},
        {"q": "Describe a project where your analysis directly changed a business decision.", "type": "behavioral", "hint": "Use STAR. Quantify the impact.", "category": "Impact", "followup": "What would you do differently?"},
        {"q": "How do you handle class imbalance in a classification problem?", "type": "technical", "hint": "SMOTE, class weights, thresholds", "category": "Modelling", "followup": "How does your choice of evaluation metric change?"},
    ],
    "Frontend Developer": [
        {"q": "Explain the difference between CSS Flexbox and Grid. When do you use each?", "type": "technical", "hint": "1D vs 2D layout", "category": "CSS", "followup": "Can you combine them?"},
        {"q": "How does React's reconciliation algorithm work?", "type": "technical", "hint": "Virtual DOM, diffing, keys", "category": "React", "followup": "Why are keys important in lists?"},
        {"q": "Describe a performance problem you encountered in a web app and how you fixed it.", "type": "behavioral", "hint": "Use STAR. Mention specific metrics.", "category": "Performance", "followup": "What tools did you use to measure it?"},
        {"q": "What is the difference between localStorage, sessionStorage, and cookies?", "type": "technical", "hint": "Persistence, scope, size", "category": "Web APIs", "followup": "When would you use IndexedDB?"},
        {"q": "How do you ensure a web app is accessible (WCAG)?", "type": "technical", "hint": "ARIA, semantic HTML, contrast", "category": "Accessibility", "followup": "How do you test for accessibility?"},
    ],
    "Backend Developer": [
        {"q": "Explain the difference between SQL and NoSQL databases. How do you choose?", "type": "technical", "hint": "ACID, scalability, schema flexibility", "category": "Databases", "followup": "Have you used both in production?"},
        {"q": "Design a REST API for a task management system.", "type": "system-design", "hint": "Resources, verbs, auth, pagination", "category": "API Design", "followup": "How would you version this API?"},
        {"q": "How do you handle authentication and authorisation in a microservices architecture?", "type": "technical", "hint": "JWT, OAuth2, service mesh", "category": "Security", "followup": "What are the risks of storing JWT in localStorage?"},
        {"q": "Tell me about a time you had to optimise a slow database query.", "type": "behavioral", "hint": "Use STAR. Mention indexes, explain plans.", "category": "Performance", "followup": "How did you measure the improvement?"},
        {"q": "What is the CAP theorem and how does it affect your database choices?", "type": "technical", "hint": "Consistency, Availability, Partition tolerance", "category": "Distributed Systems", "followup": "Give an example of a CP vs AP system."},
    ],
    "Full Stack Developer": [
        {"q": "Walk me through the full request lifecycle from browser to database and back.", "type": "technical", "hint": "DNS, TCP, HTTP, server, ORM, response", "category": "Web Fundamentals", "followup": "Where are the biggest latency bottlenecks?"},
        {"q": "How do you manage state in a large React application?", "type": "technical", "hint": "Context, Redux, Zustand, React Query", "category": "State Management", "followup": "When would you NOT use Redux?"},
        {"q": "Design a real-time collaborative document editor.", "type": "system-design", "hint": "WebSockets, operational transforms, conflict resolution", "category": "System Design", "followup": "How do you handle offline edits?"},
        {"q": "Describe a full-stack feature you built end-to-end. What tradeoffs did you make?", "type": "behavioral", "hint": "Use STAR. Cover both frontend and backend decisions.", "category": "Experience", "followup": "What would you change if you rebuilt it today?"},
        {"q": "How do you approach CI/CD for a full-stack application?", "type": "technical", "hint": "Testing, build, deploy, rollback", "category": "DevOps", "followup": "How do you handle database migrations in CI/CD?"},
    ],
    "DevOps Engineer": [
        {"q": "Explain the difference between containers and virtual machines.", "type": "technical", "hint": "Kernel sharing, isolation, resource overhead", "category": "Containerisation", "followup": "When would you choose VMs over containers?"},
        {"q": "Design a CI/CD pipeline for a microservices application.", "type": "system-design", "hint": "Build, test, security scan, deploy, rollback", "category": "CI/CD", "followup": "How do you handle a failed deployment in production?"},
        {"q": "How do you approach infrastructure as code? What tools have you used?", "type": "technical", "hint": "Terraform, Ansible, Pulumi", "category": "IaC", "followup": "How do you manage secrets in IaC?"},
        {"q": "Tell me about a major outage you helped resolve. What was your process?", "type": "behavioral", "hint": "Use STAR. Mention runbooks, RCA, communication.", "category": "Incident Response", "followup": "What did you change to prevent recurrence?"},
        {"q": "How do you monitor a production Kubernetes cluster?", "type": "technical", "hint": "Prometheus, Grafana, alerting, logging", "category": "Observability", "followup": "How do you debug a CrashLoopBackOff?"},
    ],
    "Product Manager": [
        {"q": "How do you prioritise a product backlog when everything feels urgent?", "type": "behavioral", "hint": "RICE, MoSCoW, stakeholder alignment", "category": "Prioritisation", "followup": "How do you say no to a stakeholder?"},
        {"q": "Design a metrics framework for a new feature launch.", "type": "technical", "hint": "North star, guardrail metrics, leading indicators", "category": "Metrics", "followup": "How do you know if a feature is successful?"},
        {"q": "Tell me about a product decision you made with incomplete data.", "type": "behavioral", "hint": "Use STAR. Show structured thinking under uncertainty.", "category": "Decision Making", "followup": "What would you do differently?"},
        {"q": "How would you improve our onboarding experience? Walk me through your process.", "type": "technical", "hint": "User research, funnel analysis, hypothesis testing", "category": "Product Sense", "followup": "How would you measure success?"},
        {"q": "Describe a time you had to align engineering, design, and business stakeholders on a difficult decision.", "type": "behavioral", "hint": "Use STAR. Show communication and influence skills.", "category": "Stakeholder Management", "followup": "What was the key to getting alignment?"},
    ],
}

DEFAULT_ROLE = "Software Engineer"


# ── Question Generation ──────────────────────────────────────────

def generate_questions(role: str, level: str, interview_type: str,
                       difficulty: str, company: str | None,
                       num_questions: int) -> list:

    company_str = f" at {company}" if company else ""
    prompt = f"""You are a senior technical recruiter. Generate exactly {num_questions} interview questions for a {role} position{company_str}.

Experience level: {level}
Interview type: {interview_type}
Difficulty: {difficulty}

Return ONLY a valid JSON array. No explanation, no markdown, no text before or after.
Each element must have EXACTLY these keys:
  "q"        : the full question text
  "type"     : one of "technical", "behavioral", "system-design"
  "hint"     : a subtle one-sentence hint (not the answer)
  "category" : topic area e.g. "Algorithms", "Leadership", "System Design"
  "followup" : a natural follow-up probe the interviewer would ask next

Rules:
- For "Mixed" type: include both technical and behavioral questions
- For "Technical": only technical and system-design questions
- For "Behavioral": only behavioral questions
- For "System Design": only system-design questions
- Scale complexity appropriately to the difficulty ({difficulty}) and level ({level})
- Make questions specific and realistic for {role}

Example format:
[
  {{
    "q": "Explain how a hash map works internally.",
    "type": "technical",
    "hint": "Think about the underlying array and collision handling.",
    "category": "Data Structures",
    "followup": "What happens to performance when the load factor is too high?"
  }}
]"""

    try:
        raw = _call(prompt, max_tokens=2000)
        questions = _parse_json(raw)
        if isinstance(questions, list) and len(questions) > 0:
            # Ensure all required keys exist
            valid = []
            for q in questions:
                if isinstance(q, dict) and "q" in q:
                    valid.append({
                        "q":         q.get("q", ""),
                        "type":      q.get("type", "technical"),
                        "hint":      q.get("hint", "Think carefully about this."),
                        "category":  q.get("category", "General"),
                        "followup":  q.get("followup", "Can you elaborate further?"),
                    })
            if valid:
                return valid[:num_questions]
    except Exception as e:
        print(f"[ai_service] generate_questions failed: {e}")

    # Fallback to hardcoded questions
    base = FALLBACK_QUESTIONS.get(role, FALLBACK_QUESTIONS[DEFAULT_ROLE])
    return base[:num_questions]


# ── Answer Evaluation ────────────────────────────────────────────

def evaluate_answer(question: str, question_type: str, answer: str,
                    level: str, role: str) -> dict:

    prompt = f"""You are a senior {role} interviewer. Evaluate this candidate answer strictly but fairly.

Candidate level expected: {level}
Question type: {question_type}
Question: {question}
Candidate answer: {answer}

Return ONLY a valid JSON object with EXACTLY these keys (no extra keys, no markdown):
{{
  "score":            <integer 0-100 overall score>,
  "technical":        <integer 0-100>,
  "communication":    <integer 0-100>,
  "clarity":          <integer 0-100>,
  "confidence":       <integer 0-100>,
  "problem_solving":  <integer 0-100>,
  "feedback":         "<2-3 sentences of direct interviewer feedback in second person>",
  "strengths":        ["<strength 1>", "<strength 2>"],
  "improvements":     ["<improvement 1>", "<improvement 2>"],
  "followup_comment": "<1 natural sentence transitioning to the next question>"
}}

Scoring guide:
- 85-100: Exceptional, exceeds expectations for {level}
- 70-84:  Strong, meets expectations with minor gaps
- 55-69:  Adequate, covers basics but lacks depth
- 40-54:  Partial, key concepts missing
- 0-39:   Insufficient, major gaps or incorrect

For behavioral questions, reward STAR structure.
For technical questions, reward correctness, depth, and edge-case awareness.
If the answer is very short (under 20 words), score it below 50."""

    try:
        raw = _call(prompt, max_tokens=800)
        result = _parse_json(raw)
        return {
            "score":            int(result.get("score", 60)),
            "technical":        int(result.get("technical", 60)),
            "communication":    int(result.get("communication", 60)),
            "clarity":          int(result.get("clarity", 60)),
            "confidence":       int(result.get("confidence", 60)),
            "problem_solving":  int(result.get("problem_solving", 60)),
            "feedback":         str(result.get("feedback", "Good attempt.")),
            "strengths":        list(result.get("strengths", ["Attempted the question"])),
            "improvements":     list(result.get("improvements", ["Add more specific examples"])),
            "followup_comment": str(result.get("followup_comment", "Let's move to the next question.")),
        }
    except Exception as e:
        print(f"[ai_service] evaluate_answer failed: {e}")
        return {
            "score": 60, "technical": 60, "communication": 60,
            "clarity": 60, "confidence": 60, "problem_solving": 60,
            "feedback": "Good attempt. Try to be more specific with concrete examples.",
            "strengths": ["Attempted the question"],
            "improvements": ["Add concrete examples", "Be more specific"],
            "followup_comment": "Let's continue to the next question.",
        }


# ── Full Feedback Report ─────────────────────────────────────────

def generate_feedback(role: str, level: str, config: dict,
                      qa_pairs: list) -> dict:

    answered = [qa for qa in qa_pairs if qa.get("a") and qa["a"] != "[SKIPPED]"]
    qa_text = "\n\n".join(
        f"Q{i+1} ({qa.get('type','technical')}): {qa['q']}\n"
        f"Answer: {qa['a']}\n"
        f"Score: {qa.get('eval', {}).get('score', 'N/A')}"
        for i, qa in enumerate(answered)
    )

    prompt = f"""You are a principal engineer reviewing a complete {role} interview for a {level} candidate.
Interview type: {config.get('interview_type')}. Difficulty: {config.get('difficulty')}.

Full Q&A transcript:
{qa_text}

Return ONLY a valid JSON object with EXACTLY these keys (no markdown, no extra text):
{{
  "overall_score":   <integer 0-100>,
  "grade":           <one of "A+", "A", "B+", "B", "C", "D">,
  "summary":         "<2-3 sentence overall honest assessment>",
  "technical":       <integer 0-100>,
  "communication":   <integer 0-100>,
  "clarity":         <integer 0-100>,
  "confidence":      <integer 0-100>,
  "problem_solving": <integer 0-100>,
  "top_strengths":   ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weak_areas":      ["<weak area 1>", "<weak area 2>"],
  "recommendations": [
    {{"title": "<topic>", "action": "<specific actionable advice>", "priority": "high"}},
    {{"title": "<topic>", "action": "<specific actionable advice>", "priority": "high"}},
    {{"title": "<topic>", "action": "<specific actionable advice>", "priority": "medium"}}
  ],
  "q_feedback": [
    {{"idx": 0, "verdict": "<strong|acceptable|needs-work>", "comment": "<one sentence>"}}
  ],
  "next_role": "<honest one-sentence assessment of what level/role they appear ready for>"
}}

Grade scale: A+ >= 90, A >= 80, B+ >= 70, B >= 60, C >= 50, D < 50
q_feedback must have one entry per answered question (total: {len(answered)})."""

    try:
        raw = _call(prompt, max_tokens=2000)
        result = _parse_json(raw)
        # Ensure q_feedback length matches
        if "q_feedback" not in result or len(result["q_feedback"]) != len(answered):
            result["q_feedback"] = [
                {"idx": i, "verdict": "acceptable", "comment": "Reviewed."}
                for i in range(len(answered))
            ]
        return result
    except Exception as e:
        print(f"[ai_service] generate_feedback failed: {e}")
        scores = [qa.get("eval", {}).get("score", 60) for qa in answered]
        avg = round(sum(scores) / max(1, len(scores)))
        return {
            "overall_score": avg,
            "grade": "A" if avg >= 80 else "B" if avg >= 65 else "C" if avg >= 50 else "D",
            "summary": f"Session completed with {len(qa_pairs)} questions answered. Review individual answers for details.",
            "technical": avg, "communication": avg, "clarity": avg,
            "confidence": avg, "problem_solving": avg,
            "top_strengths": ["Completed the interview", "Attempted all questions"],
            "weak_areas": ["Review your answers for specific improvement areas"],
            "recommendations": [
                {"title": "Consistent Practice", "action": "Practice 3 sessions per week focusing on your weakest areas.", "priority": "high"}
            ],
            "q_feedback": [{"idx": i, "verdict": "acceptable", "comment": "Reviewed."} for i in range(len(answered))],
            "next_role": "Continue practising to build confidence at this level.",
        }


# ── Hint Generation ──────────────────────────────────────────────

def generate_hint(question: str) -> str:
    prompt = f"""Give a subtle one-sentence hint for this interview question.
Do NOT give the answer. Just point the candidate in the right direction.
Be concise — one sentence only.

Question: {question}
Hint:"""
    try:
        return _call(prompt, max_tokens=80).strip()
    except Exception as e:
        print(f"[ai_service] generate_hint failed: {e}")
        return "Think about the core concept and a real-world example from your experience."
