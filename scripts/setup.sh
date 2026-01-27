#!/bin/bash
# Setup script for research-agent
# Creates config, directories, and optionally sets up cron job

set -e

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SKILL_DIR"

echo "🔬 Research Agent Setup"
echo "======================="
echo

# 1. Create config if needed
if [ ! -f "config.json" ]; then
    echo "📝 Creating config.json from template..."
    cp config.example.json config.json
    echo "✓ Created config.json"
    echo
    echo "⚠️  IMPORTANT: Edit config.json to set:"
    echo "   - Your research domain keywords"
    echo "   - LLM API key (get free Gemini key at https://aistudio.google.com)"
    echo "   - Telegram chatId (message @userinfobot)"
    echo
else
    echo "✓ config.json already exists"
fi

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

# 4. Create empty watchlist if needed
if [ ! -f "authors_watchlist.json" ]; then
    echo '{"authors":[]}' > authors_watchlist.json
    echo "✓ Created authors_watchlist.json"
fi

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
        --text "Run the research-agent skill to find yesterday's research papers, analyze them, and send me a digest" \
        --schedule "$CRON_SCHEDULE" \
        --context-messages 0
    
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
echo "1. Edit config.json with your research domain and API keys"
echo "2. (Optional) Add authors to authors_watchlist.json"
echo "3. Test manually: Ask Clawdbot to 'run the research-agent skill'"
echo "4. The agent will then run automatically daily!"
echo
