import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { uploadMiddleware } from '../Upload/upload.middleware';
import { UploadedFileService } from './uploadedFile.service';
import { UploadedFileValidation } from './uploadedFile.validation';

const router = express.Router();

// The media library is a back-office tool: every route is staff only.
// `auth` runs before `uploadMiddleware` so anonymous requests are rejected
// before any file is buffered into memory.

router.get(
  '/',
  auth('SUPERADMIN', 'ADMIN'),
  UploadedFileService.getAllUploadedFiles,
);

router.post(
  '/',
  auth('SUPERADMIN', 'ADMIN'),
  uploadMiddleware.array('files', { maxFiles: 20 }),
  UploadedFileService.uploadFiles,
);

router.put(
  '/:id/replace',
  auth('SUPERADMIN', 'ADMIN'),
  uploadMiddleware.single('file', { isRequired: true }),
  UploadedFileService.replaceUploadedFile,
);

router.patch(
  '/move',
  auth('SUPERADMIN', 'ADMIN'),
  validateRequest.body(UploadedFileValidation.moveManyFilesSchema),
  UploadedFileService.moveManyFiles,
);

router.patch(
  '/:id/move',
  auth('SUPERADMIN', 'ADMIN'),
  validateRequest.body(UploadedFileValidation.moveFileSchema),
  UploadedFileService.moveFile,
);

router.patch(
  '/:id',
  auth('SUPERADMIN', 'ADMIN'),
  validateRequest.body(UploadedFileValidation.renameFileSchema),
  UploadedFileService.renameFile,
);

router.delete(
  '/',
  auth('SUPERADMIN', 'ADMIN'),
  validateRequest.body(UploadedFileValidation.deleteManySchema),
  UploadedFileService.deleteManyUploadedFiles,
);

router.delete(
  '/:id',
  auth('SUPERADMIN', 'ADMIN'),
  UploadedFileService.deleteUploadedFile,
);

export const UploadedFileRoutes = router;
