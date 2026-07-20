CREATE TABLE `ai_practice_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`skill` text NOT NULL,
	`lesson_id` text NOT NULL,
	`overall_band` real NOT NULL,
	`criterion_one` real NOT NULL,
	`criterion_two` real NOT NULL,
	`criterion_three` real NOT NULL,
	`criterion_four` real NOT NULL,
	`summary` text NOT NULL,
	`strengths_json` text NOT NULL,
	`priorities_json` text NOT NULL,
	`word_count` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_practice_assessments_user_created_at_idx` ON `ai_practice_assessments` (`user_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_practice_assessments_user_skill_created_at_idx` ON `ai_practice_assessments` (`user_email`,`skill`,`created_at`);--> statement-breakpoint
CREATE TABLE `lesson_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`module` text NOT NULL,
	`lesson_id` text NOT NULL,
	`lesson_title` text NOT NULL,
	`status` text NOT NULL,
	`score` real NOT NULL,
	`correct_count` integer NOT NULL,
	`total_count` integer NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`completed_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_progress_user_module_lesson_uidx` ON `lesson_progress` (`user_email`,`module`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `lesson_progress_user_updated_at_idx` ON `lesson_progress` (`user_email`,`updated_at`);