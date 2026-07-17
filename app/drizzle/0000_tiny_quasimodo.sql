CREATE TABLE `decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`decision` text NOT NULL,
	`previous_decision` text,
	`justification` text NOT NULL,
	`cited_rule_ids` text NOT NULL,
	`source` text NOT NULL,
	`guard_override` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "decisions_decision_check" CHECK("decisions"."decision" in ('APPROVE','REJECT','MORE_INFO','ESCALATE')),
	CONSTRAINT "decisions_previous_decision_check" CHECK("decisions"."previous_decision" is null or "decisions"."previous_decision" in ('APPROVE','REJECT','MORE_INFO','ESCALATE')),
	CONSTRAINT "decisions_source_check" CHECK("decisions"."source" in ('initial','chat_revision'))
);
--> statement-breakpoint
CREATE INDEX `decisions_session_id_idx` ON `decisions` (`session_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`parts` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "messages_role_check" CHECK("messages"."role" in ('user','assistant'))
);
--> statement-breakpoint
CREATE INDEX `messages_session_id_idx` ON `messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `messages_session_id_created_at_idx` ON `messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`request_type` text NOT NULL,
	`category` text NOT NULL,
	`product_name` text NOT NULL,
	`purchase_date` text NOT NULL,
	`reason` text,
	`image_path` text NOT NULL,
	`image_original_name` text NOT NULL,
	`image_media_type` text NOT NULL,
	`vision_analysis` text,
	`status` text DEFAULT 'created' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "sessions_request_type_check" CHECK("sessions"."request_type" in ('complaint','return')),
	CONSTRAINT "sessions_category_check" CHECK("sessions"."category" in ('smartphone','laptop','tablet','tv_monitor','audio','small_appliance','peripherals','other')),
	CONSTRAINT "sessions_status_check" CHECK("sessions"."status" in ('created','analyzed','analysis_failed'))
);
