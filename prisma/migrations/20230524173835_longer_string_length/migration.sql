-- AlterTable
ALTER TABLE `User` MODIFY `refresh_token` VARCHAR(500) NOT NULL,
    MODIFY `access_token` VARCHAR(500) NOT NULL;
