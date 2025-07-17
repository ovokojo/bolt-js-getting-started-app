/**
 * Message Formatter Utility
 * Formats different types of messages using Slack Block Kit
 */

/**
 * Formats AI responses with Block Kit structure
 * @param {string} text - The AI response text
 * @returns {object} Block Kit formatted message
 */
function formatAIResponse(text) {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: text
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'ℹ Cora can make mistakes. Consider checking important information'
          }
        ]
      }
    ]
  };
}

/**
 * Formats decision record notifications with Block Kit structure and button
 * @param {object} data - Decision record data
 * @returns {object} Block Kit formatted message
 */
function formatDecisionRecord(data) {
  const {
    title,
    status,
    driver,
    context,
    accountable,
    stakeholders,
    path,
    createdDate
  } = data;

  // Format stakeholders as comma-separated list
  const stakeholdersList = Array.isArray(stakeholders) 
    ? stakeholders.join(', ')
    : stakeholders || 'Not specified';

  // Format the creation date
  const formattedDate = createdDate 
    ? new Date(createdDate).toLocaleDateString()
    : new Date().toLocaleDateString();

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📋 New Decision Record',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Title:*\n${title || 'Untitled Decision'}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${status || 'Pending'}`
          }
        ]
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Driver:*\n${driver || 'Not specified'}`
          },
          {
            type: 'mrkdwn',
            text: `*Accountable:*\n${accountable || 'Not specified'}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Context:*\n${context || 'No context provided'}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stakeholders:*\n${stakeholdersList}`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `📁 *Path:*\n${path || 'Not specified'}`
          },
          {
            type: 'mrkdwn',
            text: `📅 *Created:*\n${formattedDate}`
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Decision Record',
              emoji: true
            },
            url: 'https://app.cora.work',
            action_id: 'view_decision_record'
          }
        ]
      }
    ]
  };
}

/**
 * Formats error messages with Block Kit structure
 * @param {string} message - Error message text
 * @param {string} type - Error type ('error', 'warning', 'info')
 * @returns {object} Block Kit formatted message
 */
function formatError(message, type = 'error') {
  const emojiMap = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const titleMap = {
    error: 'Error',
    warning: 'Warning',
    info: 'Information'
  };

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emojiMap[type]} ${titleMap[type]}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💬 Try rephrasing your request or contact support if the issue persists'
          }
        ]
      }
    ]
  };
}

/**
 * Formats the thinking message with Block Kit structure
 * @returns {object} Block Kit formatted thinking message
 */
function formatThinkingMessage() {
  return {
    text: ':hourglass_flowing_sand: Thinking...',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':hourglass_flowing_sand: *Thinking...*'
        }
      }
    ]
  };
}

module.exports = {
  formatAIResponse,
  formatDecisionRecord,
  formatError,
  formatThinkingMessage
}; 