require('dotenv').config();

const { App } = require('@slack/bolt');
const { getOpenAIResponse, checkRateLimit } = require('./aiService');

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
    logger.info('Bot was mentioned:', event);
    
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

  app.logger.info('⚡️ Cora.Work app is running!');
})();
