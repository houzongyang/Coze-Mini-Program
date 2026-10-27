import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // 获取草稿订单
  @Get('draft')
  async getDraft(@Query('user_id') userId?: string) {
    console.log('获取草稿订单:', userId);
    const draft = await this.ordersService.getDraft(userId);
    return { code: 200, msg: 'success', data: draft };
  }

  // 创建或更新草稿订单
  @Post('draft')
  @HttpCode(200)
  async saveDraft(@Body() body: {
    documents: Array<{
      name: string;
      path: string;
      type: string;
      size?: number;
      pages: number;
      copies: number;
      color_mode: string;
      sides: string;
      paper_size: string;
      binding: string;
      cover: string;
      cover_laminated: boolean;
    }>;
    total_price: number;
    user_id?: string;
  }) {
    console.log('保存草稿订单:', body);
    const result = await this.ordersService.createOrUpdateDraft(body);
    return { code: 200, msg: '草稿保存成功', data: result };
  }

  // 清除草稿订单
  @Delete('draft')
  async clearDraft(@Query('user_id') userId?: string) {
    console.log('清除草稿订单:', userId);
    await this.ordersService.clearDraft(userId);
    return { code: 200, msg: '草稿已清除' };
  }

  @Post()
  @HttpCode(200)
  async createOrder(@Body() body: {
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
    console.log('创建订单:', body);
    
    const result = await this.ordersService.createOrder(body);
    
    return { code: 200, msg: '订单创建成功', data: result };
  }

  @Get()
  async getOrders(
    @Query('user_id') userId?: string,
    @Query('status') status?: string
  ) {
    console.log('查询订单列表:', userId, status);
    
    const orders = await this.ordersService.getOrders(userId, status);
    
    return { code: 200, msg: 'success', data: orders };
  }

  @Get(':id')
  async getOrderById(@Param('id') id: string) {
    console.log('查询订单详情:', id);
    
    const order = await this.ordersService.getOrderById(id);
    
    if (!order) {
      return { code: 404, msg: '订单不存在', data: null };
    }
    
    return { code: 200, msg: 'success', data: order };
  }

  @Put(':id/status')
  @HttpCode(200)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: {
      status: string;
      merchant_id?: string;
      logistics_company?: string;
      logistics_no?: string;
    }
  ) {
    console.log('更新订单状态:', id, body);
    
    const result = await this.ordersService.updateOrderStatus(id, body.status, {
      merchant_id: body.merchant_id,
      logistics_company: body.logistics_company,
      logistics_no: body.logistics_no,
    });
    
    return { code: 200, msg: '状态更新成功', data: result };
  }

  @Get('merchant/:merchantId')
  async getMerchantOrders(
    @Param('merchantId') merchantId: string,
    @Query('status') status?: string
  ) {
    console.log('查询商家订单:', merchantId, status);
    
    const orders = await this.ordersService.getMerchantOrders(merchantId, status);
    
    return { code: 200, msg: 'success', data: orders };
  }
}