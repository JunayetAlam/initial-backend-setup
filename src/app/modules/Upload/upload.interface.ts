export type FileTypePattern =
  | 'image/*'
  | 'image/png'
  | 'image/jpg'
  | 'image/jpeg'
  | 'video/*'
  | 'video/mp4'
  | 'video/mkv'
  | 'application/pdf'
  | 'application/*'
  | 'text/csv'
  | 'text/plain'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type QueryT = Record<string, any>;
