export type { MediaCategory as FileTypeFilter } from './uploadedFile.constant';

export interface IUploadedFileFilterQuery {
  searchTerm?: string;
  type?: string; // comma-separated MediaCategory list, e.g. "image,pdf"
  folderId?: string; // 'root' | 'all' | uuid
  scope?: 'folder' | 'all';
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IMoveFileInput {
  folderId: string | null;
}

export interface IMoveManyFilesInput {
  ids: string[];
  folderId: string | null;
}

export interface IDeleteManyFilesInput {
  ids: string[];
}
