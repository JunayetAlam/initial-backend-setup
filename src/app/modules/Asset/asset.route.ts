import express from 'express';
import auth from '../../middlewares/auth';
import { parseBody } from '../../middlewares/parseBody';
import validateRequest from '../../middlewares/validateRequest';
import { AssetValidation } from './asset.validation';
import { uploadMiddleware } from '../Upload/upload.middleware';
import { AssetServices } from './asset.service';
import { UploadedFileRoutes } from '../UploadedFile/uploadedFile.route';
import { UploadedFolderRoutes } from '../UploadedFolder/uploadedFolder.route';
const router = express.Router();

// Media library (file management): /assets/files, /assets/folders
router.use('/files', UploadedFileRoutes);
router.use('/folders', UploadedFolderRoutes);

// `auth` always runs before `uploadMiddleware` so anonymous requests are
// rejected before any file is buffered into memory.

router.post(
  '/upload',
  auth('ANY'),
  uploadMiddleware.single('file'),
  AssetServices.upload,
);

router.post(
  '/upload-multiple',
  auth('ANY'),
  uploadMiddleware.array('files'),
  AssetServices.uploadMultiple,
);

router.delete(
  '/delete',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteAssetSchema),
  AssetServices.delete,
);

router.delete(
  '/delete-multiple',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteMultipleAssetsSchema),
  AssetServices.deleteMultiple,
);

router.put(
  '/update',
  auth('ANY'),
  uploadMiddleware.single('file'),
  parseBody,
  validateRequest.body(AssetValidation.updateAssetSchema),
  AssetServices.update,
);

router.put(
  '/update-multiple',
  auth('ANY'),
  uploadMiddleware.array('files'),
  parseBody,
  validateRequest.body(AssetValidation.updateMultipleAssetsSchema),
  AssetServices.updateMultiple,
);

export const AssetRouters = router;
