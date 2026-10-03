import path from 'node:path';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export interface AppDependencies {
  staticDir?: string;
  registerRoutes?: (app: express.Express) => void;
}

const asyncNotFound: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${request.method} ${request.path}.`,
    },
  });
};

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (
    error instanceof Error &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    response.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' },
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'The request body must be valid JSON.' },
    });
    return;
  }

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      fieldErrors[issue.path.join('.') || 'request'] ??= issue.message;
    }
    response.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fieldErrors },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
    });
    return;
  }

  if (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    if (error.code === 'DUPLICATE_URL' && 'existingBookmark' in error) {
      response.status(error.statusCode).json({
        error: { code: error.code, message: error.message },
        existingBookmark: error.existingBookmark,
      });
      return;
    }

    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  console.error('Unhandled application error', error instanceof Error ? error.message : error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'The operation could not be completed.' },
  });
};

export function createApp(dependencies: AppDependencies = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  dependencies.registerRoutes?.(app);

  if (dependencies.staticDir) {
    const indexFile = path.join(dependencies.staticDir, 'index.html');
    app.use(
      '/assets',
      express.static(path.join(dependencies.staticDir, 'assets'), {
        index: false,
        maxAge: '1y',
        immutable: true,
      }),
    );
    app.use(
      express.static(dependencies.staticDir, {
        index: false,
        maxAge: 0,
        setHeaders: (response) => response.setHeader('Cache-Control', 'no-store'),
      }),
    );
    app.get('/{*splat}', (_request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      response.sendFile(indexFile);
    });
  } else {
    app.use(asyncNotFound);
  }

  app.use(errorHandler);
  return app;
}
