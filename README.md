# Research Agent - Autonomous Paper Digest 🤖

A fully autonomous AI research assistant that daily fetches, analyzes, and summarizes new academic papers in your research domain.

**Built as a Clawdbot sub-agent.**

## 🤖 How It Works

This isn't just a script that calls an LLM API. It is an **autonomous agent skill** for Clawdbot.

1.  **Cron Trigger**: Daily at 9 AM (default).
2.  **Agent Spawns**: Clawdbot creates an isolated session for the agent.
3.  **Mission Read**: The agent (Claude) reads `SKILL.md` to understand its goal.
4.  **Tools Used**:
    *   `scripts/fetch_openalex.js` (Journals)
    *   `scripts/fetch_arxiv.js` (Preprints)
5.  **Intelligence**: The agent reads the abstracts *itself* and scores them based on your criteria.
6.  **Reporting**: Sends a digest to Telegram and saves a log.

## ✨ Features

*   **True Autonomy**: Spawns, runs, and terminates automatically.
*   **Deep Analysis**: Evaluates papers for *relevance*, not just keywords.
*   **Multi-Source**: OpenAlex (250M+ works) and arXiv.
*   **Domain Agnostic**: Configurable for Food Safety, Physics, AI, Biology, etc.
*   **No Extra Config**: Uses your existing Clawdbot LLM provider. No separate API keys to manage.

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
      "domain": ["salmonella", "listeria", "pathogen"]
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
*Note: No `llm` section needed!*

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
