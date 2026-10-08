import { z } from 'zod';
import { roleCodes } from './contracts.js';

const email = z.string().trim().min(1, 'Email wajib diisi.').email('Masukkan alamat email yang valid.').max(254, 'Email terlalu panjang.').transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(12, 'Kata sandi minimal 12 karakter.').max(128, 'Kata sandi maksimal 128 karakter.');
export const loginSchema = z.object({
  email, password: z.string().min(1, 'Kata sandi wajib diisi.').max(128, 'Kata sandi maksimal 128 karakter.'),
}).strict();
const userFields = {
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(120, 'Nama maksimal 120 karakter.'),
  email, role: z.enum(roleCodes, { error: 'Pilih role yang tersedia.' }),
  isActive: z.boolean({ error: 'Status akun tidak valid.' }),
};
export const createUserSchema = z.object({ ...userFields, password: passwordSchema }).strict();
export const updateUserSchema = z.object({ ...userFields, password: passwordSchema.optional() }).strict();
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
