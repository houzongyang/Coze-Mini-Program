import { Injectable } from '@nestjs/common';
import { db } from '@/storage/database/sqlite-client';
import { addresses } from '@/storage/database/shared/sqlite-schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AddressesService {
  async createAddress(data: {
    user_id: string;
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
    is_default?: boolean;
  }) {
    if (data.is_default) {
      await db.update(addresses).set({ isDefault: 0 }).where(eq(addresses.userId, data.user_id));
    }

    const addressId = `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const addressData = {
      id: addressId,
      userId: data.user_id,
      name: data.name,
      phone: data.phone,
      province: data.province,
      city: data.city,
      district: data.district,
      detail: data.detail,
      isDefault: data.is_default ? 1 : 0,
    };

    await db.insert(addresses).values(addressData);

    return {
      id: addressId,
      user_id: data.user_id,
      name: data.name,
      phone: data.phone,
      province: data.province,
      city: data.city,
      district: data.district,
      detail: data.detail,
      is_default: data.is_default || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async getAddressesByUserId(userId: string) {
    const result = await db.select().from(addresses).where(eq(addresses.userId, userId));
    return result.map(a => ({
      id: a.id,
      user_id: a.userId,
      name: a.name,
      phone: a.phone,
      province: a.province,
      city: a.city,
      district: a.district,
      detail: a.detail,
      is_default: a.isDefault === 1,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
    })).sort((a, b) => {
      if (a.is_default !== b.is_default) {
        return a.is_default ? -1 : 1;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  async getDefaultAddress(userId: string) {
    const result = await db.select().from(addresses).where(eq(addresses.userId, userId));
    
    const addrList = result.map(a => ({
      id: a.id,
      user_id: a.userId,
      name: a.name,
      phone: a.phone,
      province: a.province,
      city: a.city,
      district: a.district,
      detail: a.detail,
      is_default: a.isDefault === 1,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
    }));
    
    const defaultAddr = addrList.find(a => a.is_default);
    
    if (defaultAddr) {
      return defaultAddr;
    }
    
    return addrList.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] || null;
  }

  async getAddressById(id: string) {
    const result = await db.select().from(addresses).where(eq(addresses.id, id));
    const addr = result[0];
    if (!addr) {
      return null;
    }
    return {
      id: addr.id,
      user_id: addr.userId,
      name: addr.name,
      phone: addr.phone,
      province: addr.province,
      city: addr.city,
      district: addr.district,
      detail: addr.detail,
      is_default: addr.isDefault === 1,
      created_at: addr.createdAt,
      updated_at: addr.updatedAt,
    };
  }

  async updateAddress(id: string, data: Partial<{
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
    is_default: boolean;
  }>) {
    const result = await db.select().from(addresses).where(eq(addresses.id, id));
    const address = result[0];
    
    if (!address) {
      throw new Error('地址不存在');
    }

    if (data.is_default) {
      await db.update(addresses).set({ isDefault: 0 }).where(eq(addresses.userId, address.userId));
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.province !== undefined) updateData.province = data.province;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.district !== undefined) updateData.district = data.district;
    if (data.detail !== undefined) updateData.detail = data.detail;
    if (data.is_default !== undefined) updateData.isDefault = data.is_default ? 1 : 0;
    updateData.updatedAt = new Date().toISOString();

    await db.update(addresses).set(updateData).where(eq(addresses.id, id));

    const updatedResult = await db.select().from(addresses).where(eq(addresses.id, id));
    const updated = updatedResult[0];
    
    return {
      id: updated.id,
      user_id: updated.userId,
      name: updated.name,
      phone: updated.phone,
      province: updated.province,
      city: updated.city,
      district: updated.district,
      detail: updated.detail,
      is_default: updated.isDefault === 1,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    };
  }

  async deleteAddress(id: string) {
    await db.delete(addresses).where(eq(addresses.id, id));
    return true;
  }
}
