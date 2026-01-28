# Research Agent - Autonomous Research Digest 🤖

A fully autonomous AI research assistant that daily fetches, analyzes, and summarizes new academic papers and trending GitHub repositories in your research domain.

**Built as a Clawdbot sub-agent.**

## 🤖 How It Works

This isn't just a script that calls an LLM API. It is an **autonomous agent skill** for Clawdbot.

### Two-Stage Process:

**Stage 1: Broad API Fetch (Keyword-Based)**
- Queries OpenAlex + arXiv APIs using your configured keywords
- Keywords use **OR logic** - fetches papers mentioning **ANY** keyword
- Purpose: Cast a wide net (~50-100 papers/day) without fetching all of science
- Example: "food safety" OR "pathogen" OR "dairy" OR "AI agent" OR ...

**Stage 2: Deep LLM Analysis (Intelligence-Based)**
- **ALL fetched papers** (not just keyword matches) go to the LLM
- The agent (Claude) reads each abstract and scores relevance 1-5
- Scoring based on semantic understanding, not keyword matching
- Only papers scoring ≥3 make it to your digest

**Why this hybrid approach?**
- Pure keywords miss nuanced relevance
- Pure LLM on all papers would cost $50+/day
- This balances discovery breadth with cost (~$0.15-0.20/day)

### Daily Workflow:

1.  **Cron Trigger**: Daily at 9 AM (default).
2.  **Agent Spawns**: Clawdbot creates an isolated session for the agent.
3.  **Fetch Papers**: Uses API tools to get papers (Stage 1)
4.  **Analyze Papers**: LLM scores every fetched paper (Stage 2)
5.  **Filter Papers**: Keeps papers ≥ minimum relevance score
6.  **Fetch GitHub Trending**: Gets top trending repos from past day
7.  **Summarize Repos**: LLM explains relevance of top 3 repos to your research
8.  **Report**: Sends digest to Telegram and saves log.

## ✨ Features

*   **True Autonomy**: Spawns, runs, and terminates automatically.
*   **LLM-Based Relevance**: Every paper scored by Claude for semantic relevance (not just keyword matching)
*   **Broad Discovery**: Keywords fetch candidates; LLM judges quality → catches cross-domain insights
*   **Multi-Source Papers**: OpenAlex (250M+ works) and arXiv.
*   **GitHub Trending**: Top 3 trending repos from past day with relevance summary
*   **Domain Agnostic**: Configurable for Food Safety, Physics, AI, Biology, etc.
*   **No Extra Config**: Uses your existing Clawdbot LLM provider. No separate API keys to manage.

## 🛠️ Available Tools

The agent comes equipped with specialized tools to interface with academic databases:

### 1. `scripts/fetch_openalex.js`
*   **Purpose**: Search OpenAlex (250M+ works) for journal articles and conference papers.
*   **Usage**: `node scripts/fetch_openalex.js <date> <keywords>`
*   **Capabilities**: Filters by publication date, reconstructs abstracts from inverted indexes, and extracts author metadata.

### 2. `scripts/fetch_arxiv.js`
*   **Purpose**: Search arXiv for the latest preprints.
*   **Usage**: `node scripts/fetch_arxiv.js <date> <categories> <keywords>`
*   **Capabilities**: Filters by specific arXiv categories (e.g., `cs.CV`, `cs.LG`) AND keyword matches to ensure relevance.

### 3. `scripts/fetch_github_trending.js`
*   **Purpose**: Fetch trending GitHub repositories from past day.
*   **Usage**: `node scripts/fetch_github_trending.js <date> "" <limit>`
*   **Capabilities**: Searches for repos with activity on target date (≥50 stars), sorted by star count. Returns top N trending repos broadly (not confined to domain keywords).

### 4. `scripts/setup.sh`
*   **Purpose**: One-shot setup utility.
*   **Capabilities**: Generates config files, creates data directories, and helps schedule the cron job.

*Note: The agent also utilizes Clawdbot's native capabilities for file I/O and messaging.*

## 💰 Cost Note

**This skill does not require a separate LLM API key.**

However, because the agent runs inside Clawdbot, it consumes tokens from your **existing Clawdbot LLM provider** (e.g., OpenRouter, Anthropic, OpenAI).
*   **Input**: ~1-2k tokens per run + ~500 tokens per paper analyzed.
*   **Cost**: Depends on your Clawdbot model configuration (e.g. `haiku` is cheaper than `opus`).

## 🚀 Quick Start

### 1. Install
```bash
cd ~/clawd/skills
git clone https://github.com/chenhaoq87/research-agent.git
cd research-agent
```

### 2. Setup
```bash
./scripts/setup.sh
```
Follow the prompts to create your config and (optional) cron job.

### 3. Configure
Edit `config.json`:
```json
{
  "domain": {
    "name": "Food Safety",
    "keywords": {
      "technical": ["machine learning", "computer vision"],
      "domain": ["salmonella", "listeria", "pathogen", "dairy", "food quality"]
    }
  },
  "output": {
    "telegram": {
      "enabled": true,
      "chatId": "YOUR_CHAT_ID"
    }
  }
}
```

**Keyword Strategy:**
- Use **broad terms** to avoid missing relevant papers
- Add **alternative phrasings** (e.g., "food safety" AND "foodborne")
- Include **related concepts** (e.g., "dairy", "milk", "cheese")
- Keywords use OR logic → papers matching ANY keyword get fetched → LLM judges relevance

*Note: No `llm` section needed - uses your Clawdbot provider!*

### 4. Test
Ask Clawdbot:
```text
Run the research-agent skill
```

### 5. Automate
If you didn't use the setup script:
```bash
clawdbot cron add \
  --text "Run the research-agent skill" \
  --schedule "0 9 * * *"
```

## 📂 Project Structure

*   `SKILL.md`: The agent's "brain" (instructions).
*   `scripts/`: Tools for fetching papers.
*   `config.json`: User preferences.
*   `data/`: History of seen papers (to prevent duplicates).

## License
MIT
