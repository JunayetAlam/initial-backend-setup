import httpStatus from 'http-status';

import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import {
  deleteMultiple,
  deleteSingle,
  uploadMultiple,
  uploadSingle,
} from './asset.utils';

const uploadAsset = catchAsync(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Provide at least one asset');
  }
  const url = await uploadSingle(file);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'File uploaded successfully',
    data: { url },
  });
});

const uploadMultipleAssets = catchAsync(async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Provide at least one asset');
  }
  const urls = await uploadMultiple(files);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Files uploaded successfully',
    data: { urls },
  });
});

const deleteAsset = catchAsync(async (req, res) => {
  const path = req.body.path;
  const success = await deleteSingle(path);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'File deleted successfully',
    data: { success },
  });
});

const deleteMultipleAssets = catchAsync(async (req, res) => {
  const paths = req.body.paths;
  const deleted = await deleteMultiple(paths);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Files deleted successfully',
    data: { deleted },
  });
});

const updateAsset = catchAsync(async (req, res) => {
  const oldPath = req.body.oldPath;
  const newFile = req.file;
  if (!newFile) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Provide a new file to update the asset',
    );
  }
  const url = await uploadSingle(newFile);
  deleteSingle(oldPath);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'File updated successfully',
    data: { url },
  });
});

const updateMultipleAssets = catchAsync(async (req, res) => {
  const { oldPaths } = req.body;
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Provide new files to update the assets',
    );
  }
  const urls = await uploadMultiple(files);
  deleteMultiple(oldPaths);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Files updated successfully',
    data: { urls },
  });
});

export const AssetServices = {
  upload: uploadAsset,
  uploadMultiple: uploadMultipleAssets,
  delete: deleteAsset,
  deleteMultiple: deleteMultipleAssets,
  update: updateAsset,
  updateMultiple: updateMultipleAssets,
};
