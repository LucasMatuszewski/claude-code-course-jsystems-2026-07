# Day 4 — Jakość, bezpieczeństwo i wdrożenie
### Temat: AI jako Twój QA & DevOps Engineer

**Goal of the day:** Comprehensive tests → code review + security scan → CI/CD pipeline.

---

## 09:00–10:30 — Moduł 4.1: AI-Generated Testing

**Key points:**
- Generate unit tests (Vitest / Jest / JUnit)
- Generate integration tests
- Generate E2E tests (Playwright)
- Agent self-assessment: does it pass its own tests? (TDD feedback loop)
- Limitations: generated tests need human review (test honesty rules)
- Forbidden shortcuts: weakening assertions, mocking away the unit under test

**Demo:** Ask qa-engineer sub-agent to generate E2E tests → run them → see failures → fix

**Links:** `../exercises/day-2/d2-e2-architecture-adr-starter.md` (testing strategy); `../references/sandbox-safety-module.md`

**Outcome:** Test suite for backend and frontend.

---

## 10:30–11:00 — Moduł 4.2 (start): Automated Code Reviews

**Key points:**
- Code review with AI: use the agent to review its own PR
- GitHub Copilot code review agent
- CodeRabbit, Qodo (formerly PR-Agent) — cloud-based review tools

---

## ☕ 11:00–11:15 — BREAK (15 min)

---

## 11:15–12:30 — Moduł 4.2 (cont): Security Scanning

**Key points:**
- AI-powered security scanning: Snyk, GitHub Advanced Security
- Agent identifies vulnerabilities in generated code
- Common AI code pitfalls: hardcoded secrets, SQL injection, exposed endpoints
- Review the `.env.example` — ensure no secrets in code
- Cloud agents: Claude Code in GitHub Actions, GitHub Copilot in CI

**Demo:** Run a security scan on the project codebase

**Outcome:** PR reviewed by AI agent + security scan passed.

---

## 12:30–13:00 — Moduł 4.3 (start): CI/CD with AI

**Key points:**
- Generate CI/CD pipeline with the agent (GitHub Actions)
- Build, test, lint, deploy stages
- Agent generates the YAML, you review and adjust

---

## 🍽️ 13:00–13:30 — LUNCH (30 min)

---

## 13:30–14:45 — Moduł 4.3 (cont): CI/CD deep-dive + cloud agents

**Key points:**
- Headless CI/CD patterns: agents running in GitHub Actions without interactive UI
- Real-world examples: Claude PR review in CI, Qodo PR agent, weekly config curation
- Jenkins alternatives for on-prem (Bitbucket, Jira integration)
- MCP in CI (Atlassian Rovo, custom MCP servers)

**Demo:** Show a working GitHub Actions workflow with Claude code review

**Links:** `../cicd-headless/` — full CI/CD examples (GitHub Actions, Jenkins, scripts); `../Research/cicd-agent-workflows-cloud-vs-onprem.md`

**Outcome:** Working CI/CD workflow for the project.

---

## *15:00–15:10 — Optional short break*

---

## 15:10–16:00 — Day 4 wrap-up

**Key points:**
- Demo: push a PR → CI runs → agent reviews → merge
- Quality dashboard: test coverage, security, build status
- Preview Day 5: legacy code, local models, rapid prototyping (v0/Lovable/Bolt), final demo
- Q&A

**Outcome:** App is tested, reviewed, secured, and deployed via CI/CD.
