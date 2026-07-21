CREATE TABLE `capi_tutor_escalations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`message_id` integer NOT NULL,
	`question` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`teacher_reply` text,
	`resolved_by` text,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `capi_tutor_escalations_status_created_idx` ON `capi_tutor_escalations` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `capi_tutor_escalations_user_created_idx` ON `capi_tutor_escalations` (`user_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `capi_tutor_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`intent` text DEFAULT 'general' NOT NULL,
	`citations_json` text DEFAULT '[]' NOT NULL,
	`practice_json` text,
	`confidence` real,
	`escalation_required` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `capi_tutor_messages_user_created_idx` ON `capi_tutor_messages` (`user_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `capi_tutor_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`usage_date` text NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capi_tutor_usage_user_date_uidx` ON `capi_tutor_usage` (`user_email`,`usage_date`);