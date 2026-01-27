# Research Agent - Autonomous Paper Digest 🤖

A fully autonomous AI research assistant that daily fetches, analyzes, and summarizes new academic papers in your research domain. Built as a Clawdbot skill.

## What It Does

**Every morning, you wake up to a curated digest of relevant research papers - automatically.**

The agent:
- 🔍 Fetches yesterday's papers from OpenAlex + arXiv
- 🧠 Uses LLM intelligence to analyze relevance (not just keywords!)
- 📊 Categorizes and scores papers 1-5 stars
- 👤 Flags papers by researchers you're tracking
- 📱 Delivers digest to Telegram or saves to file
- 🔄 Never shows you the same paper twice

**Zero manual work. Runs autonomously via cron.**

## Features

### 🎯 True AI Agent
Not just a script with LLM sprinkled in - this is an autonomous agent that:
- **Decides** which papers matter using real intelligence
- **Adapts** analysis based on your domain configuration
- **Handles errors** gracefully (API failures, rate limits)
- **Reports back** when done

### 🌍 Domain Agnostic
Works for **any research field** - just edit keywords:
- Food Safety (default)
- Materials Science
- Drug Discovery
- Climate Science  
- Astronomy
- Neuroscience
- Agriculture
- *Your field here*

### 💰 Flexible LLM Options
- **Gemini**: Free tier (15 RPM) - $0/month
- **OpenAI**: GPT-4o-mini - ~$1-3/month
- **Anthropic**: Claude Haiku - ~$2-5/month

### 📬 Multi-Output
- Telegram bot messages
- Text file digests
- Both simultaneously

## Quick Start

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

This will:
- Create `config.json` from template
- Set up data directories
- Optionally configure cron job

### 3. Configure

Edit `config.json`:

**Minimal setup:**
```json
{
  "domain": {
    "keywords": {
      "technical": ["machine learning", "deep learning"],
      "domain": ["your", "research", "keywords"]
    }
  },
  "llm": {
    "provider": "gemini",
    "apiKey": "YOUR_GEMINI_KEY"
  },
  "output": {
    "telegram": {
      "enabled": true,
      "chatId": "YOUR_CHAT_ID"
    }
  }
}
```

**Get API keys:**
- Gemini (free!): https://aistudio.google.com
- Telegram chat ID: Message @userinfobot

### 4. Test

Ask Clawdbot:
```
Run the research-agent skill
```

The agent will fetch yesterday's papers and send you a digest!

### 5. Automate

Already done if you ran `setup.sh`. Otherwise:

```bash
clawdbot cron add \
  --text "Run the research-agent skill" \
  --schedule "0 9 * * *"
```

**Done!** You'll get daily digests at 9 AM automatically.

## Example Output

```
📊 Daily Research Debrief (2026-01-26)

Found 3 new AI/Food Safety papers (2 OpenAlex, 1 arXiv)
(2 Pathogen Detection, 1 Quality Assessment):

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 Deep Learning for Real-Time Salmonella Detection
⭐⭐⭐⭐⭐ | 🦠 Pathogen Detection
👤 Dr. Jane Smith | 🔓 | 📊 15 citations | 📅 2026-01-26
Nature Food

We developed a CNN-based system for rapid Salmonella 
detection in poultry processing using hyperspectral imaging...

[Read Full Paper](https://doi.org/...)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

(LLM analyzed 47 candidates, selected 3 most relevant)
```

## Customization

### Change Research Domain

Edit `domain.keywords` in `config.json`. See `references/domain-examples.md` for examples in:
- Materials Science
- Drug Discovery
- Climate Science
- Astronomy
- Neuroscience
- Agriculture

### Track Specific Authors

Edit `authors_watchlist.json`:
```json
{
  "authors": [
    {
      "name": "Jane Smith",
      "openalex_id": "A1234567890",
      "note": "Leading food safety ML researcher"
    }
  ]
}
```

Find OpenAlex IDs: https://openalex.org/authors

### Adjust Relevance Threshold

```json
{
  "filters": {
    "minRelevanceScore": 4  // Only 4-5 star papers
  }
}
```

### Change Schedule

```bash
# Every day at 8 AM
clawdbot cron update <job-id> --schedule "0 8 * * *"

# Only weekdays at 9 AM  
clawdbot cron update <job-id> --schedule "0 9 * * 1-5"
```

## How It Works

```
Daily Cron Trigger
  ↓
Agent Wakes Up
  ↓
Loads config.json (understands your domain)
  ↓
Fetches papers (OpenAlex + arXiv APIs)
  ↓
LLM analyzes each paper:
  - Reads title + abstract
  - Scores relevance 1-5
  - Categorizes by research theme
  - Explains reasoning
  ↓
Checks author watchlist
  ↓
Deduplicates (never repeats papers)
  ↓
Formats digest (Telegram markdown)
  ↓
Delivers (Telegram / file)
  ↓
Updates history
  ↓
Agent sleeps until tomorrow
```

## Project Structure

```
research-agent/
├── SKILL.md                    # Agent instructions (read by LLM)
├── config.example.json         # Configuration template
├── authors_watchlist.json      # Tracked researchers
├── scripts/
│   ├── setup.sh               # First-time setup
│   ├── fetch_openalex.js      # OpenAlex API tool
│   └── fetch_arxiv.js         # arXiv API tool
├── references/
│   └── domain-examples.md     # Multi-domain configs
├── data/
│   └── papers_history.jsonl   # Seen papers (auto-created)
└── digests/
    └── digest_YYYY-MM-DD.txt  # Saved digests (optional)
```

## Why Use This?

**vs Manual Literature Search:**
- ✅ Saves 30-60 minutes daily
- ✅ Never miss papers by key authors
- ✅ Consistent coverage

**vs RSS/Email Alerts:**
- ✅ Intelligent filtering (not just keywords)
- ✅ Multi-source (journals + preprints)
- ✅ Categorized and scored

**vs Other LLM Paper Tools:**
- ✅ Fully autonomous (not manual prompting)
- ✅ Free LLM option (Gemini)
- ✅ Clawdbot integration
- ✅ Domain-agnostic

## Requirements

- Clawdbot installed
- Node.js 14+
- LLM API key (Gemini/OpenAI/Anthropic)
- (Optional) Telegram bot for delivery

## Troubleshooting

**No papers found:**
- Check if yesterday actually had papers (weekends are slow)
- Broaden domain keywords
- Lower `minRelevanceScore`

**Too many irrelevant papers:**
- Narrow domain keywords
- Raise `minRelevanceScore`
- Review technical keywords

**LLM rate limits:**
- Use Gemini free tier (15 RPM)
- Or reduce `maxPapersPerDigest`

**Telegram not working:**
- Verify bot token and chat ID
- Check Telegram API is accessible
- Fall back to file output

## Contributing

Ideas welcome:
- Additional data sources (Semantic Scholar, PubMed)
- PDF auto-download for open-access papers
- Citation network analysis
- Email delivery option
- Weekly digest rollup

## License

MIT License

## Credits

Built by [@chenhaoq87](https://github.com/chenhaoq87)

Powered by:
- [Clawdbot](https://github.com/clawdbot/clawdbot)
- [OpenAlex](https://openalex.org/)
- [arXiv](https://arxiv.org/)
- OpenAI / Anthropic / Google (LLM providers)

---

⭐ If this saves you time, star the repo!
