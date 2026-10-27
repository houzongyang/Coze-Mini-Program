import { Injectable } from '@nestjs/common';
import { db } from '@/storage/database/sqlite-client';
import { priceItems } from '@/storage/database/shared/sqlite-schema';
import { eq } from 'drizzle-orm';

export interface PriceItem {
  id: number;
  option_name: string;
  price: number;
  unit: string;
  created_at?: string;
}

@Injectable()
export class PriceSettingsService {
  async getAllPriceItems(): Promise<{ code: number; msg: string; data: PriceItem[] }> {
    const result = await db.select().from(priceItems);
    const items = result.map(item => ({
      id: item.id,
      option_name: item.optionName,
      price: item.price,
      unit: item.unit,
      created_at: item.createdAt,
    }));
    return { code: 200, msg: 'success', data: items };
  }

  async getPriceByName(name: string): Promise<number> {
    const result = await db.select().from(priceItems).where(eq(priceItems.optionName, name));
    if (result.length === 0) {
      return 0;
    }
    return result[0].price;
  }

  async updatePrice(id: number, price: number): Promise<{ code: number; msg: string; data?: any }> {
    const result = await db.select().from(priceItems).where(eq(priceItems.id, id));
    if (result.length === 0) {
      return { code: 404, msg: '价格项不存在' };
    }

    await db.update(priceItems).set({ price: price }).where(eq(priceItems.id, id));

    return { code: 200, msg: '更新成功', data: { id, price } };
  }

  async addPriceItem(item: { option_name: string; price: number; unit: string }): Promise<{ code: number; msg: string; data?: any }> {
    const result = await db.select().from(priceItems).where(eq(priceItems.optionName, item.option_name));
    if (result.length > 0) {
      return { code: 400, msg: '价格项已存在' };
    }

    await db.insert(priceItems).values({
      optionName: item.option_name,
      price: item.price,
      unit: item.unit,
    });

    return { code: 200, msg: '添加成功', data: item };
  }

  async deletePriceItem(id: number): Promise<{ code: number; msg: string }> {
    const result = await db.select().from(priceItems).where(eq(priceItems.id, id));
    if (result.length === 0) {
      return { code: 404, msg: '价格项不存在' };
    }

    await db.delete(priceItems).where(eq(priceItems.id, id));

    return { code: 200, msg: '删除成功' };
  }

  async calculatePrice(documents: Array<{
    page_count: number;
    copies: number;
    color_mode: string;
    sides: string;
    paper_size: string;
    binding: string;
    has_cover: boolean;
    cover_laminated: boolean;
  }>): Promise<{ code: number; msg: string; data?: { total: number; details: Array<{ file_name?: string; price: number }> } }> {
    try {
      const prices = await this.getAllPriceItems();
      const priceMap = new Map<string, number>();
      prices.data.forEach(item => {
        priceMap.set(item.option_name, item.price);
      });

      let total = 0;
      const details: Array<{ file_name?: string; price: number }> = [];

      for (const doc of documents) {
        let pricePerPage = 0;
        
        if (doc.color_mode === 'bw') {
          pricePerPage += priceMap.get('黑白打印') || 0;
        } else {
          pricePerPage += priceMap.get('彩色打印') || 0;
        }
        
        if (doc.sides === 'double') {
          pricePerPage += priceMap.get('双面打印') || 0;
        }
        
        let paperPrice = 0;
        if (doc.paper_size === 'a3') {
          paperPrice = priceMap.get('A3纸张') || 0;
        }
        
        let docTotal = (pricePerPage + paperPrice) * doc.page_count * doc.copies;
        
        if (doc.binding === 'staple') {
          docTotal += (priceMap.get('平钉装订') || 0) * doc.copies;
        } else if (doc.binding === 'saddle') {
          docTotal += (priceMap.get('骑马钉装订') || 0) * doc.copies;
        } else if (doc.binding === 'glue') {
          docTotal += (priceMap.get('胶装装订') || 0) * doc.copies;
        }
        
        if (doc.has_cover) {
          if (doc.cover_laminated) {
            docTotal += (priceMap.get('铜版纸覆膜封面') || 0) * doc.copies;
          } else {
            docTotal += (priceMap.get('皮纹纸封面') || 0) * doc.copies;
          }
        }
        
        total += docTotal;
        details.push({ file_name: doc['file_name'], price: docTotal });
      }

      const shippingThreshold = priceMap.get('免费配送门槛') || 10;
      const shippingFee = priceMap.get('配送费') || 5;
      
      if (total < shippingThreshold) {
        total += shippingFee;
      }

      return { code: 200, msg: 'success', data: { total, details } };
    } catch (error) {
      console.error('[PriceSettingsService] calculatePrice error:', error);
      return { code: 500, msg: '服务器错误' };
    }
  }
}
