-- Update template description to Mongolian
UPDATE inspection_templates 
SET description = 'Жинлүүрийн үзлэг',
updated_at = NOW()
WHERE id = 1 AND name = 'weighing_scale_inspection';



