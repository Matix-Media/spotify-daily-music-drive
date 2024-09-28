-- AlterTable
ALTER TABLE `User` MODIFY `refresh_token` VARCHAR(200) NOT NULL,
    MODIFY `access_token` VARCHAR(200) NOT NULL;
