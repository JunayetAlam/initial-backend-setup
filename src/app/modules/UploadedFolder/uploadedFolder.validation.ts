import { z } from 'zod';

const createFolderSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Folder name cannot be empty')
      .max(100, 'Folder name cannot exceed 100 characters'),
    parentId: z.string().uuid('Invalid parentId format').nullable().optional(),
  }),
});

const updateFolderSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'Folder name cannot be empty')
        .max(100, 'Folder name cannot exceed 100 characters')
        .optional(),
      parentId: z
        .string()
        .uuid('Invalid parentId format')
        .nullable()
        .optional(),
    })
    .refine(data => data.name !== undefined || data.parentId !== undefined, {
      message: 'Provide at least name or parentId to update',
    }),
});

export const UploadedFolderValidation = {
  createFolderSchema,
  updateFolderSchema,
};
