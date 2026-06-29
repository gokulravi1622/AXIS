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

## Local development

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Choose an answer-generation backend

**Option A — Local Ollama (default, free, no API key):**

```bash
brew install ollama          # or download from https://ollama.com/download
ollama serve                 # start the local server (leave running)
ollama pull llama3.2         # ~2 GB; or llama3.1 (8B) for higher quality
```

`.env`:
```
AXIS_LLM_BACKEND=ollama
OLLAMA_MODEL=llama3.2
OLLAMA_URL=http://localhost:11434
```

**Option B — Groq (free, fast, recommended for cloud):**
```
AXIS_LLM_BACKEND=groq
GROQ_API_KEY=gsk_...
```

**Option C — Claude via Anthropic API:**
```
AXIS_LLM_BACKEND=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

> If the model is unreachable, AXIS degrades gracefully — it still returns the retrieved sources (with working citations and feedback) instead of erroring.

### 3. Ingest the seed docs (once)

```bash
python ingest.py
```

Embeds the `data/*.json` docs into a local ChromaDB store (`axis_db/`). First run downloads the embedding model (~30s).

### 4. Start the backend

```bash
set -a && . ./.env && set +a       # load .env into the shell
uvicorn api:app --reload --port 8000
```

### 5. Start the frontend

```bash
cd ui
npm install
npm run dev
```

Open **http://localhost:3000**, then **Sign up** or log in.

---

## Connecting knowledge sources

All sources support **one-click OAuth** from the Settings → Connections panel in the UI. Manual API-token mode is also available for Jira and Confluence. Each source is optional — unconfigured ones are skipped gracefully.

---

### Jira (OAuth — recommended)

1. Create an OAuth 2.0 (3LO) app at [developer.atlassian.com](https://developer.atlassian.com/console/myapps/)
2. Add callback URL: `https://your-backend/api/connect/atlassian/callback`
3. Under **Permissions → Jira API**, enable the **classic** scopes: `read:jira-work`, `read:jira-user`

```
ATLASSIAN_OAUTH_CLIENT_ID=...
ATLASSIAN_OAUTH_CLIENT_SECRET=...
ATLASSIAN_REDIRECT_URI=https://your-backend/api/connect/atlassian/callback
```

Sync fetches issues updated in the last 2 years using cursor-based JQL pagination.

### Jira (API token — manual)

```
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=you@yourorg.com
JIRA_API_TOKEN=...            # id.atlassian.com/manage-profile/security/api-tokens
JIRA_PROJECTS=ENG,DATA,PROD   # comma-separated project keys
```

---

### Confluence (OAuth — recommended)

> **Important:** Confluence OAuth requires **granular** scopes, which must not be mixed with Jira's classic scopes in the same authorization request — Atlassian rejects the consent page if you do. AXIS sends separate OAuth flows per product using the correct scope set for each.

1. Use the same Atlassian OAuth app as Jira (or create a new one)
2. Under **Permissions → Confluence API → Granular scopes**, enable: `read:page:confluence` and `read:content:confluence`
3. Sync uses the Confluence REST API v2 (`/wiki/api/v2/pages`)

```
# Same credentials as Jira OAuth app
ATLASSIAN_OAUTH_CLIENT_ID=...
ATLASSIAN_OAUTH_CLIENT_SECRET=...
ATLASSIAN_REDIRECT_URI=https://your-backend/api/connect/atlassian/callback
```

### Confluence (API token — manual)

```
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=you@yourorg.com
JIRA_API_TOKEN=...
CONFLUENCE_SPACES=ENG,DATA    # comma-separated space keys
```

---

### Slack (OAuth — recommended)

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **OAuth & Permissions**, add redirect URL: `https://your-backend/api/connect/slack/callback`
3. Add bot token scopes: `channels:history`, `channels:read`, `groups:history`, `groups:read`, `users:read`

```
SLACK_OAUTH_CLIENT_ID=...
SLACK_OAUTH_CLIENT_SECRET=...
SLACK_REDIRECT_URI=https://your-backend/api/connect/slack/callback
```

### Slack (bot token — manual)

Invite the bot to each channel (`/invite @YourApp`), then:
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNELS=eng-help=Engineering,C0123ABC=Data   # channel name OR ID = AXIS team
```

---

### Notion (OAuth — recommended)

1. Create a public integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Set redirect URI: `https://your-backend/api/connect/notion/callback`

```
NOTION_OAUTH_CLIENT_ID=...
NOTION_OAUTH_CLIENT_SECRET=...
NOTION_REDIRECT_URI=https://your-backend/api/connect/notion/callback
```

### Notion (token — manual)

Create an **internal** integration, then **connect** each page to it (page ••• → Connections):
```
NOTION_TOKEN=ntn_...
NOTION_TEAM=Product
```

---

### Google Drive (OAuth — recommended)

1. Create a GCP OAuth 2.0 client at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Google Drive API**
3. Add redirect URI: `https://your-backend/api/connect/gdrive/callback`

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GDRIVE_REDIRECT_URI=https://your-backend/api/connect/gdrive/callback
```

### Google Drive (service account — manual)

Create a GCP service account, enable the Drive API, download a JSON key, and **share** your Docs/folder with the service account's email:
```
GOOGLE_SERVICE_ACCOUNT_FILE=/path/to/service-account.json
GDRIVE_TEAM=Data
GDRIVE_FOLDER_ID=             # optional: limit to one folder
```

---

### Other settings

```
AXIS_SYNC_INTERVAL_HOURS=6                       # how often the scheduler re-syncs every source
AXIS_JWT_SECRET=change-me-to-a-long-random-string  # signs login tokens
AXIS_ENCRYPTION_KEY=...                            # Fernet key — encrypts stored OAuth tokens at rest
FRONTEND_URL=https://your-frontend                 # used for OAuth redirect after connect
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

## Security notes

- Keep `.env` and any service-account JSON **out of version control** (both are in `.gitignore`).
- Set a strong `AXIS_JWT_SECRET` and `AXIS_ENCRYPTION_KEY` before any real use; rotate them if ever exposed.
- Rotate provider credentials if they're ever exposed (Slack token, Notion token, Google service-account key, Atlassian OAuth secret).
- OAuth tokens stored in the DB are encrypted at rest using `AXIS_ENCRYPTION_KEY`.

---

*AXIS — centralized organizational context, retrieved, cited, and answered.*
