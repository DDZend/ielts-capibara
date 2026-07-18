CREATE TABLE `assessment_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text NOT NULL,
	`target_band` real NOT NULL,
	`exam_timing` text NOT NULL,
	`current_level` text NOT NULL,
	`weekly_hours` text NOT NULL,
	`overall_band` real NOT NULL,
	`speaking_band` real NOT NULL,
	`writing_band` real NOT NULL,
	`reading_band` real NOT NULL,
	`listening_band` real NOT NULL,
	`priority_skill` text NOT NULL,
	`strength_skill` text NOT NULL,
	`reading_correct` integer NOT NULL,
	`listening_correct` integer NOT NULL,
	`writing_words` integer NOT NULL,
	`speaking_confidence` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assessment_results_user_email_created_at_idx` ON `assessment_results` (`user_email`,`created_at`);