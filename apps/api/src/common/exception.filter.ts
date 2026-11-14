import type { ApiError } from '@lmbs/shared';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiError');
  catch(exception: unknown, host: ArgumentsHost) {
    let status = 500;
    let message: string | string[] = 'Internal server error';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = 400;
      message = 'Invalid resource data';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        status = 404;
        message = 'Resource not found';
      } else if (['P2002', 'P2003', 'P2034'].includes(exception.code)) {
        status = 409;
        message = 'Conflicting or related resource';
      } else if (exception.code === 'P2004') {
        status = 400;
        message = 'Invalid resource state';
      }
    }
    // Never log request bodies, credentials, tokens, query strings, or raw database errors.
    this.logger.warn(
      JSON.stringify({
        event: 'request_error',
        statusCode: status,
        kind:
          exception instanceof Error ? exception.constructor.name : 'Unknown',
      }),
    );
    const body: ApiError = {
      statusCode: status,
      message: Array.isArray(message) ? 'Validation failed' : message,
      error: HttpStatus[status] ?? 'Error',
      details: Array.isArray(message)
        ? message.map((text) => ({
            field: text.startsWith('property ')
              ? text.split(' ')[1]
              : text.split(' ')[0],
            message: text,
          }))
        : [],
    };
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }
}
