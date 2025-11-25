-- Хариуцсан хүний мэдээлэл нэмэх
-- MySQL дээр шууд ажиллуулах query

-- 1. contact_name талбар нэмэх (хариуцсан хүний нэр)
ALTER TABLE `organizations` 
ADD COLUMN `contact_name` VARCHAR(200) NULL COMMENT 'Хариуцсан хүний нэр';

-- 2. contact_email талбар нэмэх (хэрэв байхгүй бол)
ALTER TABLE `organizations` 
ADD COLUMN `contact_email` VARCHAR(255) NULL COMMENT 'Хариуцсан хүний имэйл';

-- 3. Index үүсгэх
CREATE INDEX `idx_organizations_contact_email` ON `organizations`(`contact_email`);



