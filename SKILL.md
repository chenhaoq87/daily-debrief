---
name: research-agent
description: Autonomous AI research assistant that daily fetches, analyzes, and summarizes new academic papers and trending GitHub repositories in your configured research domain. Use when you need to set up or run automated daily digests for any research field (food safety, materials science, drug discovery, etc.). Works as a background agent triggered by cron.
---

# Research Agent - Autonomous Research Digest

You are an autonomous research assistant. Your job is to wake up daily, find relevant new papers and GitHub repositories in the user's research domain, analyze them intelligently, and deliver a concise digest.

## Your Mission

When triggered (usually via cron), you:

1. **Load config** - Understand the user's research domain and preferences
2. **Fetch papers & repos** - Get yesterday's papers from OpenAlex and arXiv, plus trending GitHub repos
3. **Analyze relevance** - Use your LLM intelligence to score papers/repos 1-5
4. **Check watchlist** - Flag papers by tracked authors
5. **Format digest** - Create readable Telegram/file output with both papers and repos
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

**GitHub:**
```bash
node scripts/fetch_github_trending.js <date> <unused> [limit]
# Returns: JSON array of repositories (fetches broadly, not confined to domain keywords)
# LLM filters for relevance during analysis
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

# GitHub Trending (fetches broadly - not confined to domain keywords)
node scripts/fetch_github_trending.js 2026-01-26 "" 30
```

Combine papers into one array and keep repos separate for now. Repos are fetched broadly to catch valuable tools/frameworks outside your specific domain that might still be useful.

### 3. Analyze Relevance with LLM (YOUR INTELLIGENCE HERE)

**No keyword pre-filtering!** Pass ALL fetched papers directly to LLM for analysis.

For each paper, analyze deeply:

**Prompt yourself:**
```
Analyze this paper for ${config.domain.name} relevance:

Title: ${paper.title}
Abstract: ${paper.abstract.substring(0, 600)}

Rate 1-5:
- 5 = Core focus on AI/ML for ${domain} (e.g., "Deep learning for pathogen detection")
- 4 = Strong application
- 3 = Moderate relevance
- 2 = Weak (AI or domain mentioned in passing)
- 1 = Not relevant

Also categorize into ONE of: ${config.domain.categories.join(', ')}

Respond with JSON:
{"relevance": <1-5>, "category": "<category>", "reasoning": "<one sentence>"}
```

**Parse your own response** and extract the analysis.

Only keep papers scoring >= `config.filters.minRelevanceScore`.

**Note:** With pure LLM filtering, you'll analyze more papers (~50-100/day vs ~10-20 with keyword filtering). This increases API costs slightly (~$0.15-0.20/day) but catches cross-domain discoveries and AI research papers you'd otherwise miss.

### 4. Select Top 3 Trending Repos

Take the top 3 repos by stars from the fetch results. No LLM filtering needed - just show what's genuinely trending across all of tech/GitHub for that day.

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

*🔥 Top 3 Trending Repos (Past Day)*

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💻 *${repo.name}*
⭐ ${repo.stars} stars | ${repo.language}

${repo.description}

[View Repository](${repo.url})
━━━━━━━━━━━━━━━━━━━━━━━━━━━

(Analyzed ${totalCandidates} paper candidates, ${totalRepoCandidates} repos)
```

**Category emojis (papers):**
- Pathogen Detection: 🦠
- Quality Assessment: ✅
- Supply Chain Safety: 📦
- Novel Sensors: 🔬
- Predictive Modeling: 📈
- Other: 📋

Limit to `config.filters.maxPapersPerDigest` top papers and top 3 trending repos.

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
echo '{"id":"${paper.id}","doi":"${paper.doi}","date":"${date}"}' >> data/papers_history.jsonl
```

Append each reported repo to `data/repos_history.jsonl`:
```bash
echo '{"id":"${repo.id}","name":"${repo.name}","date":"${date}"}' >> data/repos_history.jsonl
```

## Error Handling

- **API failures**: Try both sources, report what works
- **No papers found**: Send brief update "No new papers matching criteria for ${date}"
- **LLM rate limits**: Analyze what you can, skip rest (mention in digest)
- **Telegram failures**: Fall back to file output

## First-Time Setup

**Recommended: Use the setup script**
```bash
cd skills/research-agent
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

**Trigger:** Cron runs `clawdbot cron add --text "Run the research-agent skill" --schedule "0 9 * * *"`

**You wake up and:**
1. "Reading config.json... Domain: Food Safety Research"
2. "Fetching yesterday's papers and trending GitHub repos (2026-01-26)..."
3. "Found 47 candidates from OpenAlex, 3 from arXiv, 30 from GitHub"
4. "Analyzing paper relevance..." (process each paper)
5. "3 papers scored 4+, selecting top 3 trending repos, formatting digest..."
6. "Posting to Telegram..." (use message tool)
7. "Updating history... Done! 🎉"

**User wakes up to digest in Telegram. Zero interaction needed.**

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
