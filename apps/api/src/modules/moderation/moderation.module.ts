import { Controller, Module } from '@nestjs/common';

@Controller('moderation')
class ModerationController {
  // Report submission, review queue, actions — built in Phase 3.
}

@Module({ controllers: [ModerationController] })
export class ModerationModule {}
