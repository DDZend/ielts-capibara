CREATE TABLE `paid_access_passes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`stripe_checkout_session_id` text NOT NULL,
	`status` text NOT NULL,
	`amount_paid` integer NOT NULL,
	`currency` text NOT NULL,
	`starts_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`credit_amount` integer NOT NULL,
	`credit_reserved_session_id` text,
	`credit_used_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paid_access_passes_checkout_session_uidx` ON `paid_access_passes` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `paid_access_passes_user_expires_at_idx` ON `paid_access_passes` (`user_email`,`expires_at`);