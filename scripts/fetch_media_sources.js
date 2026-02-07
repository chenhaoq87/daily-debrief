#!/usr/bin/env node
/**
 * Tool: Fetch and merge all media sources for the daily research debrief
 * Usage: node fetch_media_sources.js [--days N] [--since YYYY-MM-DD] [--sources all|fsn,fsm,fda,fsis,cdc]
 * Returns: Unified JSON array of deduplicated, merged media items to stdout
 *
 * Sources:
 *   fsn  = Food Safety News (RSS)
 *   fsm  = Food Safety Magazine (RSS, multi-topic)
 *   fda  = FDA Food Recalls (openFDA API)
 *   fsis = USDA FSIS Recalls (scrape + openFDA fallback)
 *   cdc  = CDC Outbreak Investigations (multi-strategy)
 */

const { fetchFoodSafetyNews } = require('./fetch_food_safety_news');
const { fetchFoodSafetyMagazine } = require('./fetch_food_safety_magazine');
const { fetchFDARecalls } = require('./fetch_fda_recalls');
const { fetchFSISRecalls } = require('./fetch_fsis_recalls');
const { fetchCDCOutbreaks } = require('./fetch_cdc_outbreaks');

// ─── Similarity & Dedup Helpers ──────────────────────────────

/**
 * Simple word-overlap similarity (Jaccard-like)
 * Returns 0-1 score
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / Math.min(wordsA.size, wordsB.size);
}

/**
 * Check if two items likely refer to the same event/recall
 */
function areDuplicates(a, b) {
  // Same recall number
  if (a.recall_number && b.recall_number && a.recall_number === b.recall_number) return true;

  // Same URL
  const urlsA = new Set(a.source_urls || []);
  for (const url of (b.source_urls || [])) {
    if (urlsA.has(url)) return true;
  }

  // Same dedup key
  if (a._dedup_key && b._dedup_key && a._dedup_key === b._dedup_key) return true;

  // Pathogen + product match
  if (a.pathogen && b.pathogen && a.pathogen === b.pathogen) {
    if (a.product && b.product && textSimilarity(a.product, b.product) > 0.5) return true;
  }

  // High title similarity
  if (textSimilarity(a.title, b.title) > 0.6) return true;

  // Firm + product match (for recalls)
  if (a.recalling_firm && b.recalling_firm) {
    if (a.recalling_firm.toLowerCase() === b.recalling_firm.toLowerCase()) return true;
  }

  return false;
}

/**
 * Merge two duplicate items into one with combined source info
 */
function mergeItems(primary, secondary) {
  const merged = { ...primary };

  // Merge sources
  const allSources = new Set([...(primary.sources || []), ...(secondary.sources || [])]);
  merged.sources = [...allSources];

  // Merge source URLs
  const allUrls = new Set([...(primary.source_urls || []), ...(secondary.source_urls || [])]);
  merged.source_urls = [...allUrls];

  // Pick the richer fields
  if (!merged.pathogen && secondary.pathogen) merged.pathogen = secondary.pathogen;
  if (!merged.product && secondary.product) merged.product = secondary.product;
  if (!merged.states && secondary.states) merged.states = secondary.states;
  if (!merged.recall_number && secondary.recall_number) merged.recall_number = secondary.recall_number;
  if (!merged.classification && secondary.classification) merged.classification = secondary.classification;
  if (!merged.case_count && secondary.case_count) merged.case_count = secondary.case_count;
  if (!merged.recalling_firm && secondary.recalling_firm) merged.recalling_firm = secondary.recalling_firm;

  // Use the longer/richer summary
  if (secondary.summary && secondary.summary.length > (merged.summary || '').length) {
    merged.summary = secondary.summary;
  }

  // Use the higher severity
  const severityOrder = { high: 3, medium: 2, low: 1 };
  if ((severityOrder[secondary.severity] || 0) > (severityOrder[merged.severity] || 0)) {
    merged.severity = secondary.severity;
  }

  // Merge tags
  if (secondary.tags) {
    const allTags = new Set([...(merged.tags || []), ...secondary.tags]);
    merged.tags = [...allTags];
  }

  return merged;
}

/**
 * Deduplicate and merge a list of items
 */
function deduplicateAndMerge(items) {
  const clusters = []; // Each cluster is a merged item

  for (const item of items) {
    let foundCluster = false;

    for (let i = 0; i < clusters.length; i++) {
      if (areDuplicates(clusters[i], item)) {
        clusters[i] = mergeItems(clusters[i], item);
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      clusters.push({ ...item });
    }
  }

  return clusters;
}

// ─── Main Fetch ──────────────────────────────────────────────

async function fetchAllMediaSources(options = {}) {
  const {
    days = 1,
    since = null,
    enabledSources = ['fsn', 'fsm', 'fda', 'fsis', 'cdc']
  } = options;

  const fetchOptions = { days, since };
  const fetchers = {};

  if (enabledSources.includes('fsn')) fetchers.fsn = fetchFoodSafetyNews(fetchOptions);
  if (enabledSources.includes('fsm')) fetchers.fsm = fetchFoodSafetyMagazine(fetchOptions);
  if (enabledSources.includes('fda')) fetchers.fda = fetchFDARecalls(fetchOptions);
  if (enabledSources.includes('fsis')) fetchers.fsis = fetchFSISRecalls(fetchOptions);
  if (enabledSources.includes('cdc')) fetchers.cdc = fetchCDCOutbreaks(fetchOptions);

  // Fetch all sources in parallel
  const results = {};
  const entries = Object.entries(fetchers);
  const settled = await Promise.allSettled(entries.map(([, p]) => p));

  for (let i = 0; i < entries.length; i++) {
    const [key] = entries[i];
    const result = settled[i];
    if (result.status === 'fulfilled') {
      results[key] = result.value;
      console.error(`[MediaSources] ${key}: ${result.value.length} items`);
    } else {
      results[key] = [];
      console.error(`[MediaSources] ${key}: FAILED - ${result.reason?.message || 'Unknown error'}`);
    }
  }

  // Combine all items
  const allItems = Object.values(results).flat();
  console.error(`[MediaSources] Total raw items: ${allItems.length}`);

  // Deduplicate and merge
  const merged = deduplicateAndMerge(allItems);
  console.error(`[MediaSources] After dedup: ${merged.length} unique items`);

  // Sort by date descending, then severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  merged.sort((a, b) => {
    const dateComp = (b.date || '').localeCompare(a.date || '');
    if (dateComp !== 0) return dateComp;
    return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
  });

  // Clean up internal fields from output
  return merged.map(item => {
    const clean = { ...item };
    delete clean._dedup_key;
    // Ensure source_type
    clean.source_type = 'media';
    return clean;
  });
}

// ─── CLI ──────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) options.days = parseInt(args[++i]);
    if (args[i] === '--since' && args[i + 1]) options.since = args[++i];
    if (args[i] === '--sources' && args[i + 1]) {
      const val = args[++i];
      if (val !== 'all') options.enabledSources = val.split(',');
    }
  }

  fetchAllMediaSources(options)
    .then(items => console.log(JSON.stringify(items, null, 2)))
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { fetchAllMediaSources };
