import type { LoggerService } from '@nestjs/common';
/** Log metadata, never serialize arbitrary errors, bodies or credential values. */
export class JsonLogger implements LoggerService {
  private write(level: string, message: unknown, context?: string) {
    const text =
      typeof message === 'string'
        ? message
        : message instanceof Error
          ? message.constructor.name
          : 'Structured event';
    const redacted = text
      .replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/gi, '[REDACTED_DATABASE_URL]')
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
      .replace(
        /(password|passwordHash|access_token|JWT_SECRET)["']?\s*[:=]\s*[^,\s}]+/gi,
        '$1=[REDACTED]',
      );
    console.log(
      JSON.stringify({
        level,
        message: redacted,
        ...(context ? { context } : {}),
      }),
    );
  }
  log(message: unknown, context?: string) {
    this.write('info', message, context);
  }
  error(message: unknown, _trace?: string, context?: string) {
    this.write('error', message, context);
  }
  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string) {
    this.write('debug', message, context);
  }
}
