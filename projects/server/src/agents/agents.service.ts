import { Injectable } from '@nestjs/common';
import { db } from '@/storage/database/sqlite-client';
import {
  agents,
  agentCommissions,
  agentWithdrawals,
  userReferrals,
  orders,
} from '@/storage/database/shared/sqlite-schema';
import { eq, and, sql } from 'drizzle-orm';

@Injectable()
export class AgentsService {
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private toAgentDto(agent: typeof agents.$inferSelect) {
    return {
      id: agent.id,
      user_id: agent.userId,
      invite_code: agent.inviteCode,
      commission_rate: agent.commissionRate,
      status: agent.status,
      total_commission: agent.totalCommission,
      balance: agent.balance,
      real_name: agent.realName,
      phone: agent.phone,
      created_at: agent.createdAt,
      updated_at: agent.updatedAt,
    };
  }

  private toCommissionDto(commission: typeof agentCommissions.$inferSelect) {
    return {
      id: commission.id,
      agent_id: commission.agentId,
      order_id: commission.orderId,
      amount: commission.amount,
      status: commission.status,
      created_at: commission.createdAt,
    };
  }

  private toWithdrawalDto(withdrawal: typeof agentWithdrawals.$inferSelect) {
    return {
      id: withdrawal.id,
      agent_id: withdrawal.agentId,
      amount: withdrawal.amount,
      status: withdrawal.status,
      alipay_account: withdrawal.alipayAccount,
      real_name: withdrawal.realName,
      reject_reason: withdrawal.rejectReason,
      reviewed_at: withdrawal.reviewedAt,
      created_at: withdrawal.createdAt,
      updated_at: withdrawal.updatedAt,
    };
  }

  private toReferralDto(referral: typeof userReferrals.$inferSelect) {
    return {
      id: referral.id,
      user_id: referral.userId,
      agent_id: referral.agentId,
      invited_at: referral.invitedAt,
    };
  }

  async applyAgent(data: { user_id: string; real_name?: string; phone?: string }) {
    const existing = await db.select().from(agents).where(eq(agents.userId, data.user_id));
    if (existing.length > 0) {
      return { code: 400, msg: '已申请过代理商', data: existing[0] };
    }

    let inviteCode = this.generateInviteCode();
    while (true) {
      const codeExists = await db.select().from(agents).where(eq(agents.inviteCode, inviteCode));
      if (codeExists.length === 0) break;
      inviteCode = this.generateInviteCode();
    }

    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.insert(agents).values({
      id: agentId,
      userId: data.user_id,
      inviteCode,
      realName: data.real_name,
      phone: data.phone,
      status: 'pending',
      commissionRate: 0.05,
      totalCommission: 0,
      balance: 0,
    });

    return {
      code: 200,
      msg: '申请成功，等待审核',
      data: { agent_id: agentId, invite_code: inviteCode, status: 'pending' },
    };
  }

  async getAgentByUserId(userId: string) {
    const result = await db.select().from(agents).where(eq(agents.userId, userId));
    return result.length === 0 ? null : this.toAgentDto(result[0]);
  }

  async getAgentByInviteCode(code: string) {
    const result = await db.select().from(agents).where(eq(agents.inviteCode, code));
    return result.length === 0 ? null : result[0];
  }

  async updateAgentStatus(agentId: string, status: string, commissionRate?: number) {
    const updateData: any = { status, updatedAt: new Date().toISOString() };
    if (commissionRate !== undefined) updateData.commissionRate = commissionRate;
    await db.update(agents).set(updateData).where(eq(agents.id, agentId));
    return { code: 200, msg: '更新成功' };
  }

  async updateCommissionRate(agentId: string, rate: number) {
    await db.update(agents).set({ commissionRate: rate, updatedAt: new Date().toISOString() }).where(eq(agents.id, agentId));
    return { code: 200, msg: '更新成功' };
  }

  async getCommissions(agentId: string) {
    const result = await db.select().from(agentCommissions).where(eq(agentCommissions.agentId, agentId));
    return { code: 200, msg: 'success', data: result.map((commission) => this.toCommissionDto(commission)) };
  }

