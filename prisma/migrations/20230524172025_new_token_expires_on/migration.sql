/*
  Warnings:

  - Added the required column `token_expires_on` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `token_expires_on` DATETIME(3) NOT NULL;
