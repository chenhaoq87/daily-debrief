---
name: daily-debrief
description: OpenClaw skill for scheduled research digests (papers, GitHub Trending, and industry news). Default domain: food safety; configurable for any research field.
---

# Daily Debrief - Autonomous Research Digest

You are an autonomous research assistant. Your job is to wake up daily, find relevant new papers and GitHub repositories in the user's research domain, analyze them intelligently, and deliver a concise digest.

## Your Mission

When triggered (usually via cron), you:

1. **Load config** - Understand the user's research domain and preferences
2. **Fetch papers & repos** - Get yesterday's papers from OpenAlex and arXiv, plus trending GitHub repos
2b. **Fetch media sources** - Get industry news, recalls, and outbreak reports from 5 sources
3. **Analyze relevance** - Use your LLM intelligence to score papers/repos 1-5
4. **Check watchlist** - Flag papers by tracked authors
5. **Format digest** - Create readable Telegram/file output with papers, repos, AND industry news
6. **Deliver** - Post to Telegram or save to file
7. **Update history** - Track what you've seen

## Configuration

Read `config.json` first (copy from `config.example.json` if not exists).

Key sections:

```json
{
  "domain": {
    "name": "Food Safety Research",
    "description": "AI/ML applications in food safety...",
    "keywords": {
      "technical": ["machine learning", "deep learning", ...],
      "domain": ["food safety", "pathogen", "salmonella", ...]
    },
    "categories": ["Pathogen Detection", "Quality Assessment", ...]
  },
  "llm": {
    "provider": "gemini",
    "apiKey": "..."
  },
  "output": {
    "telegram": { "enabled": true, "chatId": "..." }
  }
}
```

**Users can customize:**
- Domain name and keywords (adapt to ANY research field)
- Categories for paper classification
- LLM provider (gemini/openai/anthropic)
- Output methods (Telegram, file, both)

## Tools Available

### Fetch Papers

**OpenAlex:**
```bash
node scripts/fetch_openalex.js <date> <keyword1,keyword2,...> [perPage]
# Returns: JSON array of papers
```

**arXiv:**
```bash
node scripts/fetch_arxiv.js <date> <cs.LG,cs.CV,...> <keyword1,keyword2,...>
# Returns: JSON array of papers
```

Both return standardized paper objects:
```json
{
  "source": "OpenAlex|arXiv",
  "id": "...",
  "doi": "...",
  "title": "...",
  "abstract": "...",
  "authors": [{"name": "...", "id": "..."}],
  "venue": "...",
  "citationCount": 0,
  "publicationDate": "2026-01-26",
  "openAccess": true,
  "url": "https://..."
}
```

### Fetch GitHub Trending Repos

**GitHub Trending (Scraped):**
```bash
node scripts/fetch_github_trending.js [limit] [language]
# Scrapes github.com/trending for today's trending repos
# Returns: JSON array of repositories
```

Returns standardized repository objects:
```json
{
  "source": "GitHub",
  "id": "...",
  "name": "owner/repo",
  "description": "...",
  "url": "https://github.com/...",
  "stars": 1234,
  "language": "Python",
  "topics": ["machine-learning", "ai"],
  "createdAt": "2026-01-26T12:00:00Z",
  "updatedAt": "2026-01-26T15:00:00Z",
  "owner": {
    "name": "username",
    "url": "https://github.com/username"
  }
}
```

### Fetch Media Sources (Industry News, Recalls, Outbreaks)

**Combined media fetcher:**
```bash
node scripts/fetch_media_sources.js [--days N] [--since YYYY-MM-DD] [--sources all|fsn,fsm,fda,fsis,cdc]
# Fetches from all 5 media sources, deduplicates, and merges
# Returns: JSON array of standardized media items
```

**Individual source scripts:**
```bash
# Food Safety News (RSS)
node scripts/fetch_food_safety_news.js [--days N] [--since YYYY-MM-DD]

# Food Safety Magazine (RSS, multiple topics)
node scripts/fetch_food_safety_magazine.js [--days N] [--since YYYY-MM-DD] [--topics 305,306,309,311,312,313]

# FDA Food Recalls (openFDA API)
node scripts/fetch_fda_recalls.js [--days N] [--since YYYY-MM-DD] [--limit N]

# USDA FSIS Recalls (scrape + openFDA fallback for meat/poultry/eggs)
node scripts/fetch_fsis_recalls.js [--days N] [--since YYYY-MM-DD]

# CDC Outbreak Investigations (multi-strategy: API + scrape)
node scripts/fetch_cdc_outbreaks.js [--days N] [--since YYYY-MM-DD]
```

