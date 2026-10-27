import { Injectable } from '@nestjs/common';
import { db } from '@/storage/database/sqlite-client';
import { userPoints, gifts, exchangeRecords } from '@/storage/database/shared/sqlite-schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class PointsService {
  async getUserPoints(userId: string) {
    const result = await db.select().from(userPoints).where(eq(userPoints.userId, userId));
    let userPts = result[0];

    if (!userPts) {
      const newId = `up_${Date.now()}`;
      userPts = {
        id: newId,
        userId: userId,
        totalPoints: 0,
        usedPoints: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.insert(userPoints).values(userPts);
    }

    return { code: 200, msg: 'success', data: userPts };
  }

  async getGifts() {
    const result = await db.select().from(gifts).where(eq(gifts.isActive, 1));
    const activeGifts = result.filter(g => g.stock > 0);
    return { code: 200, msg: 'success', data: activeGifts };
  }

  async getAllGifts() {
    const result = await db.select().from(gifts);
    return { code: 200, msg: 'success', data: result };
  }

  async exchangeGift(userId: string, giftId: number) {
    const pointsResult = await this.getUserPoints(userId);
    if (pointsResult.code !== 200) {
      return pointsResult;
    }
    const userPts = pointsResult.data;
    const availablePoints = userPts.totalPoints - userPts.usedPoints;

    const giftResult = await db.select().from(gifts).where(eq(gifts.id, giftId));
    const gift = giftResult[0];

    if (!gift || gift.isActive !== 1) {
      return { code: 404, msg: '礼品不存在或已禁用', data: null };
    }

    if (gift.stock <= 0) {
      return { code: 400, msg: '礼品库存不足', data: null };
    }

    if (availablePoints < gift.requiredPoints) {
      return { code: 400, msg: `积分不足，需要${gift.requiredPoints}分，当前可用${availablePoints}分`, data: null };
    }

    const recordId = `record_${Date.now()}`;
    await db.insert(exchangeRecords).values({
      id: recordId,
      userId: userId,
      giftId: giftId,
      pointsUsed: gift.requiredPoints,
      status: 'completed',
    });

    await db.update(userPoints).set({ 
      usedPoints: userPts.usedPoints + gift.requiredPoints,
      updatedAt: new Date().toISOString(),
    }).where(eq(userPoints.id, userPts.id));

    await db.update(gifts).set({ 
      stock: gift.stock - 1,
    }).where(eq(gifts.id, giftId));

    return { 
      code: 200, 
      msg: '兑换成功！', 
      data: { 
        record_id: recordId,
        gift_name: gift.name,
        remaining_points: availablePoints - gift.requiredPoints
      } 
    };
  }

  async getExchangeRecords(userId: string) {
    const result = await db.select().from(exchangeRecords).where(eq(exchangeRecords.userId, userId));
    
    const recordsWithGiftInfo: any[] = [];
    for (const record of result) {
      const giftResult = await db.select().from(gifts).where(eq(gifts.id, record.giftId));
      const gift = giftResult[0];
      recordsWithGiftInfo.push({
        id: record.id,
        user_id: record.userId,
        gift_id: record.giftId,
        points_used: record.pointsUsed,
        status: record.status,
        created_at: record.createdAt,
        gifts: gift ? { name: gift.name, image_url: gift.imageUrl, description: gift.description } : null
      });
    }

    return { code: 200, msg: 'success', data: recordsWithGiftInfo };
  }

  async addGift(giftData: { name: string; image_url?: string; description?: string; required_points: number; stock: number }) {
    await db.insert(gifts).values({
      name: giftData.name,
      imageUrl: giftData.image_url || '',
      description: giftData.description || '',
      requiredPoints: giftData.required_points,
      stock: giftData.stock,
      isActive: 1,
    });

    return { code: 200, msg: '添加成功', data: giftData };
  }

  async updateGift(giftId: number, giftData: Partial<{ name: string; image_url: string; description: string; required_points: number; stock: number; is_active: boolean }>) {
    const result = await db.select().from(gifts).where(eq(gifts.id, giftId));
    if (result.length === 0) {
      return { code: 404, msg: '礼品不存在', data: null };
    }

    const updateData: any = {};
    if (giftData.name !== undefined) updateData.name = giftData.name;
    if (giftData.image_url !== undefined) updateData.imageUrl = giftData.image_url;
    if (giftData.description !== undefined) updateData.description = giftData.description;
    if (giftData.required_points !== undefined) updateData.requiredPoints = giftData.required_points;
    if (giftData.stock !== undefined) updateData.stock = giftData.stock;
    if (giftData.is_active !== undefined) updateData.isActive = giftData.is_active ? 1 : 0;

    await db.update(gifts).set(updateData).where(eq(gifts.id, giftId));

    return { code: 200, msg: '更新成功', data: updateData };
  }

  async deleteGift(giftId: number) {
    const result = await db.select().from(gifts).where(eq(gifts.id, giftId));
    if (result.length === 0) {
      return { code: 404, msg: '礼品不存在', data: null };
    }

    await db.delete(gifts).where(eq(gifts.id, giftId));

    return { code: 200, msg: '删除成功', data: null };
  }

  async addPointsForOrder(userId: string, amount: number, orderId: string) {
    const points = Math.floor(amount);

    if (points <= 0) {
      return { code: 200, msg: '金额不足，不增加积分', data: { points_added: 0 } };
    }

    const pointsResult = await this.getUserPoints(userId);
    if (pointsResult.code !== 200) {
      return pointsResult;
    }
    const userPts = pointsResult.data;

    await db.update(userPoints).set({ 
      totalPoints: userPts.totalPoints + points,
      updatedAt: new Date().toISOString(),
    }).where(eq(userPoints.id, userPts.id));

    return { 
      code: 200, 
      msg: `积分增加${points}分`, 
      data: { 
        points_added: points,
        new_total_points: userPts.totalPoints + points
      } 
    };
  }
}
