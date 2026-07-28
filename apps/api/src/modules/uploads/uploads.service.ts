import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomId } from '../../common/random-id.js';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const MAX_BYTES_BY_PURPOSE: Record<UploadPurpose, number> = {
  event_cover: 8 * 1024 * 1024, // 8 MB
  org_logo: 2 * 1024 * 1024, // 2 MB
  user_avatar: 2 * 1024 * 1024, // 2 MB
};

export type UploadPurpose = 'event_cover' | 'org_logo' | 'user_avatar';

export interface PresignInput {
  purpose: UploadPurpose;
  contentType: string;
  byteSize: number;
}

export interface PresignOutput {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicBase: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION ?? 'eu-west-2';
    const bucket = process.env.S3_BUCKET ?? '';
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    this.bucket = bucket;
    this.endpoint = endpoint ?? '';
    this.publicBase = process.env.S3_PUBLIC_BASE ?? endpoint ?? '';

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'S3 not fully configured — POST /v1/uploads/sign will return 503 until S3_* env vars are set.',
      );
      this.client = null;
      return;
    }

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      // MinIO requires path-style addressing; real AWS S3 accepts it too.
      forcePathStyle: true,
    });
  }

  async presign(userId: string, input: PresignInput): Promise<PresignOutput> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Object storage is not configured. Set S3_* env vars and restart.',
      );
    }
    if (!ALLOWED_TYPES.has(input.contentType)) {
      throw new BadRequestException(
        `Content type '${input.contentType}' not allowed. Use PNG, JPEG, WebP, or GIF.`,
      );
    }
    const max = MAX_BYTES_BY_PURPOSE[input.purpose];
    if (input.byteSize > max) {
      throw new BadRequestException(
        `File too large (max ${Math.round(max / 1024 / 1024)} MB for ${input.purpose}).`,
      );
    }

    const ext = extensionForContentType(input.contentType);
    const key = `${input.purpose}/${userId.slice(0, 8)}/${randomId(16)}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.byteSize,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    const publicUrl = `${this.publicBase.replace(/\/$/, '')}/${this.bucket}/${key}`;
    return { uploadUrl, publicUrl, key, expiresIn: 300 };
  }
}

function extensionForContentType(ct: string): string {
  switch (ct) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '';
  }
}
