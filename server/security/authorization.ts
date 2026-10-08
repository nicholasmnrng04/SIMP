import type { FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import type { RoleCode, SessionUser } from '../../shared/contracts.js';
import { AppError } from '../errors.js';
import { sessionCookieName, sessionUser } from '../services/auth.js';

declare module 'fastify' { interface FastifyRequest { currentUser: SessionUser | null } }

export function authorization(db: Pool) {
  const requireUser = async (request: FastifyRequest) => {
    request.currentUser = await sessionUser(db, request.cookies[sessionCookieName]);
    if (!request.currentUser) throw new AppError(401, 'UNAUTHENTICATED', 'Sesi Anda berakhir. Silakan masuk kembali.');
  };
  const requireRoles = (...roles: RoleCode[]) => async (request: FastifyRequest) => {
    await requireUser(request);
    if (!roles.includes(request.currentUser!.role)) throw new AppError(403, 'FORBIDDEN', 'Anda tidak memiliki akses untuk tindakan ini.');
  };
  return { requireUser, requireRoles };
}
