import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { JwtPayload } from './auth.service';
import { authCookieOptions } from './cookie.options';

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  firstName?: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Жёсткий rate limit на auth-endpoint-ы — защита от перебора
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto.email, dto.password, dto.firstName);
    res.cookie('access_token', result.accessToken, authCookieOptions());
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    res.cookie('access_token', result.accessToken, authCookieOptions());
    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', authCookieOptions());
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return { id: user.sub, email: user.email, role: user.role };
  }
}
