import express from 'express';
import { AssetController } from './asset.controller';
import auth from '../../middlewares/auth';
import { parseBody } from '../../middlewares/parseBody';
import validateRequest from '../../middlewares/validateRequest';
import { AssetValidation } from './asset.validation';
import { uploadMiddleware } from '../../middlewares/upload';
import { AssetService } from './asset.service';
const router = express.Router();

router.post(
  '/upload',
  uploadMiddleware.single('file'),
  auth('ANY'),

  AssetService.upload
);

router.post(
  '/upload-multiple',
  uploadMiddleware.array('files'),
  auth('ANY'),

  AssetService.uploadMultiple
);

router.delete(
  '/delete',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteAssetSchema),
  AssetService.delete
);

router.delete(
  '/delete-multiple',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteMultipleAssetsSchema),
  AssetService.deleteMultiple
);

router.put(
  '/update',
  uploadMiddleware.single('file'),
  auth('ANY'),
  parseBody,
  validateRequest.body(AssetValidation.updateAssetSchema),
  AssetService.update
);

router.put(
  '/update-multiple',
  uploadMiddleware.array('files'),
  auth('ANY'),

  parseBody,
  validateRequest.body(AssetValidation.updateMultipleAssetsSchema),
  AssetService.updateMultiple
);

export const AssetRouters = router;
