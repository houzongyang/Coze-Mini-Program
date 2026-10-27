import { Controller, Get, Post, Body, Query, Put, Param } from '@nestjs/common'
import { PointsService } from './points.service'

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  // 获取用户积分信息
  @Get('info')
  async getUserPoints(@Query('user_id') userId: string) {
    console.log('[PointsController] getUserPoints called, user_id:', userId)
    return this.pointsService.getUserPoints(userId)
  }

  // 获取礼品列表
  @Get('gifts')
  async getGifts() {
    console.log('[PointsController] getGifts called')
    return this.pointsService.getGifts()
  }

  // 兑换礼品
  @Post('exchange')
  async exchangeGift(
    @Body() body: { user_id: string; gift_id: number }
  ) {
    console.log('[PointsController] exchangeGift called, body:', body)
    return this.pointsService.exchangeGift(body.user_id, body.gift_id)
  }

  // 获取兑换记录
  @Get('records')
  async getExchangeRecords(@Query('user_id') userId: string) {
    console.log('[PointsController] getExchangeRecords called, user_id:', userId)
    return this.pointsService.getExchangeRecords(userId)
  }

  // 后台：添加礼品
  @Post('gifts')
  async addGift(
    @Body() body: { name: string; image_url?: string; description?: string; required_points: number; stock: number }
  ) {
    console.log('[PointsController] addGift called, body:', body)
    return this.pointsService.addGift(body)
  }

  // 后台：更新礼品
  @Put('gifts/:id')
  async updateGift(
    @Param('id') id: string,
    @Body() body: { name?: string; image_url?: string; description?: string; required_points?: number; stock?: number; is_active?: boolean }
  ) {
    console.log('[PointsController] updateGift called, id:', id, 'body:', body)
    return this.pointsService.updateGift(Number(id), body)
  }

  // 后台：删除礼品
  @Post('gifts/:id/delete')
  async deleteGift(@Param('id') id: string) {
    console.log('[PointsController] deleteGift called, id:', id)
    return this.pointsService.deleteGift(Number(id))
  }

  // 后台：获取所有礼品（包括禁用的）
  @Get('gifts/all')
  async getAllGifts() {
    console.log('[PointsController] getAllGifts called')
    return this.pointsService.getAllGifts()
  }

  // 订单付款后增加积分（内部调用）
  @Post('add')
  async addPoints(
    @Body() body: { user_id: string; amount: number; order_id: string }
  ) {
    console.log('[PointsController] addPoints called, body:', body)
    return this.pointsService.addPointsForOrder(body.user_id, body.amount, body.order_id)
  }
}