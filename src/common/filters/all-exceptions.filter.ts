import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Request, Response } from 'express';

/**
 * Phase 6 — Global Exception Filter
 *
 * Normalizes ALL exceptions (HTTP, runtime, proxy errors) into a consistent
 * JSON error response for the mobile client.
 *
 * Response format:
 * { statusCode, error, message, timestamp, path, requestId }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || 'N/A';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? (exception.getResponse() as any)
        : null;

    const rawMessage =
      exceptionResponse?.message ||
      (exception instanceof Error ? exception.message : 'Internal server error');

    const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;

    const errorType =
      exceptionResponse?.error ||
      (exception instanceof HttpException ? exception.name : 'InternalServerError');

    // Resolve target service for 503 errors traceability
    const targetService = this.resolveTargetService(request.url);

    const errorResponse = {
      statusCode: status,
      error: errorType,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    // Structured error log (JSON-compatible for ELK)
    const logPayload = {
      service: 'api-gateway',
      requestId,
      method: request.method,
      path: request.url,
      statusCode: status,
      error: errorType,
      message,
      targetService,
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error('Unhandled exception', logPayload);
    } else if (status === 429) {
      this.logger.warn('Rate limit exceeded', logPayload);
    } else {
      this.logger.warn('Client error', logPayload);
    }

    response.status(status).json(errorResponse);
  }

  private resolveTargetService(url: string): string {
    if (url.startsWith('/auth') || url.startsWith('/users')) return 'auth-service';
    if (url.startsWith('/flights') || url.startsWith('/bookings') || url.startsWith('/passengers')) return 'flight-service';
    if (url.startsWith('/checkin') || url.startsWith('/seats')) return 'checkin-service';
    if (url.startsWith('/ocr')) return 'ocr-service';
    if (url.startsWith('/boarding-passes')) return 'boarding-pass-service';
    return 'api-gateway';
  }
}
