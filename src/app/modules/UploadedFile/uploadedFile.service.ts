import httpStatus from 'http-status';
import { Prisma } from '../../../generated/prisma/client';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import { prisma } from '../../utils/prisma';
import sendResponse from '../../utils/sendResponse';
import {
  CloudinaryUploadResult,
  destroyCloudinaryAssets,
  getCloudinaryConfig,
  getResourceTypeFromUrl,
  replaceFileInCloudinary,
  uploadFileToCloudinary,
} from '../Upload/uploadToCloudinary';
import {
  getMediaCategory,
  mediaCategoryWhere,
  parseMediaCategories,
} from './uploadedFile.constant';

const fileInclude = {
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
  folder: { select: { id: true, name: true } },
} as const;

/**
 * Rejects any file whose type is outside the comma-separated `accept`
 * categories sent by the media picker (e.g. "image" or "pdf,document").
 */
const assertAcceptedTypes = (
  files: Express.Multer.File[],
  rawAccept: unknown,
) => {
  const allowed = parseMediaCategories(rawAccept);
  if (allowed.length === 0) return;

  const rejected = files.filter(
    file => !allowed.includes(getMediaCategory(file.mimetype)),
  );
  if (rejected.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `${rejected.map(f => f.originalname).join(', ')} ${
        rejected.length === 1 ? 'is' : 'are'
      } not allowed here. Allowed types: ${allowed.join(', ')}`,
    );
  }
};

const getAllUploadedFiles = catchAsync(async (req, res) => {
  const query = req.query as Record<string, string | undefined>;
  const {
    type,
    folderId,
    scope,
    searchTerm,
    page = '1',
    limit = '20',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const andConditions: Prisma.UploadedFileWhereInput[] = [];

  // 1. Folder condition
  if (scope !== 'all') {
    if (folderId === 'root' || folderId === 'null') {
      andConditions.push({ folderId: null });
    } else if (folderId && folderId !== 'all') {
      andConditions.push({ folderId });
    }
  }

  // 2. MIME Type condition — `type` may be a comma-separated list ("image,pdf")
  const categories = parseMediaCategories(type);
  if (categories.length > 0) {
    andConditions.push({ OR: categories.map(mediaCategoryWhere) });
  }

  // 3. Search term condition
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    andConditions.push({
      OR: [
        { originalName: { contains: term, mode: 'insensitive' } },
        { url: { contains: term, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.UploadedFileWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const validSortFields = ['createdAt', 'size', 'originalName', 'updatedAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

  const [total, data] = await Promise.all([
    prisma.uploadedFile.count({ where }),
    prisma.uploadedFile.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { [sortField]: sortDirection },
      include: fileInclude,
    }),
  ]);

  const totalPage = Math.ceil(total / limitNum);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Files retrieved successfully',
    data,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPage,
    },
  });
});

const uploadFiles = catchAsync(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Provide at least one file to upload',
    );
  }

  assertAcceptedTypes(files, req.body?.accept);

  // Multipart fields arrive as strings; anything else is treated as "root"
  const rawFolderId =
    typeof req.body?.folderId === 'string' ? req.body.folderId.trim() : '';
  const folderId =
    rawFolderId && rawFolderId !== 'null' && rawFolderId !== 'root'
      ? rawFolderId
      : null;

  if (folderId) {
    const folderExists = await prisma.uploadedFolder.findUnique({
      where: { id: folderId },
      select: { id: true },
    });
    if (!folderExists) {
      throw new AppError(httpStatus.NOT_FOUND, 'Target folder not found');
    }
  }

  const uploadedById = req.user?.id || null;

  // Upload each file to Cloudinary in parallel
  const settled = await Promise.allSettled(
    files.map(file => uploadFileToCloudinary(file)),
  );

  const uploaded = settled
    .filter(
      (r): r is PromiseFulfilledResult<CloudinaryUploadResult> =>
        r.status === 'fulfilled',
    )
    .map(r => r.value);

  // All-or-nothing: if any upload failed, remove the ones that succeeded
  // so no orphaned assets are left in Cloudinary without a library record.
  const failed = settled.find(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  );
  if (failed) {
    await destroyCloudinaryAssets(uploaded);
    throw failed.reason;
  }

  // Batch insert into database
  let createdFiles;
  try {
    createdFiles = await prisma.$transaction(
      uploaded.map((cloudinaryResult, index) =>
        prisma.uploadedFile.create({
          data: {
            originalName: files[index].originalname,
            fileName: cloudinaryResult.publicId,
            url: cloudinaryResult.url,
            mimeType: cloudinaryResult.mimeType,
            size: cloudinaryResult.bytes,
            width: cloudinaryResult.width || null,
            height: cloudinaryResult.height || null,
            format: cloudinaryResult.format || null,
            folderId,
            uploadedById,
          },
          include: fileInclude,
        }),
      ),
    );
  } catch (error) {
    await destroyCloudinaryAssets(uploaded);
    throw error;
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Files uploaded successfully',
    data: createdFiles,
  });
});

