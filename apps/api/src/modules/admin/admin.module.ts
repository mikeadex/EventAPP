import { Controller, Module } from '@nestjs/common';

@Controller('admin')
class AdminController {
  // Platform admin endpoints — gated by PLATFORM_ADMIN role. Built in Phase 3.
}

@Module({ controllers: [AdminController] })
export class AdminModule {}
