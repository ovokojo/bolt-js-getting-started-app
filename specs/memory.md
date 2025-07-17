# Thread Context Memory Implementation Plan for Slack Bot

## Overview
This plan outlines how to implement thread context awareness for the Slack bot, enabling it to maintain conversation history within threads and provide this context to OpenAI for more coherent, contextual responses.

## Problem Statement
Currently, each message to the bot is treated as an isolated interaction, even within threads. This results in:
- Loss of conversation continuity
- Repetitive questions from the bot
- Inability to reference previous messages in the same thread
- Less natural conversation flow

## Solution Architecture

### 1. Thread Detection and Tracking

#### 1.1 Thread Identification
- Use Slack's `thread_ts` field to identify thread messages
- When `thread_ts` exists, the message is part of a thread
- When `thread_ts` equals `ts`, it's the parent message starting the thread
- Track thread ID as unique identifier: `${channel_id}-${thread_ts}`

#### 1.2 Thread Message Types
```javascript
// Thread detection logic
const isThreadMessage = (event) => {
  return event.thread_ts !== undefined;
};

const isThreadParent = (event) => {
  return event.thread_ts === event.ts;
};

const isThreadReply = (event) => {
  return event.thread_ts && event.thread_ts !== event.ts;
};
```

### 2. Thread History Retrieval

#### 2.1 Slack API Integration
Use Slack's `conversations.replies` API to fetch thread history:
```javascript
async function getThreadHistory(client, channel, thread_ts) {
  try {
    const result = await client.conversations.replies({
      channel: channel,
      ts: thread_ts,
      limit: 100 // Adjust based on needs
    });
    return result.messages;
  } catch (error) {
    console.error('Error fetching thread history:', error);
    return [];
  }
}
```

#### 2.2 Message Filtering
- Filter out bot's own messages to avoid duplication
- Include only relevant message types (text messages, not system messages)
- Preserve chronological order

### 3. Context Storage Strategy

#### 3.1 In-Memory Cache (Short-term)
```javascript
// Thread context cache with TTL
class ThreadContextCache {
  constructor(ttlMinutes = 60) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000;
  }
  
  set(threadId, context) {
    this.cache.set(threadId, {
      context,
      timestamp: Date.now()
    });
  }
  
  get(threadId) {
    const entry = this.cache.get(threadId);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(threadId);
      return null;
    }
    
    return entry.context;
  }
  
  // Cleanup expired entries periodically
  cleanup() {
    const now = Date.now();
    for (const [threadId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(threadId);
      }
    }
  }
}
```

#### 3.2 Persistent Storage (Optional - Phase 2)
For longer conversation retention:
- Redis for distributed cache
- PostgreSQL/MongoDB for permanent storage
- S3 for archived conversations

### 4. Context Formatting for OpenAI

#### 4.1 Message History Format
```javascript
function formatThreadContext(messages, botUserId) {
  const contextMessages = [];
  
  for (const message of messages) {
    // Skip bot messages to avoid confusion
    if (message.user === botUserId) {
      contextMessages.push({
        role: 'assistant',
        content: message.text
      });
    } else {
      // User messages
      contextMessages.push({
        role: 'user',
        content: message.text
      });
    }
  }
  
  return contextMessages;
}
```

#### 4.2 Context Window Management
- Limit context to recent N messages (e.g., last 20)
- Implement token counting to stay within OpenAI limits
- Summarize older messages if needed

### 5. Integration with Existing Code

#### 5.1 Modified Event Handler
```javascript
app.event('app_mention', async ({ event, say, client, logger }) => {
  try {
    logger.info('Bot was mentioned:', event);
    
    // Rate limit check...
    
    let conversationHistory = [];
    
    // Check if this is a thread message
    if (event.thread_ts) {
      const threadId = `${event.channel}-${event.thread_ts}`;
      
      // Try to get cached context
      let threadContext = threadContextCache.get(threadId);
      
      if (!threadContext) {
        // Fetch thread history from Slack
        const threadMessages = await getThreadHistory(client, event.channel, event.thread_ts);
        threadContext = formatThreadContext(threadMessages, botUserId);
        
        // Cache for future use
        threadContextCache.set(threadId, threadContext);
      }
      
      conversationHistory = threadContext;
    }
    
    // Send thinking message...
    
    // Get OpenAI response with context
    const aiResponse = await getOpenAIResponseWithContext(
      userMessage, 
      event.user, 
      conversationHistory
    );
    
    // Update cache with new interaction
    if (event.thread_ts) {
      const threadId = `${event.channel}-${event.thread_ts}`;
      conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: aiResponse }
      );
      threadContextCache.set(threadId, conversationHistory);
    }
    
    // Send response...
  } catch (error) {
    // Error handling...
  }
});
```

