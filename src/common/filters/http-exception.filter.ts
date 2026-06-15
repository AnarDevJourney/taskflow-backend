import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    // class-validator errors come as an array inside exceptionResponse.message
    const message = isHttpException
      ? typeof exceptionResponse === 'object' &&
        'message' in (exceptionResponse as object)
        ? (exceptionResponse as any).message
        : exception.message
      : 'Internal server error';

    // log 5xx errors
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} — ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      success: false,
      error: {
        statusCode,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
