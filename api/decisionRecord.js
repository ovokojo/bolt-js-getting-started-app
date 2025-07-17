/**
 * Decision Record API endpoint handler
 */

const { resolveChannel } = require('../utils/channelResolver');
const { formatDecisionRecord, createLogPreview } = require('../utils/messageFormatter');

/**
 * Handles POST requests to create decision record notifications
 * This function expects the Slack client to be available
 */
function createDecisionRecordHandler(slackClient) {
  return async function handleDecisionRecord(req, res) {
    console.log('=== Decision Record API Request ===');
    console.log('Request body size:', JSON.stringify(req.body).length, 'bytes');
    
    try {
      const { channel: requestChannel, data } = req.body;
      const fallbackChannel = process.env.DEFAULT_CHANNEL_ID;
      
      // Create log preview for debugging
      const preview = createLogPreview({ data });
      console.log('Decision record preview:', preview);
      
      // Resolve target channel
      console.log('Resolving target channel...');
      const targetChannel = await resolveChannel(
        slackClient, 
        requestChannel, 
        fallbackChannel
      );
      
      if (!targetChannel) {
        console.error('Failed to resolve any target channel');
        return res.status(500).json({
          success: false,
          error: 'Could not determine target channel'
        });
      }
      
      // Format the message
      console.log('Formatting Slack message...');
      const messageText = formatDecisionRecord({ data });
      
      console.log('Message preview (first 200 chars):', messageText.substring(0, 200));
      
      // Post to Slack
      console.log('Posting to Slack channel:', targetChannel);
      const slackResponse = await slackClient.chat.postMessage({
        channel: targetChannel,
        text: messageText,
        unfurl_links: false,
        unfurl_media: false
      });
      
      if (slackResponse.ok) {
        console.log('✅ Successfully posted to Slack:', {
          channel: targetChannel,
          messageTs: slackResponse.ts,
          title: preview.title
        });
        
        return res.status(200).json({
          success: true,
          message: 'Decision record posted successfully'
        });
      } else {
        console.error('❌ Slack API error:', slackResponse.error);
        return res.status(500).json({
          success: false,
          error: 'Failed to post to Slack'
        });
      }
      
    } catch (error) {
      console.error('❌ Error handling decision record:', error);
      
      // Check for specific error types
      if (error.message?.includes('channel')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid channel specified'
        });
      }
      
      if (error.message?.includes('Invalid decision record')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid decision record data structure'
        });
      }
      
      // Generic server error
      return res.status(500).json({
        success: false,
        error: 'Internal server error processing decision record'
      });
    }
  };
}

/**
 * Health check endpoint for the API
 */
async function handleHealthCheck(req, res) {
  console.log('API health check requested');
  
  try {
    const isApiKeyConfigured = !!process.env.DECISION_API_KEY;
    const hasDefaultChannel = !!process.env.DEFAULT_CHANNEL_ID;
    
    return res.status(200).json({
      success: true,
      status: 'API endpoint is healthy',
      config: {
        apiKeyConfigured: isApiKeyConfigured,
        hasDefaultChannel: hasDefaultChannel,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
}

module.exports = {
  createDecisionRecordHandler,
  handleHealthCheck
}; 