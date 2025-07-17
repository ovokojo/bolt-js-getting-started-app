# Implementation Plan: Decision Record POST API Integration

## Overview
Modify the existing Slack app to accept POST requests containing decision record data from an external application and post formatted summaries to a specified Slack channel.

## Current Architecture Analysis
- **Framework**: Slack Bolt JS with Socket Mode
- **Server**: Express HTTP server running on port 3000 (for Heroku health checks)
- **Dependencies**: @slack/bolt, express, openai, dotenv
- **Deployment**: Heroku

## Implementation Plan

### 1. API Endpoint Design

#### Endpoint Specification
- **Path**: `/api/decision-record`
- **Method**: POST
- **Content-Type**: application/json
- **Authentication**: API key in header

#### Request Body Structure
```json
{
  "channel": "C1234567890",  // Optional: Slack channel ID or name
  "data": {
    "record": {
      "_id": "string",        // Optional
      "createdAt": "number",  // Optional
      "data": {
        "title": "string",    // REQUIRED - only required field
        "status": "string",   // Optional
        "accountable": "string", // Optional
        "context": "string",  // Optional
        "driver": "string",   // Optional
        "informed": ["string"], // Optional
        "stakeholders": ["string"], // Optional
      },
      "path": "string",       // Optional
      "updatedAt": "number"   // Optional
    }
  }
}
```

#### Minimal Valid Request
```json
{
  "data": {
    "record": {
      "data": {
        "title": "My Decision"
      }
    }
  }
}
```

### 2. Security Implementation

#### API Key Authentication
- Store API key in environment variable: `DECISION_API_KEY`
- Validate via header: `X-API-Key: <api-key>`
- Return 401 Unauthorized if missing or invalid

#### Security Measures
- Request body size limit: 1MB
- Basic rate limiting (can enhance later)
- Input validation for required title field
- Sanitize all text inputs before posting to Slack

### 3. Configuration Requirements

#### Required Environment Variables
```
DECISION_API_KEY=<generated-api-key>    # Authentication key
DEFAULT_CHANNEL_ID=<slack-channel-id>   # Fallback channel (or bot DM)
```

#### Optional Environment Variables
```
ENABLE_API_ENDPOINT=true                # Feature flag (default: true)
API_RATE_LIMIT=100                      # Requests per hour (future enhancement)
```

### 4. Channel Selection Logic

1. **Priority Order**:
   - Use channel from request body if provided
   - Fall back to `DEFAULT_CHANNEL_ID` env variable
   - If no default set, post to bot's DM channel (self)

2. **Channel Format Support**:
   - Channel ID: `C1234567890` (preferred)
   - Channel name: `#general` or `general`
   - Auto-detect and handle both formats

### 5. Message Formatting

#### Basic Text Format
```
📋 New Decision Record Created

Title: {title}
Status: {status || 'Not specified'}
Path: {path || 'Not specified'}
Context: {context || 'Not specified'}
Accountable: {accountable || 'Not specified'}
Stakeholders: {stakeholders.join(', ') || 'None specified'}
Created: {formattedDate || 'Not specified'}
```

#### Field Handling
- Only include fields that have values
- Skip empty or null fields entirely
- Format timestamps to readable dates
- Join arrays with commas

### 6. API Response Format

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Decision record posted successfully"
}
```

#### Error Responses
```json
// 400 Bad Request
{
  "success": false,
  "error": "Missing required field: title"
}

// 401 Unauthorized
{
  "success": false,
  "error": "Invalid API key"
}

// 500 Internal Server Error
{
  "success": false,
  "error": "Failed to post to Slack"
}
```

### 7. Implementation Steps

#### Step 1: Express Middleware Setup
1. Add JSON body parser for `/api/*` routes
2. Create API key validation middleware
3. Add error handling for API routes

#### Step 2: Channel Resolution Logic
1. Create channel resolver function
2. Support both channel ID and name formats
3. Implement fallback to default channel
4. Add DM channel creation if needed

#### Step 3: Message Formatter
1. Create flexible formatter that handles optional fields
2. Skip empty fields in output
3. Format timestamps to readable format
4. Handle array fields gracefully

#### Step 4: API Route Implementation
1. Validate request has required title field
2. Resolve target channel
3. Format message based on available fields
4. Post to Slack using Bolt client
5. Return appropriate success/error response

#### Step 5: Error Handling
1. Catch and log all errors
2. Return user-friendly error messages
3. Don't expose internal details in responses
4. Log full errors for debugging

### 8. File Structure

```
cora/
  ├── app.js                 # Main app (modify to add API routes)
  ├── api/                   # New directory
  │   ├── decisionRecord.js  # POST endpoint handler
  │   └── middleware.js      # Auth middleware
  └── utils/                 # New directory
      ├── channelResolver.js # Channel lookup logic
      └── messageFormatter.js # Format decision records
```

### 9. Code Integration Points

#### In app.js
```javascript
// After Express app creation
const { authMiddleware } = require('./api/middleware');
const { handleDecisionRecord } = require('./api/decisionRecord');

// Add JSON parsing for API routes
httpApp.use('/api', express.json({ limit: '1mb' }));

// Add API route
httpApp.post('/api/decision-record', authMiddleware, handleDecisionRecord);
```

### 10. Testing Examples

#### Test with minimal data (curl)
```bash
curl -X POST http://localhost:3000/api/decision-record \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "data": {
      "record": {
        "data": {
          "title": "Test Decision"
        }
      }
    }
  }'
```

#### Test with full data and channel
```bash
curl -X POST http://localhost:3000/api/decision-record \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "channel": "#decisions",
    "data": {
      "record": {
        "data": {
          "title": "Brand Campaign Decision",
          "status": "draft",
          "context": "Q1 marketing strategy"
        }
      }
    }
  }'
```

### 11. Future Enhancements (Not in Initial Implementation)

1. **Rich Formatting**: Slack blocks with buttons and styling
2. **Update Notifications**: PUT endpoint for status changes
3. **Thread Updates**: Group related decisions in threads
4. **Webhook Signatures**: Enhanced security with HMAC
5. **Batch Operations**: Post multiple records at once
6. **Two-way Sync**: Update external app from Slack reactions

### 12. Development & Deployment Steps

1. **Local Development**:
   - Add test API key to `.env` file
   - Test with Postman/curl
   - Verify Slack message posting
   - Test error scenarios

2. **Deployment to Heroku**:
   - Add `DECISION_API_KEY` to Heroku config vars
   - Set `DEFAULT_CHANNEL_ID` (optional)
   - Deploy and test production endpoint
   - Monitor logs for errors

## Summary of Key Decisions

- ✅ Dynamic channel selection with fallback
- ✅ Simple API key authentication
- ✅ All fields optional except title
- ✅ Basic text formatting only
- ✅ Simple success/error responses
- ✅ Create notifications only (no updates)
- ✅ Flexible schema to accommodate changes

## Next Steps

Once approved, implementation will follow this order:
1. Create middleware for API key validation
2. Implement channel resolver utility
3. Build message formatter for optional fields
4. Create the POST endpoint handler
5. Integrate with Express app
6. Test locally with various payloads
7. Deploy to Heroku and test production
