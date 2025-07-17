/**
 * Authentication middleware for API endpoints
 */

function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.DECISION_API_KEY;
  
  // Check if API key is configured
  if (!expectedApiKey) {
    console.error('DECISION_API_KEY environment variable not set');
    return res.status(500).json({
      success: false,
      error: 'API endpoint not configured'
    });
  }
  
  // Check if API key is provided
  if (!apiKey) {
    console.log('API request rejected: Missing API key');
    return res.status(401).json({
      success: false,
      error: 'Missing API key in X-API-Key header'
    });
  }
  
  // Validate API key
  if (apiKey !== expectedApiKey) {
    console.log('API request rejected: Invalid API key');
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  console.log('API request authenticated successfully');
  next();
}

/**
 * Validation middleware for decision record requests
 */
function validateDecisionRecord(req, res, next) {
  const { data } = req.body;
  
  // Check basic structure
  if (!data || !data.record || !data.record.data) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request structure: missing data.record.data'
    });
  }
  
  // Check required title field
  const title = data.record.data.title;
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: title'
    });
  }
  
  console.log('Request validation passed for decision record:', title);
  next();
}

module.exports = {
  authMiddleware,
  validateDecisionRecord
}; 