// lib/dynamoClient.js
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

let cachedClient = null;

export function getDynamoClient() {
  if (cachedClient) return cachedClient;

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
  });

  cachedClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true }
  });

  return cachedClient;
}

export const RATINGS_TABLE = process.env.DYNAMODB_RATINGS_TABLE || 'dad-jokes-ratings-prod';
export const STATS_TABLE = process.env.DYNAMODB_STATS_TABLE || 'dad-jokes-stats-prod';

export { GetCommand, PutCommand, QueryCommand, UpdateCommand };