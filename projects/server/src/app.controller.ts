import { Controller, Get } from '@nestjs/common';
import { AppService } from '@/app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot() {
    return {
      status: 'success',
      message: '小喵快印后端服务运行中',
      version: '1.0.0',
      api_prefix: '/api',
      available_endpoints: [
        'GET /api/health - 健康检查',
        'GET /api/hello - 测试接口',
        'GET /api/price-settings - 获取价格设置',
        'POST /api/orders - 创建订单',
        'POST /api/agents/apply - 申请代理商',
        'GET /api/agents/list - 获取代理商列表',
        'POST /api/addresses - 创建地址',
        'POST /api/documents/upload - 上传文档',
      ],
      documentation: '所有 API 接口请使用 /api 前缀访问',
    };
  }

  @Get('hello')
  getHello(): { status: string; data: string } {
    return {
      status: 'success',
      data: this.appService.getHello()
    };
  }

  @Get('health')
  getHealth(): { status: string; data: string } {
    return {
      status: 'success',
      data: new Date().toISOString(),
    };
  }
}
