import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import { runMigrations } from '@/storage/database/migrations/0001-init';

function parsePort(): number {
  const isValidPort = (value: string | undefined): value is string => {
    if (!value) return false;
    const port = parseInt(value, 10);
    return !isNaN(port) && port > 0 && port < 65536;
  };

  const args = process.argv.slice(2);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1 && isValidPort(args[portIndex + 1])) {
    return parseInt(args[portIndex + 1], 10);
  }

  if (isValidPort(process.env.PORT)) {
    return parseInt(process.env.PORT, 10);
  }

  return 3000;
}

async function bootstrap() {
  runMigrations();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.use('/', (req, res, next) => {
    if (req.path === '/') {
      res.json({
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
      });
    } else {
      next();
    }
  });

  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());
  // 1. 开启优雅关闭 Hooks (关键!)
  app.enableShutdownHooks();

  // 2. 解析端口
  const port = parsePort();
  try {
    await app.listen(port);
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 \({port} 被占用! 请运行 'npx kill-port \){port}' 然后重试。`);
      process.exit(1);
    } else {
      throw err;
    }
  }
  console.log(`Application is running on: http://localhost:3000`);
}
bootstrap();
