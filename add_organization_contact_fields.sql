-- Add contact person fields to organizations table
-- MySQL дээр шууд ажиллуулах query

-- ТАЙЛБАР: contact_phone талбар аль хэдийн байгаа тул зөвхөн contact_email талбарыг нэмнэ

-- contact_email талбар нэмэх (хэрэв байхгүй бол)
ALTER TABLE `organizations` 
ADD COLUMN IF NOT EXISTS `contact_email` VARCHAR(255) NULL COMMENT 'Хариуцсан хүний имэйл';

-- Эсвэл MySQL 5.7-д IF NOT EXISTS дэмжихгүй бол дараах query ашиглана:
-- ALTER TABLE `organizations` 
-- ADD COLUMN `contact_email` VARCHAR(255) NULL COMMENT 'Хариуцсан хүний имэйл';

-- Index үүсгэх (хэрэв байхгүй бол)
CREATE INDEX IF NOT EXISTS `idx_organizations_contact_email` ON `organizations`(`contact_email`);

-- Эсвэл MySQL 5.7-д IF NOT EXISTS дэмжихгүй бол дараах query ашиглана:
-- CREATE INDEX `idx_organizations_contact_email` ON `organizations`(`contact_email`);
