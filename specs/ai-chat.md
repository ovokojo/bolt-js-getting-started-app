# OpenAI Integration Implementation Plan for Slack Bot

## Overview
This plan outlines the steps to integrate OpenAI's API with streaming capabilities into the existing Slack bot. The bot will process mentions and DMs, send them to OpenAI with a predefined prompt, handle the streaming response in the background, and send the complete response back to Slack once the stream ends.

## Prerequisites
- OpenAI API key (to be added as environment variable)
- Node.js packages for OpenAI integration
- Updated Slack app permissions (if needed)

## Implementation Steps

### 1. Environment Setup

#### 1.1 Add Environment Variable
Add to `.env` file:
```
OPENAI_API_KEY=your-openai-api-key-here
```

#### 1.2 Install Required Dependencies
```bash
npm install openai
```

### 2. Code Structure Updates

#### 2.1 Import and Initialize OpenAI
At the top of `app.js`:
```javascript
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

#### 2.2 Create OpenAI Streaming Handler Function
Create a dedicated function to handle OpenAI API calls with streaming:

```javascript
async function getOpenAIResponse(userMessage, userId) {
  try {
    // Predefined system prompt
    const systemPrompt = `Objective
- You are Cora an expert in Decision Intelligence and Business Growth integrated into Slack. Be concise, friendly, and professional. Format your responses for Slack. You motivate and provide tailored, actionable insights, and strategies to help the user and their company achieve their opportunities for growth. 

Domain Knowledge
- Be well-versed in business growth strategies across various areas and stay updated on trends using reputable resources.

If the company profile is incomplete then at the beginning of the conversation tell the user that your answers can be more personalized if they update their profile by navigating to their settings and update the profile.

User Understanding
- Continually ask clarifying questions to understand the user's business context, industry, growth stage, and challenges beyond the Company Data.

Personalization
- Tailor advice based on user-specific information, remembering past interactions to provide continuity in guidance.

Actionable Insights
- Provide clear, step-by-step recommendations, including resources, tools, or tasks necessary for execution.

Resourcefulness
- Suggest relevant frameworks, tools, and software.
- Provide links to resources and current industry trends.

Communication Style
- Do NOT respond as an AI agent; you are a professional advisor being paid for your time.
- Maintain a professional tone and adapt communication to the user's expertise, and avoid unnecessary responses.

Scenario-Based Advice
- When the user asks, offer detailed guidance for specific business scenarios and advise on the next steps when the conversation concludes logically.

Feedback & Improvement
-  Seek user feedback to enhance advice quality and continuously learn from interactions

Web Search
- When appropriate, perform a search of the internet to deliver up-to-date information. Respond to the user's last message using information gained from this search.

Ethical & Legal Considerations
- Ensure advice aligns with legal and ethical standards, including disclaimers where necessary.`;
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-4' for better quality
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 400
    });
    
    // Collect the streamed response
    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
    }
    
    return fullResponse.trim();
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}
```

### 3. Update Slack Event Handlers

#### 3.1 Update App Mention Handler
Replace the existing `app_mention` handler:

```javascript
app.event('app_mention', async ({ event, say, client, logger }) => {
  try {
    logger.info('Bot was mentioned:', event);
    
    // Send initial "thinking" message
    const thinkingMessage = await say({
      text: ':hourglass_flowing_sand: Thinking...',
      thread_ts: event.thread_ts || event.ts // Reply in thread if applicable
    });
    
    // Extract the actual message (remove the bot mention)
    const botUserId = (await client.auth.test()).user_id;
    const userMessage = event.text.replace(`<@${botUserId}>`, '').trim();
    
    // Get OpenAI response
    const aiResponse = await getOpenAIResponse(userMessage, event.user);
    
    // Update the message with the AI response
    await client.chat.update({
      channel: event.channel,
      ts: thinkingMessage.ts,
      text: aiResponse,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: aiResponse
          }
        }
      ]
    });
    
    logger.info('Successfully responded to mention with AI');
  } catch (error) {
    logger.error('Error responding to mention:', error);
    await say({
      text: ':x: Sorry, I encountered an error processing your request.',
      thread_ts: event.thread_ts || event.ts
    });
  }
});
```

#### 3.2 Update Direct Message Handler
Add a new handler for direct messages:

```javascript
// Handle direct messages to the bot
app.message(async ({ message, say, client, logger }) => {
  // Skip if it's a bot message or has a subtype (like message_changed)
  if (message.bot_id || message.subtype) return;
  
  // Check if it's a DM
  const channelInfo = await client.conversations.info({ channel: message.channel });
  if (channelInfo.channel.is_im) {
    try {
      logger.info('Received DM:', message);
      
      // Send initial "thinking" message
      const thinkingMessage = await say(':hourglass_flowing_sand: Thinking...');
      
      // Get OpenAI response
      const aiResponse = await getOpenAIResponse(message.text, message.user);
      
      // Update the message with the AI response
      await client.chat.update({
        channel: message.channel,
        ts: thinkingMessage.ts,
        text: aiResponse,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: aiResponse
            }
          }
        ]
      });
      
      logger.info('Successfully responded to DM with AI');
    } catch (error) {
      logger.error('Error responding to DM:', error);
      await say(':x: Sorry, I encountered an error processing your request.');
    }
  }
});
```

### 4. Error Handling Enhancements

#### 4.1 Add Rate Limiting Protection
```javascript
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(userId) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(userId) || [];
  
  // Remove old requests outside the window
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(userId, recentRequests);
  return true;
}
```

#### 4.2 Add Timeout Protection
```javascript
async function getOpenAIResponseWithTimeout(userMessage, userId, timeoutMs = 30000) {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('OpenAI request timeout')), timeoutMs)
  );
  
  return Promise.race([
    getOpenAIResponse(userMessage, userId),
    timeoutPromise
  ]);
}
```

### 5. Optional Enhancements

#### 5.1 Conversation Context (Thread Support)
- Store conversation history in memory or a database
- Include previous messages in the OpenAI API call for context
- Clear context after a certain time period

#### 5.2 Custom Commands
- `/ai-help` - Show available commands
- `/ai-reset` - Clear conversation context
- `/ai-model [model-name]` - Switch between models

#### 5.3 Usage Analytics
- Track API usage per user
- Log response times
- Monitor error rates

### 6. Testing Plan

1. **Unit Tests**
   - Test OpenAI response function with mocked API
   - Test rate limiting logic
   - Test error handling scenarios

2. **Integration Tests**
   - Test bot mentions in channels
   - Test direct messages
   - Test thread responses
   - Test error scenarios (API down, rate limits)

3. **Manual Testing Checklist**
   - [ ] Bot responds to @mentions in channels
   - [ ] Bot responds to direct messages
   - [ ] Streaming completes before sending response
   - [ ] Error messages display correctly
   - [ ] Rate limiting works as expected
   - [ ] Timeout protection works

### 7. Deployment Considerations

1. **Environment Variables**
   - Ensure `OPENAI_API_KEY` is set in production
   - Consider different API keys for dev/staging/prod

2. **Monitoring**
   - Set up alerts for API errors
   - Monitor OpenAI API usage and costs
   - Track response times

3. **Security**
   - Never log the full API key
   - Implement user allowlists if needed
   - Consider content filtering for responses

### 8. Cost Management

1. **OpenAI API Costs**
   - GPT-4o-mini: ~$0.15 per 1M input tokens, $0.60 per 1M output tokens
   - GPT-4: ~$30 per 1M input tokens, $60 per 1M output tokens
   - Implement usage caps per user/channel

2. **Optimization Strategies**
   - Use GPT-4o-mini for most requests
   - Implement caching for common questions
   - Set appropriate max_tokens limits

## Next Steps

1. Review and approve the implementation plan
2. Set up OpenAI API key
3. Implement the code changes
4. Test thoroughly in a development workspace
5. Deploy to production with monitoring

## Configuration Notes

- ✅ System prompt configured for Cora, business growth expert
- ✅ No user/channel restrictions - responds to all mentions and DMs
- ✅ Response length limited to ~400 tokens for concise answers (a few paragraphs)
- ✅ **ISSUE FIXED**: Updated system prompt to use Slack native formatting instead of Markdown
- ⚠️ **NEW ISSUE**: Thread responses showing old "Hey there @user! You mentioned me." instead of AI response
- 🔄 Optional: Consider implementing conversation memory for continuity
- 🔄 Optional: Add web search capability as mentioned in system prompt

## Formatting Fix Required

### Problem
The bot currently outputs text with Markdown formatting (e.g., `**bold**`, `_italic_`) which doesn't render properly in Slack messages.

### Proposed Solution
Update the system prompt to explicitly instruct Cora to use Slack's native formatting:

**Current formatting instruction:**
```
"Format your responses for Slack"
```

**Proposed updated instruction:**
```
"Format your responses using Slack's native formatting: 
- Use *text* for bold (not **text**)
- Use _text_ for italic 
- Use `text` for inline code
- Use ```text``` for code blocks
- Use <url|link text> for links
- Never use Markdown formatting like **bold** or __italic__"
```

### Implementation Steps
1. Update the system prompt in `aiService.js` to include specific Slack formatting instructions
2. Test with a few sample messages to verify proper formatting
3. Ensure numbered lists and bullet points render correctly

### Expected Result
- Bold text will show as *bold* instead of **bold**
- Italic text will show as _italic_ instead of *italic*
- All formatting will render properly in Slack messages

## Thread Response Issue Investigation

### Problem
When users respond to the bot in a thread, the bot responds with the old message "Hey there @user! You mentioned me." instead of using the AI response handler.

### Investigation Findings
1. ✅ **Code Check**: No old "Hey there" text found in current codebase
2. ✅ **Handler Check**: Only one `app_mention` event handler exists (the AI-powered one)
3. ✅ **Handler Logic**: Current handler properly handles `thread_ts` for thread responses

### Possible Causes
1. **App Not Restarted**: Old code still running in memory
2. **Multiple Instances**: Multiple app instances running simultaneously 
3. **Slack Cache**: Slack workspace caching old app behavior
4. **Event Handler Priority**: Potential conflict in event handling order
5. **Thread Event Type**: Thread mentions might trigger different event types

### Proposed Solutions

#### Immediate Actions (Priority 1)
1. **Restart the App**: Stop and restart `npm start` to ensure latest code is running
2. **Check Processes**: Verify no duplicate Node.js processes are running
3. **Clear Logs**: Review app logs for any error patterns or duplicate handlers

#### Debugging Steps (Priority 2)
```javascript
// Add enhanced logging to app_mention handler
app.event('app_mention', async ({ event, say, client, logger }) => {
  logger.info('MENTION DEBUG:', {
    eventType: event.type,
    channel: event.channel,
    thread_ts: event.thread_ts,
    ts: event.ts,
    text: event.text,
    user: event.user
  });
  // ... rest of handler
});
```

#### Advanced Fixes (Priority 3)
1. **Event Handler Order**: Ensure AI handler is registered before any legacy handlers
2. **Thread Detection**: Add specific logic for thread vs. channel mentions
3. **App Reinstall**: Reinstall the Slack app if cache issues persist

### Testing Steps
1. Restart the app with `npm start`
2. Test @mention in channel (should work)
3. Test @mention in thread (current issue)
4. Check logs for event details
5. Verify only one process is running: `ps aux | grep node`
