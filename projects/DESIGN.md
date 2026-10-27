# 云打印小程序设计指南

## 1. 气质与意象

**关键词**：简洁、高效、可信赖、温暖服务

**具象场景**：
想象一个大学图书馆的自助打印区域，清晨阳光透过玻璃窗洒在白色的打印柜台，学生在平板上轻松选择打印参数，几分钟后收到装订整齐的文件包裹。界面干净利落，没有多余装饰，每个按钮都清晰传达意图——这就是云打印小程序要带给用户的感觉。

## 2. 视觉策略

**摄影/图像方向**：
- 文档图标采用简约线条风格
- 状态图标使用彩色徽章区分（待处理/打印中/已完成/已发货）
- 避免复杂的插画，用清晰的图标传达功能

**图形语言**：
- 圆角卡片式布局（8px 圆角）
- 微阴影分层（shadow-sm）
- 清晰的区域分隔线

## 3. 配色方案

| 用途 | 颜色 | Tailwind 类名 | 意象来源 |
|------|------|---------------|----------|
| 主色（品牌色） | #3B82F6 蓝色 | `bg-blue-500` `text-blue-500` | 清晨天空，传递专业、可信赖感 |
| 辅色（行动色） | #F97316 橙色 | `bg-orange-500` `text-orange-500` | 温暖阳光，用于"提交订单""支付"等关键行动按钮 |
| 成功状态 | #10B981 绿色 | `bg-green-500` `text-green-500` | 任务完成，订单成功 |
| 警告状态 | #F59E0B 黄色 | `bg-yellow-500` `text-yellow-500` | 提醒注意，待处理状态 |
| 危险状态 | #EF4444 红色 | `bg-red-500` `text-red-500` | 错误提示，取消订单 |
| 背景色 | #FFFFFF 白色 | `bg-white` | 干净整洁的柜台 |
| 次级背景 | #F9FAFB 浅灰 | `bg-gray-50` | 内容区域区分 |
| 文字主色 | #111827 深灰 | `text-gray-900` | 正文内容 |
| 文字辅色 | #6B7280 中灰 | `text-gray-500` | 辅助说明文字 |

## 4. 字体排版

**推荐字体**：
- 中文：思源黑体（Noto Sans SC）
- 英文/数字：Inter

**排版节奏**：
- 标题：text-xl font-semibold，24px，间距 mb-4
- 副标题：text-lg font-medium，18px，间距 mb-3
- 正文：text-base，16px，行间距 normal
- 辅助文字：text-sm text-gray-500，14px
- 价格数字：text-2xl font-bold，24px

## 5. 组件使用原则

**CRITICAL：所有通用 UI 组件必须优先使用 `@/components/ui/*`**

| UI 单元 | 组件来源 | 说明 |
|---------|----------|------|
| 按钮 | `@/components/ui/button` | 提交订单、支付、确认等 |
| 输入框 | `@/components/ui/input` | 地址输入、备注等 |
| 文本域 | `@/components/ui/textarea` | 详细地址描述 |
| 卡片 | `@/components/ui/card` | 订单列表、参数选择区域 |
| 标签/徽章 | `@/components/ui/badge` | 订单状态标识 |
| 分段切换 | `@/components/ui/tabs` | 黑白/彩色、单双面选择 |
| 弹窗 | `@/components/ui/dialog` | 地址选择、支付确认 |
| 底部抽屉 | `@/components/ui/drawer` | 参数选择面板 |
| 分割线 | `@/components/ui/separator` | 内容区块分隔 |
| 进度条 | `@/components/ui/progress` | 上传进度、订单处理进度 |
| 加载态 | `@/components/ui/skeleton` | 数据加载占位 |

**禁止**：用 `View/Text` + Tailwind 手搓按钮、输入框、弹窗等通用组件

## 6. 间距系统

- 页面边距：px-4（16px）
- 卡片内边距：p-4（16px）
- 列表项间距：gap-3（12px）
- 标题与内容间距：mb-4（16px）

## 7. 导航结构

**TabBar 配置（用户端）**：

| 页面 | 路径 | 图标 | 文字 |
|------|------|------|------|
| 首页 | pages/home/index | House | 首页 |
| 订单 | pages/orders/index | ClipboardList | 我的订单 |
| 我的 | pages/profile/index | User | 个人中心 |

**商家端单独入口（无 TabBar）**：
- pages/merchant/index - 商家管理页

**管理后台单独入口（无 TabBar）**：
- pages/admin/index - 后台管理页

**页面跳转规范**：
- TabBar 页面切换用 `Taro.switchTab()`
- 详情页跳转用 `Taro.navigateTo()`

## 8. 设计禁忌

- ❌ 禁止使用复杂插画装饰
- ❌ 禁止使用超过 3 种主色混搭
- ❌ 禁止用 View/Text 手搓按钮、输入框
- ❌ 禁止硬编码 px 值（用 Tailwind 预设类名）
- ❌ 禁止使用 placeholder 图片服务（如 via.placeholder.com）
- ❌ 禁止将图片打包到项目（使用 TOS 对象存储）
- ❌ 禁止在弹窗外层叠加超过 2 层
- ❌ 禁止使用全屏加载动画遮挡操作

## 9. 小程序约束

- 包体积：主包不超过 2MB
- 图片策略：所有文档图片上传到 TOS 对象存储
- TabBar 图标：本地 PNG（81x81px）
- 性能优化：列表分页加载，避免一次加载全部数据