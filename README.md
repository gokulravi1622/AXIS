---
title: AXIS Backend
emoji: 🧠
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# AXIS — Centralized Knowledge Layer

> One source of truth. Every team's context, in one place.
                              
AXIS is a RAG-based (Retrieval-Augmented Generation) knowledge assistant that centralizes documentation from across your organization and makes it queryable through a chat interface. It syncs from **Jira, Confluence, Slack, Notion, and Google Drive**, retrieves the most relevant context for any question, and generates grounded, source-cited answers.

**Live deployment:**
- **Frontend:** https://axis-plff.vercel.app (Vercel)
- **Backend:** https://gokul1622-axis-backend.hf.space (Hugging Face Spaces, Docker)
- **Source:** https://github.com/gokulravi1622/AXIS

---

## What it does

- **Five live knowledge sources** — Jira, Confluence, Slack, Notion, Google Drive (plus contributed docs)
- **One-click OAuth connections** — connect any source from the UI; no manual token handling for end users
- **Hybrid retrieval** — semantic vector search (ChromaDB) + BM25 keyword search, merged and re-ranked with a cross-encoder
- **Cloud LLM answers** — Groq (`llama-3.1-8b-instant`) in production; local Ollama in development; optionally Claude via the Anthropic API
- **Clickable citations** — every answer's source chips link back to the original Jira ticket / Confluence page / Slack message / Notion page / Google Doc
- **User accounts** — login/sign-up so each team member has their own session
- **Feedback loop** — 👍/👎 on answers; upvotes nudge useful docs higher in future retrieval
- **Background sync** — a scheduler re-syncs all sources every few hours

---

## Architecture

```
                 ┌──────────────┐     /api/ask, /api/auth, /api/sync, /api/feedback
   React + Vite ──▶  FastAPI     │◀───────────────────────────────────────────────
   (ui/, Vercel)  │  (api.py)    │ HF Spaces Docker, port 7860
                 └──────┬───────┘
        ┌───────────────┼───────────────────────────┐
        ▼               ▼                            ▼
  query.py         sync.py                       db.py / auth.py
  retrieve +       Jira · Confluence · Slack ·   SQLite: users,
  rerank +         Notion · Google Drive          messages, feedback,
  feedback boost   → ChromaDB                      doc_scores
  → answer
   ├── ChromaDB (axis_db/)  vector store + doc metadata (team, title, url, source)
   ├── bm25_index.py        keyword index over data/*.json
   └── Groq API (prod)      answer generation  [or Ollama / Anthropic API]
```

### Project structure

```
AXIS/
├── api.py                 # FastAPI backend (ask, auth, sync, feedback, stats)
├── query.py               # Hybrid retrieve → rerank → feedback boost → answer
├── sync.py                # Jira / Confluence / Slack / Notion / Google Drive → ChromaDB
├── oauth.py               # OAuth 2.0 flows for all five providers
├── connections.py         # Per-org credential store + env-var mapping for sync.py
├── bm25_index.py          # BM25 keyword index for hybrid retrieval
├── db.py                  # SQLite: users, messages, feedback, doc_scores
├── auth.py                # Password hashing (PBKDF2) + JWT sessions
├── contribute.py          # Add a doc from the UI ("Add Context")
├── scheduler.py           # Background auto-sync of all sources
├── ingest.py              # One-time embed of the seed data/*.json
├── data/                  # Seed docs (5 teams)
├── ui/                    # React + Vite frontend
├── Dockerfile             # Backend image (port 7860 for HF Spaces, 8000 locally)
├── axis_db/               # ChromaDB vector store (generated)
├── axis.db                # SQLite database (generated)
├── .env                   # Configuration (see below — never commit)
└── requirements.txt
```

---

## Deployment

### Frontend (Vercel)

- Set **Root Directory = `ui`** in the Vercel project settings (the repo root is the FastAPI backend)
- `ui/vercel.json` proxies `/api/*` → the HF Spaces backend (no CORS needed)
- Vercel auto-deploys on every push to `main`

### Backend (Hugging Face Spaces)

`.github/workflows/deploy-hf.yml` creates an orphan backend-only commit on every push to `main` (strips `ui/`, `.github/`, binary assets) and pushes it to the `gokul1622/axis-backend` HF Space.

Set these secrets/variables in the HF Space settings:
```
AXIS_LLM_BACKEND=groq
GROQ_API_KEY=gsk_...
AXIS_JWT_SECRET=...
AXIS_ENCRYPTION_KEY=...
FRONTEND_URL=https://axis-plff.vercel.app
# Plus OAuth credentials for each provider you want to enable:
ATLASSIAN_OAUTH_CLIENT_ID=...
ATLASSIAN_OAUTH_CLIENT_SECRET=...
ATLASSIAN_REDIRECT_URI=https://gokul1622-axis-backend.hf.space/api/connect/atlassian/callback
SLACK_OAUTH_CLIENT_ID=...
# etc.
```

> **HF free tier caveat:** Storage is ephemeral — users, chats, and synced docs reset on Space restart. `api._ensure_seeded()` re-ingests seed docs on cold start. The Space also sleeps after inactivity.

---

## How to use

- **Ask anything** — AXIS runs hybrid retrieval, re-ranks, and answers with source attribution.
- **Filter by team** in the sidebar to scope a question to one team's knowledge.
- **Click a source chip** (those with a ↗) to open the original Jira ticket / Confluence page / Slack message / Notion page / Google Doc.
- **Rate answers** with 👍 / 👎 — upvoted docs get a small ranking boost on future questions.
- **Add Context** in the sidebar to contribute a doc directly.
- **Sync** individual sources or **Sync All** from the sidebar.

---

## Sample questions to demo

| Question | Likely source |
|---|---|
| What is the AXIS onboarding timeline? | Notion |
| How long does the Data team keep raw event data? | Google Drive |
| What is the status of the digital card feature? | Jira, Confluence |
| How do we deploy to production? | Confluence / Slack |
| What metrics are in the LENS dashboard? | Data |
| What is the T2 support SLA? | CRM, Client Success |

---

## Tech stack

| Component | Technology |
|---|---|
| Backend | FastAPI (`api.py`) |
| Frontend | React 19 + Vite (`ui/`) |
| Embeddings | `sentence-transformers` (all-MiniLM-L6-v2, local) |
| Re-ranking | cross-encoder (`ms-marco-MiniLM-L-6-v2`, local) |
| Keyword search | BM25 (`rank-bm25`) |
| Vector store | ChromaDB (persistent) |
| Answer LLM | Groq (cloud, default) · Ollama (local) · Claude (Anthropic API) |
| Auth / data | SQLite + PBKDF2 + JWT (PyJWT) |
| Frontend hosting | Vercel |
| Backend hosting | Hugging Face Spaces (Docker, port 7860) |
| Language | Python 3.11+ |

---

*AXIS — centralized organizational context, retrieved, cited, and answered.*
