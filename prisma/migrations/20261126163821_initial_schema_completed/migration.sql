-- CreateEnum
CREATE TYPE "OTPFor" AS ENUM ('USER_VERIFICATION', 'FORGOT_PASSWORD', 'NOT');

-- CreateEnum
CREATE TYPE "UserRoleEnum" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LoginWay" AS ENUM ('EMAIL', 'FIREBASE');

-- CreateEnum
CREATE TYPE "FirebaseProvider" AS ENUM ('GOOGLE', 'FACEBOOK');

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "password" TEXT,
    "role" "UserRoleEnum" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "bio" TEXT,
    "location" TEXT,
    "isAgreeWithTerms" BOOLEAN NOT NULL,
    "profilePhoto" TEXT,
    "otp" TEXT,
    "otpFor" "OTPFor",
    "otpExpiry" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "passwordResetToken" TEXT,
    "passwordResetTokenExpires" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "emailVerificationTokenExpires" TIMESTAMP(3),
    "loginWay" "LoginWay" DEFAULT 'EMAIL',
    "firebaseUid" TEXT,
    "firebaseProvider" "FirebaseProvider",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_tokenHash_key" ON "session"("tokenHash");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_expireAt_idx" ON "session"("expireAt");

-- CreateIndex
CREATE INDEX "session_createdAt_idx" ON "session"("createdAt");

-- CreateIndex
CREATE INDEX "uploaded_files_folder_id_idx" ON "uploaded_files"("folder_id");

-- CreateIndex
CREATE INDEX "uploaded_files_uploaded_by_id_idx" ON "uploaded_files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "uploaded_files_created_at_idx" ON "uploaded_files"("created_at");

-- CreateIndex
CREATE INDEX "uploaded_files_mime_type_idx" ON "uploaded_files"("mime_type");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_folders_name_key_key" ON "uploaded_folders"("name_key");

-- CreateIndex
CREATE INDEX "uploaded_folders_parent_id_idx" ON "uploaded_folders"("parent_id");

-- CreateIndex
CREATE INDEX "uploaded_folders_created_by_id_idx" ON "uploaded_folders"("created_by_id");

-- CreateIndex
CREATE INDEX "uploaded_folders_created_at_idx" ON "uploaded_folders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_folders_parent_id_name_key" ON "uploaded_folders"("parent_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "uploaded_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_folders" ADD CONSTRAINT "uploaded_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "uploaded_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_folders" ADD CONSTRAINT "uploaded_folders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
