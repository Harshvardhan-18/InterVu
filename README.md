# InterVu

An AI-powered mock interview platform that researches real companies, generates adaptive interview questions grounded in actual interview experiences, and provides detailed performance feedback.

## How It Works

1. **Research** — Tavily searches the web for company-specific interview experiences, Firecrawl scrapes the content, and an LLM extracts structured knowledge (topics, rounds, DSA patterns, difficulty)
2. **Blueprint** — A conductor agent generates an interview plan based on the extracted knowledge, covering all relevant sections (Screening, Coding, System Design, Behavioral)
3. **Interview** — A conversational conductor agent runs the interview turn-by-turn, seeing the full conversation history and adapting questions based on your answers
4. **Evaluation** — Each answer is scored across correctness, depth, communication, and problem-solving
5. **Report** — A feedback agent generates a comprehensive report with section scores, strong/weak areas, and study recommendations

---
<img width="6838" height="4304" alt="Untitled-2026-06-16-1614" src="https://github.com/user-attachments/assets/a11082f2-0db6-4d18-b936-51be2f68eba1" />

# Project Structure

```text
InterVu/
├── frontend/                    # Next.js 16 + TypeScript + TailwindCSS
│   └── app/
│       ├── login/               # Auth page
│       ├── (protected)/         # Auth-guarded pages
│       │   ├── dashboard/       # Interview history + stats
│       │   ├── interview/
│       │   │   ├── new/         # 4-step interview wizard
│       │   │   └── [id]/        # Live interview session (chat UI)
│       │   └── report/[id]/     # Post-interview feedback report
│       └── layout.tsx
└── backend/                     # FastAPI + LangGraph + ChromaDB
    ├── agents/
    │   ├── conductor.py         # Conversational interview conductor (main agent)
    │   ├── evaluator.py         # Answer scoring (correctness/depth/communication/problem-solving)
    │   ├── feedback.py          # Post-interview report generation
    │   ├── extractor.py         # Structured knowledge extraction from web content
    │   └── blueprint.py         # Interview plan generation
    ├── graph/
    │   └── interview_graph.py   # LangGraph state machine (Postgres-backed checkpointing)
    ├── rag/
    │   ├── vector_store.py      # ChromaDB document ingestion
    │   ├── retriever.py         # Semantic search for question context
    │   └── embeddings.py        # sentence-transformers / Google embeddings
    ├── search/
    │   ├── tavily.py            # Multi-category web search (concurrent)
    │   ├── firecrawl.py         # Full-page markdown scraping (concurrent)
    │   └── anakin.py            # Reddit thread scraping
    ├── normalization/           # Round name canonicalization, dedup, fuzzy matching
    ├── pipeline.py              # End-to-end research pipeline (fully async)
    ├── db/postgres.py           # PostgreSQL models (SQLAlchemy async)
    ├── api/
    │   ├── interview.py         # /start, /answer, /end, /complete
    │   ├── report.py            # /reports/:id
    │   └── auth.py              # /auth/login (email-based, no password)
    └── main.py                  # FastAPI app + lifespan (DB + graph init)
```

---

# Getting Started

## 1. Backend Setup

```bash
cd backend

python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env

# Start PostgreSQL + ChromaDB
docker-compose up -d

# Run the backend
uvicorn main:app --reload --port 8000
```

---

## 2. Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:3000
```

---

## 3. Environment Variables

### backend/.env

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/intervu` |
| `DATABASE_URL_PSYCOPG` | `postgresql://postgres:postgres@localhost:5432/intervu` |
| `GOOGLE_API_KEY` | Google AI Studio — Blueprint, Evaluator, Feedback agents |
| `GROQ_API_KEY` | Groq — Extractor, Conductor agents |
| `TAVILY_API_KEY` | Tavily — Web search |
| `FIRECRAWL_API_KEY` | Firecrawl — Web scraping |
| `ANAKIN_API_KEY` | Anakin — Reddit scraping |
| `EMBEDDING_PROVIDER` | `sentence-transformers` (default, local) or `google` (API-based) |

### frontend/.env.local

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

# Models Used

| Agent | Model | Provider |
|-------|-------|----------|
| Conductor (interviewer) | `llama-3.3-70b-versatile` | Groq |
| Extractor | `meta-llama/llama-4-scout-17b-16e-instruct` | Groq |
| Blueprint generator | `llama-3.3-70b-versatile` | Groq |
| Evaluator | `openai/gpt-oss-120b` | Google |
| Feedback | `openai/gpt-oss-120b` | Google |

---

# Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, TailwindCSS |
| Backend | Python 3.11, FastAPI, LangGraph |
| AI Agents | Groq (Llama 3.3), Google Gemini 2.5 Flash |
| Embeddings | sentence-transformers (`BAAI/bge-small-en-v1.5`) or Google `text-embedding-004` |
| Vector DB | ChromaDB (local persistent) |
| Graph State | LangGraph + AsyncPostgresSaver (Postgres-backed checkpointing) |
| Relational DB | PostgreSQL (async SQLAlchemy + asyncpg) |
| Web Research | Tavily (search) + Firecrawl (scraping) + Anakin (Reddit) |
| Auth | Email-based identity (no password), localStorage session |
| Containerization | Docker + docker-compose |

---

# Key Architecture Decisions

- **Conductor agent over rigid scripts** — the interview is driven by a single LLM agent that sees the full conversation history, the blueprint, and a coverage summary, making it feel like a real conversation rather than a question list.
- **Async throughout** — Tavily (11 concurrent searches), Firecrawl + Anakin (concurrent scraping), LLM calls all use `asyncio.gather` / `ainvoke`.
- **Postgres-backed graph checkpointing** — `AsyncPostgresSaver` means in-progress interviews survive server restarts.
- **Research caching** — `ResearchProfile` table caches pipeline output per company/role, so repeat interviews reuse the same knowledge base without re-running the expensive pipeline.
- **Section coverage guardrails** — the conductor is given explicit coverage status per section and a per-section question cap, ensuring all areas of the interview are visited even if the conversation gravitates toward one topic.
