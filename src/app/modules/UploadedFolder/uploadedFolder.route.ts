import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { UploadedFolderService } from './uploadedFolder.service';
import { UploadedFolderValidation } from './uploadedFolder.validation';

const router = express.Router();

// Folders belong to the staff-only media library.

router.post(
  '/',
  auth('SUPERADMIN', 'ADMIN'),
  validateRequest.body(UploadedFolderValidation.createFolderSchema),
  UploadedFolderService.createFolder,
);

router.get(
  '/tree',
  auth('SUPERADMIN', 'ADMIN'),
  UploadedFolderService.getFolderTree,
);

router.get('/', auth('SUPERADMIN', 'ADMIN'), UploadedFolderService.getFolders);

router.get(
  '/:id',
  auth('SUPERADMIN', 'ADMIN'),
  UploadedFolderService.getFolderById,
);

router.patch(
  '/:id',
  auth('SUPERADMIN', 'ADMIN'),
  validateRequest.body(UploadedFolderValidation.updateFolderSchema),
  UploadedFolderService.updateFolder,
);

router.delete(
  '/:id',
  auth('SUPERADMIN', 'ADMIN'),
  UploadedFolderService.deleteFolder,
);

export const UploadedFolderRoutes = router;
