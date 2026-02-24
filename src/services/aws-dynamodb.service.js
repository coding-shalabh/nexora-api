/**
 * AWS DynamoDB Service
 * Handles NoSQL database operations for sessions, cache, and high-speed data
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../common/logger.js';

// Initialize DynamoDB client lazily (credentials loaded from AWS Secrets Manager)
let dynamoDBClient = null;
let docClient = null;

function getDynamoDBClient() {
  if (!dynamoDBClient) {
    const region = process.env.AWS_REGION || 'ap-south-1';

    dynamoDBClient = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    docClient = DynamoDBDocumentClient.from(dynamoDBClient);
  }

  return docClient;
}

export class DynamoDBService {
  /**
   * Put item into DynamoDB table
   * @param {string} tableName - Table name
   * @param {Object} item - Item to store
   */
  static async putItem(tableName, item) {
    try {
      const command = new PutCommand({
        TableName: tableName,
        Item: item,
      });

      await getDynamoDBClient().send(command);

      logger.info({ tableName, itemId: item.id }, 'Item stored in DynamoDB');
      return { success: true };
    } catch (error) {
      logger.error({ error, tableName }, 'Failed to put item in DynamoDB');
      throw new Error(`DynamoDB put failed: ${error.message}`);
    }
  }

  /**
   * Get item from DynamoDB table
   * @param {string} tableName - Table name
   * @param {Object} key - Primary key
   */
  static async getItem(tableName, key) {
    try {
      const command = new GetCommand({
        TableName: tableName,
        Key: key,
      });

      const response = await getDynamoDBClient().send(command);

      logger.info({ tableName, key }, 'Item retrieved from DynamoDB');
      return response.Item;
    } catch (error) {
      logger.error({ error, tableName, key }, 'Failed to get item from DynamoDB');
      throw new Error(`DynamoDB get failed: ${error.message}`);
    }
  }

  /**
   * Update item in DynamoDB table
   * @param {string} tableName - Table name
   * @param {Object} key - Primary key
   * @param {Object} updates - Fields to update
   */
  static async updateItem(tableName, key, updates) {
    try {
      // Build update expression dynamically
      const updateExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.keys(updates).forEach((field, index) => {
        const placeholder = `#field${index}`;
        const valuePlaceholder = `:val${index}`;
        updateExpressions.push(`${placeholder} = ${valuePlaceholder}`);
        expressionAttributeNames[placeholder] = field;
        expressionAttributeValues[valuePlaceholder] = updates[field];
      });

      const command = new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const response = await getDynamoDBClient().send(command);

      logger.info({ tableName, key }, 'Item updated in DynamoDB');
      return response.Attributes;
    } catch (error) {
      logger.error({ error, tableName, key }, 'Failed to update item in DynamoDB');
      throw new Error(`DynamoDB update failed: ${error.message}`);
    }
  }

  /**
   * Delete item from DynamoDB table
   * @param {string} tableName - Table name
   * @param {Object} key - Primary key
   */
  static async deleteItem(tableName, key) {
    try {
      const command = new DeleteCommand({
        TableName: tableName,
        Key: key,
      });

      await getDynamoDBClient().send(command);

      logger.info({ tableName, key }, 'Item deleted from DynamoDB');
      return { success: true };
    } catch (error) {
      logger.error({ error, tableName, key }, 'Failed to delete item from DynamoDB');
      throw new Error(`DynamoDB delete failed: ${error.message}`);
    }
  }

  /**
   * Query items from DynamoDB table
   * @param {string} tableName - Table name
   * @param {Object} keyCondition - Query condition
   * @param {Object} options - Additional query options
   */
  static async queryItems(tableName, keyCondition, options = {}) {
    try {
      const command = new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: keyCondition.expression,
        ExpressionAttributeNames: keyCondition.names,
        ExpressionAttributeValues: keyCondition.values,
        Limit: options.limit,
        ScanIndexForward: options.ascending !== false,
      });

      const response = await getDynamoDBClient().send(command);

      logger.info({ tableName, count: response.Items.length }, 'Items queried from DynamoDB');
      return response.Items;
    } catch (error) {
      logger.error({ error, tableName }, 'Failed to query items from DynamoDB');
      throw new Error(`DynamoDB query failed: ${error.message}`);
    }
  }

  /**
   * Scan table (use sparingly, can be expensive)
   * @param {string} tableName - Table name
   * @param {Object} options - Scan options
   */
  static async scanTable(tableName, options = {}) {
    try {
      const command = new ScanCommand({
        TableName: tableName,
        Limit: options.limit || 100,
        FilterExpression: options.filterExpression,
        ExpressionAttributeNames: options.expressionAttributeNames,
        ExpressionAttributeValues: options.expressionAttributeValues,
      });

      const response = await getDynamoDBClient().send(command);

      logger.warn(
        { tableName, count: response.Items.length },
        'Table scanned in DynamoDB (expensive operation)'
      );
      return response.Items;
    } catch (error) {
      logger.error({ error, tableName }, 'Failed to scan table in DynamoDB');
      throw new Error(`DynamoDB scan failed: ${error.message}`);
    }
  }

  /**
   * Store user session in DynamoDB
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data
   * @param {number} ttl - Time to live in seconds
   */
  static async storeSession(sessionId, sessionData, ttl = 86400) {
    const tableName = process.env.AWS_DYNAMODB_SESSIONS_TABLE || 'nexora-sessions';
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;

    return this.putItem(tableName, {
      sessionId, // Use 'sessionId' as primary key (not 'id')
      ...sessionData,
      ttl: expiresAt,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Get user session from DynamoDB
   * @param {string} sessionId - Session ID
   */
  static async getSession(sessionId) {
    const tableName = process.env.AWS_DYNAMODB_SESSIONS_TABLE || 'nexora-sessions';
    return this.getItem(tableName, { sessionId }); // Use 'sessionId' key
  }

  /**
   * Delete user session
   * @param {string} sessionId - Session ID
   */
  static async deleteSession(sessionId) {
    const tableName = process.env.AWS_DYNAMODB_SESSIONS_TABLE || 'nexora-sessions';
    return this.deleteItem(tableName, { sessionId }); // Use 'sessionId' key
  }
}

export default DynamoDBService;
