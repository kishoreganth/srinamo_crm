import { z } from 'zod';
import type { IdType } from '@/types';

const ID_TYPES: IdType[] = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID'];

export function asIdType(value?: string): IdType | undefined {
  return ID_TYPES.find((item) => item === value);
}

export const guestPhoneSchema = z
  .string()
  .regex(/^\+\d{8,15}$/, 'Enter the phone number');

export const guestEmailSchema = z
  .string()
  .optional()
  .transform((value) => (value ?? '').trim())
  .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email');
