import { z } from 'zod';

const deleteManySchema = z.object({
  body: z.object({
    ids: z
      .array(z.string().uuid('Invalid file ID format'))
      .min(1, 'Provide at least one file ID'),
  }),
});

const moveFileSchema = z.object({
  body: z.object({
    folderId: z.string().uuid('Invalid folder ID format').nullable(),
  }),
});

const moveManyFilesSchema = z.object({
  body: z.object({
    ids: z
      .array(z.string().uuid('Invalid file ID format'))
      .min(1, 'Provide at least one file ID to move'),
    folderId: z.string().uuid('Invalid folder ID format').nullable(),
  }),
});

const renameFileSchema = z.object({
  body: z.object({
    originalName: z
      .string()
      .trim()
      .min(1, 'File name cannot be empty')
      .max(255, 'File name cannot exceed 255 characters'),
  }),
});

export const UploadedFileValidation = {
  deleteManySchema,
  renameFileSchema,
  moveFileSchema,
  moveManyFilesSchema,
};
