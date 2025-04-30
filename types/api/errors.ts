// types/api/errors.ts
export class ApiError {
  static validation(message: string, details?: any) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details,
      },
    };
  }

  static notFound(resource: string, id?: string) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: id ? `${resource} with ID ${id} not found` : `${resource} not found`,
      },
    };
  }

  static internalServerError(error: unknown) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
    };
  }

  static methodNotAllowed(method: string) {
    return {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `Method ${method} is not allowed`,
      },
    };
  }

  static unauthorized(message = 'Unauthorized') {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message,
      },
    };
  }
}
