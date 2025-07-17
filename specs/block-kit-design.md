# Slack Message Design Plan - Using Block Kit with Markdown

## Current State Analysis

### Current Implementation
1. **AI Responses**: Currently using simple `mrkdwn` in a single section block
2. **Formatting**: System prompt instructs to use Slack's native formatting (*bold*, _italic_, etc.)
3. **Structure**: All responses are flat text without visual hierarchy

### Limitations
- No visual hierarchy or structure
- Limited use of Block Kit capabilities
- No headers, dividers, or contextual sections
- Decision records likely sent as plain text

## Proposed Redesign Using Block Kit

### 1. Enhanced AI Response Structure

Instead of a single section block, use multiple blocks for better organization:

```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "[Main response content with markdown]"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "💡 *Tip:* Reply in thread to continue the conversation"
        }
      ]
    }
  ]
}
```

### 2. AI System Prompt Updates

Update the system prompt to leverage markdown more effectively:

```
Format your responses using enhanced Slack markdown:
- Use *bold* for key concepts and important points
- Use _italic_ for emphasis or examples
- Use `inline code` for technical terms, metrics, or specific values
- Use ```code blocks``` for step-by-step instructions or frameworks
- Use • for bullet points (Slack doesn't support - or *)
- Use numbered lists (1. 2. 3.) for sequential steps
- Use > for important quotes or key takeaways
- Use --- for visual breaks between sections
- Structure responses with clear sections when appropriate
```

### 3. Decision Record Notification Design

Create a rich, structured notification for decision records (API-triggered only):

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "📋 New Decision Record",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Decision:*\n[Decision title]"
        },
        {
          "type": "mrkdwn",
          "text": "*Status:*\n🟢 [Status]"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Context:*\n[Context description]"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Options Considered:*\n• Option 1: [Description]\n• Option 2: [Description]"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Decision Made:*\n[Detailed decision and rationale]"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Decision Record",
            "emoji": true
          },
          "url": "https://app.cora.work",
          "action_id": "view_decision_record"
        }
      ]
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "📅 *Created:* [Date] | 👤 *Owner:* [Name]"
        }
      ]
    }
  ]
}
```

**Note:** The button is only included for API-triggered decision record notifications. Regular Cora responses will not include interactive elements.

### 4. Response Type Templates

#### A. Strategic Advice Response
- Header: "🎯 Strategic Recommendation"
- Main section: Core advice
- Subsections: Action items, timeline, resources
- Context: Next steps

#### B. Analysis Response  
- Header: "📊 Analysis Results"
- Fields section: Key metrics/findings
- Main section: Detailed analysis
- Context: Data sources, confidence level

#### C. Error/Warning Messages
- Header with appropriate emoji (⚠️, ❌, ℹ️)
- Clear error description
- Suggested actions
- Help resources

### 5. Implementation Changes

#### aiService.js Updates:
1. Enhance system prompt with markdown formatting guidelines
2. Keep returning plain text responses (block formatting handled in app.js)

#### app.js Updates:
1. Create block builder functions for AI responses
2. Update message posting to use multi-block structures
3. Add visual consistency across all bot responses

#### api/decisionRecord.js Updates:
1. Implement the decision record block structure with button
2. Use the enhanced markdown formatting

#### messageFormatter.js (New Utility):
1. `formatAIResponse(text)` - Converts AI text to block structure
2. `formatDecisionRecord(data)` - Creates decision record blocks with button
3. `formatError(message)` - Consistent error message blocks

### 6. Benefits

1. **Better Readability**: Clear visual hierarchy and sections
2. **Professional Appearance**: Consistent, polished message design
3. **Improved UX**: Users can quickly scan and find information
4. **Contextual Information**: Better use of metadata and context blocks
5. **Actionable Content**: Clear separation of information vs. actions

### 7. Testing Plan

1. Update one response type at a time
2. Test markdown rendering in Slack
3. Verify mobile and desktop appearance
4. Gather user feedback on readability
5. Iterate on block arrangements

## Design Decisions

Based on requirements:

1. **Interactive Elements**: Only decision record notifications (API-triggered) will include a "View Decision Record" button linking to app.cora.work. No other responses will have interactive elements.
2. **Color Coding**: No special color-coding for different response types - maintain consistent design.
3. **Thread Responses**: Will use the same structure as initial responses for consistency.
4. **Long Responses**: Display in full without pagination or truncation.
5. **Reaction Shortcuts**: Not implemented at this time.

## Next Steps

1. ✅ Design plan approved with modifications
2. Update system prompt in aiService.js to use enhanced markdown
3. Create messageFormatter.js utility with three main functions:
   - `formatAIResponse()` for Cora's responses
   - `formatDecisionRecord()` for API notifications with button
   - `formatError()` for error messages
4. Update app.js to use new formatter for AI responses
5. Update api/decisionRecord.js to use formatter for notifications
6. Test all message types in Slack (desktop and mobile)