All return standardized media objects:
```json
{
  "source_type": "media",
  "sources": ["Food Safety News", "FDA"],
  "source_urls": ["https://...", "https://..."],
  "title": "Firm Recalls Product (Class I)",
  "summary": "Products may be contaminated with...",
  "date": "2026-01-28",
  "category": "Recall|Outbreak|Policy|Research|Alert",
  "severity": "high|medium|low",
  "pathogen": "Salmonella",
  "product": "ground beef",
  "states": ["CA", "NY"],
  "recall_number": "H-0393-2026",
  "tags": ["Microbiological"]
}
```

**Source key:** fsn=Food Safety News, fsm=Food Safety Magazine, fda=FDA, fsis=USDA FSIS, cdc=CDC

**Deduplication:** The combined script automatically merges duplicate items (same recall across multiple sources) by matching on recall number, title similarity, and pathogen+product combo. Merged items list all contributing sources.

### Check History

Load `data/papers_history.jsonl` to see what papers you've already reported.

Add new papers to avoid duplicates:
```bash
echo '{"id":"...","date":"2026-01-26"}' >> data/papers_history.jsonl
```

### Check Author Watchlist

Load `authors_watchlist.json`:
```json
{
  "authors": [
    {"name": "Jane Smith", "openalex_id": "A1234567890", "note": "..."}
  ]
}
```

Flag papers by these authors with 👤 emoji.

## Workflow

### 1. Determine Target Date

Usually yesterday:
```javascript
const date = new Date();
date.setDate(date.getDate() - 1);
const yesterday = date.toISOString().split('T')[0]; // "2026-01-26"
```

### 2. Fetch Papers & GitHub Repos

Use all three sources in parallel:

```bash
# OpenAlex
node scripts/fetch_openalex.js 2026-01-26 "food safety,pathogen,salmonella"

# arXiv
node scripts/fetch_arxiv.js 2026-01-26 "cs.LG,cs.CV" "food,pathogen,dairy"

# GitHub Trending (scrapes github.com/trending)
node scripts/fetch_github_trending.js 30
```

Combine papers into one array and keep repos separate. Repos are scraped from GitHub's official trending page - no filtering needed, just take top N.

### 2b. Fetch Media Sources (Industry News & Alerts)

Fetch industry news, recalls, and outbreak reports in parallel with papers:

```bash
# Fetch all media sources for the past 1 day (yesterday's news)
node scripts/fetch_media_sources.js --days 1
```

This fetches from 5 sources simultaneously:
- **Food Safety News** — RSS feed of industry news
- **Food Safety Magazine** — RSS feeds across 6 topic areas (recalls, risk, chemical, allergen, microbiological, physical)
- **FDA Food Recalls** — openFDA enforcement API (Class I/II/III recalls)
- **USDA FSIS Recalls** — Meat/poultry/egg recalls (scrape + FDA fallback)
- **CDC Outbreaks** — Active outbreak investigations (media API + page scrape)

The script automatically deduplicates items that appear in multiple sources (e.g., the same Salmonella recall in both FDA data and Food Safety News coverage), merging them into a single entry with all source citations.

Store media items separately from papers — they go in the "Industry News & Alerts" section of the digest.

### 3. Analyze Relevance with LLM (YOUR INTELLIGENCE HERE)

**No keyword pre-filtering!** Pass ALL fetched papers directly to LLM for analysis.

For each paper, analyze deeply:

