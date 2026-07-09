# Day 1 — Fundamenty i misja
### Temat: The AI-Augmented Developer & odprawa przed misją

**Goal of the day:** Mindset shift to AI-first + environment ready + project agreed.

---

## 09:00–10:00 — Moduł 1.1: The New Frontier

**Key points:**
- Round of intros: experience with AI, tools used, pain points
- AI revolution in coding: hype vs reality (ASI vs diminishing returns)
- Benefits vs risks: overreliance, hallucinations, privacy, skill degradation
- Does AI speed us up or slow us down? (Stanford 120k study, METR, J-curve)
- New IT roles: Orchestrators, Infra Builders, Domain Experts as Programmers
- Stages 0→5 of AI-assisted programming

**Links:** Course Notes → *Trends 2025–2026*, *Stages of AI-Assisted Programming*, *3 New IT Roles*, *Research data on AI Coding*

**Outcome:** Group understands "why" and is ready to change mindset.

---

## 10:00–10:50 — Moduł 1.2: Modele, Prompty, Context Engineering

**Key points:**
- Compare models: Claude aliases `fable` (Fable 5, most capable), `opus` (Opus 4.8), `sonnet` (Sonnet 5), `haiku` (Haiku 4.5), plus other vendors. TODO-VERIFY before delivery: current non-Claude model names and pricing.
- Prompt engineering basics: tokens, context window, attention, zero/few-shot
- Context engineering: context rot, managing agent context
- Organize prompts, commit to git
- Balance automation vs control (System 1 vs System 2 thinking)

**Links:** Course Notes → *Prompt Engineering*, *Context Engineering*; `../prompts/` for example prompts

**Outcome:** Solid mental model of how LLMs work and why context matters.

---

## 10:50–11:00 — Buffer / Q&A

---

## ☕ 11:00–11:15 — BREAK (15 min)

---

## 11:15–12:15 — Moduł 1.3: Mission Briefing & Environment Setup

**Key points:**
- Present the course project: multimodal AI assistant (e.g. electronics returns/complaints agent)
- High-level architecture overview (form → AI analysis → chat)
- Environment setup: Claude Code CLI + Desktop, any IDE, API keys, git
- Everyone has working agent + API key + can run a hello-world prompt

**Demo:** Show your own setup (Claude Code in WezTerm, AGENTS.md, statusline)

**Outcome:** Every participant has a working agent and knows the project goal.

---

## 12:15–13:00 — Moduł 1.4 (part 1): Poznaj swoje AI Tools

**Key points:**
- Claude Code walkthrough: CLI vs Desktop vs IDE plugin
- Core features: autocomplete, chat vs Agent mode, inline edits, terminal integration
- Codex CLI as alternative (brief overview, if group interested)
- Other tools mentioned: Gemini CLI, OpenCode, Cursor, Zed, Junie, Copilot (concepts transfer)
- Costs: subscriptions (Claude Pro/Max, GLM Coding Plan), API keys, local models

**Outcome:** Participants know the main tool features and cost landscape.

---

## 🍽️ 13:00–13:30 — LUNCH (30 min)

---

## 13:30–14:45 — Moduł 1.4 (part 2): Hands-on + first AGENTS.md

**Key points:**
- Hands-on: participants explore their agent, try inline edits, chat, agent mode
- Create a simple project, ask the agent to scaffold something
- Discussion: CLI vs Desktop vs IDE — when to use which
- Start writing AGENTS.md / CLAUDE.md — describe how the agent should work
- Share approaches across the group

**Links:** `../prompts/day-1/day-1-prompt-pack.md`; `../.claude-example/` for example Claude config

**Demo:** Show your AGENTS.md, how it changes agent behavior

**Outcome:** Participants are comfortable with their tool and have a first AGENTS.md draft.

---

## *15:00–15:10 — Optional short break*

---

## 15:10–16:00 — Day 1 wrap-up

**Key points:**
- Recap the day: mindset + tools + environment
- Preview Day 2: from idea to project (PRD, ADR, research)
- Q&A and open discussion
- Homework (optional): think about what app the group wants to build, bring ideas tomorrow

**Outcome:** Group is aligned, energized, and ready for Day 2.
