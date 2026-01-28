#!/usr/bin/env node
/**
 * Tool: Scrape GitHub trending page
 * Usage: node fetch_github_trending_scrape.js [limit] [language]
 * Returns: JSON array of repositories
 */

const https = require('https');

async function fetchGitHubTrending(limit = 25, language = '') {
    const path = language ? `/trending/${language}` : '/trending';
    const options = {
        hostname: 'github.com',
        path: path,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; research-agent-bot)',
            'Accept': 'text/html'
        }
    };
    
    return new Promise((resolve, reject) => {
        https.get(options, (res) => {
            let html = '';
            res.on('data', (chunk) => html += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const repos = parseGitHubTrendingHTML(html, limit);
                        resolve(repos);
                    } catch (err) {
                        reject(new Error(`Failed to parse GitHub trending: ${err.message}`));
                    }
                } else {
                    reject(new Error(`GitHub returned status ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

function parseGitHubTrendingHTML(html, limit) {
    const repos = [];
    
    // GitHub trending uses specific HTML structure
    // Each repo is in an article with class "Box-row"
    const articleRegex = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
    
    let match;
    while ((match = articleRegex.exec(html)) !== null && repos.length < limit) {
        const article = match[1];
        
        // Extract repo name
        const nameMatch = article.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        if (!nameMatch) continue;
        
        const fullName = nameMatch[1];
        
        // Extract description
        const descMatch = article.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
        const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        
        // Extract language
        const langMatch = article.match(/itemprop="programmingLanguage">([^<]+)</);
        const language = langMatch ? langMatch[1].trim() : null;
        
        // Extract stars today
        const starsMatch = article.match(/<svg[^>]*octicon-star[^>]*>[\s\S]*?<\/svg>\s*([\d,]+)/);
        const starsToday = starsMatch ? parseInt(starsMatch[1].replace(/,/g, '')) : 0;
        
        // Extract total stars from the star count span
        const totalStarsMatch = article.match(/aria-label="(\d[\d,]*)\s+stars?"/);
        const totalStars = totalStarsMatch ? parseInt(totalStarsMatch[1].replace(/,/g, '')) : starsToday;
        
        repos.push({
            source: 'GitHub-Trending',
            name: fullName,
            description: description,
            url: `https://github.com/${fullName}`,
            stars: totalStars,
            starsToday: starsToday,
            language: language
        });
    }
    
    return repos;
}

// CLI usage
if (require.main === module) {
    const limit = parseInt(process.argv[2]) || 25;
    const language = process.argv[3] || '';
    
    fetchGitHubTrending(limit, language)
        .then(repos => console.log(JSON.stringify(repos, null, 2)))
        .catch(err => {
            console.error(err.message);
            process.exit(1);
        });
}

module.exports = { fetchGitHubTrending };
