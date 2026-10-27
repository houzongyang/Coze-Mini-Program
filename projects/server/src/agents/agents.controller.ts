import { Controller, Get, Post, Put, Body, Param, Query, HttpCode } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  // 申请成为代理商
  @Post('apply')
  @HttpCode(200)
  async apply(@Body() body: {
    user_id: string;
    real_name?: string;
    phone?: string;
  }) {
    return this.agentsService.applyAgent(body);
  }

  // 获取代理商信息（by user_id）
  @Get('info')
  async getAgentInfo(@Query('user_id') userId: string) {
    const agent = await this.agentsService.getAgentByUserId(userId);
    if (!agent) return { code: 404, msg: '您还不是代理商', data: null };
    return { code: 200, msg: 'success', data: agent };
  }

  // 通过邀请码查询代理商信息
  @Get('invite/:code')
  async getInviteInfo(@Param('code') code: string) {
    const agent = await this.agentsService.getAgentByInviteCode(code);
    if (!agent) return { code: 404, msg: '推广码无效', data: null };
    return {
      code: 200,
      msg: 'success',
      data: {
        agent_id: agent.id,
        invite_code: agent.inviteCode,
        commission_rate: agent.commissionRate,
        status: agent.status,
      },
    };
  }

  // 绑定推广关系（用户扫码/点击邀请链接时调用）
  @Post('bind')
  @HttpCode(200)
  async bindReferral(@Body() body: { invite_code: string; user_id: string }) {
    // NOTE: service signature is (userId, inviteCode)
    return this.agentsService.bindReferral(body.user_id, body.invite_code);
  }

  // 获取推广统计
  @Get('stats')
  async getStats(@Query('agent_id') agentId: string) {
    return this.agentsService.getAgentStats(agentId);
  }

  // 获取推广用户列表
  @Get('referrals')
  async getReferrals(@Query('agent_id') agentId: string) {
    return this.agentsService.getReferrals(agentId);
  }

  // 获取佣金记录
  @Get('commissions')
  async getCommissions(@Query('agent_id') agentId: string) {
    return this.agentsService.getCommissions(agentId);
  }

  // 申请提现
  @Post('withdraw')
  @HttpCode(200)
  async withdraw(@Body() body: {
    agent_id: string;
    amount: number;
    alipay_account?: string;
    real_name?: string;
  }) {
    return this.agentsService.applyWithdrawal(
      body.agent_id,
      body.amount,
      body.alipay_account,
      body.real_name,
    );
  }

  // 获取我的提现记录
  @Get('withdrawals')
  async getWithdrawals(@Query('agent_id') agentId: string) {
    return this.agentsService.getWithdrawals(agentId);
  }

  // ===== 管理后台接口 =====

  // 获取所有代理商列表
  @Get('list')
  async getAllAgents() {
    return this.agentsService.getAllAgents();
  }

  // 更新代理商状态（审核通过/拒绝）
  @Put(':id/status')
  @HttpCode(200)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; commission_rate?: number },
  ) {
    return this.agentsService.updateAgentStatus(id, body.status, body.commission_rate);
  }

  // 更新分润比例
  @Put(':id/rate')
  @HttpCode(200)
  async updateRate(
    @Param('id') id: string,
    @Body() body: { commission_rate: number },
  ) {
    return this.agentsService.updateCommissionRate(id, body.commission_rate);
  }

  // 获取所有提现申请（管理后台）
  @Get('admin/withdrawals')
  async getAllWithdrawals(@Query('status') status?: string) {
    return this.agentsService.getAllWithdrawals(status);
  }

  /**
   * 审核提现申请（管理后台）
   * status: 'approved' | 'rejected'
   *
   * ⚠️ 批准后需人工完成线下打款（支付宝/微信企业付款）。
   * 生产接入自动打款所需凭据：
   *   - 支付宝企业付款：ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY
   *   - 微信企业付款：WX_MCHID, WX_MCHKEY, WX_APICERT
   * 以上凭据由运营方配置在服务器环境变量中，代码层接入点在本接口 approved 分支。
   */
  @Put('admin/withdrawals/:id/review')
  @HttpCode(200)
  async reviewWithdrawal(
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected'; reject_reason?: string },
  ) {
    return this.agentsService.reviewWithdrawal(id, body.status, body.reject_reason);
  }
}