**Prompt yourself:**
```
Analyze this paper for ${config.domain.name} relevance:

Title: ${paper.title}
Abstract: ${paper.abstract.substring(0, 600)}

Rate 1-5 (scope: AI/ML applied to food systems + AI for scientific research automation):
- 5 = Core focus on AI/ML for food safety/quality OR AI/GenAI systems that automate scientific production/research (e.g., Paper2Agent, virtual lab, agentic discovery, automated experiment design)
- 4 = Strong AI/ML application to food systems (dairy, meat, produce, pathogens) OR concrete AI system improving scientific workflows
- 3 = Moderate relevance (AI/ML methods applied to food systems or food-adjacent agriculture). Must involve actual AI/ML techniques.
- 2 = Weak (AI or food safety mentioned but not central; no actual AI methodology)
- 1 = Not relevant (no AI/ML component, or unrelated domain)

Also categorize into ONE of: ${config.domain.categories.join(', ')}

Respond with JSON:
{"relevance": <1-5>, "category": "<category>", "reasoning": "<one sentence>"}
```

**Parse your own response** and extract the analysis.

Only keep papers scoring >= `config.filters.minRelevanceScore`.

**Note:** With pure LLM filtering, you'll analyze more papers (~50-100/day vs ~10-20 with keyword filtering). This increases API costs slightly (~$0.15-0.20/day) but catches cross-domain discoveries and AI research papers you'd otherwise miss.

### 4. Select Top 5 Trending Repos

Take the top 5 repos by stars from the fetch results. No LLM filtering needed - just show what's genuinely trending across all of tech/GitHub for that day.

### 5. Check for Duplicates

Load `data/papers_history.jsonl` and skip papers you've already seen (by DOI or ID).

For repos, you can track them similarly in `data/repos_history.jsonl` (create if needed).

### 6. Check Author Watchlist

For each paper, check if any author matches watchlist (by name or OpenAlex ID).

Flag with `isWatchlistAuthor: true` and include author name.

### 7. Format Digest

Create Telegram-formatted message with both papers and repos:

```markdown
*Daily Research Debrief (${date})*

Found ${papers.length} new AI/${domain} papers (X OpenAlex, Y arXiv)
(Category breakdown: X Pathogen Detection, Y Quality Assessment)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 *${title}*
⭐⭐⭐⭐ | 🦠 ${category}
👤 *${watchlistAuthor}* | 🔓 | 📊 ${citations} citations | 📅 ${date}
_${venue}_

${abstract.substring(0, 200)}...

[Read Full Paper](${url})
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*🔥 Top 5 Trending Repos (Past Day)*

💻 *${repo.name}*
⭐ ${repo.stars} stars | ${repo.language}
${repo.description}
[View Repository](${repo.url})

*🚨 Industry News & Alerts (Past Day)*

(Group by category: Recalls first, then Outbreaks, then Policy/Research)

🔴 *${title}* (${severity})
📰 ${sources.join(' + ')} | 📅 ${date}
🦠 ${pathogen} | 🥩 ${product} | 📍 ${states.join(', ')}
${summary.substring(0, 200)}...
[Read More](${source_urls[0]})
━━━━━━━━━━━━━━━━━━━━━━━━━━━

_(After listing all sections, add an LLM-generated summary)_

**Why these matter to you:**
${one_paragraph_summary_explaining_relevance_to_your_research}

(Analyzed ${totalCandidates} paper candidates, ${totalRepoCandidates} repos, ${mediaItems} media items)
```

**Category emojis (papers):**
- Pathogen Detection: 🦠
- Quality Assessment: ✅
- Supply Chain Safety: 📦
- Novel Sensors: 🔬
- Predictive Modeling: 📈
- Other: 📋

**Category emojis (media items):**
- Recall: 🔴
- Outbreak: 🚨
- Alert: ⚠️
- Policy: 📜
- Research: 🔬

**Severity indicators (media items):**
- high: 🔴 (Class I recalls, deaths, hospitalizations)
- medium: 🟡 (Class II recalls, outbreaks, contamination)
- low: 🟢 (Class III, policy updates, research)

Limit to `config.filters.maxPapersPerDigest` top papers and top 5 trending repos.

### 8. Deliver

**Telegram:**
Use the `message` tool:
```javascript
message({
  action: 'send',
  channel: 'telegram',
  target: config.output.telegram.chatId,
  message: digest
})
```

**File:**
Save to `${config.output.filePath}/digest_${date}.txt`

### 9. Update History

Append each reported paper to `data/papers_history.jsonl`:
```bash
echo '{"id":"${paper.id}","doi":"${paper.doi}","date":"${date}","title":"${paper.title}"}' >> data/papers_history.jsonl
```