const replaceUploadedFile = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const file = req.file;

  if (!file) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Provide a replacement file to upload',
    );
  }

  assertAcceptedTypes([file], req.body?.accept);

  const existing = await prisma.uploadedFile.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'File not found');
  }

  // Cloudinary stores image/video/raw in separate namespaces; a cross-type
  // replacement would land at a different URL and leave the old asset served.
  const existingResourceType = getResourceTypeFromUrl(existing.url);
  const { resource_type: newResourceType } = getCloudinaryConfig(file.mimetype);
  if (existingResourceType !== newResourceType) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Replacement must be the same kind of file (${existingResourceType}). Upload it as a new file instead.`,
    );
  }

  // Cloudinary in-place overwrite: same public_id, invalidate CDN
  const replacementResult = await replaceFileInCloudinary(
    existing.fileName,
    file,
    existingResourceType,
  );

  // Update DB row: public URL & original name remain preserved
  const updated = await prisma.uploadedFile.update({
    where: { id: existing.id },
    data: {
      mimeType: replacementResult.mimeType,
      size: replacementResult.bytes,
      width: replacementResult.width || null,
      height: replacementResult.height || null,
      format: replacementResult.format || null,
    },
    include: fileInclude,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'File replaced successfully. Public URL is unchanged.',
    data: {
      ...updated,
      cdnPurged: true,
    },
  });
});

// Display-name only: the Cloudinary public_id and URL never change.
const renameFile = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const { originalName } = req.body as { originalName: string };

  const existing = await prisma.uploadedFile.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'File not found');
  }

  const updated = await prisma.uploadedFile.update({
    where: { id },
    data: { originalName: originalName.trim() },
    include: fileInclude,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'File renamed successfully',
    data: updated,
  });
});

const moveFile = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const { folderId } = req.body as { folderId: string | null };

  const existing = await prisma.uploadedFile.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'File not found');
  }

  const targetFolderId = folderId ? folderId.trim() : null;
  if (targetFolderId) {
    const folderExists = await prisma.uploadedFolder.findUnique({
      where: { id: targetFolderId },
      select: { id: true },
    });
    if (!folderExists) {
      throw new AppError(httpStatus.NOT_FOUND, 'Target folder not found');
    }
  }

  const updated = await prisma.uploadedFile.update({
    where: { id },
    data: { folderId: targetFolderId },
    include: fileInclude,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'File moved successfully',
    data: updated,
  });
});

const moveManyFiles = catchAsync(async (req, res) => {
  const { ids, folderId } = req.body as {
    ids: string[];
    folderId: string | null;
  };

  const targetFolderId = folderId ? folderId.trim() : null;
  if (targetFolderId) {
    const folderExists = await prisma.uploadedFolder.findUnique({
      where: { id: targetFolderId },
      select: { id: true },
    });
    if (!folderExists) {
      throw new AppError(httpStatus.NOT_FOUND, 'Target folder not found');
    }
  }

  const result = await prisma.uploadedFile.updateMany({
    where: { id: { in: ids } },
    data: { folderId: targetFolderId },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: `${result.count} file${result.count === 1 ? '' : 's'} moved successfully`,
    data: { count: result.count },
  });
});

// Database record deletion only: cloud storage asset remains intact
// so consumer entities referencing the URL do not get broken links.
const deleteUploadedFile = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  const existing = await prisma.uploadedFile.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'File not found');
  }

  await prisma.uploadedFile.delete({
    where: { id },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'File removed from library',
    data: { id },
  });
});

const deleteManyUploadedFiles = catchAsync(async (req, res) => {
  const { ids } = req.body as { ids: string[] };

  const result = await prisma.uploadedFile.deleteMany({
    where: { id: { in: ids } },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: `${result.count} file${result.count === 1 ? '' : 's'} removed from library`,
    data: { count: result.count },
  });
});

export const UploadedFileService = {
  getAllUploadedFiles,
  uploadFiles,
  replaceUploadedFile,
  renameFile,
  moveFile,
  moveManyFiles,
  deleteUploadedFile,
  deleteManyUploadedFiles,
};
