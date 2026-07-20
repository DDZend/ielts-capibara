CREATE TABLE `mock_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`test_id` integer NOT NULL,
	`version_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`exam_mode` integer DEFAULT true NOT NULL,
	`current_item_index` integer DEFAULT 0 NOT NULL,
	`current_section` text DEFAULT 'Reading' NOT NULL,
	`section_started_at` text NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`reading_correct` integer,
	`reading_total` integer,
	`listening_correct` integer,
	`listening_total` integer,
	`reading_band` real,
	`listening_band` real,
	`writing_ai_band` real,
	`speaking_ai_band` real,
	`writing_teacher_band` real,
	`speaking_teacher_band` real,
	`overall_band` real,
	`teacher_comment` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`submitted_at` text
);
--> statement-breakpoint
CREATE INDEX `mock_attempts_user_status_updated_idx` ON `mock_attempts` (`user_email`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `mock_attempts_user_submitted_idx` ON `mock_attempts` (`user_email`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `mock_attempts_version_status_idx` ON `mock_attempts` (`version_id`,`status`);--> statement-breakpoint
CREATE TABLE `mock_item_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`item_key` text NOT NULL,
	`skill` text NOT NULL,
	`question_type` text NOT NULL,
	`correct` integer,
	`raw_score` real DEFAULT 0 NOT NULL,
	`max_score` real DEFAULT 1 NOT NULL,
	`ai_band` real,
	`teacher_band` real,
	`feedback_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mock_item_results_attempt_item_uidx` ON `mock_item_results` (`attempt_id`,`item_key`);--> statement-breakpoint
CREATE INDEX `mock_item_results_type_correct_idx` ON `mock_item_results` (`question_type`,`correct`);--> statement-breakpoint
CREATE TABLE `mock_recordings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`item_key` text NOT NULL,
	`user_email` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`ai_feedback_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mock_recordings_attempt_item_uidx` ON `mock_recordings` (`attempt_id`,`item_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `mock_recordings_r2_key_uidx` ON `mock_recordings` (`r2_key`);--> statement-breakpoint
CREATE TABLE `mock_test_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`test_id` integer NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`reading_minutes` integer DEFAULT 60 NOT NULL,
	`listening_minutes` integer DEFAULT 40 NOT NULL,
	`writing_minutes` integer DEFAULT 60 NOT NULL,
	`speaking_minutes` integer DEFAULT 15 NOT NULL,
	`items_json` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mock_test_versions_test_label_uidx` ON `mock_test_versions` (`test_id`,`label`);--> statement-breakpoint
CREATE INDEX `mock_test_versions_status_published_idx` ON `mock_test_versions` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `mock_tests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mock_tests_status_updated_idx` ON `mock_tests` (`status`,`updated_at`);