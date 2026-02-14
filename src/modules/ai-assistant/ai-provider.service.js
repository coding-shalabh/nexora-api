/**
 * AI Provider Service
 * Wrapper for AIML API with tool calling support
 */

import { logger } from '../../common/utils/logger.js';

const AIML_API_KEY = process.env.AIML_API_KEY;
const AIML_API_URL = 'https://api.aimlapi.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.AI_ASSISTANT_DEFAULT_MODEL || 'gpt-4o-mini';
const FALLBACK_MODEL = process.env.AI_ASSISTANT_FALLBACK_MODEL || 'gpt-4o';

// Tool definitions for AI
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'getSalesReport',
      description:
        'Get sales pipeline metrics including revenue, deals won/lost, win rate, and top performers',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description:
              'Start date in ISO format (YYYY-MM-DD). Defaults to 30 days ago if not provided',
          },
          endDate: {
            type: 'string',
            description: 'End date in ISO format (YYYY-MM-DD). Defaults to today if not provided',
          },
          pipelineId: {
            type: 'string',
            description: 'Optional specific pipeline ID to filter by',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCRMStats',
      description: 'Get CRM statistics for contacts, companies, or activities',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['contacts', 'companies', 'activities'],
            description: 'Type of CRM metric to retrieve',
          },
          startDate: {
            type: 'string',
            description: 'Start date for filtering (YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'End date for filtering (YYYY-MM-DD)',
          },
        },
        required: ['metric'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getHRData',
      description: 'Get HR metrics (attendance, leave, employees). Requires HR permissions.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['attendance', 'leave', 'employees'],
            description: 'Type of HR data to retrieve',
          },
          date: {
            type: 'string',
            description: 'Specific date for attendance/leave (YYYY-MM-DD)',
          },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getProjectMetrics',
      description: 'Get project and task metrics',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional specific project ID',
          },
          metric: {
            type: 'string',
            enum: ['overview', 'tasks', 'time'],
            description: 'Type of project metric to retrieve',
          },
        },
        required: ['metric'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTicketStats',
      description: 'Get support ticket metrics and statistics',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Start date for filtering (YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'End date for filtering (YYYY-MM-DD)',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            description: 'Filter by priority level',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCommerceData',
      description: 'Get commerce metrics for orders, invoices, or payments',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['orders', 'invoices', 'payments'],
            description: 'Type of commerce data to retrieve',
          },
          startDate: {
            type: 'string',
            description: 'Start date for filtering (YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'End date for filtering (YYYY-MM-DD)',
          },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSubscriptionInfo',
      description: 'Get user subscription and billing information',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scheduleReport',
      description: 'Set up automated daily/weekly/monthly reports',
      parameters: {
        type: 'object',
        properties: {
          frequency: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
            description: 'Report frequency',
          },
          time: {
            type: 'string',
            description: 'Time in HH:MM format (e.g., "09:00")',
          },
          reportType: {
            type: 'string',
            enum: ['summary', 'sales', 'hr', 'custom'],
            description: 'Type of report to generate',
          },
        },
        required: ['frequency', 'time', 'reportType'],
      },
    },
  },
];

export class AIProviderService {
  /**
   * Process user query with tool calling support
   * @param {string} userQuery - User's message
   * @param {Object} userContext - User context (permissions, history)
   * @param {Function} toolExecutor - Function to execute tools
   */
  async processWithTools(userQuery, userContext, toolExecutor) {
    try {
      const messages = this.buildMessages(userQuery, userContext);

      // First AI call - AI decides which tool to call
      const response = await this.callAIML({
        model: DEFAULT_MODEL,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
      });

      const aiMessage = response.choices[0].message;

      // Check if AI wants to call a tool
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        const toolCall = aiMessage.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        logger.info({ toolName, toolArgs }, 'AI calling tool');

        // Execute the tool
        const toolResult = await toolExecutor(toolName, toolArgs);

        // Second AI call - format the result
        const formattingMessages = [
          ...messages,
          aiMessage,
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(toolResult),
          },
        ];

        const formattingResponse = await this.callAIML({
          model: DEFAULT_MODEL,
          messages: formattingMessages,
        });

        return {
          content: formattingResponse.choices[0].message.content,
          model: DEFAULT_MODEL,
          intent: toolName,
          usage: {
            promptTokens: response.usage.prompt_tokens + formattingResponse.usage.prompt_tokens,
            completionTokens:
              response.usage.completion_tokens + formattingResponse.usage.completion_tokens,
            totalTokens: response.usage.total_tokens + formattingResponse.usage.total_tokens,
            cost: this.calculateCost(
              response.usage.prompt_tokens + formattingResponse.usage.prompt_tokens,
              response.usage.completion_tokens + formattingResponse.usage.completion_tokens,
              DEFAULT_MODEL
            ),
          },
        };
      } else {
        // No tool call - direct response
        return {
          content: aiMessage.content,
          model: DEFAULT_MODEL,
          intent: 'general',
          usage: {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
            cost: this.calculateCost(
              response.usage.prompt_tokens,
              response.usage.completion_tokens,
              DEFAULT_MODEL
            ),
          },
        };
      }
    } catch (error) {
      logger.error({ error }, 'AI provider error');
      throw error;
    }
  }

  /**
   * Build message array for AI
   */
  buildMessages(userQuery, userContext) {
    const messages = [
      {
        role: 'system',
        content: `You are Nexora AI Assistant. Help users get business insights and manage subscriptions.

User Context:
- Tenant ID: ${userContext.tenantId}
- Permissions: ${userContext.permissions.join(', ')}
- Role Level: ${userContext.roleLevel}

Guidelines:
- Use the available tools to fetch data
- Format responses clearly for WhatsApp (use emojis, bullet points)
- Keep responses concise (under 3000 characters)
- If user lacks permissions, politely inform them
- For dates, default to last 30 days if not specified`,
      },
    ];

    // Add conversation history (last 5 exchanges)
    if (userContext.conversationHistory && userContext.conversationHistory.length > 0) {
      const recentHistory = userContext.conversationHistory.slice(-10); // Last 5 exchanges (10 messages)
      messages.push(...recentHistory);
    }

    // Add current user query
    messages.push({
      role: 'user',
      content: userQuery,
    });

    return messages;
  }

  /**
   * Call AIML API
   */
  async callAIML({ model, messages, tools = null, tool_choice = null }) {
    if (!AIML_API_KEY) {
      throw new Error('AIML_API_KEY not configured');
    }

    const body = {
      model,
      messages,
    };

    if (tools) {
      body.tools = tools;
      body.tool_choice = tool_choice;
    }

    const response = await fetch(AIML_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIML_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'AIML API error');
      throw new Error(`AIML API error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Calculate cost based on model and token usage
   * Prices from AIML API (per 1M tokens)
   */
  calculateCost(promptTokens, completionTokens, model) {
    const prices = {
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4o': { input: 5.0, output: 15.0 },
      'gemini-2.0-flash-exp': { input: 0.13, output: 0.52 },
    };

    const modelPrices = prices[model] || prices['gpt-4o-mini'];

    const inputCost = (promptTokens / 1_000_000) * modelPrices.input;
    const outputCost = (completionTokens / 1_000_000) * modelPrices.output;

    return inputCost + outputCost;
  }
}
