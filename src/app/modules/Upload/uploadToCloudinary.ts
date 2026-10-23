/* eslint-disable no-console */

import { randomBytes } from 'crypto';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import httpStatus from 'http-status';
import config from '../../../config';
import AppError from '../../errors/AppError';

cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret,
});

const PROJECT_NAME =
  config.cloudinary.project_name || config.project_slug || 'my-project';

interface UploadResponse {
  Location: string;
  public_id: string;
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  bytes: number;
  format?: string;
  width?: number;
  height?: number;
  mimeType: string;
}

export type CloudinaryResourceType = 'auto' | 'image' | 'video' | 'raw';

/**
 * Normalizes a file name into a URL-friendly slug.
 * Dots are stripped so the public_id never looks like it has a file extension.
 */
export const slugifyFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 100);

/**
 * Decide folder & resource type based on mimetype
 */
export const getCloudinaryConfig = (
  mimetype: string,
): { folder: string; resource_type: CloudinaryResourceType } => {
  if (mimetype.startsWith('image/')) {
    return {
      folder: `${PROJECT_NAME}/uploads/images`,
      resource_type: 'image',
    };
  }

  if (mimetype.startsWith('video/')) {
    return {
      folder: `${PROJECT_NAME}/uploads/videos`,
      resource_type: 'video',
    };
  }

  if (mimetype === 'application/pdf') {
    return {
      folder: `${PROJECT_NAME}/uploads/documents`,
      resource_type: 'raw',
    };
  }

  return {
    folder: `${PROJECT_NAME}/uploads/files`,
    resource_type: 'raw',
  };
};

/**
 * Generates a collision-resistant unique public_id preserving the original file slug.
 */
export const generatePublicId = (file: Express.Multer.File): string => {
  const { folder } = getCloudinaryConfig(file.mimetype);
  const slug = slugifyFileName(file.originalname) || 'file';
  return `${folder}/${slug}_${randomBytes(4).toString('hex')}`;
};

/**
 * Upload a single file to Cloudinary and return its metadata.
 */
export const uploadFileToCloudinary = (
  file: Express.Multer.File,
  customPublicId?: string,
): Promise<CloudinaryUploadResult> => {
  if (!file || !file.buffer) {
    return Promise.reject(
      new AppError(httpStatus.BAD_REQUEST, 'File buffer is missing for upload'),
    );
  }

  const publicId = customPublicId || generatePublicId(file);
  const { resource_type } = getCloudinaryConfig(file.mimetype);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type,
        overwrite: false,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          console.error(
            `Error uploading to Cloudinary: ${file.originalname}`,
            error,
          );
          return reject(
            new AppError(
              httpStatus.BAD_GATEWAY,
              `Failed to upload file to Cloudinary: ${error?.message || 'Unknown error'}`,
            ),
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes || file.size,
          format: result.format,
          width: result.width,
          height: result.height,
          mimeType: file.mimetype,
        });
      },
    );

    uploadStream.end(file.buffer);
  });
};

/**
 * In-place file replacement on Cloudinary.
 * Keeps the same public_id and URL, overwrites storage and invalidates the CDN cache.
 * `resource_type` must match the original asset — Cloudinary keeps image/video/raw
 * in separate namespaces, so a different type would create a new asset at a new URL.
 */
export const replaceFileInCloudinary = (
  publicId: string,
  file: Express.Multer.File,
  resource_type: CloudinaryResourceType,
): Promise<CloudinaryUploadResult> => {
  if (!file || !file.buffer) {
    return Promise.reject(
      new AppError(httpStatus.BAD_REQUEST, 'Provide a valid replacement file'),
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type,
        overwrite: true,
        invalidate: true,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          console.error(
            `Error replacing file in Cloudinary: ${publicId}`,
            error,
          );
          return reject(
            new AppError(
              httpStatus.BAD_GATEWAY,
              `Failed to replace file in Cloudinary: ${error?.message || 'Unknown error'}`,
            ),
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes || file.size,
          format: result.format,
          width: result.width,
          height: result.height,
          mimeType: file.mimetype,
        });
      },
    );

    uploadStream.end(file.buffer);
  });
};

/**
 * Best-effort removal of assets by public_id (used to roll back failed batch uploads).
 */
export const destroyCloudinaryAssets = async (
  assets: Array<{ publicId: string; mimeType: string }>,
): Promise<void> => {
  await Promise.allSettled(
    assets.map(({ publicId, mimeType }) =>
      cloudinary.uploader.destroy(publicId, {
        resource_type: getCloudinaryConfig(mimeType).resource_type,
        invalidate: true,
      }),
    ),
  );
};

// ---------------- URL based helpers (used by the Asset module) ----------------

export const uploadToCloudinary = async (
  file: Express.Multer.File,
): Promise<UploadResponse> => {
  const res = await uploadFileToCloudinary(file);
  return {
    Location: res.url,
    public_id: res.publicId,
  };
};

export const uploadMultipleToCloudinary = async (
  files: Express.Multer.File[],
): Promise<UploadResponse[]> => {
  const results = await Promise.allSettled(
    files.map(file => uploadFileToCloudinary(file)),
  );
  const uploaded = results.flatMap(r =>
    r.status === 'fulfilled' ? [r.value] : [],
  );

  // All or nothing: roll back the files that did upload if any of them failed
  const failed = results.find(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  );
  if (failed) {
    await destroyCloudinaryAssets(uploaded);
    throw failed.reason;
  }

  return uploaded.map(res => ({ Location: res.url, public_id: res.publicId }));
};

export const getResourceTypeFromUrl = (url: string): CloudinaryResourceType => {
  if (url.includes('/image/upload/')) return 'image';
  if (url.includes('/video/upload/')) return 'video';
  return 'raw';
};

const getPublicIdFromUrl = (url: string): string => {
  const parts = url.split('/upload/')[1] || '';
  const withoutVersion = parts.replace(/^v\d+\//, '');
  // Raw assets keep their extension as part of the public_id
  return getResourceTypeFromUrl(url) === 'raw'
    ? withoutVersion
    : withoutVersion.replace(/\.[^/.]+$/, '');
};

export const deleteFromCloudinary = async (
  fileUrl: string,
): Promise<boolean> => {
  try {
    const result = await cloudinary.uploader.destroy(
      getPublicIdFromUrl(fileUrl),
      {
        resource_type: getResourceTypeFromUrl(fileUrl),
        invalidate: true,
      },
    );
    return result?.result === 'ok';
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

export const deleteMultipleByUrl = async (urls: string[]) => {
  // delete_resources works on one resource type per call
  const byType = new Map<CloudinaryResourceType, string[]>();
  urls.forEach(url => {
    const type = getResourceTypeFromUrl(url);
    byType.set(type, [...(byType.get(type) || []), getPublicIdFromUrl(url)]);
  });

  const results = await Promise.all(
    [...byType.entries()].map(([resource_type, publicIds]) =>
      cloudinary.api.delete_resources(publicIds, { resource_type }),
    ),
  );

  return results.reduce(
    (acc, r) => ({ ...acc, ...(r?.deleted || {}) }),
    {} as Record<string, string>,
  );
};
