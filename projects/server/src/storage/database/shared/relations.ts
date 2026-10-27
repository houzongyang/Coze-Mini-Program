import { relations } from "drizzle-orm/relations";
import { users, documents, orders, logisticsTracks, addresses, orderItems, merchants } from "./schema";

export const documentsRelations = relations(documents, ({one, many}) => ({
	user: one(users, {
		fields: [documents.userId],
		references: [users.id]
	}),
	orderItems: many(orderItems),
}));

export const usersRelations = relations(users, ({many}) => ({
	documents: many(documents),
	addresses: many(addresses),
	merchants: many(merchants),
	orders: many(orders),
}));

export const logisticsTracksRelations = relations(logisticsTracks, ({one}) => ({
	order: one(orders, {
		fields: [logisticsTracks.orderId],
		references: [orders.id]
	}),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	logisticsTracks: many(logisticsTracks),
	orderItems: many(orderItems),
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
	merchant: one(merchants, {
		fields: [orders.merchantId],
		references: [merchants.id]
	}),
	address: one(addresses, {
		fields: [orders.addressId],
		references: [addresses.id]
	}),
}));

export const addressesRelations = relations(addresses, ({one, many}) => ({
	user: one(users, {
		fields: [addresses.userId],
		references: [users.id]
	}),
	orders: many(orders),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	document: one(documents, {
		fields: [orderItems.documentId],
		references: [documents.id]
	}),
}));

export const merchantsRelations = relations(merchants, ({one, many}) => ({
	user: one(users, {
		fields: [merchants.userId],
		references: [users.id]
	}),
	orders: many(orders),
}));