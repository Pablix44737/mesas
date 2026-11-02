import type { Guion } from '../tipos';
import { lider } from './lider';
import { participante } from './participante';

/** Los videos que hay, por el nombre que se pide en `/video?v=…`. */
export const guiones: Record<string, Guion> = { lider, participante };