#### 5.2 Modified OpenAI Service
```javascript
async function getOpenAIResponseWithContext(userMessage, userId, conversationHistory = []) {
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory, // Insert conversation history
      { role: 'user', content: userMessage }
    ];
    
    // Trim messages if too long
    const trimmedMessages = trimMessagesToFitContext(messages, 4000); // Reserve tokens
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: trimmedMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 400
    });
    
    // Rest of implementation...
  } catch (error) {
    // Error handling...
  }
}
```

### 6. Performance Considerations

#### 6.1 Caching Strategy
- Cache thread contexts for 1 hour by default
- Implement LRU eviction for memory management
- Set maximum cache size (e.g., 1000 threads)

#### 6.2 API Rate Limits
- Batch thread history requests when possible
- Implement exponential backoff for Slack API
- Monitor API usage

#### 6.3 Cost Optimization
- Count tokens before sending to OpenAI
- Implement message summarization for long threads
- Consider different models for different thread lengths

### 7. Edge Cases and Limitations

#### 7.1 Thread Boundaries
- New threads start fresh (no cross-thread context)
- Very old threads may have expired context
- Handle deleted messages gracefully

#### 7.2 User Privacy
- Don't store sensitive information permanently
- Allow users to clear thread history
- Implement data retention policies

#### 7.3 Technical Limitations
- Slack API limits (100 messages per thread fetch)
- OpenAI token limits (context window)
- Memory constraints for large deployments

### 8. Implementation Phases

#### Phase 1: Basic Thread Context (MVP)
1. Implement thread detection
2. Add in-memory cache with 1-hour TTL
3. Fetch last 100 messages from thread
4. Pass context to OpenAI
5. Test with simple conversations

#### Phase 2: Enhanced Context Management
1. Implement token counting and trimming
2. Add message summarization for long threads
3. Improve cache management (LRU, size limits)
4. Add thread context indicators in responses

#### Phase 3: Advanced Features
1. Persistent storage option
2. Cross-channel thread references
3. User preferences for context retention
4. Analytics on thread conversations

### 9. Testing Strategy

#### 9.1 Unit Tests
- Thread detection logic
- Cache operations
- Context formatting
- Token counting

#### 9.2 Integration Tests
- Slack API thread fetching
- OpenAI API with context
- End-to-end thread conversations

#### 9.3 Manual Test Scenarios
- [ ] Single message in thread (should work like before)
- [ ] Multiple back-and-forth in same thread
- [ ] Very long thread (>20 messages)
- [ ] Thread after cache expiry
- [ ] Multiple concurrent threads
- [ ] Thread with mixed users

### 10. Monitoring and Metrics

#### 10.1 Performance Metrics
- Cache hit/miss ratio
- Average context size
- API response times
- Token usage per thread

#### 10.2 User Experience Metrics
- Thread conversation completion rate
- Average messages per thread
- User satisfaction indicators

### 11. Configuration Options

```javascript
const THREAD_CONFIG = {
  CACHE_TTL_MINUTES: 60,
  MAX_CONTEXT_MESSAGES: 100,
  MAX_CACHE_SIZE: 1000,
  TOKEN_LIMIT: 4000,
  ENABLE_PERSISTENT_STORAGE: false,
  SUMMARIZE_AFTER_N_MESSAGES: 15
};
```

### 12. Example User Experience

**Before Implementation:**
```
User: @Cora what's our target audience?
Cora: [Provides general answer about target audiences]
User: Can you be more specific for B2B?
Cora: [Provides B2B info without context of previous question]
```

**After Implementation:**
```
User: @Cora what's our target audience?
Cora: [Provides general answer about target audiences]
User: Can you be more specific for B2B?
Cora: Building on what I mentioned about target audiences, for B2B specifically... [contextual response]
```

## Questions for Consideration

1. **Cache Duration**: Is 1 hour appropriate for thread context retention?
2. **Message Limit**: Should we limit context to last 100 messages or use token-based limits?
3. **Storage**: Do we need persistent storage in Phase 1 or can we start with memory-only?
4. **Privacy**: Any specific data retention requirements?
5. **Costs**: Acceptable increase in OpenAI API costs due to larger contexts?

## Phase 1 Detailed Implementation Plan (MVP)

### Overview
Phase 1 focuses on implementing basic thread context with up to 100 messages of history, using in-memory caching for simplicity and quick deployment.

### 1. File Structure and Dependencies

