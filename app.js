require('dotenv').config();

const { App } = require('@slack/bolt');

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
app.event('app_mention', async ({ event, say, logger }) => {
  try {
    logger.info('Bot was mentioned:', event);
    await say({
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `Hey there <@${event.user}>! You mentioned me.`
          },
          "accessory": {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "Click Me"
            },
            "action_id": "button_click"
          }
        }
      ],
      text: `Hey there <@${event.user}>! You mentioned me.`
    });
    logger.info('Successfully responded to mention');
  } catch (error) {
    logger.error('Error responding to mention:', error);
  }
});

// Listens to incoming messages that contain "hello"
app.message('hello', async ({ message, say, logger }) => {
  try {
    logger.info('Hello message received:', { channel: message.channel, user: message.user });
    // say() sends a message to the channel where the event was triggered
    await say({
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `Hey there <@${message.user}>!`
          },
          "accessory": {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "Click Me"
            },
            "action_id": "button_click"
          }
        }
      ],
      text: `Hey there <@${message.user}>!`
    });
    logger.info('Successfully responded to hello');
  } catch (error) {
    logger.error('Error responding to hello:', error);
  }
});

app.message('goodbye', async ({ say, logger }) => {
  try {
    const responses = ['Adios', 'Au revoir', 'Farewell'];
    const parting = responses[Math.floor(Math.random() * responses.length)];
    await say(`${parting}!`);
    logger.info('Successfully responded to goodbye');
  } catch (error) {
    logger.error('Error responding to goodbye:', error);
  }
});

app.action('button_click', async ({ body, ack, say, logger }) => {
  try {
    // Acknowledge the action
    await ack();
    await say(`<@${body.user.id}> clicked the button`);
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
