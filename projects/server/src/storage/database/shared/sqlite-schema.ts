import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  openid: text("openid").notNull(),
  nickname: text("nickname"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  role: text("role").default("customer").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at"),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  pageCount: integer("page_count").default(1).notNull(),
  filePath: text("file_path"),  // absolute path to stored file on disk
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const addresses = sqliteTable("addresses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  province: text("province").notNull(),
  city: text("city").notNull(),
  district: text("district").notNull(),
  detail: text("detail").notNull(),
  isDefault: integer("is_default").default(0).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at"),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  orderNo: text("order_no").notNull(),
  userId: text("user_id").notNull(),
  merchantId: text("merchant_id"),
  addressId: text("address_id").notNull(),
  status: text("status").default("pending").notNull(),
  totalPrice: real("total_price").notNull(),
  shippingFee: real("shipping_fee").default(0),
  orderType: text("order_type").default("normal"),
  printSettings: text("print_settings").notNull(),
  logisticsCompany: text("logistics_company"),
  logisticsNo: text("logistics_no"),
  remark: text("remark"),
  paidAt: text("paid_at"),
  printedAt: text("printed_at"),
  shippedAt: text("shipped_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at"),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  documentId: text("document_id").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  copies: integer("copies").default(1).notNull(),
  colorMode: text("color_mode").default("bw").notNull(),
  sides: text("sides").default("single").notNull(),
  paperSize: text("paper_size").default("a4").notNull(),
  binding: text("binding").default("none"),
  hasCover: integer("has_cover").default(0).notNull(),
  coverLaminated: integer("cover_laminated").default(0).notNull(),
  pageCount: integer("page_count").default(1).notNull(),
  price: real("price").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const priceItems = sqliteTable("price_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  optionName: text("option_name").notNull(),
  price: real("price").notNull(),
  unit: text("unit").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  inviteCode: text("invite_code").notNull(),
  commissionRate: real("commission_rate").default(0.05).notNull(),
  status: text("status").default("pending").notNull(),
  totalCommission: real("total_commission").default(0).notNull(),
  balance: real("balance").default(0).notNull(),
  realName: text("real_name"),
  phone: text("phone"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at"),
});

export const agentCommissions = sqliteTable("agent_commissions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  orderId: text("order_id").notNull(),
  amount: real("amount").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const agentWithdrawals = sqliteTable("agent_withdrawals", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  amount: real("amount").notNull(),
  // pending | approved | rejected
  status: text("status").default("pending").notNull(),
  alipayAccount: text("alipay_account"),
  realName: text("real_name"),
  rejectReason: text("reject_reason"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at"),
});

export const userReferrals = sqliteTable("user_referrals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  agentId: text("agent_id").notNull(),
  invitedAt: text("invited_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const userPoints = sqliteTable("user_points", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  totalPoints: integer("total_points").default(0).notNull(),
  usedPoints: integer("used_points").default(0).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at"),
});

export const gifts = sqliteTable("gifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  requiredPoints: integer("required_points").notNull(),
  stock: integer("stock").notNull(),
  isActive: integer("is_active").default(1).notNull(),
  imageUrl: text("image_url"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const exchangeRecords = sqliteTable("exchange_records", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  giftId: integer("gift_id").notNull(),
  pointsUsed: integer("points_used").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const draftOrders = sqliteTable("draft_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  documents: text("documents").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at"),
});