#### 1.1 New File: `threadContext.js`
Create a new module to handle all thread context operations:
```javascript
// cora/threadContext.js
const THREAD_CONFIG = {
  CACHE_TTL_MINUTES: 60,
  MAX_CONTEXT_MESSAGES: 100,
  MAX_CACHE_SIZE: 1000
};

class ThreadContextCache {
  constructor(ttlMinutes = THREAD_CONFIG.CACHE_TTL_MINUTES) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000;
    
    // Run cleanup every 15 minutes
    setInterval(() => this.cleanup(), 15 * 60 * 1000);
  }
  
  set(threadId, context) {
    // Implement cache size limit
    if (this.cache.size >= THREAD_CONFIG.MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(threadId, {
      context,
      timestamp: Date.now()
    });
  }
  
  get(threadId) {
    const entry = this.cache.get(threadId);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(threadId);
      return null;
    }
    
    return entry.context;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [threadId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(threadId);
      }
    }
  }
}

async function getThreadHistory(client, channel, thread_ts, botUserId) {
  try {
    const result = await client.conversations.replies({
      channel: channel,
      ts: thread_ts,
      limit: THREAD_CONFIG.MAX_CONTEXT_MESSAGES + 20 // Fetch extra to account for bot messages
    });
    
    // Sort messages chronologically
    const messages = result.messages.sort((a, b) => 
      parseFloat(a.ts) - parseFloat(b.ts)
    );
    
    // Format for OpenAI, limiting to MAX_CONTEXT_MESSAGES
    const formattedMessages = [];
    let userMessageCount = 0;
    
    for (const message of messages) {
      // Skip system messages, bot messages from other bots, etc.
      if (message.subtype && message.subtype !== 'bot_message') continue;
      
      if (message.user === botUserId || message.bot_id === botUserId) {
        formattedMessages.push({
          role: 'assistant',
          content: message.text
        });
      } else if (message.text) {
        formattedMessages.push({
          role: 'user',
          content: message.text
        });
        userMessageCount++;
        
        // Stop if we've reached the limit
        if (userMessageCount >= THREAD_CONFIG.MAX_CONTEXT_MESSAGES) break;
      }
    }
    
    return formattedMessages;
  } catch (error) {
    console.error('Error fetching thread history:', error);
    return [];
  }
}

module.exports = {
  ThreadContextCache,
  getThreadHistory,
  THREAD_CONFIG
};
```

#### 1.2 Update `aiService.js`
Add new function to handle context:
```javascript
// Add to imports
const { getThreadHistory } = require('./threadContext');

// New function to handle OpenAI calls with context
async function getOpenAIResponseWithContext(userMessage, userId, conversationHistory = []) {
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 400
    });
    
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

// Export both functions
module.exports = {
  getOpenAIResponse,
  getOpenAIResponseWithContext,
  checkRateLimit
};
```

