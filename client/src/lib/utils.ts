import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind class names safely.
 * Combines clsx (conditional joining) with tailwind-merge (conflict resolution).
 *
 * Adapted verbatim from the takehome starter so component conventions match.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
