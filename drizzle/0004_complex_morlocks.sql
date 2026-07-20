CREATE TABLE `payment_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`stripe_event_id` text NOT NULL,
	`stripe_invoice_id` text,
	`amount_paid` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`plan_interval` text NOT NULL,
	`discount_percent` integer DEFAULT 0 NOT NULL,
	`paid_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_history_stripe_event_uidx` ON `payment_history` (`stripe_event_id`);--> statement-breakpoint
CREATE INDEX `payment_history_user_paid_at_idx` ON `payment_history` (`user_email`,`paid_at`);--> statement-breakpoint
CREATE TABLE `sponsored_access_passes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`donor_email` text NOT NULL,
	`pass_code` text NOT NULL,
	`coins` integer NOT NULL,
	`access_hours` integer NOT NULL,
	`recipient_email` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`claimed_at` text,
	`expires_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sponsored_access_passes_code_uidx` ON `sponsored_access_passes` (`pass_code`);--> statement-breakpoint
CREATE INDEX `sponsored_access_passes_donor_created_at_idx` ON `sponsored_access_passes` (`donor_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `sponsored_access_passes_recipient_expires_at_idx` ON `sponsored_access_passes` (`recipient_email`,`expires_at`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan_interval` text NOT NULL,
	`status` text NOT NULL,
	`discount_percent` integer DEFAULT 0 NOT NULL,
	`current_period_end` text,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_user_email_uidx` ON `subscriptions` (`user_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_stripe_subscription_uidx` ON `subscriptions` (`stripe_subscription_id`);