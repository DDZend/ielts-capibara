CREATE TABLE `creator_lessons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module` text NOT NULL,
	`lesson_id` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`video_media_id` integer,
	`audio_media_id` integer,
	`vocabulary_json` text DEFAULT '[]' NOT NULL,
	`exercises_json` text DEFAULT '[]' NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`answer_key_json` text DEFAULT '[]' NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_lessons_module_lesson_uidx` ON `creator_lessons` (`module`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `creator_lessons_module_position_idx` ON `creator_lessons` (`module`,`position`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_r2_key_uidx` ON `media_assets` (`r2_key`);--> statement-breakpoint
CREATE INDEX `media_assets_owner_created_at_idx` ON `media_assets` (`owner_email`,`created_at`);