import express from 'express';
import { AssetController } from './asset.controller';
import auth from '../../middlewares/auth';
import { parseBody } from '../../middlewares/parseBody';
import validateRequest from '../../middlewares/validateRequest';
import { AssetValidation } from './asset.validation';
import { uploadMiddleware } from '../../middlewares/upload';
const router = express.Router();

router.post(
  '/upload',
  uploadMiddleware.single('file'),
  auth('ANY'),

  AssetController.uploadAsset
);

router.post(
  '/upload-multiple',
  uploadMiddleware.array('files'),
  auth('ANY'),

  AssetController.uploadMultipleAssets
);

router.delete(
  '/delete',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteAssetSchema),
  AssetController.deleteAsset
);

router.delete(
  '/delete-multiple',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteMultipleAssetsSchema),
  AssetController.deleteMultipleAssets
);

router.put(
  '/update',
  uploadMiddleware.single('file'),
  auth('ANY'),
  parseBody,
  validateRequest.body(AssetValidation.updateAssetSchema),
  AssetController.updateAsset
);

router.put(
  '/update-multiple',
  uploadMiddleware.array('files'),
  auth('ANY'),

  parseBody,
  validateRequest.body(AssetValidation.updateMultipleAssetsSchema),
  AssetController.updateMultipleAssets
);

export const AssetRouters = router;
