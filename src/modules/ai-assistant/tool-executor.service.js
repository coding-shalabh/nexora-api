/**
 * Tool Executor Service
 * Executes AI tool calls with permission checks
 */

import { DataFetcherService } from './data-fetcher.service.js';
import { logger } from '../../common/utils/logger.js';

export class ToolExecutorService {
  constructor() {
    this.dataFetcher = new DataFetcherService();
  }

  /**
   * Execute a tool based on AI's request
   * @param {string} toolName - Name of tool to execute
   * @param {Object} args - Tool arguments
   * @param {Object} userContext - User context with permissions
   */
  async executeTool(toolName, args, userContext) {
    try {
      logger.info({ toolName, args }, 'Executing tool');

      switch (toolName) {
        case 'getSalesReport':
          return await this.dataFetcher.fetchSalesData(
            userContext.tenantId,
            {
              startDate: args.startDate,
              endDate: args.endDate,
              pipelineId: args.pipelineId,
            },
            userContext.permissions
          );

        case 'getCRMStats':
          return await this.dataFetcher.fetchCRMData(
            userContext.tenantId,
            {
              metric: args.metric,
              startDate: args.startDate,
              endDate: args.endDate,
            },
            userContext.permissions
          );

        case 'getHRData':
          // Check HR permissions first
          if (
            !this.hasPermission(userContext.permissions, 'hr:*') &&
            !this.hasPermission(userContext.permissions, 'hr:read')
          ) {
            return {
              error: true,
              message:
                '⛔ You do not have permission to access HR data. Please contact your administrator.',
            };
          }
          return await this.dataFetcher.fetchHRData(
            userContext.tenantId,
            {
              type: args.type,
              date: args.date,
            },
            userContext.permissions
          );

        case 'getProjectMetrics':
          return await this.dataFetcher.fetchProjectData(
            userContext.tenantId,
            {
              projectId: args.projectId,
              metric: args.metric,
            },
            userContext.permissions
          );

        case 'getTicketStats':
          return await this.dataFetcher.fetchTicketData(
            userContext.tenantId,
            {
              startDate: args.startDate,
              endDate: args.endDate,
              priority: args.priority,
            },
            userContext.permissions
          );

        case 'getCommerceData':
          return await this.dataFetcher.fetchCommerceData(
            userContext.tenantId,
            {
              type: args.type,
              startDate: args.startDate,
              endDate: args.endDate,
            },
            userContext.permissions
          );

        case 'getSubscriptionInfo':
          return await this.dataFetcher.fetchSubscriptionInfo(
            userContext.tenantId,
            userContext.permissions
          );

        case 'scheduleReport':
          return await this.createSchedule(userContext.userId, userContext.tenantId, args);

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      logger.error({ error, toolName }, 'Tool execution failed');
      return {
        error: true,
        message: `Failed to execute ${toolName}: ${error.message}`,
      };
    }
  }

  /**
   * Check if user has required permission
   */
  hasPermission(userPermissions, required) {
    return (
      userPermissions.includes('*') ||
      userPermissions.includes(required) ||
      userPermissions.includes(required.split(':')[0] + ':*')
    );
  }

  /**
   * Create a report schedule
   */
  async createSchedule(userId, tenantId, { frequency, time, reportType }) {
    const { prisma } = await import('@nexora/database');

    // Check if schedule already exists
    const existing = await prisma.aIAssistantSchedule.findFirst({
      where: {
        userId,
        tenantId,
        scheduleType: this.mapReportTypeToScheduleType(reportType),
        isActive: true,
      },
    });

    if (existing) {
      // Update existing schedule
      await prisma.aIAssistantSchedule.update({
        where: { id: existing.id },
        data: {
          frequency: frequency.toUpperCase(),
          time,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        message: `✅ Updated your ${frequency} ${reportType} report schedule to ${time}`,
      };
    } else {
      // Create new schedule
      await prisma.aIAssistantSchedule.create({
        data: {
          userId,
          tenantId,
          scheduleType: this.mapReportTypeToScheduleType(reportType),
          frequency: frequency.toUpperCase(),
          time,
          timezone: 'Asia/Kolkata',
          isActive: true,
        },
      });

      return {
        success: true,
        message: `✅ Created ${frequency} ${reportType} report schedule at ${time}`,
      };
    }
  }

  /**
   * Map report type to schedule type enum
   */
  mapReportTypeToScheduleType(reportType) {
    const mapping = {
      summary: 'DAILY_SUMMARY',
      sales: 'DAILY_SUMMARY',
      hr: 'DAILY_SUMMARY',
      custom: 'CUSTOM',
    };
    return mapping[reportType] || 'DAILY_SUMMARY';
  }
}
