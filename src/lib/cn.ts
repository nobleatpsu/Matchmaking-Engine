import { clsx, type ClassValue } from 'clsx';

export const cn = (...xs: ClassValue[]) => clsx(xs);
