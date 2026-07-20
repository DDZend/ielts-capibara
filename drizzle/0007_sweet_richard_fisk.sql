CREATE TABLE `billing_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`stripe_event_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`action_url` text,
	`status` text DEFAULT 'unread' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_notifications_event_uidx` ON `billing_notifications` (`stripe_event_id`);--> statement-breakpoint
CREATE INDEX `billing_notifications_user_created_at_idx` ON `billing_notifications` (`user_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `manual_access_grants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`plan_interval` text NOT NULL,
	`status` text NOT NULL,
	`starts_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`note` text,
	`granted_by` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `manual_access_grants_user_expires_at_idx` ON `manual_access_grants` (`user_email`,`expires_at`);--> statement-breakpoint
CREATE TABLE `promotion_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`percent_off` integer NOT NULL,
	`max_redemptions` integer,
	`redemption_count` integer DEFAULT 0 NOT NULL,
	`reserved_count` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promotion_codes_code_uidx` ON `promotion_codes` (`code`);--> statement-breakpoint
CREATE TABLE `promotion_redemptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`promotion_code_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`stripe_checkout_session_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`redeemed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promotion_redemptions_session_uidx` ON `promotion_redemptions` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `promotion_redemptions_code_user_uidx` ON `promotion_redemptions` (`promotion_code_id`,`user_email`);--> statement-breakpoint
ALTER TABLE `payment_history` ADD `stripe_payment_intent_id` text;--> statement-breakpoint
ALTER TABLE `payment_history` ADD `stripe_charge_id` text;--> statement-breakpoint
ALTER TABLE `payment_history` ADD `stripe_checkout_session_id` text;--> statement-breakpoint
ALTER TABLE `payment_history` ADD `refunded_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_history` ADD `promotion_code` text;--> statement-breakpoint
ALTER TABLE `payment_history` ADD `receipt_url` text;--> statement-breakpoint
ALTER TABLE `payment_history` ADD `invoice_pdf_url` text;--> statement-breakpoint
ALTER TABLE `payment_history` ADD `failure_reason` text;--> statement-breakpoint
ALTER TABLE `payment_history` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `promotion_code` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `current_period_start` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `grace_until` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `last_payment_error` text;
