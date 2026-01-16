import httpStatus from 'http-status';

import AppError from '../../errors/AppError';
import { deleteFromMinIO, uploadToMinIO } from '../../utils/uploadToMinio';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';

interface ImageData {
    name: string;
    url: string;
}

export function getImageDataFromUrl(imageUrl: string): ImageData {
    const parts = imageUrl.split("/");
    const fileName = parts[parts.length - 1] || "unknown";

    return {
        name: fileName,
        url: imageUrl,
    };
}


const uploadAsset = catchAsync(async (req, res) => {
    const file = req.file;
    if (!file) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide at least one asset');
    }
    const location = await uploadToMinIO(file);
    const url = getImageDataFromUrl(location);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'File uploaded successfully',
        data: { url },
    });
});

const uploadMultipleAssets = catchAsync(async (req, res) => {
    const files = req.files as Express.Multer.File[] || undefined;
    if (!files || files.length === 0) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide at least one asset');
    }
    console.log(files)
    const locations = await uploadToMinIO(files);
    const urls = locations.map(item => getImageDataFromUrl(item));
    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Files uploaded successfully',
        data: { urls },
    });
});

const deleteAsset = catchAsync(async (req, res) => {
    const path = req.params.path;
    const success = deleteFromMinIO(path);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'File deleted successfully',
        data: { success },
    });
});

const deleteMultipleAssets = catchAsync(async (req, res) => {
    const paths = req.params.paths;
    const deleted = deleteFromMinIO(paths);
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
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide a new file to update the asset');
    }
    const newLocation = await uploadToMinIO(newFile);
    deleteFromMinIO(oldPath)
    const url = getImageDataFromUrl(newLocation);

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
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide new files to update the assets');
    }
    const newLocations = await uploadToMinIO(files);
    deleteFromMinIO(oldPaths)
    const urls = newLocations.map(item => getImageDataFromUrl(item));

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Files updated successfully',
        data: { urls },
    });
});


export const AssetService = {
    upload: uploadAsset,
    uploadMultiple: uploadMultipleAssets,
    delete: deleteAsset,
    deleteMultiple: deleteMultipleAssets,
    update: updateAsset,
    updateMultiple: updateMultipleAssets,
};
