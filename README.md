# InterVu

An AI-powered interview preparation platform.

## Project Structure

```
InterVu/
├── frontend/          # Next.js 15 + TypeScript + Tailwind + shadcn/ui
└── backend/           # Python + FastAPI + LangGraph + ChromaDB
    ├── agents/        # Interviewer, Evaluator, Feedback, Extractor
    ├── graph/         # LangGraph interview state machine
    ├── rag/           # ChromaDB vector store + retriever + embeddings
    ├── search/        # Tavily + Firecrawl research pipeline
    ├── db/            # PostgreSQL models (SQLAlchemy async)
    ├── api/           # FastAPI routers
    └── main.py        # App entrypoint
```

## Getting Started

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and fill in env vars
copy .env.example .env

# Run the API server
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. PostgreSQL

Make sure PostgreSQL is running locally (or update `DATABASE_URL` in `.env`).

Tables are auto-created on first startup via SQLAlchemy.

### 4. API Keys Required

| Key | Where to get |
|-----|-------------|
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/) |
| `TAVILY_API_KEY` | [Tavily](https://tavily.com/) |
| `FIRECRAWL_API_KEY` | [Firecrawl](https://firecrawl.dev/) |

## Models Used

| Agent | Model |
|-------|-------|
| Interviewer | `gemini-2.5-flash` |
| Extractor | `gemini-2.5-flash` |
| Evaluator | `gemini-2.5-pro` |
| Feedback | `gemini-2.5-pro` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Python, FastAPI, LangGraph |
| AI | Gemini 2.5 Flash & Pro |
| Vector DB | ChromaDB + sentence-transformers |
| Relational DB | PostgreSQL (async SQLAlchemy) |
| Search | Tavily + Firecrawl |
