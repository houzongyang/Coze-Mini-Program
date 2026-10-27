import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { db } from '@/storage/database/sqlite-client';
import { orders, orderItems, draftOrders, priceItems } from '@/storage/database/shared/sqlite-schema';
import { eq } from 'drizzle-orm';
import { AgentsService } from '@/agents/agents.service';

/** 达到这些状态时触发佣金结算（幂等） */
const COMMISSION_TRIGGER_STATUSES = new Set(['completed', 'paid']);

@Injectable()
export class OrdersService {
  constructor(
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
  ) {}
  /** 服务端使用与 price-settings 相同规则独立计算总价，防止客户端篡改 */
  private async calcServerPrice(documents: Array<{
    page_count: number;
    copies: number;
    color_mode: string;
    sides: string;
    paper_size: string;
    binding: string;
    has_cover: boolean;
    cover_laminated: boolean;
  }>): Promise<{ docsTotal: number; shippingFee: number; total: number; perDocPrices: number[] }> {
    const items = await db.select().from(priceItems);
    const pm = new Map<string, number>(items.map(i => [i.optionName, i.price]));

    const get = (name: string) => pm.get(name) ?? 0;

    const perDocPrices: number[] = [];
    let docsTotal = 0;

    for (const doc of documents) {
      let pp = doc.color_mode === 'bw' ? get('黑白打印') : get('彩色打印');
      if (doc.sides === 'double') pp += get('双面打印');
      const paperExtra = doc.paper_size === 'a3' ? get('A3纸张') : 0;
      let docTotal = (pp + paperExtra) * doc.page_count * doc.copies;

      if (doc.binding === 'staple') docTotal += get('平钉装订') * doc.copies;
      else if (doc.binding === 'saddle') docTotal += get('骑马钉装订') * doc.copies;
      else if (doc.binding === 'glue') docTotal += get('胶装装订') * doc.copies;

      if (doc.has_cover) {
        docTotal += (doc.cover_laminated ? get('铜版纸覆膜封面') : get('皮纹纸封面')) * doc.copies;
      }

      perDocPrices.push(docTotal);
      docsTotal += docTotal;
    }

    const threshold = get('免费配送门槛') || 10;
    const shippingFee = docsTotal < threshold ? get('配送费') : 0;
    return { docsTotal, shippingFee, total: docsTotal + shippingFee, perDocPrices };
  }

  async createOrder(data: {
    documents: Array<{
      file_name: string;
      file_url: string;
      page_count: number;
      copies: number;
      color_mode: string;
      sides: string;
      paper_size: string;
      binding: string;
      has_cover: boolean;
      cover_laminated: boolean;
      price: number;
    }>;
    address_id?: string;
    total_price: number;
    shipping_fee?: number;
    order_type?: string;
    status?: string;
    user_id?: string;
  }) {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const orderNo = `CP${Date.now().toString().slice(-10)}`;

    // 服务端独立计算价格，不信任客户端传来的 total_price / doc.price
    const serverPriceResult = await this.calcServerPrice(data.documents);
    const serverTotal = serverPriceResult.total;
    const serverShipping = serverPriceResult.shippingFee;

    // 校验：客户端与服务端价格偏差超过 0.01 元时记录告警（仍使用服务端价格落库）
    const clientTotal = data.total_price || 0;
    if (Math.abs(clientTotal - serverTotal) > 0.01) {
      console.warn(
        `[OrdersService] 价格校验差异 client=${clientTotal.toFixed(2)} server=${serverTotal.toFixed(2)}，使用服务端价格`
      );
    }

    const orderData = {
      id: orderId,
      orderNo: orderNo,
      userId: data.user_id || 'demo-user',
      addressId: data.address_id || 'default-address',
      status: data.status || 'pending_payment',
      totalPrice: serverTotal,      // 落库服务端价格
      shippingFee: serverShipping,
      orderType: data.order_type || 'normal',
      printSettings: JSON.stringify({
        documents: data.documents.map((doc, i) => ({
          file_name: doc.file_name,
          file_url: doc.file_url,
          page_count: doc.page_count,
          copies: doc.copies,
          color_mode: doc.color_mode,
          sides: doc.sides,
          paper_size: doc.paper_size,
          binding: doc.binding,
          has_cover: doc.has_cover,
          cover_laminated: doc.cover_laminated,
          price: serverPriceResult.perDocPrices[i] ?? 0,
        }))
      }),
    };

    await db.insert(orders).values(orderData);

    for (let i = 0; i < data.documents.length; i++) {
      const doc = data.documents[i];
      const itemData = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        orderId: orderId,
        documentId: `${orderId}_${i}`,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        copies: doc.copies,
        colorMode: doc.color_mode,
        sides: doc.sides,
        paperSize: doc.paper_size,
        binding: doc.binding,
        hasCover: doc.has_cover ? 1 : 0,
        coverLaminated: doc.cover_laminated ? 1 : 0,
        pageCount: doc.page_count,
        price: serverPriceResult.perDocPrices[i] ?? 0, // 服务端计算价格
      };
      await db.insert(orderItems).values(itemData);
    }

