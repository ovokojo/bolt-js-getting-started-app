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