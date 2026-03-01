---
name: architecture-diagram
description: Analyze the joshkurz.net codebase and generate visual architecture diagrams using Python. Use when asked to visualize, explain, or document the system architecture.
disable-model-invocation: true
---

# Architecture Diagram Generator

Analyze the joshkurz.net codebase and generate visual architecture diagrams using Python. Run this live to show how the system is built.

## What You'll Do

1. **Analyze the codebase** - map all components, APIs, data flows, and external services
2. **Generate Python diagram scripts** using the `diagrams` library
3. **Run the scripts** to produce PNG architecture diagrams
4. **Present findings** with a clear written architecture summary

## Steps

### Step 1 – Audit the Architecture

Read these files to understand the full system:
- `pages/api/*.js` – all API routes and what they do
- `lib/*.js` – core logic, storage, OpenAI integration
- `package.json` – all dependencies
- `next.config.js` – Next.js config
- `CLAUDE.md` – architecture notes

Produce a structured summary covering:
- Entry points (pages, API routes)
- Data stores (DynamoDB tables, in-memory, static files)
- External services (OpenAI, Vercel, Google Analytics)
- Data flow for the three main user journeys: get a joke, rate a joke, generate AI joke

### Step 2 – Write Diagram Scripts

Create `talk/diagrams/generate_diagrams.py` using the `diagrams` Python library. Install it first if needed:

```bash
pip install diagrams 2>/dev/null || pip3 install diagrams 2>/dev/null
```

Generate **three diagrams**:

**Diagram 1: High-Level System Architecture**
```python
from diagrams import Diagram, Cluster, Edge
from diagrams.programming.framework import React
from diagrams.onprem.client import User
from diagrams.aws.database import Dynamodb
from diagrams.saas.analytics import Analytics
# Use generic nodes for OpenAI and Vercel
```

Show: User → Vercel/Next.js → [DynamoDB (ratings + stats), DynamoDB Streams → Lambda (stats aggregation), OpenAI API, Static Data]

**Diagram 2: API Route Map**
Show each API endpoint as a node, what it reads/writes, and which lib module handles it.

**Diagram 3: Data Flow – AI Joke Generation**
Show the streaming flow: User → `/api/ai-joke` → `openaiClient` → OpenAI → streaming response → `parseJokeStream` → UI

### Step 3 – Run the Scripts

```bash
cd talk/diagrams && python generate_diagrams.py
```

Save output PNGs to `talk/diagrams/output/`.

### Step 4 – Present the Architecture

After generating diagrams, output a concise architecture briefing:

```
## joshkurz.net Architecture

**Runtime:** Next.js 13 on Vercel (serverless)
**Data:** AWS DynamoDB for ratings and stats persistence, fatherhood.gov JSON for jokes
**AI:** OpenAI GPT-4.1 with streaming, TTS via gpt-4o-mini-tts
**Analytics:** Google Analytics + custom DynamoDB-backed dashboard

### Key Design Decisions
1. [explain the most interesting architectural choice]
2. [explain the DynamoDB single-table design and O(1) stats lookup]
3. [explain the streaming approach for AI]

### Generated Diagrams
- talk/diagrams/output/system_architecture.png
- talk/diagrams/output/api_routes.png
- talk/diagrams/output/ai_joke_flow.png
```

Show the generated PNG files to the audience using the Read tool (images are rendered inline).