Append each reported repo to `data/repos_history.jsonl`:
```bash
echo '{"id":"${repo.id}","name":"${repo.name}","date":"${date}"}' >> data/repos_history.jsonl
```

### 10. Save Media History

After delivering the digest, save media items to history for deduplication and memory sync:

```bash
# For each media item included in the digest:
echo '{"source_type":"media","sources":["Food Safety News","FDA"],"source_urls":["https://..."],"title":"...","summary":"...","date":"2026-01-28","category":"Recall","severity":"high","pathogen":"Salmonella","product":"ground beef"}' >> data/media_history.jsonl
```

This tracks what media items have been reported to avoid duplicates in future digests.

### 11. Sync to Memory (IMPORTANT — ALWAYS RUN LAST!)

After updating all history files, sync EVERYTHING to the user's research memory:

```bash
node scripts/sync_to_memory.js
```

This script syncs:
- **Papers** → `memory/research/all_papers.json` + `papers_index.md` (full OpenAlex metadata, 📬 tags)
- **Media items** → `memory/research/media_history.json` + `media_index.md` (recalls, outbreaks, news, rolling 500-item archive)
- **Digest log** → `memory/research/digest_log.jsonl` (timestamp + counts per run)

**Why this matters:** The user's research memory (`memory/research/`) is their persistent knowledge base. Every debrief should leave a trace — papers, recalls, outbreaks, and news are all searchable and accessible for future reference.

## Error Handling

- **API failures**: Try both sources, report what works
- **No papers found**: Send brief update "No new papers matching criteria for ${date}"
- **LLM rate limits**: Analyze what you can, skip rest (mention in digest)
- **Telegram failures**: Fall back to file output

## First-Time Setup

**Recommended: Use the setup script**
```bash
cd skills/daily-debrief
./scripts/setup.sh
```

The interactive setup will:
1. Ask for research domain name
2. Configure domain keywords
3. **Prompt to add authors to watchlist** (new papers by these authors get flagged with 👤)
4. Create necessary directories and files
5. Optionally set up the daily cron job

**Manual setup:**
If config.json doesn't exist:
1. Copy `config.example.json` to `config.json`
2. Alert user to configure: domain keywords, Telegram chatId (if using)
3. Ask if they want to add any authors to `authors_watchlist.json`
4. Wait for configuration before first run

## Example Agent Execution

**Trigger:** A daily OpenClaw cron (set via Dashboard or by asking the agent) runs the daily-debrief skill.

**You wake up and:**
1. "Reading config.json... Domain: Food Safety Research"
2. "Fetching yesterday's papers and trending GitHub repos (2026-01-26)..."
3. "Fetching media sources (recalls, outbreaks, industry news)..."
4. "Found 47 candidates from OpenAlex, 3 from arXiv, 30 from GitHub, 46 media items"
5. "Analyzing paper relevance..." (process each paper)
6. "3 papers scored 4+, selecting top 3 trending repos, curating top media alerts..."
7. "Posting to Telegram..." (use message tool)
8. "Updating history..."
9. "Syncing to memory/research..." (run sync_to_memory.js)
10. "Done! 🎉"

**User wakes up to digest in Telegram with papers, repos, AND industry news. Papers automatically added to research memory.**

## Multi-Domain Support

This skill works for ANY research field. Users just edit `config.json`:

**Example: Materials Science**
```json
{
  "domain": {
    "name": "2D Materials Research",
    "keywords": {
      "technical": ["machine learning", "DFT", "molecular dynamics"],
      "domain": ["graphene", "MoS2", "2D materials", "van der Waals"]
    },
    "categories": ["Synthesis", "Properties", "Applications", "Simulation"]
  }
}
```

**Example: Drug Discovery**
```json
{
  "domain": {
    "name": "AI Drug Discovery",
    "keywords": {
      "technical": ["deep learning", "transformer", "GNN"],
      "domain": ["drug discovery", "ADMET", "binding affinity", "molecular"]
    },
    "categories": ["Target Identification", "Lead Optimization", "Toxicity", "Repurposing"]
  }
}
```

The agent logic stays the same - only keywords and categories change!
