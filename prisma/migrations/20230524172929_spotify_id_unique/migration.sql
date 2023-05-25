/*
  Warnings:

  - A unique constraint covering the columns `[spotify_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `User_spotify_id_key` ON `User`(`spotify_id`);
