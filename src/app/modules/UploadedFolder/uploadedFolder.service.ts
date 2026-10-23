import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import { prisma } from '../../utils/prisma';
import sendResponse from '../../utils/sendResponse';
import { IFolderBreadcrumb, IFolderTreeNode } from './uploadedFolder.interface';

const createdByInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

// Upper bound on hierarchy depth walked by breadcrumb / cycle checks (guards against corrupt data)
const MAX_FOLDER_DEPTH = 100;

/**
 * Normalized uniqueness key: case-insensitive name scoped to its parent (or root).
 */
const buildFolderNameKey = (parentId: string | null, name: string): string =>
  `${parentId ?? 'root'}:${name.toLowerCase()}`;

/**
 * Builds breadcrumbs path from root down to the specified folder.
 */
export const getFolderBreadcrumbs = async (
  folderId: string,
): Promise<IFolderBreadcrumb[]> => {
  const breadcrumbs: IFolderBreadcrumb[] = [];
  let currentId: string | null = folderId;

  // Maximum loop guard to avoid infinite loops in case of any data anomalies
  let depth = 0;
  while (currentId && depth < MAX_FOLDER_DEPTH) {
    depth++;
    const folder: { id: string; name: string; parentId: string | null } | null =
      await prisma.uploadedFolder.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });
    if (!folder) break;
    breadcrumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  return breadcrumbs;
};

/**
 * Validates whether moving `folderId` to `targetParentId` would produce a cycle.
 */
const wouldCreateCycle = async (
  folderId: string,
  targetParentId: string,
): Promise<boolean> => {
  if (folderId === targetParentId) return true;

  let currentParentId: string | null = targetParentId;
  let depth = 0;

  while (currentParentId) {
    // Depth limit hit means the chain is corrupt or cyclic — refuse the move
    if (++depth > MAX_FOLDER_DEPTH) return true;
    if (currentParentId === folderId) return true;

    const parent: { parentId: string | null } | null =
      await prisma.uploadedFolder.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
    if (!parent) break;
    currentParentId = parent.parentId;
  }

  return false;
};

const createFolder = catchAsync(async (req, res) => {
  const { name, parentId } = req.body as {
    name: string;
    parentId?: string | null;
  };
  const trimmedName = name.trim();
  const targetParentId = parentId ? parentId.trim() : null;
  const createdById = req.user?.id || null;

  if (targetParentId) {
    const parentFolder = await prisma.uploadedFolder.findUnique({
      where: { id: targetParentId },
      select: { id: true },
    });
    if (!parentFolder) {
      throw new AppError(httpStatus.NOT_FOUND, 'Parent folder not found');
    }
  }

  // Enforce unique name under the same parent
  const existingWithSameName = await prisma.uploadedFolder.findFirst({
    where: {
      parentId: targetParentId,
      name: { equals: trimmedName, mode: 'insensitive' },
    },
  });

  if (existingWithSameName) {
    throw new AppError(
      httpStatus.CONFLICT,
      `A folder named "${trimmedName}" already exists in this location`,
    );
  }

  const newFolder = await prisma.uploadedFolder.create({
    data: {
      name: trimmedName,
      nameKey: buildFolderNameKey(targetParentId, trimmedName),
      parentId: targetParentId,
      createdById,
    },
    include: createdByInclude,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Folder created successfully',
    data: newFolder,
  });
});

