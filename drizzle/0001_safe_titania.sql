CREATE TABLE `mock_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text NOT NULL,
	`week_start` text NOT NULL,
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
CREATE UNIQUE INDEX `mock_results_user_week_uidx` ON `mock_results` (`user_email`,`week_start`);--> statement-breakpoint
CREATE INDEX `mock_results_user_created_at_idx` ON `mock_results` (`user_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `study_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`task_date` text NOT NULL,
	`skill` text NOT NULL,
	`title` text NOT NULL,
	`minutes` integer NOT NULL,
	`task_type` text NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_tasks_user_date_title_uidx` ON `study_tasks` (`user_email`,`task_date`,`title`);--> statement-breakpoint
CREATE INDEX `study_tasks_user_date_idx` ON `study_tasks` (`user_email`,`task_date`);