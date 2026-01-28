#!/bin/bash
# Setup script for research-agent
# Creates config, directories, and optionally sets up cron job

set -e

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SKILL_DIR"

echo "🔬 Research Agent Setup Wizard"
echo "============================="
echo

# 1. Custom Configuration
echo "First, let's customize the agent for your research."
echo

# Ask for Domain Name
read -p "What is your research domain name? (Default: 'Food Safety'): " DOMAIN_NAME
DOMAIN_NAME=${DOMAIN_NAME:-"Food Safety"}

# Configure Keywords
DEFAULT_KEYWORDS='["food safety", "pathogen", "salmonella", "e. coli", "listeria", "dairy", "meat"]'

echo
echo "Default keywords for $DOMAIN_NAME:"
echo "  food safety, pathogen, salmonella, e. coli, listeria, dairy, meat"
read -p "Do you want to use these defaults? (y/n): " USE_DEFAULTS

if [ "$USE_DEFAULTS" = "y" ] || [ "$USE_DEFAULTS" = "Y" ] || [ -z "$USE_DEFAULTS" ]; then
    KEYWORDS_ARRAY="$DEFAULT_KEYWORDS"
else
    echo
    read -p "Enter your keywords (comma separated): " KEYWORDS_INPUT
    # Transform comma-separated string into JSON array
    KEYWORDS_ARRAY=$(echo "$KEYWORDS_INPUT" | sed 's/,/","/g' | sed 's/^/["/' | sed 's/$/"]/')
fi

# Create config.json from template with variable substitution
echo
echo "📝 Generating config.json..."

cat > config.json <<EOF
{
  "domain": {
    "name": "$DOMAIN_NAME",
    "description": "Research papers related to $DOMAIN_NAME",
    "keywords": {
      "technical": [
        "machine learning",
        "deep learning",
        "neural network",
        "artificial intelligence"
      ],
      "domain": $KEYWORDS_ARRAY
    },
    "categories": [
      "Key Research",
      "Applications",
      "Methods",
      "Reviews",
      "Other"
    ]
  },
  "sources": {
    "openalex": {
      "enabled": true,
      "perPage": 50
    },
    "arxiv": {
      "enabled": true,
      "categories": ["cs.CV", "cs.LG", "cs.AI", "cs.CL"]
    }
  },
  "filters": {
    "minRelevanceScore": 3,
    "maxPapersPerDigest": 10
  },
  "authors": {
    "watchlistPath": "authors_watchlist.json"
  },
  "agent": {
    "comment": "This runs as a Clawdbot sub-agent. The agent (Claude) analyzes papers directly - no external LLM API needed!"
  },
  "output": {
    "telegram": {
      "enabled": true,
      "comment": "Uses Clawdbot's default messaging channel"
    },
    "saveToFile": true,
    "filePath": "digests/"
  },
  "schedule": {
    "cronExpression": "0 9 * * *",
    "comment": "Daily at 9 AM. Change as needed."
  }
}
EOF

echo "✓ Config generated for domain: $DOMAIN_NAME"
echo

# 2. Create directories
echo "📁 Creating data directories..."
mkdir -p data
mkdir -p digests
mkdir -p logs
echo "✓ Directories created"
echo

# 3. Create empty history file
if [ ! -f "data/papers_history.jsonl" ]; then
    touch data/papers_history.jsonl
    echo "✓ Created papers_history.jsonl"
fi

# 4. Author Watchlist Setup
echo "👤 Author Watchlist"
echo "-------------------"
echo "Do you want to track specific authors? The agent will flag their papers with 👤"
read -p "(y/n): " SETUP_AUTHORS

AUTHORS_JSON='{"authors":[]}'

if [ "$SETUP_AUTHORS" = "y" ] || [ "$SETUP_AUTHORS" = "Y" ]; then
    echo
    echo "Enter author names (one per line). Press Enter with empty line when done:"
    echo "(You can find OpenAlex IDs later at https://openalex.org/authors)"
    echo
    
    AUTHORS_ARRAY="[]"
    while true; do
        read -p "Author name (or Enter to finish): " AUTHOR_NAME
        if [ -z "$AUTHOR_NAME" ]; then
            break
        fi
        
        # Add author to array
        if [ "$AUTHORS_ARRAY" = "[]" ]; then
            AUTHORS_ARRAY='[{"name":"'"$AUTHOR_NAME"'","openalex_id":"","note":""}]'
        else
            # Append to existing array
            AUTHORS_ARRAY=$(echo "$AUTHORS_ARRAY" | sed 's/]$/,{"name":"'"$AUTHOR_NAME"'","openalex_id":"","note":""}]/')
        fi
        echo "  ✓ Added: $AUTHOR_NAME"
    done
    
    AUTHORS_JSON='{"authors":'"$AUTHORS_ARRAY"'}'
fi

echo "$AUTHORS_JSON" > authors_watchlist.json
echo "✓ Created authors_watchlist.json"
echo

# 5. Make scripts executable
chmod +x scripts/*.sh scripts/*.js 2>/dev/null || true
echo "✓ Made scripts executable"
echo

# 6. Ask about cron setup
echo "⏰ Cron Job Setup"
echo "-----------------"
echo "Would you like to set up the daily cron job now? (y/n)"
read -r SETUP_CRON

if [ "$SETUP_CRON" = "y" ] || [ "$SETUP_CRON" = "Y" ]; then
    # Get schedule preference
    echo
    echo "When should the agent run daily?"
    echo "1) 9:00 AM (default)"
    echo "2) 8:00 AM"
    echo "3) Custom time (will prompt)"
    read -r TIME_CHOICE
    
    case $TIME_CHOICE in
        2)
            CRON_SCHEDULE="0 8 * * *"
            ;;
        3)
            echo "Enter cron schedule (e.g., '0 9 * * *' for 9 AM):"
            read -r CRON_SCHEDULE
            ;;
        *)
            CRON_SCHEDULE="0 9 * * *"
            ;;
    esac
    
    echo
    echo "Setting up cron job with schedule: $CRON_SCHEDULE"
    
    # Use clawdbot cron to schedule
    clawdbot cron add \
        --name "research-agent-daily" \
        --message "Run the research-agent skill to find yesterday's research papers, analyze them, and send me a digest" \
        --cron "$CRON_SCHEDULE" \
        --session isolated
    
    echo "✓ Cron job created!"
    echo
    echo "The agent will run automatically at the scheduled time."
    echo "Check status with: clawdbot cron list"
else
    echo
    echo "Skipped cron setup. To set up later, run:"
    echo "  clawdbot cron add --text 'Run research-agent skill' --schedule '0 9 * * *'"
fi

echo
echo "✅ Setup complete!"
echo
echo "Next steps:"
echo "1. (Optional) Fine-tune config.json for your specific needs"
echo "2. (Optional) Add more authors to authors_watchlist.json"
echo "3. Test manually: Ask Clawdbot to 'run the research-agent skill'"
echo "4. The agent will then run automatically daily!"
echo
