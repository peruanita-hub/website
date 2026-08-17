import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Une clases y resuelve conflictos de Tailwind (la última gana), igual
 * que el helper `cn` de shadcn/ui. Permite que quien usa un componente
 * pase `class="..."` para sobreescribir sin pelear con la especificidad.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
