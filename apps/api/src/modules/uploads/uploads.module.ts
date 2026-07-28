import { Body, Controller, Module, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { UploadsService } from './uploads.service.js';

const PresignSchema = z.object({
  purpose: z.enum(['event_cover', 'org_logo', 'user_avatar']),
  contentType: z.string().min(1).max(120),
  byteSize: z.number().int().positive().max(50 * 1024 * 1024),
});

@Controller('uploads')
@UseGuards(AuthGuard)
class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * Returns a short-lived PUT URL the client uses to upload directly to S3.
   * The API never sees the file bytes. The client then passes `publicUrl`
   * back to whatever endpoint stores the reference (event create, etc.).
   */
  @Post('sign')
  async sign(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = PresignSchema.parse(body);
    return this.uploads.presign(req.user.id, input);
  }
}

@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
