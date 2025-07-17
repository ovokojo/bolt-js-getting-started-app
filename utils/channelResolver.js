/**
 * Channel resolution utility for decision record API
 */

/**
 * Resolves a channel ID from various input formats
 * @param {Object} slackClient - Slack Bolt client
 * @param {string} channelInput - Channel ID, name, or #name
 * @param {string} fallbackChannelId - Default channel ID from env
 * @returns {Promise<string>} - Resolved channel ID
 */
async function resolveChannel(slackClient, channelInput, fallbackChannelId) {
  console.log('Resolving channel:', { channelInput, fallbackChannelId });
  
  // If channel provided in request, try to use it
  if (channelInput) {
    const resolvedId = await resolveChannelFromInput(slackClient, channelInput);
    if (resolvedId) {
      console.log('Channel resolved from request:', resolvedId);
      return resolvedId;
    }
    console.log('Failed to resolve channel from request, falling back');
  }
  
  // Fall back to default channel if configured
  if (fallbackChannelId) {
    const resolvedId = await resolveChannelFromInput(slackClient, fallbackChannelId);
    if (resolvedId) {
      console.log('Channel resolved from fallback:', resolvedId);
      return resolvedId;
    }
    console.log('Failed to resolve fallback channel');
  }
  
  // Final fallback: get bot's DM channel (self)
  try {
    const authInfo = await slackClient.auth.test();
    const botUserId = authInfo.user_id;
    
    // Open DM channel with self (bot)
    const dmResult = await slackClient.conversations.open({
      users: botUserId
    });
    
    console.log('Using bot DM as final fallback:', dmResult.channel.id);
    return dmResult.channel.id;
  } catch (error) {
    console.error('Failed to create bot DM channel:', error);
    throw new Error('Could not resolve any channel for posting');
  }
}

/**
 * Resolves a channel ID from input (ID, name, or #name)
 * @param {Object} slackClient - Slack Bolt client
 * @param {string} input - Channel input to resolve
 * @returns {Promise<string|null>} - Channel ID or null if not found
 */
async function resolveChannelFromInput(slackClient, input) {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  const trimmedInput = input.trim();
  
  // If it looks like a channel ID (starts with C), return as-is
  if (trimmedInput.match(/^C[A-Z0-9]+$/)) {
    console.log('Input appears to be channel ID:', trimmedInput);
    return trimmedInput;
  }
  
  // Remove # prefix if present
  const channelName = trimmedInput.startsWith('#') ? trimmedInput.slice(1) : trimmedInput;
  
  try {
    // Try to find channel by name
    console.log('Looking up channel by name:', channelName);
    
    // Get list of channels (public channels)
    const channelsResult = await slackClient.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 1000
    });
    
    const channel = channelsResult.channels.find(ch => ch.name === channelName);
    
    if (channel) {
      console.log('Found channel by name:', { name: channelName, id: channel.id });
      return channel.id;
    }
    
    console.log('Channel not found by name:', channelName);
    return null;
  } catch (error) {
    console.error('Error looking up channel:', error);
    return null;
  }
}

/**
 * Validates that a channel exists and bot has access
 * @param {Object} slackClient - Slack Bolt client  
 * @param {string} channelId - Channel ID to validate
 * @returns {Promise<boolean>} - Whether channel is accessible
 */
async function validateChannelAccess(slackClient, channelId) {
  try {
    const info = await slackClient.conversations.info({ channel: channelId });
    console.log('Channel validation successful:', { 
      id: channelId, 
      name: info.channel.name,
      is_member: info.channel.is_member 
    });
    return true;
  } catch (error) {
    console.error('Channel validation failed:', { channelId, error: error.message });
    return false;
  }
}

module.exports = {
  resolveChannel,
  validateChannelAccess
}; 