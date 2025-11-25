-- Add schedule_type column to inspections table
ALTER TABLE `inspections` 
ADD COLUMN `schedule_type` ENUM('DAILY', 'SCHEDULED') NOT NULL DEFAULT 'SCHEDULED';

-- Create indexes
CREATE INDEX `idx_inspections_schedule_type` ON `inspections`(`schedule_type`);
CREATE INDEX `idx_inspections_org_schedule_type` ON `inspections`(`org_id`, `schedule_type`);



