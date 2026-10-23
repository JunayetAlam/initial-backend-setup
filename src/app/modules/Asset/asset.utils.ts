/* eslint-disable no-console */

// Storage layer for the Asset module. Swap the provider here (Cloudinary,
// MinIO, DigitalOcean, local) without touching asset.service.ts.
import {
  deleteFromCloudinary,
  deleteMultipleByUrl,
  uploadMultipleToCloudinary,
  uploadToCloudinary,
} from '../Upload/uploadToCloudinary';

export interface ImageData {
  name: string;
  url: string;
}

export function getImageDataFromUrl(imageUrl: string): ImageData {
  const parts = imageUrl.split('/');
  const fileName = parts[parts.length - 1] || 'unknown';

  return {
    name: fileName,
    url: imageUrl,
  };
}

export const uploadSingle = async (
  file: Express.Multer.File,
): Promise<ImageData> => {
  const location = await uploadToCloudinary(file);
  return getImageDataFromUrl(location.Location);
};

export const uploadMultiple = async (
  files: Express.Multer.File[],
): Promise<ImageData[]> => {
  const locations = await uploadMultipleToCloudinary(files);
  return locations.map(item => getImageDataFromUrl(item.Location));
};

export const deleteSingle = async (url: string): Promise<boolean> => {
  return deleteFromCloudinary(url);
};

// Never throws: also used fire-and-forget after an update, where an
// unhandled rejection would take the whole process down.
export const deleteMultiple = async (urls: string[]) => {
  try {
    return await deleteMultipleByUrl(urls);
  } catch (error) {
    console.error('Bulk deletion failed:', error);
    return {};
  }
};
