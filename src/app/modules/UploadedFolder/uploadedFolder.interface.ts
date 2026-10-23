export interface ICreateFolderPayload {
  name: string;
  parentId?: string | null;
}

export interface IUpdateFolderPayload {
  name?: string;
  parentId?: string | null;
}

export interface IFolderBreadcrumb {
  id: string;
  name: string;
}

export interface IFolderTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  fileCount: number;
  subfolderCount: number;
  createdAt: Date;
  updatedAt: Date;
  subFolders?: IFolderTreeNode[];
}
