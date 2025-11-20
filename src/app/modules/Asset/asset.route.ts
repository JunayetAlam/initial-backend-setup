import express from 'express';
import { AssetController } from './asset.controller';
import auth from '../../middlewares/auth';
import { parseBody } from '../../middlewares/parseBody';
import validateRequest from '../../middlewares/validateRequest';
import { AssetValidation } from './asset.validation';
import { uploadMiddleware } from '../../middlewares/upload';
const router = express.Router();

// Single file upload
router.post(
  '/upload',
  uploadMiddleware.single('file'),
  auth('ANY'),

  AssetController.uploadAsset
);

// Multiple files upload
router.post(
  '/upload-multiple',
  uploadMiddleware.array('files'),
  auth('ANY'),

  AssetController.uploadMultipleAssets
);

// Delete single asset
router.delete(
  '/delete',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteAssetSchema),
  AssetController.deleteAsset
);

// Delete multiple assets
router.delete(
  '/delete-multiple',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteMultipleAssetsSchema),
  AssetController.deleteMultipleAssets
);

// Update single asset
router.put(
  '/update',
  uploadMiddleware.single('file'),
  auth('ANY'),
  parseBody,
  validateRequest.body(AssetValidation.updateAssetSchema),
  AssetController.updateAsset
);

// Update multiple assets
router.put(
  '/update-multiple',
  uploadMiddleware.array('files'),
  auth('ANY'),

  parseBody,
  validateRequest.body(AssetValidation.updateMultipleAssetsSchema),
  AssetController.updateMultipleAssets
);

export const AssetRouters = router;
