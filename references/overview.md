# Daily Debrief — Overview

This skill provides an autonomous daily research digest: it fetches new papers (OpenAlex/arXiv), analyzes relevance, and summarizes top GitHub trending repos for a configured research domain. It runs on a schedule via OpenClaw (cron/Dashboard) and posts a concise digest.

## How it works (high level)
1. Fetch candidates (OpenAlex + arXiv) based on broad keywords.
2. LLM scores relevance (1–5) and assigns a category.
3. Select top items + top 3 trending GitHub repos.
4. Format digest and deliver (Telegram/file).
5. Update history to avoid duplicates.

## Quick start
```bash
cd ~/clawd/skills
git clone https://github.com/chenhaoq87/research-agent.git daily-debrief
cd daily-debrief
./scripts/setup.sh
```

## Configure
Edit `config.json` (copy from `config.example.json` if needed) to set:
- domain name, keywords, categories
- output channel (Telegram/file)
- relevance thresholds

## Automate
Schedule via OpenClaw Dashboard or ask the agent to create a daily cron.
Example prompt:
```
Please schedule the daily-debrief skill daily at 9 AM UTC.
```

## Notes
- The skill uses your OpenClaw LLM provider (no extra API key required).
- See `SKILL.md` for full procedure and references for domain examples.
