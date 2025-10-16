import { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'

const S3_BUCKET_ENV_VARS = [
  'DAD_AWS_S3_BUCKET',
  'AWS_S3_BUCKET',
  'S3_BUCKET_NAME',
  'S3_BUCKET'
]

const S3_REGION_ENV_VARS = [
  'AWS_REGION',
  'AWS_DEFAULT_REGION',
  'S3_REGION',
  'S3_BUCKET_REGION'
]

const s3Bucket = S3_BUCKET_ENV_VARS.map((key) => process.env[key]).find(Boolean) || null
const s3Region = S3_REGION_ENV_VARS.map((key) => process.env[key]).find(Boolean) || null

const s3Client = s3Bucket
  ? new S3Client({
      ...(s3Region ? { region: s3Region } : {})
    })
  : null

const storageConfigured = Boolean(s3Client && s3Bucket)

if (!storageConfigured && process.env.NODE_ENV !== 'test') {
  const globalWarnKey = '__s3StorageWarned__'
  if (!globalThis[globalWarnKey]) {
    globalThis[globalWarnKey] = true
    console.warn(
      `[storage] S3 bucket configuration missing; checked env vars: ${S3_BUCKET_ENV_VARS.join(', ')}`
    )
  }
}

function isNotFoundError(error) {
  if (!error) {
    return false
  }
  const status = error?.$metadata?.httpStatusCode
  if (status === 404) {
    return true
  }
  const code = error?.Code || error?.name || error?.code
  return code === 'NoSuchKey' || code === 'NotFound'
}

async function getObjectJson(key) {
  if (!storageConfigured) {
    return null
  }
  try {
    const command = new GetObjectCommand({ Bucket: s3Bucket, Key: key })
    const response = await s3Client.send(command)
    if (!response?.Body) {
      return null
    }
    const text = await response.Body.transformToString()
    if (!text) {
      return null
    }
    return JSON.parse(text)
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }
    throw error
  }
}

async function putObjectJson(key, payload, { cacheControl, contentType } = {}) {
  if (!storageConfigured) {
    return
  }
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/json',
    ...(cacheControl ? { CacheControl: cacheControl } : {})
  })
  await s3Client.send(command)
}

async function listObjectKeys(prefix) {
  if (!storageConfigured) {
    return []
  }
  const keys = []
  let continuationToken
  do {
    const command = new ListObjectsV2Command({
      Bucket: s3Bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    })
    const response = await s3Client.send(command)
    if (Array.isArray(response?.Contents)) {
      for (const item of response.Contents) {
        if (item?.Key) {
          keys.push(item.Key)
        }
      }
    }
    continuationToken = response?.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)
  return keys
}

export { getObjectJson, listObjectKeys, putObjectJson, storageConfigured }
