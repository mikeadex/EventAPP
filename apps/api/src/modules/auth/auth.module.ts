import { All, Controller, Global, Module, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getAuth } from './auth.js';
import { CurrentUserService } from './current-user.service.js';

/**
 * Better Auth exposes its own request handler. We mount it under /auth/*
 * (outside the /v1 prefix) so its built-in routes (e.g. /auth/sign-in/email)
 * keep their expected paths.
 */
@Controller('auth')
class AuthHandlerController {
  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body:
        req.method === 'GET' || req.method === 'HEAD'
          ? undefined
          : JSON.stringify(req.body),
    });
    const auth = await getAuth();
    const response = await auth.handler(request);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const body = await response.text();
    res.send(body);
  }
}

@Global()
@Module({
  controllers: [AuthHandlerController],
  providers: [CurrentUserService],
  exports: [CurrentUserService],
})
export class AuthModule {}
