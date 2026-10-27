import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode } from '@nestjs/common';
import { PriceSettingsService } from './price-settings.service';

@Controller('price-settings')
export class PriceSettingsController {
  constructor(private readonly priceSettingsService: PriceSettingsService) {}

  @Get()
  async getPriceSettings() {
    console.log('查询价格设置');
    
    const result = await this.priceSettingsService.getAllPriceItems();
    
    return result;
  }

  @Post()
  @HttpCode(200)
  async createPriceItem(@Body() body: {
    option_name: string;
    price: number;
    unit?: string;
  }) {
    console.log('创建价格项:', body);
    
    const result = await this.priceSettingsService.addPriceItem({ ...body, unit: body.unit || '份' });
    
    return result;
  }

  @Put(':id')
  @HttpCode(200)
  async updatePriceItem(
    @Param('id') id: string,
    @Body() body: {
      option_name?: string;
      price?: number;
      unit?: string;
    }
  ) {
    console.log('更新价格项:', id, body);
    
    if (body.price !== undefined) {
      const result = await this.priceSettingsService.updatePrice(parseInt(id), body.price);
      return result;
    }
    
    return { code: 400, msg: '请提供price参数' };
  }

  @Delete(':id')
  @HttpCode(200)
  async deletePriceItem(@Param('id') id: string) {
    console.log('删除价格项:', id);
    
    const result = await this.priceSettingsService.deletePriceItem(parseInt(id));
    
    return result;
  }

  @Post('calculate')
  @HttpCode(200)
  async calculatePrice(@Body() body: {
    documents: Array<{
      page_count: number;
      copies: number;
      color_mode: string;
      sides: string;
      paper_size: string;
      binding: string;
      has_cover: boolean;
      cover_laminated: boolean;
    }>;
  }) {
    console.log('计算价格:', body);
    
    const result = await this.priceSettingsService.calculatePrice(body.documents);
    
    return result;
  }
}
