import { UploadsService } from './uploads.service';

describe('UploadsService.presign', () => {
  const saved = { ...process.env };

  beforeAll(() => {
    process.env.S3_ENDPOINT = 's3.eu-central-003.backblazeb2.com';
    process.env.S3_REGION = 'eu-central-003';
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_ACCESS_KEY = 'test-access-key';
    process.env.S3_SECRET_KEY = 'test-secret-key';
  });

  afterAll(() => {
    process.env = saved;
  });

  it('does not sign a checksum of an empty body into the upload URL', async () => {
    const out = await new UploadsService().presign('user-1234567890', {
      purpose: 'org_logo',
      contentType: 'image/png',
      byteSize: 1234,
    });
    const url = new URL(out.uploadUrl);
    expect(url.host).toBe('s3.eu-central-003.backblazeb2.com');
    expect(url.pathname.startsWith('/test-bucket/org_logo/')).toBe(true);
    const params = [...url.searchParams.keys()].map((k) => k.toLowerCase());
    expect(params.some((k) => k.startsWith('x-amz-checksum'))).toBe(false);
    expect(params).not.toContain('x-amz-sdk-checksum-algorithm');
  });
});
