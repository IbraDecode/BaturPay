/**
 * Modul: API — Error handling plugin
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { isBaturPayError } from '@baturpay/core';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const err = error as unknown as Record<string, unknown> & { message: string };

    if (error instanceof ZodError) {
      void reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request failed validation',
          details: { issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
        },
      });
      return;
    }

    if (isBaturPayError(error)) {
      void reply.status(error.status).send({ error: error.toJSON() });
      return;
    }

    if (err.validation) {
      void reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: err.message },
      });
      return;
    }

    request.log.error({ err: error }, 'unhandled error');
    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Route not found: ${request.method} ${request.url}` },
    });
  });
}
