CREATE TABLE `attendance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`student_email` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`marked_by` text NOT NULL,
	`marked_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_records_session_student_uidx` ON `attendance_records` (`session_id`,`student_email`);--> statement-breakpoint
CREATE TABLE `class_bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`student_email` text NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`booked_at` text NOT NULL,
	`cancelled_at` text,
	`cancellation_reason` text,
	`rescheduled_from_session_id` integer,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_bookings_session_student_uidx` ON `class_bookings` (`session_id`,`student_email`);--> statement-breakpoint
CREATE INDEX `class_bookings_student_status_idx` ON `class_bookings` (`student_email`,`status`);--> statement-breakpoint
CREATE TABLE `class_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`session_type` text NOT NULL,
	`cohort_id` integer,
	`student_email` text,
	`teacher_email` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`timezone` text NOT NULL,
	`meeting_provider` text NOT NULL,
	`meeting_url` text NOT NULL,
	`capacity` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`cancellation_reason` text,
	`cancelled_by` text,
	`cancelled_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `class_sessions_teacher_starts_idx` ON `class_sessions` (`teacher_email`,`starts_at`);--> statement-breakpoint
CREATE INDEX `class_sessions_cohort_starts_idx` ON `class_sessions` (`cohort_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `class_sessions_student_starts_idx` ON `class_sessions` (`student_email`,`starts_at`);--> statement-breakpoint
CREATE TABLE `cohort_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cohort_id` integer NOT NULL,
	`student_email` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cohort_members_cohort_student_uidx` ON `cohort_members` (`cohort_id`,`student_email`);--> statement-breakpoint
CREATE INDEX `cohort_members_student_status_idx` ON `cohort_members` (`student_email`,`status`);--> statement-breakpoint
CREATE TABLE `cohorts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target_band` real NOT NULL,
	`teacher_email` text,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cohorts_teacher_status_idx` ON `cohorts` (`teacher_email`,`status`);--> statement-breakpoint
CREATE TABLE `homework_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`instructions` text NOT NULL,
	`module` text NOT NULL,
	`lesson_id` text,
	`exercise_id` text,
	`assigned_to_type` text NOT NULL,
	`assigned_to_value` text NOT NULL,
	`due_at` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`assigned_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `homework_assignments_target_due_idx` ON `homework_assignments` (`assigned_to_type`,`assigned_to_value`,`due_at`);--> statement-breakpoint
CREATE TABLE `homework_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignment_id` integer NOT NULL,
	`student_email` text NOT NULL,
	`status` text DEFAULT 'assigned' NOT NULL,
	`student_note` text,
	`teacher_comment` text,
	`submitted_at` text,
	`reviewed_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homework_submissions_assignment_student_uidx` ON `homework_submissions` (`assignment_id`,`student_email`);--> statement-breakpoint
CREATE INDEX `homework_submissions_student_status_idx` ON `homework_submissions` (`student_email`,`status`);--> statement-breakpoint
CREATE TABLE `student_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_email` text NOT NULL,
	`teacher_email` text NOT NULL,
	`body` text NOT NULL,
	`visible_to_student` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `student_notes_student_created_idx` ON `student_notes` (`student_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `student_teacher_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_email` text NOT NULL,
	`teacher_email` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_teacher_assignments_student_uidx` ON `student_teacher_assignments` (`student_email`);--> statement-breakpoint
CREATE INDEX `student_teacher_assignments_teacher_status_idx` ON `student_teacher_assignments` (`teacher_email`,`status`);--> statement-breakpoint
CREATE TABLE `teacher_availability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`teacher_email` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`timezone` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `teacher_availability_teacher_day_idx` ON `teacher_availability` (`teacher_email`,`day_of_week`);--> statement-breakpoint
CREATE TABLE `teacher_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Almaty' NOT NULL,
	`color` text DEFAULT '#16803e' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_profiles_email_uidx` ON `teacher_profiles` (`email`);