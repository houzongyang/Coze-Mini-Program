import { pgTable, index, foreignKey, varchar, integer, timestamp, serial, text, boolean, numeric, unique, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const documents = pgTable("documents", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	fileKey: varchar("file_key", { length: 256 }).notNull(),
	fileName: varchar("file_name", { length: 256 }).notNull(),
	fileType: varchar("file_type", { length: 32 }).notNull(),
	fileSize: integer("file_size").notNull(),
	pageCount: integer("page_count").default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("documents_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("documents_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "documents_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const logisticsTracks = pgTable("logistics_tracks", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	status: varchar({ length: 32 }).notNull(),
	location: varchar({ length: 128 }),
	description: text(),
	trackedAt: timestamp("tracked_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("logistics_tracks_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("logistics_tracks_tracked_at_idx").using("btree", table.trackedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "logistics_tracks_order_id_orders_id_fk"
		}).onDelete("cascade"),
]);

export const addresses = pgTable("addresses", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	name: varchar({ length: 64 }).notNull(),
	phone: varchar({ length: 20 }).notNull(),
	province: varchar({ length: 32 }).notNull(),
	city: varchar({ length: 32 }).notNull(),
	district: varchar({ length: 32 }).notNull(),
	detail: varchar({ length: 256 }).notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("addresses_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "addresses_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const orderItems = pgTable("order_items", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	documentId: varchar("document_id", { length: 36 }).notNull(),
	copies: integer().default(1).notNull(),
	colorMode: varchar("color_mode", { length: 20 }).default('bw').notNull(),
	sides: varchar({ length: 20 }).default('single').notNull(),
	paperSize: varchar("paper_size", { length: 20 }).default('a4').notNull(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("order_items_document_id_idx").using("btree", table.documentId.asc().nullsLast().op("text_ops")),
	index("order_items_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_orders_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "order_items_document_id_documents_id_fk"
		}).onDelete("cascade"),
]);

export const merchants = pgTable("merchants", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	shopName: varchar("shop_name", { length: 128 }).notNull(),
	contactPhone: varchar("contact_phone", { length: 20 }).notNull(),
	address: varchar({ length: 256 }).notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("merchants_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("merchants_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "merchants_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const priceSettings = pgTable("price_settings", {
	id: serial().primaryKey().notNull(),
	colorBwSingle: numeric("color_bw_single", { precision: 10, scale:  2 }).default('0.10').notNull(),
	colorBwDouble: numeric("color_bw_double", { precision: 10, scale:  2 }).default('0.15').notNull(),
	colorColorSingle: numeric("color_color_single", { precision: 10, scale:  2 }).default('1.00').notNull(),
	colorColorDouble: numeric("color_color_double", { precision: 10, scale:  2 }).default('1.50').notNull(),
	paperA4: numeric("paper_a4", { precision: 10, scale:  2 }).default('0.00').notNull(),
	paperA3: numeric("paper_a3", { precision: 10, scale:  2 }).default('0.50').notNull(),
	paperB5: numeric("paper_b5", { precision: 10, scale:  2 }).default('0.00').notNull(),
	shippingFee: numeric("shipping_fee", { precision: 10, scale:  2 }).default('5.00').notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	openid: varchar({ length: 64 }).notNull(),
	nickname: varchar({ length: 128 }),
	avatarUrl: varchar("avatar_url", { length: 512 }),
	phone: varchar({ length: 20 }),
	role: varchar({ length: 20 }).default('customer').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("users_openid_idx").using("btree", table.openid.asc().nullsLast().op("text_ops")),
	index("users_role_idx").using("btree", table.role.asc().nullsLast().op("text_ops")),
	unique("users_openid_unique").on(table.openid),
]);

export const orders = pgTable("orders", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	orderNo: varchar("order_no", { length: 32 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	merchantId: varchar("merchant_id", { length: 36 }),
	addressId: varchar("address_id", { length: 36 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	totalPrice: numeric("total_price", { precision: 10, scale:  2 }).notNull(),
	printSettings: jsonb("print_settings").notNull(),
	logisticsCompany: varchar("logistics_company", { length: 32 }),
	logisticsNo: varchar("logistics_no", { length: 64 }),
	remark: text(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	printedAt: timestamp("printed_at", { withTimezone: true, mode: 'string' }),
	shippedAt: timestamp("shipped_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("orders_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("orders_merchant_id_idx").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
	index("orders_order_no_idx").using("btree", table.orderNo.asc().nullsLast().op("text_ops")),
	index("orders_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("orders_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "orders_merchant_id_merchants_id_fk"
		}),
	foreignKey({
			columns: [table.addressId],
			foreignColumns: [addresses.id],
			name: "orders_address_id_addresses_id_fk"
		}),
	unique("orders_order_no_unique").on(table.orderNo),
]);

// 代理商表
export const agents = pgTable("agents", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	inviteCode: varchar("invite_code", { length: 16 }).notNull(),
	commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).default('0.05').notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	totalCommission: numeric("total_commission", { precision: 10, scale: 2 }).default('0').notNull(),
	balance: numeric({ precision: 10, scale: 2 }).default('0').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("agents_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("agents_invite_code_idx").using("btree", table.inviteCode.asc().nullsLast().op("text_ops")),
	index("agents_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "agents_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("agents_invite_code_unique").on(table.inviteCode),
]);

// 佣金记录表
export const agentCommissions = pgTable("agent_commissions", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	agentId: varchar("agent_id", { length: 36 }).notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	amount: numeric({ precision: 10, scale: 2 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_commissions_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	index("agent_commissions_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_commissions_agent_id_agents_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "agent_commissions_order_id_orders_id_fk"
		}).onDelete("cascade"),
]);

// 提现记录表
export const agentWithdrawals = pgTable("agent_withdrawals", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	agentId: varchar("agent_id", { length: 36 }).notNull(),
	amount: numeric({ precision: 10, scale: 2 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("agent_withdrawals_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_withdrawals_agent_id_agents_id_fk"
		}).onDelete("cascade"),
]);

// 用户推广来源表
export const userReferrals = pgTable("user_referrals", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	agentId: varchar("agent_id", { length: 36 }).notNull(),
	invitedAt: timestamp("invited_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_referrals_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("user_referrals_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_referrals_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "user_referrals_agent_id_agents_id_fk"
		}).onDelete("cascade"),
]);
