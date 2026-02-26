import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../lib/env.js";

const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), "storage");

const client = env.STORAGE_MODE === "s3"
  ? new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!
      }
    })
  : null;

export async function createUploadUrl(input: { mimeType: string; folder: string }): Promise<{
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
}> {
  const extension = input.mimeType.split("/")[1] ?? "bin";
  const objectKey = `${input.folder}/${randomUUID()}.${extension}`;

  if (env.STORAGE_MODE === "local") {
    const uploadUrl = `${env.API_PUBLIC_URL}/uploads/local/${objectKey}`;
    const publicUrl = `${env.API_PUBLIC_URL}/uploads/local/${objectKey}`;
    return { objectKey, uploadUrl, publicUrl };
  }

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET!,
    Key: objectKey,
    ContentType: input.mimeType
  });

  const uploadUrl = await getSignedUrl(client!, command, { expiresIn: 300 });
  const publicUrl = env.S3_PUBLIC_BASE_URL
    ? `${env.S3_PUBLIC_BASE_URL}/${objectKey}`
    : `s3://${env.S3_BUCKET}/${objectKey}`;

  return { objectKey, uploadUrl, publicUrl };
}

export async function createReadUrl(objectKey: string): Promise<string> {
  if (env.STORAGE_MODE === "local") {
    return `${env.API_PUBLIC_URL}/uploads/local/${objectKey}`;
  }
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET!, Key: objectKey });
  return getSignedUrl(client!, command, { expiresIn: 600 });
}

export async function writeLocalObject(objectKey: string, content: Buffer): Promise<void> {
  const fullPath = path.resolve(LOCAL_STORAGE_ROOT, objectKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

export function getLocalStorageRoot(): string {
  return LOCAL_STORAGE_ROOT;
}
