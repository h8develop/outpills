import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

/** Только для ADMIN — все admin-endpoint-ы закрыты этим guard-ом */
@Injectable()
export class AdminGuard extends AuthGuard implements CanActivate {
  constructor(auth: AuthService) {
    super(auth);
  }

  canActivate(context: ExecutionContext): boolean {
    super.canActivate(context);
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Требуются права администратора');
    }
    return true;
  }
}
