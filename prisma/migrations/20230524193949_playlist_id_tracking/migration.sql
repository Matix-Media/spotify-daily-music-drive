/*
  Warnings:

  - A unique constraint covering the columns `[daily_music_drive_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `daily_music_drive_id` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `daily_music_drive_id` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_daily_music_drive_id_key` ON `User`(`daily_music_drive_id`);