#### 1.3 Update `app.js`
Integrate thread context into event handlers:
```javascript
// Add to imports
const { getOpenAIResponse, getOpenAIResponseWithContext, checkRateLimit } = require('./aiService');
const { ThreadContextCache, getThreadHistory } = require('./threadContext');

// Initialize thread cache
const threadContextCache = new ThreadContextCache();

// Update app_mention handler
app.event('app_mention', async ({ event, say, client, logger }) => {
  try {
    logger.info('Bot was mentioned:', {
      channel: event.channel,
      thread_ts: event.thread_ts,
      ts: event.ts,
      isThread: !!event.thread_ts
    });
    
    // Check rate limit
    if (!checkRateLimit(event.user)) {
      await say({
        text: ':warning: You\'ve reached the rate limit. Please try again in a minute.',
        thread_ts: event.thread_ts || event.ts
      });
      return;
    }
    
    // Send initial "thinking" message
    const thinkingMessage = await say({
      text: ':hourglass_flowing_sand: Thinking...',
      thread_ts: event.thread_ts || event.ts
    });
    
    // Extract the actual message
    const botUserId = (await client.auth.test()).user_id;
    const userMessage = event.text.replace(`<@${botUserId}>`, '').trim();
    
    let aiResponse;
    
    // Check if this is a thread message
    if (event.thread_ts) {
      const threadId = `${event.channel}-${event.thread_ts}`;
      
      // Try to get cached context
      let conversationHistory = threadContextCache.get(threadId);
      
      if (!conversationHistory) {
        // Fetch thread history from Slack
        conversationHistory = await getThreadHistory(
          client, 
          event.channel, 
          event.thread_ts, 
          botUserId
        );
        
        // Only cache if we have history
        if (conversationHistory.length > 0) {
          threadContextCache.set(threadId, conversationHistory);
        }
      }
      
      logger.info(`Thread context loaded: ${conversationHistory.length} messages`);
      
      // Get OpenAI response with context
      aiResponse = await getOpenAIResponseWithContext(
        userMessage, 
        event.user, 
        conversationHistory
      );
      
      // Update cache with new interaction
      const updatedHistory = [
        ...conversationHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: aiResponse }
      ];
      
      // Keep only the last 100 messages
      if (updatedHistory.length > THREAD_CONFIG.MAX_CONTEXT_MESSAGES * 2) {
        updatedHistory.splice(0, updatedHistory.length - THREAD_CONFIG.MAX_CONTEXT_MESSAGES * 2);
      }
      
      threadContextCache.set(threadId, updatedHistory);
    } else {
      // No thread context needed
      aiResponse = await getOpenAIResponse(userMessage, event.user);
    }
    
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

### 2. Implementation Steps

#### Step 1: Create Thread Context Module
1. Create `cora/threadContext.js` with the code above
2. Implement ThreadContextCache class with TTL and size limits
3. Implement getThreadHistory function to fetch and format Slack messages

#### Step 2: Update AI Service
1. Add getOpenAIResponseWithContext function to `aiService.js`
2. Ensure it accepts conversation history array
3. Export both context and non-context functions

#### Step 3: Update App Event Handlers
1. Import thread context utilities in `app.js`
2. Initialize ThreadContextCache instance
3. Update app_mention handler to:
   - Detect thread messages
   - Fetch/cache thread history
   - Pass context to OpenAI
   - Update cache after response

#### Step 4: Testing & Validation
1. Test non-thread mentions (should work as before)
2. Test thread conversations with multiple back-and-forth
3. Test cache expiration after 1 hour
4. Test with threads approaching 100 messages

### 3. Testing Scenarios

#### 3.1 Basic Thread Test
```
1. User: @Cora What is customer segmentation?
2. Cora: [Explains customer segmentation]
3. User: How do I implement it for my SaaS business?
4. Cora: [Should reference previous explanation and provide SaaS-specific advice]
```

#### 3.2 Long Thread Test
```
1. Create a thread with 50+ messages
2. Mention bot near the end
3. Verify bot has context from earlier messages
4. Continue conversation to exceed 100 messages
5. Verify oldest messages are dropped
```

#### 3.3 Cache Expiration Test
```
1. Start a thread conversation
2. Wait 61 minutes
3. Continue the conversation
4. Verify context is refetched from Slack
```

### 4. Monitoring & Debugging

#### 4.1 Add Debug Logging
```javascript
// In app.js mention handler
logger.info('Thread context debug:', {
  threadId: threadId,
  cacheHit: !!cachedContext,
  historyLength: conversationHistory.length,
  cacheSize: threadContextCache.cache.size
});
```

#### 4.2 Health Check Endpoint (Optional)
```javascript
app.command('/cora-health', async ({ ack, respond }) => {
  await ack();
  await respond({
    text: `Thread Cache Status:\n` +
          `- Active threads: ${threadContextCache.cache.size}\n` +
          `- Cache TTL: ${THREAD_CONFIG.CACHE_TTL_MINUTES} minutes\n` +
          `- Max messages: ${THREAD_CONFIG.MAX_CONTEXT_MESSAGES}`
  });
});
```

### 5. Performance Considerations

1. **Memory Usage**: With 1000 max threads × 100 messages each, estimate ~10-50MB RAM
2. **Slack API**: Fetching 100 messages is well within rate limits
3. **OpenAI Costs**: 100 messages ≈ 2000-5000 tokens additional context
4. **Response Time**: Initial thread fetch adds ~500ms, subsequent uses cache

### 6. Known Limitations for Phase 1

1. **No Persistent Storage**: Context lost on app restart
2. **No Token Counting**: Could exceed OpenAI limits with very long messages
3. **Simple Cache**: No LRU eviction, just FIFO when limit reached
4. **No Summarization**: Old messages not summarized when limit reached

### 7. Success Criteria

Phase 1 is complete when:
- [ ] Thread context is maintained within conversations
- [ ] Bot responses show awareness of previous messages
- [ ] Cache performs well with up to 100 concurrent threads
- [ ] No degradation in non-thread performance
- [ ] Error handling prevents crashes from API failures

## Next Steps

1. Review and approve this Phase 1 detailed plan
2. Implement the code changes in order
3. Test in development environment
4. Deploy to production with monitoring
5. Gather user feedback for Phase 2 enhancements

---

*This Phase 1 implementation provides a solid foundation for thread context while keeping complexity manageable. Future phases can build on this base.*