  /**
   * 幂等地为一笔订单生成佣金记录。
   * 通过 (order_id, agent_id) 唯一索引保证同一订单不会重复产生佣金。
   * 调用方负责确认订单状态已达 completed / paid。
   */
  async addCommissionIdempotent(agentId: string, orderId: string, orderAmount: number) {
    // Check idempotency: already exists?
    const existing = await db
      .select()
      .from(agentCommissions)
      .where(and(eq(agentCommissions.orderId, orderId), eq(agentCommissions.agentId, agentId)));
    if (existing.length > 0) {
      return { code: 200, msg: '佣金已存在（幂等）', data: existing[0] };
    }

    const agentResult = await db.select().from(agents).where(eq(agents.id, agentId));
    const agent = agentResult[0];
    if (!agent || agent.status !== 'active') {
      return { code: 400, msg: '代理商不存在或未激活' };
    }

    const commissionAmount = Math.round(orderAmount * agent.commissionRate * 100) / 100;
    const commissionId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await db.insert(agentCommissions).values({
        id: commissionId,
        agentId,
        orderId,
        amount: commissionAmount,
        status: 'pending',
      });

      // Accumulate balance atomically
      await db.update(agents).set({
        totalCommission: sql`${agents.totalCommission} + ${commissionAmount}`,
        balance: sql`${agents.balance} + ${commissionAmount}`,
        updatedAt: new Date().toISOString(),
      }).where(eq(agents.id, agentId));

      return { code: 200, msg: '佣金已生成', data: { commission_id: commissionId, amount: commissionAmount } };
    } catch (err: any) {
      // UNIQUE constraint violation means already inserted concurrently — idempotent
      if (err?.message?.includes('UNIQUE')) {
        return { code: 200, msg: '佣金已存在（幂等）' };
      }
      throw err;
    }
  }

  /** Legacy non-idempotent add (kept for backward compat, prefer addCommissionIdempotent) */
  async addCommission(agentId: string, orderId: string, amount: number) {
    return this.addCommissionIdempotent(agentId, orderId, amount);
  }

  /**
   * 触发订单佣金：根据 orderId 找到下单用户的推广归因代理，
   * 再以幂等方式写入佣金。由 orders.service 在订单完成时调用。
   */
  async triggerCommissionForOrder(orderId: string, orderAmount: number) {
    // Find the order to get user_id
    const orderResult = await db.select().from(orders).where(eq(orders.id, orderId));
    const order = orderResult[0];
    if (!order) return { code: 404, msg: '订单不存在' };

    // Find referral: which agent referred this user?
    const referralResult = await db
      .select()
      .from(userReferrals)
      .where(eq(userReferrals.userId, order.userId));
    if (referralResult.length === 0) {
      return { code: 200, msg: '该订单无推广归因，跳过佣金' };
    }

    const agentId = referralResult[0].agentId;
    return this.addCommissionIdempotent(agentId, orderId, orderAmount);
  }

  async applyWithdrawal(agentId: string, amount: number, alipayAccount?: string, realName?: string) {
    const agentResult = await db.select().from(agents).where(eq(agents.id, agentId));
    const agent = agentResult[0];
    if (!agent) return { code: 404, msg: '代理商不存在' };
    if (agent.status !== 'active') return { code: 400, msg: '代理商未激活，无法提现' };
    if (agent.balance < amount) return { code: 400, msg: '余额不足' };
    if (amount <= 0) return { code: 400, msg: '提现金额必须大于0' };

    const withdrawalId = `withdraw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Deduct balance immediately and create withdrawal record
    await db.insert(agentWithdrawals).values({
      id: withdrawalId,
      agentId,
      amount,
      status: 'pending',
      alipayAccount: alipayAccount || null,
      realName: realName || null,
    });

    await db.update(agents).set({
      balance: sql`${agents.balance} - ${amount}`,
      updatedAt: new Date().toISOString(),
    }).where(eq(agents.id, agentId));

    return {
      code: 200,
      msg: '提现申请已提交，等待人工审核后线下打款',
      data: { withdrawal_id: withdrawalId, amount, status: 'pending' },
    };
  }

  /**
   * 后台审核提现申请。
   * status: 'approved' | 'rejected'
   * 驳回时返还余额；批准时仅变更状态（实际打款由人工线下完成）。
   *
   * ⚠️ 生产环境接入自动打款需配置支付宝/微信企业付款凭据。
   * 当前实现为可审计的人工结算流程。
   */
  async reviewWithdrawal(withdrawalId: string, status: 'approved' | 'rejected', rejectReason?: string) {
    const result = await db.select().from(agentWithdrawals).where(eq(agentWithdrawals.id, withdrawalId));
    const withdrawal = result[0];
    if (!withdrawal) return { code: 404, msg: '提现记录不存在' };
    if (withdrawal.status !== 'pending') return { code: 400, msg: `该记录已处理：${withdrawal.status}` };

    const now = new Date().toISOString();
    await db.update(agentWithdrawals).set({
      status,
      rejectReason: status === 'rejected' ? (rejectReason || '审核不通过') : null,
      reviewedAt: now,
      updatedAt: now,
    }).where(eq(agentWithdrawals.id, withdrawalId));

    if (status === 'rejected') {
      // Return balance to agent
      await db.update(agents).set({
        balance: sql`${agents.balance} + ${withdrawal.amount}`,
        updatedAt: now,
      }).where(eq(agents.id, withdrawal.agentId));
    }

    return {
      code: 200,
      msg: status === 'approved' ? '审核通过，请线下完成打款' : '已驳回，余额已返还',
      data: { status },
    };
  }

  async getWithdrawals(agentId: string) {
    const result = await db
      .select()
      .from(agentWithdrawals)
      .where(eq(agentWithdrawals.agentId, agentId));
    return { code: 200, msg: 'success', data: result.map((withdrawal) => this.toWithdrawalDto(withdrawal)) };
  }

  async getAllWithdrawals(status?: string) {
    const all = await db.select().from(agentWithdrawals);
    const filtered = status ? all.filter(w => w.status === status) : all;
    return { code: 200, msg: 'success', data: filtered.map((withdrawal) => this.toWithdrawalDto(withdrawal)) };
  }

  /** 绑定推广关系（用户首次通过邀请码进入时调用） */
  async bindReferral(userId: string, inviteCode: string) {
    const agentResult = await db.select().from(agents).where(eq(agents.inviteCode, inviteCode));
    const agent = agentResult[0];
    if (!agent) return { code: 404, msg: '邀请码不存在' };
    if (agent.status !== 'active') return { code: 400, msg: '该推广码暂不可用' };

    const existingRef = await db.select().from(userReferrals).where(eq(userReferrals.userId, userId));
    if (existingRef.length > 0) {
      return { code: 400, msg: '您已绑定推广关系' };
    }

    const referralId = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(userReferrals).values({ id: referralId, userId, agentId: agent.id });

    return { code: 200, msg: '绑定成功', data: { agent_id: agent.id } };
  }

  async getReferrals(agentId: string) {
    const result = await db.select().from(userReferrals).where(eq(userReferrals.agentId, agentId));
    return { code: 200, msg: 'success', data: result.map((referral) => this.toReferralDto(referral)) };
  }

  async getAgentStats(agentId: string) {
    const agentResult = await db.select().from(agents).where(eq(agents.id, agentId));
    const agent = agentResult[0];
    if (!agent) return { code: 404, msg: '代理商不存在' };

    const referrals = await db.select().from(userReferrals).where(eq(userReferrals.agentId, agentId));
    const commissions = await db.select().from(agentCommissions).where(eq(agentCommissions.agentId, agentId));
    const withdrawals = await db.select().from(agentWithdrawals).where(eq(agentWithdrawals.agentId, agentId));

    const settledAmount = withdrawals
      .filter(w => w.status === 'approved')
      .reduce((s, w) => s + w.amount, 0);

    return {
      code: 200,
      msg: 'success',
      data: {
        total_referrals: referrals.length,
        total_commission: agent.totalCommission,
        balance: agent.balance,
        settled_amount: settledAmount,
        commission_count: commissions.length,
        invite_code: agent.inviteCode,
        commission_rate: agent.commissionRate,
        status: agent.status,
      },
    };
  }

  async getAllAgents() {
    const result = await db.select().from(agents);
    return { code: 200, msg: 'success', data: result.map((agent) => this.toAgentDto(agent)) };
  }
}