const getFolders = catchAsync(async (req, res) => {
  const { parentId } = req.query as { parentId?: string };

  let whereClause = {};

  if (parentId === 'all') {
    whereClause = {};
  } else if (!parentId || parentId === 'root' || parentId === 'null') {
    whereClause = { parentId: null };
  } else {
    whereClause = { parentId };
  }

  const folders = await prisma.uploadedFolder.findMany({
    where: whereClause,
    include: {
      ...createdByInclude,
      _count: {
        select: {
          subFolders: true,
          files: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formatted = folders.map(f => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    createdBy: f.createdBy,
    subfolderCount: f._count.subFolders,
    fileCount: f._count.files,
  }));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Folders retrieved successfully',
    data: formatted,
  });
});

const getFolderTree = catchAsync(async (_req, res) => {
  const allFolders = await prisma.uploadedFolder.findMany({
    include: {
      _count: {
        select: {
          subFolders: true,
          files: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const folderMap = new Map<string, IFolderTreeNode>();
  allFolders.forEach(f => {
    folderMap.set(f.id, {
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      subfolderCount: f._count.subFolders,
      fileCount: f._count.files,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      subFolders: [],
    });
  });

  const rootNodes: IFolderTreeNode[] = [];
  folderMap.forEach(node => {
    if (node.parentId && folderMap.has(node.parentId)) {
      folderMap.get(node.parentId)!.subFolders?.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Folder tree retrieved successfully',
    data: rootNodes,
  });
});

const getFolderById = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  const folder = await prisma.uploadedFolder.findUnique({
    where: { id },
    include: {
      ...createdByInclude,
      _count: {
        select: {
          subFolders: true,
          files: true,
        },
      },
    },
  });

  if (!folder) {
    throw new AppError(httpStatus.NOT_FOUND, 'Folder not found');
  }

  const breadcrumbs = await getFolderBreadcrumbs(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Folder details retrieved successfully',
    data: {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      createdBy: folder.createdBy,
      subfolderCount: folder._count.subFolders,
      fileCount: folder._count.files,
      breadcrumbs,
    },
  });
});

const updateFolder = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const { name, parentId } = req.body as {
    name?: string;
    parentId?: string | null;
  };

  const existing = await prisma.uploadedFolder.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Folder not found');
  }

  const nextName = name !== undefined ? name.trim() : existing.name;
  let nextParentId = existing.parentId;

  if (parentId !== undefined) {
    const normalizedTargetParent = parentId ? parentId.trim() : null;

    if (normalizedTargetParent !== existing.parentId) {
      if (normalizedTargetParent) {
        const targetFolder = await prisma.uploadedFolder.findUnique({
          where: { id: normalizedTargetParent },
        });
        if (!targetFolder) {
          throw new AppError(
            httpStatus.NOT_FOUND,
            'Target parent folder not found',
          );
        }

        const isCycle = await wouldCreateCycle(id, normalizedTargetParent);
        if (isCycle) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Cannot move a folder into itself or one of its own subfolders',
          );
        }
      }
      nextParentId = normalizedTargetParent;
    }
  }

  // If name or parent changed, check uniqueness
  if (nextName !== existing.name || nextParentId !== existing.parentId) {
    const duplicate = await prisma.uploadedFolder.findFirst({
      where: {
        id: { not: id },
        parentId: nextParentId,
        name: { equals: nextName, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      throw new AppError(
        httpStatus.CONFLICT,
        `A folder named "${nextName}" already exists in the destination folder`,
      );
    }
  }

  const updated = await prisma.uploadedFolder.update({
    where: { id },
    data: {
      name: nextName,
      nameKey: buildFolderNameKey(nextParentId, nextName),
      parentId: nextParentId,
    },
    include: createdByInclude,
  });

  const breadcrumbs = await getFolderBreadcrumbs(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Folder updated successfully',
    data: { ...updated, breadcrumbs },
  });
});

const deleteFolder = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  const existing = await prisma.uploadedFolder.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Folder not found');
  }

  const [subfolderCount, fileCount] = await Promise.all([
    prisma.uploadedFolder.count({ where: { parentId: id } }),
    prisma.uploadedFile.count({ where: { folderId: id } }),
  ]);

  if (subfolderCount > 0 || fileCount > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Folder cannot be deleted because it contains ${subfolderCount} subfolder(s) and ${fileCount} file(s). Please move or delete its contents first.`,
    );
  }

  await prisma.uploadedFolder.delete({
    where: { id },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Folder deleted successfully',
    data: { id },
  });
});

export const UploadedFolderService = {
  createFolder,
  getFolders,
  getFolderTree,
  getFolderById,
  updateFolder,
  deleteFolder,
};
