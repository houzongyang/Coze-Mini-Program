import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode } from '@nestjs/common';
import { AddressesService } from './addresses.service';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @HttpCode(200)
  async createAddress(@Body() body: {
    user_id: string;
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
    is_default?: boolean;
  }) {
    console.log('创建地址:', body);
    
    const result = await this.addressesService.createAddress(body);
    
    return { code: 200, msg: '地址创建成功', data: result };
  }

  @Get()
  async getAddresses(@Query('user_id') userId: string) {
    console.log('查询地址列表:', userId);
    
    if (!userId) {
      return { code: 400, msg: '缺少用户ID', data: null };
    }
    
    const addresses = await this.addressesService.getAddressesByUserId(userId);
    
    return { code: 200, msg: 'success', data: addresses };
  }

  @Get('default')
  async getDefaultAddress(@Query('user_id') userId: string) {
    console.log('查询默认地址:', userId);
    
    if (!userId) {
      // 返回演示地址
      return {
        code: 200,
        msg: 'success',
        data: {
          id: 'demo-address',
          name: '张三',
          phone: '13800138000',
          address: '北京市朝阳区某某街道某某小区1号楼101室'
        }
      };
    }
    
    const address = await this.addressesService.getDefaultAddress(userId);
    
    if (!address) {
      return { code: 404, msg: '暂无地址', data: null };
    }
    
    // 格式化地址信息
    const formattedAddress = {
      ...address,
      address: `${address.province}${address.city}${address.district}${address.detail}`
    };
    
    return { code: 200, msg: 'success', data: formattedAddress };
  }

  @Get(':id')
  async getAddressById(@Param('id') id: string) {
    console.log('查询地址详情:', id);
    
    const address = await this.addressesService.getAddressById(id);
    
    if (!address) {
      return { code: 404, msg: '地址不存在', data: null };
    }
    
    return { code: 200, msg: 'success', data: address };
  }

  @Put(':id')
  @HttpCode(200)
  async updateAddress(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      phone: string;
      province: string;
      city: string;
      district: string;
      detail: string;
      is_default: boolean;
    }>
  ) {
    console.log('更新地址:', id, body);
    
    const result = await this.addressesService.updateAddress(id, body);
    
    return { code: 200, msg: '地址更新成功', data: result };
  }

  @Delete(':id')
  @HttpCode(200)
  async deleteAddress(@Param('id') id: string) {
    console.log('删除地址:', id);
    
    await this.addressesService.deleteAddress(id);
    
    return { code: 200, msg: '地址删除成功', data: null };
  }
}