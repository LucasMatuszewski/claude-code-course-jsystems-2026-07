# Day 5 — Mistrzostwo, utrzymanie i przyszłość
### Temat: The Advanced Frontier

**Goal of the day:** Legacy code skills → local models awareness → rapid prototyping (v0/Lovable/Bolt) → final demo → lifelong learning plan.

---

## 09:00–10:15 — Moduł 5.1: Praca ze starym kodem (Legacy Code)

**Key points:**
- AI in analyzing, documenting, and refactoring legacy codebases
- Exercise: agent analyzes an old/unfamiliar project (different language or stack)
  - Ask the agent to understand what the code does
  - Generate documentation
  - Add tests to untested code
  - Run it in a modern environment
  - Refactor to modern standards
- This is the most immediately useful skill for participants with real jobs

**Demo:** Take a small legacy codebase (or a participant's project) → agent analyzes + documents + tests

**Outcome:** Practical experience with AI-assisted legacy code modernization.

---

## 10:15–11:00 — Moduł 5.2: Modele lokalne, prywatność i koszty

**Key points:**
- When to use local models: privacy, IP protection, cost control, offline
- Tools: Ollama, LM Studio, vLLM
- Local vs cloud: tradeoffs (speed, quality, cost, VRAM requirements)
- Brief model/provider landscape: Claude aliases `fable` (Fable 5, most capable), `opus` (Opus 4.8), `sonnet` (Sonnet 5), `haiku` (Haiku 4.5), plus local/open models. TODO-VERIFY before delivery: current non-Claude model names and pricing.
- Cost optimization: GLM Coding Plan ($3/m Lite), OpenRouter routing, model cascading
- Context length and VRAM: Ollama context settings, `OLLAMA_CONTEXT_LENGTH`

**Demo:** Show Ollama running locally, Claude Code-first local/open-model workflow, or GLM Coding Plan. TODO-VERIFY before delivery: current CLI flags and provider support.

**Links:** Course Notes → *GLM Coding Plan*, pricing tables; `.codex/config.toml` for OSS profiles

**Outcome:** Participants can make informed model/provider choices.

---

## ☕ 11:00–11:15 — BREAK (15 min)

---

## 11:15–12:30 — Moduł 5.3: AI-Powered UX/UI Design & Rapid Prototyping

**Key points:**
- **AI-native design tools:** v0.dev, Lovable, Bolt — generate UI from a prompt
- When to use them: rapid prototyping, exploring ideas, landing pages
- When NOT to use them: production code, complex logic, maintainability
- Compare with the agent-driven approach from Day 3 (tokens → components)
- Tradeoffs: speed vs control, generated code quality, lock-in risk
- **Exercise:** pick one tool (v0/Lovable/Bolt) and generate a quick prototype of any app idea

**Demo:** Live v0.dev or Lovable session — generate a UI in 2 minutes, compare with Day 3 approach

**Outcome:** A quick clickable prototype + awareness of when rapid prototyping tools help vs hurt.

---

## 12:30–13:00 — Buffer / open discussion

**Key points:**
- What surprised participants most during the course?
- What will they change in their workflow starting Monday?
- Open Q&A on any topic

---

## 🍽️ 13:00–13:30 — LUNCH (30 min)

---

## 13:30–14:45 — Moduł 5.4 (part 1): Final demos

**Key points:**
- Each participant (or group) demos their project
- Focus on: what the agent helped with, what was hard, what they learned
- Celebrate progress — even a simple working app is a win in 5 days
- Discuss technical decisions and compromises made

**Outcome:** Everyone showcases their work and receives feedback.

---

## *15:00–15:10 — Optional short break*

---

## 15:10–16:00 — Moduł 5.4 (part 2): Retrospective & Lifelong Learning

**Key points:**
- Retrospective: what worked, what to change in daily workflow
- Best practices for continuous learning in fast-changing AI landscape:
  - Follow key voices (Karpathy, steipete, etc.)
  - Experiment with new tools regularly
  - Share knowledge in teams
  - Keep an AI journal / blog
- Resources: NotebookLM knowledge bases, research links from course notes
- Certificates, feedback forms
- Positive closure — energy and motivation to apply this Monday

**Links:** Course Notes → research links, NotebookLM knowledge bases

**Outcome:** Participants leave with a plan and motivation to continue.

---

## Notes for the trainer

- **Day 5 energy management:** this is the last day — keep energy high with the v0/Lovable demo (it's genuinely fun and fast)
- **Legacy code exercise** is optional if time is short — prioritize Module 5.3 (rapid prototyping) since it's in the published agenda and participants expect it
- **Final demos** can be informal — don't stress about completeness, celebrate the learning journey
- **End on a high note** — the closing impression matters most for feedback scores
