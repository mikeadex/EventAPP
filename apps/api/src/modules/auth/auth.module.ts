import { All, Controller, Get, Global, Module, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getAuth } from './auth.js';
import { CurrentUserService } from './current-user.service.js';
import { enabledSocialProviders } from './social-providers.js';
import { NativeAuthController } from './native-handoff.controller.js';
import { SocialStartController } from './social-start.controller.js';

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

/**
 * What this deployment can actually do, for clients to read before rendering.
 *
 * Social sign-in is the first entry: a provider whose credentials are missing
 * simply has no button, rather than a button that dead-ends at a broken consent
 * screen. Exposes provider ids only — never client ids or secrets.
 *
 * Not under `auth/` because Better Auth owns that path with a catch-all, and
 * not `v1/...` because the global prefix would double it to /v1/v1.
 */
@Controller('config')
class DeploymentConfigController {
  @Get()
  config() {
    return { socialProviders: enabledSocialProviders() };
  }
}

@Global()
@Module({
  controllers: [
    AuthHandlerController,
    DeploymentConfigController,
    NativeAuthController,
    SocialStartController,
  ],
  providers: [CurrentUserService],
  exports: [CurrentUserService],
})
export class AuthModule {}
