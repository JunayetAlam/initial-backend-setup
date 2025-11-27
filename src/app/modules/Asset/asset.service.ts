import httpStatus from 'http-status';

import AppError from '../../errors/AppError';
import { deleteFromMinIO, uploadToMinIO } from '../../utils/uploadToMinio';

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

const uploadAsset = async (file: Express.Multer.File | undefined) => {
    if (!file) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide at least one asset');
    }
    const location = await uploadToMinIO(file);
    return getImageDataFromUrl(location);
};

const uploadMultipleAssets = async (files: Express.Multer.File[] | undefined) => {
    if (!files || files.length === 0) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide at least one asset');
    }
    console.log(files)
    const locations = await uploadToMinIO(files);
    return locations.map(item => getImageDataFromUrl(item));
};

const deleteAsset = async (path: string) => {
    const success = deleteFromMinIO(path);
    return success;
};

const deleteMultipleAssets = async (paths: string[]) => {
    const deleted = deleteFromMinIO(paths);
    return deleted;
};

const updateAsset = async (
    oldPath: string,
    newFile: Express.Multer.File | undefined
) => {
    if (!newFile) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide a new file to update the asset');
    }
    const newLocation = await uploadToMinIO(newFile);
    deleteFromMinIO(oldPath)
    return getImageDataFromUrl(newLocation);
};

const updateMultipleAsset = async (
    oldPaths: string[],
    newFiles: Express.Multer.File[] | undefined
) => {
    if (!newFiles || newFiles.length === 0) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide new files to update the assets');
    }
    const newLocations = await uploadToMinIO(newFiles);
    deleteFromMinIO(oldPaths)
    return newLocations.map(item => getImageDataFromUrl(item));
};

export const AssetService = {
    upload: uploadAsset,
    uploadMultiple: uploadMultipleAssets,
    delete: deleteAsset,
    deleteMultiple: deleteMultipleAssets,
    update: updateAsset,
    updateMultipleAsset,
};
