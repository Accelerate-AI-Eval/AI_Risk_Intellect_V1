# AI Risk Intellect

AI Risk Intellect ingests AI-related news, research, and reports, extracts structured risks with an LLM, maps them to a catalog taxonomy, and gives analysts a workspace to review, score, and export results.

The product is a three-process system: a React app, a Node/Express API with PostgreSQL, and a Python FastAPI service for text extraction and LLM calls.

---

## What it does

| Area | What you get |
| --- | --- |
| **Ingestion** | Fetch HTML or PDF from a URL, RSS feeds, scheduled cron discovery, or Excel/CSV ETL uploads. Content is cleaned, language-detected, and stored as articles. |
| **Risk extraction** | An LLM produces a structured risk object (title, domain, evidence, controls, justification) against a JSON schema. Long articles are chunked and merged. |
| **Catalog matching** | Extracted risks are scored against `risk_mappings` using taxonomy, lexical evidence, embeddings, and an optional LLM judge. |
| **Scoring** | Likelihood and impact (1–5) come from the model; severity is derived as likelihood × impact on a FAIR-informed 5×5 matrix. |
| **Human review** | Low-quality, duplicate, non-English, unknown-domain, or judge-no-match records land in a review queue with remap and feedback. |
| **Operations** | Jobs queue, batch runs, model picker/tester, observability metrics, application logs, API keys, and signed webhooks. |

---

## How it works

```
URL / RSS / ETL
       │
       ▼
  Jobs queue (PostgreSQL)
       │
       ▼
  Job worker ──► fetch page (SSRF-safe) ──► Python ingest (HTML/PDF/text)
       │                                         │
       │                                         ▼
       │                                   article stored
       │
       ▼
  Python extract ──► JSON risk object
       │
       ▼
  Domain resolve → catalog match (embeddings + judge)
       │
       ▼
  Dedup, quality gates, FAIR scoring → Risks table
       │
       ├── high quality → Risks UI
       └── needs review → Review queue
```

### 1. Sources become jobs

Work enters as a **job** (`pending` → `running` → `done` | `skipped` | `error`):

- **Manual URL** from Jobs or Controls
- **RSS discovery** from configured feeds (`backend/config/sources.yaml` and Controls → RSS)
- **Cron** schedules that start discovery at a chosen timezone
- **ETL reports** (spreadsheet upload parsed in Python, then one job per URL)
- **API** enqueue (JWT or API key)

Sources are tagged on the job (`manual`, `rss`, `api`, `etl_reports`). Duplicate URLs and “do not execute” blocks skip work instead of re-fetching.

### 2. Ingest

The **job worker** (`npm run worker`) claims the next pending job, fetches the URL with timeout and SSRF protection, then calls Python:

- HTML → article text (Trafilatura)
- PDF → text (pdfminer)
- Raw text path for already-extracted content

Python applies skip rules (too little text, bot-block pages, excluded non-AI topics) and language detection. Node persists the article, hashes content for dedup, and can localize/store an English title.

### 3. Extract

Python invokes the configured LLM (Bedrock by default; OpenAI, SageMaker, Cisco, or a local Hugging Face model are supported) with `python/app/schemas/risk_extraction.schema.json`. Output includes:

- Risk title, AI-Q domain, description, evidence, product/vendor
- Likelihood / impact reasoning and FAIR loss categories
- Suggested controls and a justification block

Invalid JSON is repaired when possible. Chunked articles are merged into one object.

### 4. Match, score, and gate

After extraction, Node:

1. Resolves the domain to one of seven **AI-Q catalog domains** (Privacy and Security, Discrimination and Toxicity, Misinformation, and so on).
2. Finds **catalog matches** using taxonomy alignment, evidence overlap, Bedrock embeddings, and an optional match judge (`MATCH_JUDGE_ENABLED`).
3. Embeds the new risk and **deduplicates** against existing risks.
4. Computes **severity** from likelihood × impact (model-supplied severity is ignored).
5. Sets **review** when quality is below threshold, justification is missing, language is not English, domain is off-taxonomy, a duplicate is found, or the judge reports no match.

### 5. Analysts use the app

Authenticated users work in the React UI (Vite on port **5176**). The API is `/api/v1` on port **5005**. Notifications cover cron and job events.

---

## Application features

### Dashboard

Pipeline health: article and risk counts, success rate, 24h activity, average processing time, pending queue, domain mix, and recent activity.

### Jobs

Queue of ingest/extract work. Filter by status and source, retry, skip, mark a URL do-not-execute, and enqueue a URL. Polls while jobs are running.

### Risks

Searchable catalog of extracted risks with filters, severity, domain, and Excel export. Detail view shows extraction JSON, catalog matches, scoring, and source article.

### Articles

Stored source documents (title, URL, language, hashes) that jobs and risks attach to.

### Controls (admin)

