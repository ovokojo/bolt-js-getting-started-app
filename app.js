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

// Handle URL verification challenge for Events API
// This handles the challenge when setting up Events API subscriptions
app.use(async ({ body, ack, next, logger }) => {
  if (body && body.type === 'url_verification') {
    logger.info('Received URL verification challenge:', body);
    
    // Respond with the challenge value as plain text
    await ack(body.challenge);
    
    logger.info('Successfully responded to URL verification challenge');
    return;
  }
  
  // Continue to next middleware
  await next();
});

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
  // Start your app
  await app.start(process.env.PORT || 3000);

  app.logger.info('⚡️ Cora.Work app is running with thread context support!');
})();
