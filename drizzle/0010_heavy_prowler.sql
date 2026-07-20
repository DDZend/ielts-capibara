CREATE TABLE `staff_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'teacher' NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`permissions_json` text DEFAULT '[]' NOT NULL,
	`invited_by` text NOT NULL,
	`invited_at` text NOT NULL,
	`activated_at` text,
	`last_signed_in_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_roles_email_uidx` ON `staff_roles` (`email`);--> statement-breakpoint
CREATE INDEX `staff_roles_status_role_idx` ON `staff_roles` (`status`,`role`);--> statement-breakpoint
CREATE TABLE `teacher_access_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_access_requests_email_uidx` ON `teacher_access_requests` (`email`);--> statement-breakpoint
CREATE INDEX `teacher_access_requests_status_requested_idx` ON `teacher_access_requests` (`status`,`requested_at`);