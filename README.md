# Cora.Work - AI Business Growth Assistant ⚡️

> AI-powered Slack bot for Decision Intelligence and Business Growth

## Overview

Cora is an intelligent Slack bot built with the [Bolt for JavaScript framework][2] and powered by OpenAI. Cora acts as your expert business growth advisor, providing tailored insights, actionable strategies, and professional guidance to help you and your company achieve growth opportunities.

### Key Features

- 🧠 **AI-Powered Conversations**: Responds to @mentions and direct messages with intelligent business advice
- 🎯 **Decision Intelligence**: Expert guidance on business growth strategies across various industries  
- 📊 **Actionable Insights**: Provides clear, step-by-step recommendations with resources and tools
- 🧵 **Thread Context Memory**: Maintains conversation history within threads for contextual responses
- 📝 **Decision Records Integration**: Seamlessly integrates with decision records infrastructure to post updates and answer questions about organizational decisions
- 💬 **Native Slack Integration**: Proper Slack formatting, thread support, and seamless user experience
- 🛡️ **Rate Limiting**: Built-in protection with 10 requests per minute per user
- ⚡ **Streaming Responses**: Real-time AI response generation with "thinking" indicators

## Decision Records Integration

Cora Slack app can integrate with decision records infrastructure for:

### 📋 Decision Record Management
- **Post Updates**: Automatically posts decision record updates to relevant Slack channels
- **Answer Questions**: Provides intelligent responses about existing decision records
- **Search & Reference**: Quickly find and reference past decisions in conversations
- **Status Tracking**: Monitor decision implementation progress and outcomes

### 🔄 Workflow Integration
- **Decision Notifications**: Notify teams when new decisions are made or updated
- **Approval Workflows**: Facilitate decision approval processes through Slack
- **Stakeholder Updates**: Keep relevant parties informed about decision changes
- **Historical Context**: Provide context from previous decisions when making new ones

This integration ensures that organizational knowledge and decision-making processes are seamlessly accessible through natural conversation with Cora, making decision intelligence truly conversational and actionable.

## Running locally

### 0. Create a new Slack App

- Go to https://api.slack.com/apps
- Click **Create App**
- Choose a workspace
- Enter App Manifest using contents of `manifest.json`
- Click **Create**

Once the app is created click **Install to Workspace**
Then scroll down in Basic Info and click **Generate Token and Scopes** with both scopes

### 1. Setup environment variables

Create a `.env` file in the project root and add your tokens:

```env
# Slack Bot Tokens
SLACK_BOT_TOKEN=xoxb-your-actual-bot-token
SLACK_APP_TOKEN=xapp-your-actual-app-token

# OpenAI API Key (required for AI features)
OPENAI_API_KEY=your-openai-api-key-here
```

**Getting your tokens:**
- **Slack tokens**: Follow the app creation steps above
- **OpenAI API key**: Get from [platform.openai.com](https://platform.openai.com/api-keys)

### 2. Setup your local project

```zsh
# Clone this project onto your machine
git clone <your-repo-url>

# Change into the project
cd slack-agent/cora/

# Install the dependencies
npm install
```

### 3. Available Scripts

The project includes several convenient scripts for development and process management:

#### Development Scripts
```zsh
# Start the application
npm run start

# Kill all running instances (prevents multiple instance issues)
npm run pkill

# Restart cleanly (kills old instances and starts fresh)
npm run restart

# Quick development restart (alias for restart)
npm run dev
```

#### Recommended Development Workflow
```zsh
# For development, use restart to avoid multiple instance issues
npm run restart

# Or use the short alias
npm run dev
```

**Note**: The `restart` and `dev` scripts automatically kill any existing instances before starting a new one, preventing the common issue of multiple app instances running simultaneously.

### 4. Test Cora's AI Features

#### Direct Messages
Send a DM to Cora with any business question:
```
"How can I improve customer retention for my SaaS business?"
"What are the best marketing strategies for B2B companies?"
"Help me create a growth strategy for my startup"
```

#### Channel Mentions  
Mention Cora in any channel:
```
@Cora what are some effective lead generation tactics?
@Cora help me optimize my sales funnel
```

#### Interactive Features
- Click buttons for interactive responses

## How Cora Works

1. **Mention or DM**: @mention Cora in a channel or send a direct message
2. **Processing**: Cora shows a "thinking" indicator while generating a response
3. **AI Response**: Receive tailored business advice using OpenAI's GPT models
4. **Thread Support**: Responses maintain context in threaded conversations

## Cost Considerations

- Uses OpenAI GPT-4o-mini model (~$0.15 per 1M input tokens)
- Responses limited to ~400 tokens for cost efficiency
- Rate limiting prevents excessive usage (10 requests/minute per user)

## Architecture

- **`app.js`**: Main Slack bot application with event handlers
- **`aiService.js`**: OpenAI integration module with streaming and rate limiting
- **`threadContext.js`**: Thread context management for conversation memory
- **`manifest.json`**: Slack app configuration

## Configuration

### System Prompt
Cora is configured as a Decision Intelligence and Business Growth expert with:
- Professional, non-AI persona
- Concise, actionable advice
- Slack-native formatting
- Industry-specific insights
- Decision records integration capabilities
- Ethical and legal considerations

### Thread Context
- **Cache Duration**: 1 hour for thread conversation memory
- **Message Limit**: Up to 100 messages per thread for context
- **Auto-cleanup**: Expired threads cleaned up every 15 minutes

### Customization
- Modify the system prompt in `aiService.js` to adjust Cora's expertise
- Update rate limits and token limits as needed
- Configure thread context limits in `threadContext.js`
- Integrate with decision records APIs for organizational data

## Troubleshooting

- **No AI responses**: Verify `OPENAI_API_KEY` is set correctly
- **Rate limit errors**: Users are limited to 10 requests per minute
- **Formatting issues**: Cora uses Slack formatting (*bold*, _italic_), not Markdown
- **Thread context issues**: Check Slack app scopes include `groups:history`, `im:read`, `mpim:history`
- **Decision records integration**: Verify API connections and permissions for decision records system
- **Multiple instances running**: If you see old responses or unexpected behavior, check for multiple running processes:
  ```zsh
  # Check for running instances
  ps aux | grep "node app.js"
  
  # Kill all instances and restart cleanly
  npm run restart
  ```

## Resources

[1]: https://tools.slack.dev/bolt-js/getting-started
[2]: https://tools.slack.dev/bolt-js/
[3]: https://platform.openai.com/docs/
[4]: https://api.slack.com/apps
