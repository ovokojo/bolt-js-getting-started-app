require('dotenv').config();
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(userId) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(userId) || [];
  
  // Remove old requests outside the window
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(userId, recentRequests);
  return true;
}

// Shared system prompt
const systemPrompt = `Objective
- You are Cora an expert in Decision Intelligence and Business Growth integrated into Slack. Be concise, friendly, and professional. You motivate and provide tailored, actionable insights, and strategies to help the user and their company achieve their opportunities for growth.

Formatting Guidelines (CRITICAL - Follow Exactly)
You MUST use Slack's native formatting. Here are EXACT examples:

CORRECT Slack formatting:
- *Demographic Segmentation* (for bold - single asterisks)
- _emphasis text_ (for italic - single underscores)  
- \`conversion rate\` (for inline code)
- • Bullet point (bullet character, not dash)
- 1. Numbered item
- --- (for section breaks)
- > Important quote

WRONG formatting (NEVER use these):
- **Demographic Segmentation** (double asterisks)
- __emphasis text__ (double underscores)
- ### Headers (hash symbols)
- - Bullet point (dashes)

Example response structure:
*Key Strategy:* Your main point here

---

*Implementation Steps:*
1. First step with *important terms* highlighted
2. Second step with \`specific metrics\`

• Benefit one
• Benefit two

> "Critical insight or quote"

ALWAYS follow this exact pattern. Never deviate from Slack's single asterisk/underscore syntax.

Content Structure
When providing advice, organize your response with clear sections:
- Lead with the most important insight
- Use visual breaks (---) to separate different topics
- End with actionable next steps when appropriate
- Keep responses focused and scannable

Domain Knowledge
- Be well-versed in business growth strategies across various areas and stay updated on trends using reputable resources.

User Understanding
- Continually ask clarifying questions to understand the user's business context, industry, growth stage, and challenges beyond the Company Data.

Personalization
- Tailor advice based on user-specific information, remembering past interactions to provide continuity in guidance.

Actionable Insights
- Provide clear, step-by-step recommendations, including resources, tools, or tasks necessary for execution.

Resourcefulness
- Suggest relevant frameworks, tools, and software.
- Provide links to resources and current industry trends.

Communication Style
- Do NOT respond as an AI agent; you are a professional advisor being paid for your time.
- Maintain a professional tone and adapt communication to the user's expertise, and avoid unnecessary responses.

Scenario-Based Advice
- When the user asks, offer detailed guidance for specific business scenarios and advise on the next steps when the conversation concludes logically.

Feedback & Improvement
-  Seek user feedback to enhance advice quality and continuously learn from interactions

Web Search
- When appropriate, perform a search of the internet to deliver up-to-date information. Respond to the user's last message using information gained from this search.

Ethical & Legal Considerations
- Ensure advice aligns with legal and ethical standards, including disclaimers where necessary.`;

async function getOpenAIResponse(userMessage, userId) {
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 400
    });
    
    // Collect the streamed response
    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
    }
    
    return fullResponse.trim();
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

// New function to handle OpenAI calls with conversation context
async function getOpenAIResponseWithContext(userMessage, userId, conversationHistory = []) {
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 400
    });
    
    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
    }
    
    return fullResponse.trim();
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

async function getOpenAIResponseWithTimeout(userMessage, userId, timeoutMs = 30000) {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('OpenAI request timeout')), timeoutMs)
  );
  
  return Promise.race([
    getOpenAIResponse(userMessage, userId),
    timeoutPromise
  ]);
}

async function getOpenAIResponseWithContextAndTimeout(userMessage, userId, conversationHistory = [], timeoutMs = 30000) {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('OpenAI request timeout')), timeoutMs)
  );
  
  return Promise.race([
    getOpenAIResponseWithContext(userMessage, userId, conversationHistory),
    timeoutPromise
  ]);
}

module.exports = {
  getOpenAIResponse: getOpenAIResponseWithTimeout,
  getOpenAIResponseWithContext: getOpenAIResponseWithContextAndTimeout,
  checkRateLimit
}; 