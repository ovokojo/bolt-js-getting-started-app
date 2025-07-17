/**
 * Message formatting utility for decision records
 */

/**
 * Formats a decision record into a Slack message
 * @param {Object} decisionData - Decision record data from request
 * @returns {string} - Formatted Slack message
 */
function formatDecisionRecord(decisionData) {
  console.log('Formatting decision record message');
  
  const record = decisionData.data?.record;
  if (!record) {
    throw new Error('Invalid decision record structure');
  }
  
  const data = record.data || {};
  
  // Start with the header
  let message = '📋 New Decision Record Created\n\n';
  
  // Title is required, so always include it
  const title = data.title?.trim();
  if (title) {
    message += `*Title:* ${title}\n`;
  }
  
  // Add optional fields only if they have values
  const status = data.status?.trim();
  if (status) {
    message += `*Status:* ${status}\n`;
  }
  
  const path = record.path?.trim();
  if (path) {
    message += `*Path:* ${path}\n`;
  }
  
  const context = data.context?.trim();
  if (context) {
    message += `*Context:* ${context}\n`;
  }
  
  const accountable = data.accountable?.trim();
  if (accountable) {
    message += `*Accountable:* ${accountable}\n`;
  }
  
  const driver = data.driver?.trim();
  if (driver) {
    message += `*Driver:* ${driver}\n`;
  }
  
  // Handle stakeholders array
  const stakeholders = data.stakeholders;
  if (Array.isArray(stakeholders) && stakeholders.length > 0) {
    const stakeholdersList = stakeholders
      .filter(s => s && typeof s === 'string' && s.trim())
      .map(s => s.trim())
      .join(', ');
    
    if (stakeholdersList) {
      message += `*Stakeholders:* ${stakeholdersList}\n`;
    }
  }
  
  // Handle informed array  
  const informed = data.informed;
  if (Array.isArray(informed) && informed.length > 0) {
    const informedList = informed
      .filter(i => i && typeof i === 'string' && i.trim())
      .map(i => i.trim())
      .join(', ');
    
    if (informedList) {
      message += `*Informed:* ${informedList}\n`;
    }
  }
  
  // Add creation timestamp if available
  const createdAt = record.createdAt;
  if (createdAt && typeof createdAt === 'number') {
    const formattedDate = formatTimestamp(createdAt);
    message += `*Created:* ${formattedDate}\n`;
  }
  
  // Add decision record ID if available (for tracking)
  const recordId = record._id?.trim();
  if (recordId) {
    message += `*ID:* ${recordId}\n`;
  }
  
  console.log('Formatted message length:', message.length);
  return message.trim();
}

/**
 * Formats a timestamp into a readable date string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} - Formatted date string
 */
function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    // Format as: January 18, 2025 at 3:45 PM
    const options = {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    };
    
    return date.toLocaleString('en-US', options);
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Unknown date';
  }
}

/**
 * Sanitizes text input for Slack messages
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .trim()
    .replace(/[<>&]/g, (char) => {
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        default: return char;
      }
    })
    .substring(0, 3000); // Limit length to prevent overly long messages
}

/**
 * Creates a preview of the decision record for logging
 * @param {Object} decisionData - Decision record data
 * @returns {Object} - Preview object for logging
 */
function createLogPreview(decisionData) {
  const record = decisionData.data?.record;
  const data = record?.data || {};
  
  return {
    title: data.title,
    status: data.status,
    path: record?.path,
    recordId: record?._id,
    hasContext: !!data.context,
    hasStakeholders: Array.isArray(data.stakeholders) && data.stakeholders.length > 0,
    hasInformed: Array.isArray(data.informed) && data.informed.length > 0,
    createdAt: record?.createdAt
  };
}

module.exports = {
  formatDecisionRecord,
  formatTimestamp,
  sanitizeText,
  createLogPreview
}; 