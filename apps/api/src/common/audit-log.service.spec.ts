import type { Request } from 'express';
import { AuditLogService } from './audit-log.service.js';

function setup() {
  const create = jest.fn().mockResolvedValue({});
  const svc = new AuditLogService({ auditLog: { create } } as never);
  return { svc, create };
}

const req = (headers: Record<string, string | string[]>, remoteAddress = '10.0.0.9') =>
  ({ headers, socket: { remoteAddress } }) as unknown as Request;

describe('AuditLogService client IP', () => {
  it('uses the right-most X-Forwarded-For entry, never the client-supplied left-most', async () => {
    const { svc, create } = setup();
    await svc.write({
      action: 'host.claim',
      req: req({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1, 203.0.113.7', 'user-agent': 'ua' }),
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ipAddress: '203.0.113.7', userAgent: 'ua' }),
    });
  });

  it('prefers x-vercel-forwarded-for, then x-real-ip', async () => {
    const { svc, create } = setup();
    await svc.write({
      action: 'a',
      req: req({
        'x-vercel-forwarded-for': '192.0.2.1',
        'x-real-ip': '192.0.2.2',
        'x-forwarded-for': '6.6.6.6',
      }),
    });
    await svc.write({ action: 'a', req: req({ 'x-real-ip': '192.0.2.2', 'x-forwarded-for': '6.6.6.6' }) });
    expect(create.mock.calls[0][0].data.ipAddress).toBe('192.0.2.1');
    expect(create.mock.calls[1][0].data.ipAddress).toBe('192.0.2.2');
  });

  it('falls back to the socket address, and to nothing without a request', async () => {
    const { svc, create } = setup();
    await svc.write({ action: 'a', req: req({}) });
    await svc.write({ action: 'a' });
    expect(create.mock.calls[0][0].data.ipAddress).toBe('10.0.0.9');
    expect(create.mock.calls[1][0].data.ipAddress).toBeUndefined();
  });
});
