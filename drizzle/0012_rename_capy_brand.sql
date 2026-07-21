UPDATE `mock_tests`
SET `title` = replace(replace(replace(replace(`title`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `description` = replace(replace(replace(replace(`description`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY');
--> statement-breakpoint
UPDATE `mock_test_versions`
SET `label` = replace(replace(replace(replace(`label`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `items_json` = replace(replace(replace(replace(`items_json`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY');
--> statement-breakpoint
UPDATE `capi_tutor_messages`
SET `content` = replace(replace(replace(replace(`content`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `practice_json` = replace(replace(replace(replace(`practice_json`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY')
WHERE `role` IN ('capi', 'teacher');
--> statement-breakpoint
UPDATE `capi_tutor_escalations`
SET `reason` = replace(replace(replace(replace(`reason`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `teacher_reply` = replace(replace(replace(replace(`teacher_reply`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY');
--> statement-breakpoint
UPDATE `ai_practice_assessments`
SET `summary` = replace(replace(replace(replace(`summary`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `strengths_json` = replace(replace(replace(replace(`strengths_json`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `priorities_json` = replace(replace(replace(replace(`priorities_json`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY');
--> statement-breakpoint
UPDATE `creator_lessons`
SET `title` = replace(replace(replace(replace(`title`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `vocabulary_json` = replace(replace(replace(replace(`vocabulary_json`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `exercises_json` = replace(replace(replace(replace(`exercises_json`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `transcript` = replace(replace(replace(replace(`transcript`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY'),
    `answer_key_json` = replace(replace(replace(replace(`answer_key_json`, 'Capibara', 'Capybara'), 'capibara', 'capybara'), 'Capi', 'Capy'), 'CAPI', 'CAPY');