- Start/stop **discovery** and the **job worker**
- Pick and **test LLM models** (Bedrock inference profiles)
- **RSS feeds**: ingest links, archive, discovery logs
- **ETL**: upload reports, start a reports run, logs
- **Batches**: multi-URL / multi-model batch runs
- **Cron**: timezone-aware RSS schedules
- Export risks, articles, and review queues to Excel
- API connection and about/settings sections

### Review

Human queue for flagged extractions: approve, remap domain, capture feedback. Feedback tab aggregates reviewer notes.

### Observability

Per-extraction metrics (model, tokens, word count, duration) and daily charts.

### Users, account, API keys

Invite users (email link to set password), profile and password change, idle logout. Generate and revoke API keys for programmatic access. Optional signed **webhooks** on API-key events.

---

## Architecture

| Layer | Stack | Role |
| --- | --- | --- |
| **frontend/** | React 19, TypeScript, Vite, React Router | Analyst UI |
| **backend/** | Express 5, Drizzle ORM, PostgreSQL, Winston | API, auth, jobs, matching, scoring, workers |
| **python/** | FastAPI, Trafilatura, LLM backends | Ingest text + LLM extraction |
| **Workers** | `jobWorker.ts`, `discoveryService.ts` | Poll jobs; poll RSS / cron |

PostgreSQL is the system of record (users, articles, jobs, risks, embeddings, mappings, cron, logs). The Node API talks to Python over HTTP (`PYTHON_INGEST_URL`, default `http://localhost:5006`).

Auth is JWT access + refresh cookies (or `X-Api-Key`). Helmet, CORS, rate limits, and webhook HMAC signing are enabled on the API.

---

## Local setup

**Prerequisites:** Node.js 20+, Python 3.11+, PostgreSQL.

### 1. Database and env

Create a Postgres database, then copy env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill `DATABASE_*` (or `DATABASE_URL`), `JWT_SECRET_KEY` / JWT secrets, `BACKEND_PORT` (default 5005), and LLM credentials. For Bedrock:

```
USE_BEDROCK=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BEARER_TOKEN_BEDROCK=
BEDROCK_MODEL_ID=us.anthropic.claude-3-sonnet-20240229-v1:0:200k
```

Frontend:

```
VITE_BASE_URL=http://localhost:5005/api/v1
```

Or use `/api/v1` to go through the Vite proxy.

### 2. Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

Python (from `python/`):

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Backend `npm run py:dev` expects `python/.venv` and starts FastAPI on port **5006**.

### 3. Migrate and seed

```bash
cd backend
npm run db:migrate
npm run db:seed:admin
```

Catalog matching expects `risk_mappings` (and ideally `risk_mapping_embeddings`). Restore a catalog dump if you have one, then optionally:

```bash
npm run backfill:catalog-embeddings
```

See `backend/src/scripts/README.md` for match backfill and re-extract runbooks.

### 4. Run

**API + Python ingest** (from `backend/`):

```bash
npm run dev
```

**API + Python + job worker:**

```bash
npm run dev:all
```

**Frontend** (from `frontend/`):

```bash
npm run dev
```

Open `http://localhost:5176`. Sign in with the seeded admin user.

| Process | Default |
| --- | --- |
| UI | http://localhost:5176 |
| API | http://localhost:5005/api/v1 |
| Python | http://localhost:5006 |
| Health | `GET /api/v1/health` |

Useful commands from `backend/`:

| Script | Purpose |
| --- | --- |
| `npm run worker` | Job worker only |
| `npm run discovery` / `discovery:once` | RSS discovery loop |
| `npm run db:studio` | Drizzle Studio |
| `npm test` | Backend unit tests |

---

## Configuration notes

- **LLM backends** (Python): set exactly one of `USE_BEDROCK`, `USE_OPENAI`, `USE_SAGEMAKER`, `USE_CISCO`; otherwise a local Hugging Face model is used (`LOCAL_MODEL_ID`).
- **Chunking:** `USE_CHUNKING`, `CHUNK_THRESHOLD_CHARS`, `CHUNK_MAX_TOKENS`, `CHUNK_OVERLAP`.
- **Matching:** `REVIEW_QUALITY_THRESHOLD` (default 0.75), `MATCH_JUDGE_ENABLED`, `RISK_DEDUP_THRESHOLD`, `MATCH_EVIDENCE_GATE_ENABLED`.
- **RSS:** `AUTO_INGEST_INTERVAL_MIN`, `AUTO_INGEST_MAX_PER_CYCLE`, plus `backend/config/sources.yaml`.
- **Email:** Gmail or Office 365 for invites and password reset (`EMAIL_SERVICE_TYPE`, `INVITE_APP_URL`).

Do not commit `.env` files or LLM credentials.

---

## Repository layout

```
frontend/     React UI
backend/      Express API, Drizzle schema, workers, admin services
python/       FastAPI ingest + extraction + ETL parse
```
