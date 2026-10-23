-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "mime_type" VARCHAR(150),
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "format" VARCHAR(50),
    "folder_id" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_folders" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_key" VARCHAR(150) NOT NULL,
    "parent_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uploaded_files_folder_id_idx" ON "uploaded_files"("folder_id");

-- CreateIndex
CREATE INDEX "uploaded_files_uploaded_by_id_idx" ON "uploaded_files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "uploaded_files_created_at_idx" ON "uploaded_files"("created_at");

-- CreateIndex
CREATE INDEX "uploaded_files_mime_type_idx" ON "uploaded_files"("mime_type");

-- CreateIndex
CREATE INDEX "uploaded_folders_parent_id_idx" ON "uploaded_folders"("parent_id");

-- CreateIndex
CREATE INDEX "uploaded_folders_created_by_id_idx" ON "uploaded_folders"("created_by_id");

-- CreateIndex
CREATE INDEX "uploaded_folders_created_at_idx" ON "uploaded_folders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_folders_parent_id_name_key" ON "uploaded_folders"("parent_id", "name");

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "uploaded_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_folders" ADD CONSTRAINT "uploaded_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "uploaded_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_folders" ADD CONSTRAINT "uploaded_folders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_folders_name_key_key" ON "uploaded_folders"("name_key");
