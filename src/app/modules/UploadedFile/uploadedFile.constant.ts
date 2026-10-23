import { Prisma } from '../../../generated/prisma/client';

/**
 * Media categories shared by the library filter (`?type=`) and the upload
 * type guard (`accept`). Each category is disjoint from the others.
 */
export const MEDIA_CATEGORIES = [
  'image',
  'video',
  'audio',
  'pdf',
  'document',
  'other',
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const DOCUMENT_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

export const getMediaCategory = (mimeType?: string | null): MediaCategory => {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (DOCUMENT_MIME_TYPES.includes(mimeType)) return 'document';
  return 'other';
};

/**
 * Parses a comma-separated category list (e.g. "image,pdf").
 * Returns [] for empty input or "all", meaning no restriction.
 */
export const parseMediaCategories = (raw?: unknown): MediaCategory[] => {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const values = raw
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
  if (values.includes('all')) return [];
  return [
    ...new Set(
      values.filter((v): v is MediaCategory =>
        (MEDIA_CATEGORIES as readonly string[]).includes(v),
      ),
    ),
  ];
};

export const mediaCategoryWhere = (
  category: MediaCategory,
): Prisma.UploadedFileWhereInput => {
  switch (category) {
    case 'image':
      return { mimeType: { startsWith: 'image/' } };
    case 'video':
      return { mimeType: { startsWith: 'video/' } };
    case 'audio':
      return { mimeType: { startsWith: 'audio/' } };
    case 'pdf':
      return { mimeType: { equals: 'application/pdf' } };
    case 'document':
      return { mimeType: { in: DOCUMENT_MIME_TYPES } };
    case 'other':
      return {
        OR: [
          { mimeType: null },
          {
            AND: [
              { NOT: { mimeType: { startsWith: 'image/' } } },
              { NOT: { mimeType: { startsWith: 'video/' } } },
              { NOT: { mimeType: { startsWith: 'audio/' } } },
              { NOT: { mimeType: { equals: 'application/pdf' } } },
              { NOT: { mimeType: { in: DOCUMENT_MIME_TYPES } } },
            ],
          },
        ],
      };
  }
};
