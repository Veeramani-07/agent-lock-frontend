# 🛡️ Agent-Lock: Real-Time Human-in-the-Loop Interceptor for AI Agents

> **Agent-Lock** is a real-time security firewall and supervisor dashboard for autonomous AI agents. It intercepts high-risk CLI, system, and database commands before runtime execution, evaluates risk scores, and routes them to a human supervisor for live Approval or Rejection.

---

## 🌐 Live Application Links

* **Frontend Dashboard (Vercel):** [agent-lock-frontend-seven.vercel.app](https://agent-lock-frontend-seven.vercel.app/)
* **Backend REST & WebSocket API (Render):** [agent-lock-backend.onrender.com](https://agent-lock-backend.onrender.com)

---

## ⚙️ Architecture & Data Flow

```text
[ AI Agent / Python Client ] 
          │ 
          │ 1. Intercepts Command & Sends Payload
          ▼
┌──────────────────────────────────────────────────┐
│          Spring Boot Backend Security Engine     │
│  • Evaluates Risk Score ($Risk > 70 \rightarrow PAUSED$)  │
│  • Holds Execution Thread                        │
└────────────────────────┬─────────────────────────┘
                         │ 
                         │ 2. Real-Time WebSocket Event (/ws)
                         ▼
┌──────────────────────────────────────────────────┐
│          React Supervisor Dashboard (UI)         │
│  • Displays Live Logged Actions                  │
│  • Human Actions: [APPROVE] / [REJECT]           │
└────────────────────────┬─────────────────────────┘
                         │ 
                         │ 3. Propagates Decision & AI Prompt
                         ▼
[ Agent Unlocks / Re-plans Execution Flow ]