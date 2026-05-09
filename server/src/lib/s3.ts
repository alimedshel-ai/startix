import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION ?? 'me-south-1';
const bucket = process.env.AWS_S3_BUCKET;

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({ region });
  }
  return client;
}

function requireBucket(): string {
  if (!bucket) throw new Error('AWS_S3_BUCKET must be set');
  return bucket;
}

export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string }> {
  await s3().send(
    new PutObjectCommand({
      Bucket: requireBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return { key };
}

export async function presignDownload(key: string, expiresInSec = 300): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: requireBucket(), Key: key });
  return getSignedUrl(s3(), cmd, { expiresIn: expiresInSec });
}

export async function presignUpload(
  key: string,
  contentType: string,
  expiresInSec = 300
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: requireBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: expiresInSec });
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }));
}
