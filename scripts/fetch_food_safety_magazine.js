#!/usr/bin/env node
/**
 * Tool: Fetch articles from Food Safety Magazine RSS feeds (multiple topics)
 * Usage: node fetch_food_safety_magazine.js [--days N] [--since YYYY-MM-DD] [--topics 305,306,...]
 * Returns: JSON array of standardized media items to stdout
 * 
 * Topic IDs:
 *   305 = Recall/Crisis Management
 *   306 = Risk Assessment
 *   309 = Chemical
 *   311 = Allergen
 *   312 = Microbiological
 *   313 = Physical
 */

const https = require('https');
const { parseString } = require('xml2js');

const DEFAULT_TOPICS = {
  305: 'Recall',
  306: 'Research',
  309: 'Alert',
  311: 'Alert',
  312: 'Research',
  313: 'Alert'
};

const TOPIC_NAMES = {
  305: 'Recall/Crisis',
  306: 'Risk Assessment',
  309: 'Chemical',
  311: 'Allergen',
  312: 'Microbiological',
  313: 'Physical'
};

const PATHOGENS = [
  'salmonella', 'e. coli', 'e.coli', 'escherichia coli', 'listeria',
  'campylobacter', 'norovirus', 'clostridium', 'botulism', 'vibrio',
  'staphylococcus', 'shigella', 'hepatitis a', 'cyclospora', 'cronobacter',
  'bacillus cereus', 'yersinia'
];

function extractPathogen(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const p of PATHOGENS) {
    if (lower.includes(p)) {
      if (p === 'e. coli' || p === 'e.coli' || p === 'escherichia coli') return 'E. coli';
      return p.charAt(0).toUpperCase() + p.slice(1);
    }
  }
  return null;
}

function determineSeverity(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('death') || text.includes('died') || text.includes('fatal') || text.includes('class i')) return 'high';
  if (text.includes('hospitalized') || text.includes('outbreak') || text.includes('recall') || text.includes('contaminated')) return 'medium';
  return 'low';
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#xA0;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'ResearchAgent/1.0' },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout for ${url}`)); });
  });
}

function parseRSSFeed(xml) {
  return new Promise((resolve, reject) => {
    parseString(xml, { explicitArray: false, trim: true }, (err, result) => {
      if (err) return reject(err);
      const items = result?.rss?.channel?.item;
      if (!items) return resolve([]);
      resolve(Array.isArray(items) ? items : [items]);
    });
  });
}

async function fetchFoodSafetyMagazine(options = {}) {
  const { days = 7, since = null, topics = Object.keys(DEFAULT_TOPICS) } = options;

  const cutoffDate = since
    ? new Date(since + 'T00:00:00Z')
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const allArticles = [];
  const seenUrls = new Set();

  // Fetch all topic feeds in parallel
  const feedPromises = topics.map(async (topicId) => {
    const url = `https://www.food-safety.com/rss/topic/${topicId}`;
    const categoryDefault = DEFAULT_TOPICS[topicId] || 'Research';
    const topicName = TOPIC_NAMES[topicId] || `Topic ${topicId}`;

    try {
      const xml = await fetchRSS(url);
      const items = await parseRSSFeed(xml);

      for (const item of items) {
        const pubDate = new Date(item.pubDate);
        if (isNaN(pubDate.getTime()) || pubDate < cutoffDate) continue;

        const link = item.link || item.guid;
        if (!link || seenUrls.has(link)) continue;
        seenUrls.add(link);

        const title = stripHtml(item.title || '');
        const description = stripHtml(item.description || '');

        allArticles.push({
          source_type: 'media',
          sources: ['Food Safety Magazine'],
          source_urls: [link],
          title,
          summary: description,
          date: pubDate.toISOString().split('T')[0],
          category: categoryDefault,
          severity: determineSeverity(title, description),
          pathogen: extractPathogen(`${title} ${description}`),
          product: null,
          states: null,
          tags: [topicName],
          _dedup_key: title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
        });
      }
    } catch (err) {
      console.error(`[Food Safety Magazine] Topic ${topicId} (${topicName}): ${err.message}`);
    }
  });

  await Promise.all(feedPromises);

  // Sort by date descending
  allArticles.sort((a, b) => b.date.localeCompare(a.date));

  return allArticles;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) options.days = parseInt(args[++i]);
    if (args[i] === '--since' && args[i + 1]) options.since = args[++i];
    if (args[i] === '--topics' && args[i + 1]) options.topics = args[++i].split(',');
  }

  fetchFoodSafetyMagazine(options)
    .then(items => console.log(JSON.stringify(items, null, 2)))
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { fetchFoodSafetyMagazine };
