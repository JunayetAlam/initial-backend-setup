import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

type PrismaErrorPayload = {
  statusCode: number;
  message: string;
  errorDetails: Record<string, unknown>;
};

type KnownErrorHandler = (
  err: Prisma.PrismaClientKnownRequestError,
) => PrismaErrorPayload;

function formatMetaValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value)) return value.map(String).join(', ');
  return fallback;
}

const KNOWN_ERROR_HANDLERS: Record<string, KnownErrorHandler> = {
  P2002: (err) => {
    const target = formatMetaValue(err.meta?.target, 'unknown');
    return {
      statusCode: HttpStatus.CONFLICT,
      message: `Duplicate entity on the fields: ${target}`,
      errorDetails: { code: err.code, target: err.meta?.target },
    };
  },
  P2003: (err) => ({
    statusCode: HttpStatus.BAD_REQUEST,
    message: `Foreign key constraint failed on the field: ${formatMetaValue(err.meta?.field_name, 'unknown')}`,
    errorDetails: {
      code: err.code,
      field: err.meta?.field_name,
      model: err.meta?.modelName,
    },
  }),
  P2011: (err) => ({
    statusCode: HttpStatus.BAD_REQUEST,
    message: `Null constraint violation on the field: ${formatMetaValue(err.meta?.field_name, 'unknown')}`,
    errorDetails: { code: err.code, field: err.meta?.field_name },
  }),
  P2025: (err) => ({
    statusCode: HttpStatus.NOT_FOUND,
    message: `${formatMetaValue(err.meta?.modelName, 'Record')} Not Found!!`,
    errorDetails: { code: err.code, cause: err.meta?.cause },
  }),
};

function formatPrismaValidationError(
  err: Prisma.PrismaClientValidationError,
): PrismaErrorPayload {
  const rawMessage = err.message || 'Prisma validation error occurred.';
  let message = 'Validation error in Prisma operation';
  let suggestion = '';

  const missingFieldMatch = rawMessage.match(/Argument `(\w+)` is missing/);
  if (missingFieldMatch) {
    const field = missingFieldMatch[1];
    message = `Prisma error: The "${field}" field is required in the create/update query.`;
    suggestion = `Provide "${field}" inside the query \`data\` object.`;
  } else if (rawMessage.includes('Argument `data` is missing')) {
    message =
      'Prisma error: The "data" property is required in create/update queries.';
    suggestion = 'Include a `data` object in your create/update query.';
  } else if (rawMessage.includes('Unknown arg')) {
    message = 'Prisma error: You passed an invalid field to the query.';
    suggestion = 'Check your field names in the `data` object.';
  }

  return {
    statusCode: HttpStatus.BAD_REQUEST,
    message,
    errorDetails: { fullError: rawMessage, suggestion },
  };
}

/** Maps Prisma request and validation errors to the standard API error response shape. */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError
      | Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<Response>();
    const payload = this.buildPayload(exception);

    response.status(payload.statusCode).json({
      success: false,
      message: payload.message,
      errorDetails: payload.errorDetails,
      statusCode: payload.statusCode,
    });
  }

  private buildPayload(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError
      | Prisma.PrismaClientUnknownRequestError,
  ): PrismaErrorPayload {
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return formatPrismaValidationError(exception);
    }

    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message,
        errorDetails: { message: exception.message },
      };
    }

    const handler = KNOWN_ERROR_HANDLERS[exception.code];
    if (handler) {
      return handler(exception);
    }

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: exception.message,
      errorDetails: { code: exception.code, meta: exception.meta },
    };
  }
}
