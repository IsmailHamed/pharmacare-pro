CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`batch_number` text NOT NULL,
	`expiry_date` text NOT NULL,
	`qty_packs` integer NOT NULL,
	`branch_id` text DEFAULT 'MAIN_BRANCH' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cash_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`notes` text,
	`shift_id` text NOT NULL,
	`created_at` text NOT NULL,
	`branch_id` text DEFAULT 'MAIN_BRANCH' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `controlled_drug_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`scientific_name` text NOT NULL,
	`barcode` text NOT NULL,
	`unit` text NOT NULL,
	`qty` integer NOT NULL,
	`batch_number` text NOT NULL,
	`patient_name` text NOT NULL,
	`national_id` text NOT NULL,
	`doctor_name` text NOT NULL,
	`prescription_id` text NOT NULL,
	`dispensed_at` text NOT NULL,
	`branch_id` text DEFAULT 'MAIN_BRANCH' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payment_mode` text NOT NULL,
	`customer_name` text NOT NULL,
	`subtotal` real NOT NULL,
	`discount_percent` real DEFAULT 0 NOT NULL,
	`total_amount` real NOT NULL,
	`total_cost_amount` real DEFAULT 0 NOT NULL,
	`net_profit` real DEFAULT 0 NOT NULL,
	`items_json` text NOT NULL,
	`created_at` text NOT NULL,
	`branch_id` text DEFAULT 'MAIN_BRANCH' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`barcode` text NOT NULL,
	`name` text NOT NULL,
	`scientific_name` text NOT NULL,
	`category` text DEFAULT 'عام' NOT NULL,
	`pack_price` real NOT NULL,
	`weighted_cost_price` real NOT NULL,
	`strips_per_pack` integer DEFAULT 1 NOT NULL,
	`stock_packs` integer DEFAULT 0 NOT NULL,
	`stock_loose_strips` integer DEFAULT 0 NOT NULL,
	`min_limit` integer DEFAULT 5 NOT NULL,
	`is_controlled` integer DEFAULT false NOT NULL,
	`branch_id` text DEFAULT 'MAIN_BRANCH' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode_unique` ON `products` (`barcode`);--> statement-breakpoint
CREATE TABLE `purchase_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_name` text NOT NULL,
	`supplier_invoice_number` text NOT NULL,
	`payment_mode` text NOT NULL,
	`total_amount` real NOT NULL,
	`total_bonus_value` real DEFAULT 0 NOT NULL,
	`items_json` text NOT NULL,
	`created_at` text NOT NULL,
	`branch_id` text DEFAULT 'MAIN_BRANCH' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`pharmacist_name` text NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text,
	`status` text NOT NULL,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`cash_sales_total` real DEFAULT 0 NOT NULL,
	`credit_sales_total` real DEFAULT 0 NOT NULL,
	`returns_total` real DEFAULT 0 NOT NULL,
	`petty_cash_total` real DEFAULT 0 NOT NULL,
	`expected_drawer_cash` real DEFAULT 0 NOT NULL,
	`actual_drawer_cash` real,
	`variance` real,
	`branch_id` text DEFAULT 'MAIN_BRANCH' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`operation` text NOT NULL,
	`record_id` text NOT NULL,
	`payload` text NOT NULL,
	`branch_id` text DEFAULT 'MAIN_BRANCH' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL,
	`synced_at` text
);
