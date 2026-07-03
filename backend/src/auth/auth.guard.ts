import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

/** Достаёт JWT из cookie `access_token` или заголовка Authorization: Bearer */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Требуется авторизация');
    (req as any).user = this.auth.verify(token);
    return true;
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return (req as any).cookies?.access_token ?? null;
  }
}
