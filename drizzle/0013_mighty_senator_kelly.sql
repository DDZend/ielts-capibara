CREATE TABLE `notification_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notification_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`provider_message_id` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sent_at` text,
	`opened_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_notification_channel_uidx` ON `notification_deliveries` (`notification_id`,`channel`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_status_next_idx` ON `notification_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_provider_idx` ON `notification_deliveries` (`provider_message_id`);--> statement-breakpoint
CREATE TABLE `notification_delivery_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`webhook_id` text NOT NULL,
	`provider_message_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_delivery_events_webhook_uidx` ON `notification_delivery_events` (`webhook_id`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`in_app_enabled` integer DEFAULT true NOT NULL,
	`email_enabled` integer DEFAULT true NOT NULL,
	`upcoming_classes` integer DEFAULT true NOT NULL,
	`new_homework` integer DEFAULT true NOT NULL,
	`homework_deadlines` integer DEFAULT true NOT NULL,
	`teacher_comments` integer DEFAULT true NOT NULL,
	`weekend_mock` integer DEFAULT true NOT NULL,
	`membership` integer DEFAULT true NOT NULL,
	`sponsored_pass` integer DEFAULT true NOT NULL,
	`weekly_report` integer DEFAULT true NOT NULL,
	`announcements` integer DEFAULT true NOT NULL,
	`quiet_start` text DEFAULT '22:00' NOT NULL,
	`quiet_end` text DEFAULT '08:00' NOT NULL,
	`timezone` text DEFAULT 'Asia/Almaty' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_user_uidx` ON `notification_preferences` (`user_email`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`source_key` text,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`action_url` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	`opened_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_source_key_uidx` ON `notifications` (`source_key`);--> statement-breakpoint
CREATE INDEX `notifications_user_status_created_idx` ON `notifications` (`user_email`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_category_created_idx` ON `notifications` (`category`,`created_at`);--> statement-breakpoint
CREATE TABLE `teacher_announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`audience_type` text NOT NULL,
	`audience_value` text,
	`action_url` text,
	`recipient_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`sent_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `teacher_announcements_created_idx` ON `teacher_announcements` (`created_at`);