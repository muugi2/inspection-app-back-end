-- Fix orphaned inspection_question_images (answer_id = NULL)
-- These images lost their answer_id due to CASCADE delete before the fix was implemented

-- Option 1: Delete orphaned images (if they are old/invalid data)
-- DELETE FROM inspection_question_images WHERE answer_id IS NULL;

-- Option 2: Check which images are orphaned
SELECT 
  id,
  answer_id,
  field_id,
  section,
  image_order,
  image_url,
  created_at
FROM inspection_question_images
WHERE answer_id IS NULL
ORDER BY created_at DESC;

-- After checking the above, you can decide whether to:
-- 1. Delete them (if they are old test data): DELETE FROM inspection_question_images WHERE answer_id IS NULL;
-- 2. Keep them for historical purposes (they won't show up in reports anyway)

-- Note: This issue is now fixed in the code. New images will not become orphaned because:
-- 1. handleCompletionOperation updates inspection_question_images before deleting old answers
-- 2. handleSignaturesOperation updates inspection_question_images before deleting separate signature answers
-- 3. handleRemarksOperation updates inspection_question_images before deleting separate remarks answers