    return {
      order_id: orderId,
      order_no: orderNo,
      total_price: serverTotal,      // 返回服务端价格给前端
      shipping_fee: serverShipping,
      status: data.status || 'pending_payment',
      created_at: new Date().toISOString(),
    };
  }

  async getOrders(userId?: string, status?: string) {
    const result = userId 
      ? await db.select().from(orders).where(eq(orders.userId, userId))
      : await db.select().from(orders);
    return result.map(order => ({
      id: order.id,
      order_no: order.orderNo,
      user_id: order.userId,
      status: order.status,
      total_price: order.totalPrice,
      shipping_fee: order.shippingFee,
      created_at: order.createdAt,
      print_settings: order.printSettings ? JSON.parse(order.printSettings) : {},
    }));
  }

  async getOrderById(orderId: string) {
    const result = await db.select().from(orders).where(eq(orders.id, orderId));
    const order = result[0];
    if (!order) {
      return null;
    }

    const itemsResult = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const items = itemsResult.map(item => ({
      id: item.id,
      file_name: item.fileName,
      file_url: item.fileUrl,
      page_count: item.pageCount,
      copies: item.copies,
      color_mode: item.colorMode,
      sides: item.sides,
      paper_size: item.paperSize,
      binding: item.binding,
      has_cover: item.hasCover === 1,
      cover_laminated: item.coverLaminated === 1,
      price: item.price,
    }));

    return {
      ...order,
      print_settings: order.printSettings ? JSON.parse(order.printSettings) : {},
      items,
    };
  }

  async updateOrderStatus(orderId: string, status: string, options?: {
    merchant_id?: string;
    logistics_company?: string;
    logistics_no?: string;
  }) {
    const now = new Date().toISOString();
    const updateData: any = { status, updatedAt: now };
    if (options?.merchant_id) updateData.merchantId = options.merchant_id;
    if (options?.logistics_company) updateData.logisticsCompany = options.logistics_company;
    if (options?.logistics_no) updateData.logisticsNo = options.logistics_no;
    if (status === 'paid') updateData.paidAt = now;
    if (status === 'printed') updateData.printedAt = now;
    if (status === 'shipped') updateData.shippedAt = now;
    if (status === 'completed') updateData.completedAt = now;

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    // 订单达到终态时幂等触发代理佣金
    if (COMMISSION_TRIGGER_STATUSES.has(status)) {
      const orderResult = await db.select().from(orders).where(eq(orders.id, orderId));
      const order = orderResult[0];
      if (order) {
        this.agentsService.triggerCommissionForOrder(orderId, order.totalPrice).catch(err => {
          console.error(`[AgentCommission] 佣金触发失败 order=${orderId}:`, err);
        });
      }
    }

    return true;
  }

  async getDraft(userId?: string) {
    const uid = userId || 'demo-user';
    const result = await db.select().from(draftOrders).where(eq(draftOrders.userId, uid));
    if (result.length === 0) {
      return { hasDraft: false, documents: [] };
    }
    const docs: any[] = result[0].documents ? JSON.parse(result[0].documents) : [];
    return {
      hasDraft: docs.length > 0,
      documents: docs,
    };
  }

  async createOrUpdateDraft(data: {
    documents: any[];
    total_price: number;
    user_id?: string;
  }) {
    const userId = data.user_id || 'demo-user';
    const draftId = `draft_${userId}`;
    
    const existing = await db.select().from(draftOrders).where(eq(draftOrders.userId, userId));
    
    if (existing.length > 0) {
      await db.update(draftOrders).set({
        documents: JSON.stringify(data.documents),
        updatedAt: new Date().toISOString(),
      }).where(eq(draftOrders.userId, userId));
    } else {
      await db.insert(draftOrders).values({
        id: draftId,
        userId: userId,
        documents: JSON.stringify(data.documents),
      });
    }
    
    return { success: true };
  }

  async clearDraft(userId?: string) {
    const uid = userId || 'demo-user';
    await db.delete(draftOrders).where(eq(draftOrders.userId, uid));
    return true;
  }

  async getMerchantOrders(merchantId: string, status?: string) {
    let query = db.select().from(orders).where(eq(orders.merchantId, merchantId));
    const result = await query;
    return result.map(order => ({
      id: order.id,
      order_no: order.orderNo,
      user_id: order.userId,
      status: order.status,
      total_price: order.totalPrice,
      shipping_fee: order.shippingFee,
      created_at: order.createdAt,
      print_settings: order.printSettings ? JSON.parse(order.printSettings) : {},
    }));
  }
}
