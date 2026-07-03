import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string, firstName?: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Пользователь с таким email уже существует');

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName,
      },
    });
    return this.issueToken(user.id, user.email, user.role);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    return this.issueToken(user.id, user.email, user.role);
  }

  private issueToken(sub: string, email: string, role: string) {
    const payload: JwtPayload = { sub, email, role: role as JwtPayload['role'] };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: sub, email, role },
    };
  }

  verify(token: string): JwtPayload {
    try {
      return this.jwt.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Невалидный или истёкший токен');
    }
  }
}
