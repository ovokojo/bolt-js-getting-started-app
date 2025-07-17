require('dotenv').config();

const { App } = require('@slack/bolt');
const { getOpenAIResponse, getOpenAIResponseWithContext, checkRateLimit } = require('./aiService');
const { ThreadContextCache, getThreadHistory, THREAD_CONFIG } = require('./threadContext');

/**
 * This sample slack application uses SocketMode.
 * For the companion getting started setup guide, see:
 * https://tools.slack.dev/bolt-js/getting-started/
 */

// Initializes your app with your bot token and app token
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Initialize thread context cache
const threadContextCache = new ThreadContextCache();

// Add logging to see all incoming messages for debugging
app.message(async ({ message, logger }) => {
  logger.info('Received message:', {
    type: message.type,
    subtype: message.subtype,
    channel: message.channel,
    user: message.user,
    text: message.text,
    channel_type: message.channel_type
  });
});

// Handle app mentions (when someone @mentions the bot)
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
      thread_ts: event.thread_ts || event.ts // Reply in thread if applicable
    });
    
    // Extract the actual message (remove the bot mention)
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
      logger.info('Thread context debug:', {
        threadId: threadId,
        cacheHit: !!threadContextCache.get(threadId),
        historyLength: conversationHistory.length,
        cacheSize: threadContextCache.cache.size
      });
      
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
      
      // Keep only the last 100 messages (200 total including user/assistant pairs)
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

// Handle direct messages to the bot
app.message(async ({ message, say, client, logger }) => {
  // Skip if it's a bot message or has a subtype (like message_changed)
  if (message.bot_id || message.subtype) return;
  
  try {
    // Check if it's a DM
    const channelInfo = await client.conversations.info({ channel: message.channel });
    if (channelInfo.channel.is_im) {
      logger.info('Received DM:', message);
      
      // Check rate limit
      if (!checkRateLimit(message.user)) {
        await say(':warning: You\'ve reached the rate limit. Please try again in a minute.');
        return;
      }
      
      // Send initial "thinking" message
      const thinkingMessage = await say(':hourglass_flowing_sand: Thinking...');
      
      // Get OpenAI response (DMs typically don't have thread context)
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
    }
  } catch (error) {
    logger.error('Error responding to DM:', error);
    await say(':x: Sorry, I encountered an error processing your request.');
  }
});

app.action('button_click', async ({ body, ack, say, logger }) => {
  try {
    // Acknowledge the action
    await ack();
    await say(`<@${body.user.id}> clicked the button! Try mentioning me with @Cora for business advice.`);
    logger.info('Successfully handled button click');
  } catch (error) {
    logger.error('Error handling button click:', error);
  }
});

// Add error handling for the app
app.error(async (error) => {
  console.error('App error:', error);
});

(async () => {
  try {
    console.log('🚀 Starting Cora.Work app...');
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ? 'Set' : 'Missing',
      SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN ? 'Set' : 'Missing',
      socketMode: true
    });
    
    // For Socket Mode apps on Heroku, we need to start an HTTP server
    // for health checks even though the Slack app uses WebSocket
    const express = require('express');
    const httpApp = express();
    
    // Import API handlers
    const { authMiddleware, validateDecisionRecord } = require('./api/middleware');
    const { createDecisionRecordHandler, handleHealthCheck } = require('./api/decisionRecord');
    
    // Add JSON parsing middleware for API routes
    httpApp.use('/api', express.json({ limit: '1mb' }));
    
    // Decision Record API endpoint
    const decisionRecordHandler = createDecisionRecordHandler(app.client);
    httpApp.post('/api/decision-record', authMiddleware, validateDecisionRecord, decisionRecordHandler);
    
    // API health check endpoint
    httpApp.get('/api/health', handleHealthCheck);
    
    // Original health check endpoints
    httpApp.get('/', (req, res) => {
      res.json({ status: 'Cora.Work Slack Bot is running!', timestamp: new Date().toISOString() });
    });
    
    httpApp.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    // Start HTTP server for Heroku
    const port = process.env.PORT || 3000;
    httpApp.listen(port, () => {
      console.log(`🌐 HTTP server listening on port ${port} for Heroku health checks`);
      console.log(`📋 Decision Record API available at: http://localhost:${port}/api/decision-record`);
      console.log(`🔍 API health check available at: http://localhost:${port}/api/health`);
      console.log(`🔑 API Key configured: ${process.env.DECISION_API_KEY ? 'Yes' : 'No'}`);
      console.log(`📨 Default channel: ${process.env.DEFAULT_CHANNEL_ID || 'Not set (will use bot DM)'}`);
    });
    
    // Keep-alive mechanism to prevent Heroku from sleeping the dyno
    if (process.env.NODE_ENV === 'production') {
      const keepAliveInterval = 25 * 60 * 1000; // 25 minutes in milliseconds
      setInterval(async () => {
        try {
          const response = await fetch(`https://slack-agent-cora-3c101624d293.herokuapp.com/health`);
          console.log(`🔄 Keep-alive ping: ${response.status} - ${new Date().toISOString()}`);
        } catch (error) {
          console.error('❌ Keep-alive ping failed:', error.message);
        }
      }, keepAliveInterval);
      
      console.log(`⏰ Keep-alive mechanism started (pinging every ${keepAliveInterval/1000/60} minutes)`);
    }
    
    // Start the Slack app (Socket Mode - doesn't need port)
    await app.start();
    
    console.log('⚡️ Cora.Work Slack app is running with thread context support!');
    app.logger.info('⚡️ Cora.Work app is running with thread context support!');
  } catch (error) {
    console.error('❌ Failed to start app:', error);
    process.exit(1);
  }
})();
