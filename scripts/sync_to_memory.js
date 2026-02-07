#!/usr/bin/env node
/**
 * sync_to_memory.js
 * 
 * Syncs ALL debrief content to the main research memory:
 * - Papers → memory/research/all_papers.json + papers_index.md
 * - Media items (recalls, outbreaks, news) → memory/research/media_history.json + media_index.md
 * - Digest summaries → memory/research/digest_log.jsonl
 * 
 * Usage: node scripts/sync_to_memory.js [--all]
 *   --all: Sync all items in history (not just new ones)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SKILL_DIR = path.dirname(__dirname);
const WORKSPACE = path.resolve(SKILL_DIR, '../..');
const MEMORY_DIR = path.join(WORKSPACE, 'memory/research');

// Paper files
const PAPERS_HISTORY = path.join(SKILL_DIR, 'data/papers_history.jsonl');
const ALL_PAPERS_FILE = path.join(MEMORY_DIR, 'all_papers.json');
const PAPERS_INDEX_FILE = path.join(MEMORY_DIR, 'papers_index.md');

// Media files
const MEDIA_HISTORY_SKILL = path.join(SKILL_DIR, 'data/media_history.jsonl');
const MEDIA_HISTORY_MEM = path.join(MEMORY_DIR, 'media_history.json');
const MEDIA_INDEX_FILE = path.join(MEMORY_DIR, 'media_index.md');

// Digest log
const DIGEST_LOG = path.join(MEMORY_DIR, 'digest_log.jsonl');

// ─── Paper Syncing ───

function fetchPaper(paperId) {
  return new Promise((resolve, reject) => {
    const workId = paperId.replace('https://openalex.org/', '');
    const url = `https://api.openalex.org/works/${workId}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const positions = [];
  for (const [word, indices] of Object.entries(invertedIndex)) {
    for (const idx of indices) { positions[idx] = word; }
  }
  return positions.join(' ');
}

async function syncPapers(syncAll) {
  console.log('\n📄 Syncing papers...');
  
  if (!fs.existsSync(PAPERS_HISTORY)) {
    console.log('  No papers_history.jsonl found');
    return 0;
  }
  
  const historyLines = fs.readFileSync(PAPERS_HISTORY, 'utf8').trim().split('\n').filter(Boolean);
  const historyPapers = historyLines.map(line => JSON.parse(line));
  
  let allPapers = [];
  if (fs.existsSync(ALL_PAPERS_FILE)) {
    allPapers = JSON.parse(fs.readFileSync(ALL_PAPERS_FILE, 'utf8'));
  }
  const existingIds = new Set(allPapers.map(p => p.id));
  
  const toSync = syncAll 
    ? historyPapers 
    : historyPapers.filter(p => !existingIds.has(p.id));
  
  if (toSync.length === 0) {
    console.log('  ✓ All papers already synced');
    // Still regenerate index
    regeneratePapersIndex(allPapers);
    return 0;
  }
  
  console.log(`  Fetching ${toSync.length} new papers from OpenAlex...`);
  const newPapers = [];
  for (const paper of toSync) {
    try {
      const fullPaper = await fetchPaper(paper.id);
      fullPaper._source = 'daily_debrief';
      fullPaper._added_date = paper.date || new Date().toISOString().split('T')[0];
      newPapers.push(fullPaper);
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.log(`  ✗ ${paper.id}: ${err.message}`);
    }
  }
  
  allPapers = [...newPapers, ...allPapers];
  fs.writeFileSync(ALL_PAPERS_FILE, JSON.stringify(allPapers, null, 2));
  regeneratePapersIndex(allPapers);
  console.log(`  ✓ ${newPapers.length} papers synced (${allPapers.length} total)`);
  return newPapers.length;
}

function regeneratePapersIndex(allPapers) {
  const debrief = allPapers.filter(p => p._source === 'daily_debrief');
  const user = allPapers.filter(p => p._source === 'user_added');
  
  const lines = [
    '# Papers Index - Searchable Archive', '',
    `**Total:** ${allPapers.length} papers`,
    `**From daily debrief:** ${debrief.length} 📬`,
    `**User-added papers:** ${user.length} ⭐`, '',
    'Auto-generated from all_papers.json', '', '---', ''
  ];
  
  for (const paper of allPapers.slice(0, 100)) {
    const title = paper.title || paper.display_name || 'Untitled';
    const year = paper.publication_year || '';
    const doi = paper.doi || '';
    const abstract = reconstructAbstract(paper.abstract_inverted_index);
    let tag = '';
    if (paper._source === 'daily_debrief') tag = ' 📬';
    else if (paper._source === 'user_added') tag = ' ⭐';
    
    lines.push(`### ${title} (${year})${tag}`);
    lines.push(abstract ? (abstract.length > 200 ? abstract.slice(0, 200) + '...' : abstract) : 'Abstract not available.');
    if (doi) lines.push(`DOI: ${doi}`);
    lines.push('');
  }
  
  fs.writeFileSync(PAPERS_INDEX_FILE, lines.join('\n'));
}

// ─── Media Syncing ───

function syncMedia(syncAll) {
  console.log('\n📰 Syncing media items...');
  
  if (!fs.existsSync(MEDIA_HISTORY_SKILL)) {
    console.log('  No media_history.jsonl found');
    return 0;
  }
  
  const historyLines = fs.readFileSync(MEDIA_HISTORY_SKILL, 'utf8').trim().split('\n').filter(Boolean);
  const newItems = historyLines.map(line => JSON.parse(line));
  
  // Load existing media history
  let allMedia = [];
  if (fs.existsSync(MEDIA_HISTORY_MEM)) {
    allMedia = JSON.parse(fs.readFileSync(MEDIA_HISTORY_MEM, 'utf8'));
  }
  
  // Dedup by URL
  const existingUrls = new Set();
  for (const item of allMedia) {
    (item.source_urls || []).forEach(u => existingUrls.add(u));
  }
  
  const toAdd = syncAll ? newItems : newItems.filter(item => {
    const urls = item.source_urls || [];
    return !urls.some(u => existingUrls.has(u));
  });
  
  if (toAdd.length === 0) {
    console.log('  ✓ All media items already synced');
    regenerateMediaIndex(allMedia);
    return 0;
  }
  
  // Add new items at beginning
  allMedia = [...toAdd, ...allMedia];
  
  // Cap at 500 items (rolling window)
  if (allMedia.length > 500) {
    allMedia = allMedia.slice(0, 500);
  }
  
  fs.writeFileSync(MEDIA_HISTORY_MEM, JSON.stringify(allMedia, null, 2));
  regenerateMediaIndex(allMedia);
  console.log(`  ✓ ${toAdd.length} media items synced (${allMedia.length} total)`);
  return toAdd.length;
}

function regenerateMediaIndex(allMedia) {
  const byCategory = {};
  for (const item of allMedia) {
    const cat = item.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }
  
  const severityOrder = { high: 0, medium: 1, low: 2 };
  const categoryEmoji = {
    'Outbreak': '🦠', 'Recall': '🔴', 'Alert': '⚠️',
    'Policy': '📜', 'Research': '🔬', 'Other': '📋'
  };
  
  const lines = [
    '# Media Index - Industry News, Recalls & Outbreaks', '',
    `**Total items:** ${allMedia.length}`,
    `**Categories:** ${Object.entries(byCategory).map(([k,v]) => `${k} (${v.length})`).join(', ')}`,
    '',
    'Rolling archive of food safety news, regulatory alerts, recalls, and outbreak reports.',
    'Auto-generated by sync_to_memory.js', '', '---', ''
  ];
  
  // Sort categories: Outbreak, Recall, Alert, Policy, Research, Other
  const catOrder = ['Outbreak', 'Recall', 'Alert', 'Policy', 'Research', 'Other'];
  for (const cat of catOrder) {
    const items = byCategory[cat];
    if (!items || items.length === 0) continue;
    
    const emoji = categoryEmoji[cat] || '📋';
    lines.push(`## ${emoji} ${cat} (${items.length})`);
    lines.push('');
    
    // Sort by severity then date
    items.sort((a, b) => {
      const sa = severityOrder[a.severity] ?? 2;
      const sb = severityOrder[b.severity] ?? 2;
      if (sa !== sb) return sa - sb;
      return (b.date || '').localeCompare(a.date || '');
    });
    
    // Show up to 50 per category
    for (const item of items.slice(0, 50)) {
      const sev = item.severity === 'high' ? '🔴' : item.severity === 'medium' ? '🟡' : '🟢';
      const sources = (item.sources || []).join(', ');
      const pathogen = item.pathogen ? ` | 🦠 ${item.pathogen}` : '';
      const product = item.product ? ` | ${item.product}` : '';
      
      lines.push(`### ${sev} ${item.title} (${item.date || 'undated'})`);
      lines.push(`📰 ${sources}${pathogen}${product}`);
      if (item.summary) {
        lines.push(item.summary.length > 200 ? item.summary.slice(0, 200) + '...' : item.summary);
      }
      if (item.source_urls && item.source_urls[0]) {
        lines.push(`URL: ${item.source_urls[0]}`);
      }
      lines.push('');
    }
  }
  
  fs.writeFileSync(MEDIA_INDEX_FILE, lines.join('\n'));
}

// ─── Digest Log ───

function logDigest(paperCount, mediaCount) {
  const entry = {
    date: new Date().toISOString().split('T')[0],
    ts: Date.now(),
    papers_synced: paperCount,
    media_synced: mediaCount
  };
  fs.appendFileSync(DIGEST_LOG, JSON.stringify(entry) + '\n');
  console.log(`\n📋 Digest logged to digest_log.jsonl`);
}

// ─── Main ───

async function main() {
  const syncAll = process.argv.includes('--all');
  const today = new Date().toISOString().split('T')[0];
  
  console.log(`📚 Syncing debrief content to memory/research (${today})...`);
  
  // Ensure memory dir exists
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
  
  const paperCount = await syncPapers(syncAll);
  const mediaCount = syncMedia(syncAll);
  logDigest(paperCount, mediaCount);
  
  console.log(`\n✅ Sync complete: ${paperCount} papers, ${mediaCount} media items`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
