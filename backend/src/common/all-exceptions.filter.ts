import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Структурированные ошибки API — единый формат:
 * { statusCode, error, message, details?, path, timestamp }
 * Внутренние ошибки не протекают наружу (в проде — generic message).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Внутренняя ошибка сервера';
    let error = 'InternalServerError';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        error = (b.error as string) ?? exception.name;
        details = b.details;
      }
    } else {
      // Логируем незапланированные ошибки с трейсом — их видит мониторинг
      this.logger.error(
        `Unhandled: ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      ...(details !== undefined ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
