#!/usr/bin/env node
/**
 * Tool: Fetch trending GitHub repositories
 * Usage: node fetch_github_trending.js <date> <keywords> [limit]
 * Returns: JSON array of repositories
 */

const https = require('https');

async function fetchGitHubTrending(date, keywords, limit = 20) {
    // GitHub API requires user-agent
    const options = {
        hostname: 'api.github.com',
        headers: {
            'User-Agent': 'research-agent-bot',
            'Accept': 'application/vnd.github.v3+json'
        }
    };
    
    // Build search query: trending repos across all tech/ML/AI, not confined to domain
    // Fetch repos with significant activity on target date, sorted by stars
    const query = `stars:>=50 pushed:${date}`;
    const searchUrl = `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`;
    
    return new Promise((resolve, reject) => {
        https.get({ ...options, path: searchUrl }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    const repos = response.items.map(r => ({
                        source: 'GitHub',
                        id: r.id.toString(),
                        name: r.full_name,
                        description: r.description || '',
                        url: r.html_url,
                        stars: r.stargazers_count,
                        language: r.language,
                        topics: r.topics || [],
                        createdAt: r.created_at,
                        updatedAt: r.updated_at,
                        owner: {
                            name: r.owner.login,
                            url: r.owner.html_url
                        }
                    }));
                    resolve(repos);
                } else if (res.statusCode === 403) {
                    reject(new Error('GitHub API rate limit exceeded. Try again later or add GITHUB_TOKEN to config.'));
                } else {
                    reject(new Error(`GitHub API error: ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

// CLI usage
if (require.main === module) {
    const date = process.argv[2];
    const keywords = process.argv[3]?.split(',') || [];
    const limit = parseInt(process.argv[4]) || 20;
    
    if (!date || keywords.length === 0) {
        console.error('Usage: node fetch_github_trending.js <date> <keyword1,keyword2,...> [limit]');
        console.error('Example: node fetch_github_trending.js 2026-01-27 "machine learning,deep learning,AI" 20');
        process.exit(1);
    }
    
    fetchGitHubTrending(date, keywords, limit)
        .then(repos => console.log(JSON.stringify(repos, null, 2)))
        .catch(err => {
            console.error(err.message);
            process.exit(1);
        });
}

module.exports = { fetchGitHubTrending };
