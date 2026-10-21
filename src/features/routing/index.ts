// Routing (4b): the only way into this feature. Typed as the agreed meeting point, so a change that breaks 5b's
// contract fails the type-check here.
import type { CreateRouter } from '@/shared/data/route';
import { createRouter as create } from './router';

export const createRouter: CreateRouter = create;
