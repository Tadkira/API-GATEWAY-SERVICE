import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';

/**
 * Phase 6 — Global Logging Interceptor
 *
 * - Generates / propagates a unique X-Request-ID (UUID v4) per request
 * - Logs inbound requests and outbound responses in structured JSON (ELK-compatible)
 * - Injects X-User-Id header for downstream traceability
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Generate or reuse existing Request ID
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-ID', requestId);

    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const userId = request.headers['x-user-id'] || 'anonymous';
    const now = Date.now();

    // Structured inbound log (JSON-compatible for ELK)
    this.logger.info('Inbound request', {
      service: 'api-gateway',
      requestId,
      method,
      path: url,
      ip,
      userAgent,
      userId,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          const statusCode = response.statusCode;

          // Derive target service from path prefix
          const targetService = this.resolveTargetService(url);

          this.logger.info('Outbound response', {
            service: 'api-gateway',
            requestId,
            method,
            path: url,
            statusCode,
            duration: `${duration}ms`,
            targetService,
          });
        },
        error: (err) => {
          const duration = Date.now() - now;
          const targetService = this.resolveTargetService(url);

          this.logger.error('Request failed', {
            service: 'api-gateway',
            requestId,
            method,
            path: url,
            duration: `${duration}ms`,
            targetService,
            error: err?.message || 'Unknown error',
          });
        },
      }),
    );
  }

  /**
   * Resolve which downstream service is targeted based on request path.
   * Used in logs to identify the source of 503 errors.
   */
  private resolveTargetService(url: string): string {
    if (url.startsWith('/auth') || url.startsWith('/users')) return 'auth-service';
    if (url.startsWith('/flights') || url.startsWith('/bookings') || url.startsWith('/passengers')) return 'flight-service';
    if (url.startsWith('/checkin') || url.startsWith('/seats')) return 'checkin-service';
    if (url.startsWith('/ocr')) return 'ocr-service';
    if (url.startsWith('/boarding-passes')) return 'boarding-pass-service';
    return 'api-gateway';
  }
}
