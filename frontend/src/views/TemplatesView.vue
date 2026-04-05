<template>
  <div class="tpl-root">

    <!-- ── Header ── -->
    <div class="tpl-header">
      <div class="tpl-header-copy">
        <h1 class="tpl-title">模版中心</h1>
        <p class="tpl-subtitle">从预设框架出发，快速生成专业活动策划与视觉方案</p>
      </div>
      <div class="tpl-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-pill"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id; closePreview()"
        >
          <component :is="tab.icon" :size="14" weight="duotone" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ── Body ── -->
    <div class="tpl-body">

      <!-- 活动策划 -->
      <transition name="fade-up" mode="out-in">
        <div v-if="activeTab === 'planning'" key="planning" class="planning-grid">
          <div
            v-for="(tpl, idx) in planningTemplates"
            :key="tpl.id"
            class="plan-card"
            :class="[`span-${tpl.span}`, { selected: previewItem?.id === tpl.id }]"
            :style="{ '--accent': tpl.accent, '--index': idx }"
            @mousemove="onSpotlight"
            @mouseleave="clearSpotlight"
            @click="openPreview(tpl)"
          >
            <div class="card-glow" />
            <div class="card-inner">
              <div class="card-top">
                <div class="card-icon" :style="{ background: `${tpl.accent}14`, color: tpl.accent }">
                  <component :is="tpl.icon" :size="18" weight="duotone" />
                </div>
                <div class="card-slides-badge">{{ tpl.slides.length }} 张</div>
              </div>
              <div class="card-text">
                <h3 class="card-name">{{ tpl.name }}</h3>
                <p class="card-desc">{{ tpl.desc }}</p>
              </div>
              <div class="outline-chips">
                <span
                  v-for="s in tpl.slides.filter(s => s.type !== 'cover' && s.type !== 'end' && s.type !== 'toc').slice(0, tpl.span >= 7 ? 5 : 3)"
                  :key="s.title"
                  class="chip"
                >{{ s.title }}</span>
              </div>
              <div class="card-footer">
                <div class="footer-tags">
                  <span v-for="t in tpl.tags" :key="t" class="tag">{{ t }}</span>
                </div>
                <button class="preview-btn" @click.stop="openPreview(tpl)">
                  <PhEye :size="12" weight="bold" />
                  预览结构
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- PPT 排版 -->
        <div v-else key="layout" class="layout-grid">
          <div
            v-for="(tpl, idx) in layoutTemplates"
            :key="tpl.id"
            class="layout-card"
            :class="{ active: activeLayoutId === tpl.id, selected: previewItem?.id === tpl.id }"
            :style="{ '--index': idx }"
            @click="openPreview(tpl)"
          >
            <div class="slide-strip">
              <div class="mini-slide" :style="{ background: tpl.coverBg }">
                <div class="ms-title-line" :style="{ background: tpl.titleColor }" />
                <div class="ms-sub-line"  :style="{ background: tpl.titleColor + '80' }" />
              </div>
              <div class="mini-slide" :style="{ background: tpl.contentBg, border: '1px solid #e5e7eb' }">
                <div class="ms-header-bar" :style="{ background: tpl.primary }" />
                <div class="ms-content-lines">
                  <div class="ms-line" /><div class="ms-line short" /><div class="ms-line" />
                </div>
              </div>
              <div class="mini-slide" :style="{ background: tpl.endBg }">
                <div class="ms-end-dot"  :style="{ background: tpl.titleColor }" />
                <div class="ms-end-line" :style="{ background: tpl.titleColor + '60' }" />
              </div>
            </div>
            <div class="layout-meta">
              <div class="layout-name-row">
                <span class="layout-name">{{ tpl.name }}</span>
                <span v-if="activeLayoutId === tpl.id" class="active-badge">
                  <PhCheckCircle :size="12" weight="fill" />已应用
                </span>
              </div>
              <p class="layout-desc">{{ tpl.desc }}</p>
              <div class="swatches">
                <span v-for="c in tpl.colors" :key="c" class="swatch" :style="{ background: c }" />
              </div>
            </div>
            <div v-if="activeLayoutId === tpl.id" class="active-ring" />
          </div>
        </div>
      </transition>

      <!-- ── Preview Panel ── -->
      <transition name="panel-slide">
        <div v-if="previewItem" class="preview-panel">
          <button class="panel-close" @click="closePreview"><PhX :size="14" weight="bold" /></button>

          <!-- Planning preview -->
          <template v-if="activeTab === 'planning'">
            <div class="panel-header" :style="{ '--accent': previewItem.accent }">
              <div class="panel-icon" :style="{ background: `${previewItem.accent}18`, color: previewItem.accent }">
                <component :is="previewItem.icon" :size="22" weight="duotone" />
              </div>
              <div>
                <h2 class="panel-title">{{ previewItem.name }}</h2>
                <div class="panel-meta-row">
                  <span class="panel-badge">{{ previewItem.slides.length }} 张幻灯片</span>
                  <span class="panel-badge">{{ previewItem.duration }}</span>
                </div>
              </div>
            </div>

            <p class="panel-desc">{{ previewItem.desc }}</p>

            <div class="panel-section-title">完整幻灯片结构</div>

            <div class="slide-list">
              <div
                v-for="(slide, i) in previewItem.slides"
                :key="i"
                class="slide-row"
                :style="{ '--accent': previewItem.accent, '--delay': `${i * 30}ms` }"
              >
                <div class="slide-row-left">
                  <span class="slide-num">{{ String(i + 1).padStart(2, '0') }}</span>
                  <div class="slide-type-dot" :class="`type-${slide.type}`" />
                </div>
                <div class="slide-row-body">
                  <div class="slide-row-title">{{ slide.title }}</div>
                  <ul v-if="slide.points?.length" class="slide-points">
                    <li v-for="p in slide.points" :key="p">{{ p }}</li>
                  </ul>
                  <div v-if="slide.note" class="slide-note">{{ slide.note }}</div>
                </div>
                <span class="slide-type-label">{{ slideTypeLabel(slide.type) }}</span>
              </div>
            </div>

            <div class="panel-section-title" style="margin-top:18px">提示词预览</div>
            <div class="prompt-preview">
              <span class="prompt-text">{{ previewItem.prompt }}</span>
              <span class="prompt-cursor">|</span>
            </div>
            <p class="prompt-hint">使用后将自动填入智能体对话框，可继续补充活动细节</p>

            <div class="panel-tags">
              <span v-for="t in previewItem.tags" :key="t" class="tag">{{ t }}</span>
            </div>

            <button
              class="panel-use-btn"
              :style="{ background: previewItem.accent }"
              @click="usePlanningTemplate(previewItem)"
            >
              使用此模版，开始策划
              <PhArrowRight :size="14" weight="bold" />
            </button>
          </template>

          <!-- Layout preview -->
          <template v-else>
            <div class="panel-header">
              <div class="panel-color-dot" :style="{ background: previewItem.primary }" />
              <div>
                <h2 class="panel-title">{{ previewItem.name }}</h2>
                <div class="panel-meta-row">
                  <span v-if="activeLayoutId === previewItem.id" class="panel-badge active-text">当前已应用</span>
                </div>
              </div>
            </div>

            <p class="panel-desc">{{ previewItem.desc }}</p>

            <div class="panel-section-title">幻灯片预览</div>
            <div class="large-slides">
              <div class="large-slide-wrap">
                <div class="large-slide" :style="{ background: previewItem.coverBg }">
                  <div class="ls-cover-content">
                    <div class="ls-cover-tag" :style="{ background: previewItem.titleColor + '25', color: previewItem.titleColor }">活动策划</div>
                    <div class="ls-cover-title" :style="{ color: previewItem.titleColor }">活动主标题</div>
                    <div class="ls-cover-sub"   :style="{ color: previewItem.titleColor + 'aa' }">副标题 · 2026年</div>
                    <div class="ls-cover-line"  :style="{ background: previewItem.titleColor + '40' }" />
                    <div class="ls-cover-org"   :style="{ color: previewItem.titleColor + '70' }">主办方 / 品牌名称</div>
                  </div>
                </div>
                <span class="slide-label">封面页</span>
              </div>

              <div class="large-slide-wrap">
                <div class="large-slide" :style="{ background: previewItem.contentBg, border: '1px solid #e5e7eb' }">
                  <div class="ls-content-top" :style="{ background: previewItem.primary }" />
                  <div class="ls-content-body">
                    <div class="ls-content-title" :style="{ color: previewItem.primary }">议程安排</div>
                    <div class="ls-content-items">
                      <div v-for="item in ['开幕致辞', '主题演讲', '产品展示', '圆桌讨论']" :key="item" class="ls-content-item">
                        <div class="ls-item-dot" :style="{ background: previewItem.primary }" />
                        <span :style="{ color: previewItem.contentBg === '#ffffff' || previewItem.contentBg.startsWith('#f') ? '#374151' : '#e2e8f0', fontSize: '9px' }">{{ item }}</span>
                      </div>
                    </div>
                    <div class="ls-content-chip" :style="{ background: previewItem.primary + '15', color: previewItem.primary }">关键要点</div>
                  </div>
                </div>
                <span class="slide-label">内容页</span>
              </div>

              <div class="large-slide-wrap">
                <div class="large-slide two-col" :style="{ background: previewItem.contentBg, border: '1px solid #e5e7eb' }">
                  <div class="ls-col-left"  :style="{ background: previewItem.primary }">
                    <div class="ls-col-label" :style="{ color: previewItem.titleColor }">数据</div>
                    <div class="ls-col-num"  :style="{ color: previewItem.titleColor }">2,400+</div>
                  </div>
                  <div class="ls-col-right">
                    <div class="ls-col-title" :style="{ color: previewItem.primary }">预算规划</div>
                    <div class="ls-col-lines">
                      <div class="ls-line" /><div class="ls-line short" /><div class="ls-line" />
                    </div>
                  </div>
                </div>
                <span class="slide-label">双栏页</span>
              </div>

              <div class="large-slide-wrap">
                <div class="large-slide" :style="{ background: previewItem.endBg }">
                  <div class="ls-end-content">
                    <div class="ls-end-circle" :style="{ border: `2px solid ${previewItem.titleColor}35` }">
                      <div class="ls-end-dot" :style="{ background: previewItem.titleColor }" />
                    </div>
                    <div class="ls-end-title" :style="{ color: previewItem.titleColor }">感谢观看</div>
                    <div class="ls-end-sub"   :style="{ color: previewItem.titleColor + '60' }">THANK YOU</div>
                    <div class="ls-end-contact" :style="{ color: previewItem.titleColor + '50' }">contact@brand.com</div>
                  </div>
                </div>
                <span class="slide-label">结尾页</span>
              </div>
            </div>

            <div class="panel-section-title" style="margin-top:16px">配色方案</div>
            <div class="palette-row">
              <div v-for="(c, i) in previewItem.colors" :key="c" class="palette-chip" :style="{ background: c }">
                <span class="palette-hex">{{ c }}</span>
                <span class="palette-role">{{ ['主色', '深色', '浅色', '文字'][i] }}</span>
              </div>
            </div>

            <div class="panel-section-title" style="margin-top:16px">排版规格</div>
            <div class="typo-specs">
              <div v-for="spec in previewItem.specs" :key="spec.label" class="typo-row">
                <span class="typo-label">{{ spec.label }}</span>
                <span class="typo-value">{{ spec.value }}</span>
              </div>
            </div>

            <button
              class="panel-use-btn"
              :style="{ background: previewItem.primary }"
              @click="applyLayout(previewItem)"
            >
              <PhCheckCircle :size="14" weight="bold" />
              {{ activeLayoutId === previewItem.id ? '已应用此风格' : '应用此风格' }}
            </button>
          </template>
        </div>
      </transition>
    </div>

    <!-- Toast -->
    <transition name="toast-slide">
      <div v-if="toastVisible" class="toast">
        <PhCheckCircle :size="15" weight="fill" />{{ toastText }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import {
  PhCalendar, PhLayout, PhArrowRight, PhCheckCircle,
  PhRocket, PhCar, PhMicrophone, PhStar, PhUsers, PhChartBar,
  PhEye, PhX,
} from '@phosphor-icons/vue'

const router = useRouter()

const tabs = [
  { id: 'planning', label: '活动策划', icon: PhCalendar },
  { id: 'layout',   label: 'PPT 排版',  icon: PhLayout   },
]
const activeTab = ref('planning')

const previewItem = shallowRef(null)
function openPreview(tpl)  { previewItem.value = tpl }
function closePreview()    { previewItem.value = null }

const SLIDE_TYPE_LABELS = {
  cover:      '封面',
  toc:        '目录',
  content:    '内容',
  two_column: '双栏',
  cards:      '卡片',
  timeline:   '时间线',
  data:       '数据',
  end:        '结尾',
}
function slideTypeLabel(type) { return SLIDE_TYPE_LABELS[type] || type }

/* ─────────────── Planning Templates ─────────────── */
const planningTemplates = [
  {
    id: 'product-launch',
    name: '新品发布会',
    desc: '产品亮点呈现、媒体邀请策略、现场互动设计与传播方案全链路策划',
    icon: PhRocket,
    accent: '#165dff',
    duration: '60-90 分钟',
    span: 7,
    tags: ['发布会', '科技', '媒体'],
    prompt: '帮我做一个新品发布会的活动策划PPT，',
    slides: [
      { type: 'cover',      title: '新品发布会',     note: '主视觉封面，产品形象图 + 发布会标题 + 日期地点' },
      { type: 'toc',        title: '议程目录',       points: ['活动背景', '产品亮点', '用户洞察', '发布现场', '传播方案', '行动计划'] },
      { type: 'content',    title: '活动背景',       points: ['市场趋势与竞争格局', '品牌发展阶段与发布契机', '本次发布会核心目标'] },
      { type: 'content',    title: '核心产品亮点',   points: ['三大差异化卖点拆解', '技术创新与用户价值', '对标竞品优势对比'] },
      { type: 'two_column', title: '目标受众分析',   points: ['核心用户画像', '媒体邀请策略', 'KOL 合作矩阵'] },
      { type: 'cards',      title: '发布会形式设计', points: ['线下主会场方案', '线上直播同步互动', '媒体专区与采访安排'] },
      { type: 'timeline',   title: '现场活动流程',   points: ['签到入场 (18:00)', '开场视频 (18:30)', '高管致辞 (18:40)', '产品揭幕 (19:00)', '体验互动 (19:30)', '媒体晚宴 (20:00)'] },
      { type: 'two_column', title: '传播方案',       points: ['预热期：悬念营销 & 媒体预告', '爆发期：直播 & 话题发酵', '长尾期：UGC 征集 & 电商承接'] },
      { type: 'data',       title: '传播目标与 KPI', points: ['预期曝光量 5000 万+', '直播观看 200 万+', '话题热搜 TOP 10', '社媒互动率 ≥ 8%'] },
      { type: 'content',    title: '场地与搭建方案', points: ['主舞台视觉设计方向', '互动体验区规划', '媒体采访区布置'] },
      { type: 'two_column', title: '预算规划',       points: ['场地与搭建 40%', '传播推广 35%', '嘉宾与接待 15%', '应急备用 10%'] },
      { type: 'timeline',   title: '执行时间线',     points: ['T-60天 场地确认', 'T-45天 媒体邀请', 'T-30天 物料制作', 'T-7天 彩排走场', 'T+1天 复盘报告'] },
      { type: 'content',    title: '风险预案',       points: ['设备故障应急方案', '嘉宾缺席替代预案', '舆情管理预案'] },
      { type: 'end',        title: '感谢',           note: '联系信息 + 项目组署名' },
    ],
  },
  {
    id: 'auto-show',
    name: '汽车展览会',
    desc: '车型介绍、试驾安排与展台视觉设计，打造沉浸式品牌体验',
    icon: PhCar,
    accent: '#374151',
    duration: '3-5 天',
    span: 5,
    tags: ['展览', '汽车', '体验'],
    prompt: '帮我做一个汽车展览会的活动策划PPT，',
    slides: [
      { type: 'cover',      title: '品牌车展策划',   note: '主视觉：旗舰车型侧面 + 展会标题 + 参展日期' },
      { type: 'toc',        title: '策划目录',       points: ['品牌定位', '参展车型', '展台设计', '试驾方案', '传播计划', '预算时间线'] },
      { type: 'content',    title: '品牌参展定位',   points: ['本届车展核心传播主题', '目标受众画像与购车决策路径', '差异化竞争策略'] },
      { type: 'cards',      title: '参展车型矩阵',   points: ['旗舰轿车：全球首发款', '新能源 SUV：量产上市版', '概念车：未来出行愿景', '运动款：限量特别版'] },
      { type: 'two_column', title: '展台空间规划',   points: ['主展台：旗舰车型 360° 舞台', '互动区：科技配置体验舱', '洽谈区：VIP 接待室', '媒体区：独立采访间'] },
      { type: 'content',    title: '展台视觉方案',   points: ['主色调与材质方向', '灯光设计与动态显示', '品牌 IP 互动装置'] },
      { type: 'timeline',   title: '试驾活动方案',   points: ['媒体试驾日 (Day 1)', '专业买家试驾 (Day 2)', '公众开放试驾 (Day 3-5)', '试驾路线规划', '安全保障方案'] },
      { type: 'content',    title: '现场活动设计',   points: ['发布会 / 技术说明会', 'VIP 客户专属体验日', '互动游戏与礼品方案'] },
      { type: 'two_column', title: '传播方案',       points: ['展前：悬念预热 + 媒体提前探营', '展中：直播 + 实时话题运营', '展后：精华内容二次传播'] },
      { type: 'data',       title: '预期成效',       points: ['到场观众目标 8 万人次', '媒体曝光 2 亿次+', '线索收集 5000 条', '意向订单 300+'] },
      { type: 'two_column', title: '预算分解',       points: ['展台搭建 45%', '车辆运输与保险 15%', '传播推广 25%', '接待与人员 15%'] },
      { type: 'end',        title: '感谢',           note: '项目组 + 联系方式' },
    ],
  },
  {
    id: 'annual-summit',
    name: '年度峰会',
    desc: '大会议程规划、演讲嘉宾阵容与分论坛管理，配合直播传播方案',
    icon: PhMicrophone,
    accent: '#0369a1',
    duration: '1-2 天',
    span: 5,
    tags: ['峰会', '行业', '直播'],
    prompt: '帮我做一个年度行业峰会的活动策划PPT，',
    slides: [
      { type: 'cover',      title: '年度峰会策划方案', note: '峰会主题视觉 + 时间地点 + 主办方' },
      { type: 'toc',        title: '策划目录',         points: ['峰会定位', '议程规划', '嘉宾矩阵', '会场方案', '直播传播', '执行保障'] },
      { type: 'content',    title: '峰会战略定位',     points: ['本届主题与核心议题', '目标群体：决策者 / 专业人士 / 媒体', '峰会品牌价值与往届回顾'] },
      { type: 'cards',      title: '峰会规模',         points: ['参会嘉宾 500+ 人', '演讲嘉宾 20+ 位', '分论坛 6 个', '合作媒体 50+'] },
      { type: 'timeline',   title: '主论坛议程 (Day 1)', points: ['09:00 开幕典礼 & 主旨演讲', '10:30 圆桌对话：行业趋势', '12:00 商务午餐 & 1v1 会面', '14:00 专题演讲 × 3', '16:00 闪电演讲 × 5', '18:00 颁奖晚宴'] },
      { type: 'timeline',   title: '分论坛议程 (Day 2)', points: ['论坛A：战略与投资', '论坛B：技术与创新', '论坛C：品牌与营销', '论坛D：出海与全球化', '论坛E：ESG 可持续', '论坛F：青年领袖'] },
      { type: 'cards',      title: '嘉宾阵容',         points: ['主旨演讲：行业顶级领袖 3 位', '圆桌嘉宾：上市公司 CEO × 5', '创业明星：独角兽创始人 × 4', '学界专家：顶尖研究机构 × 3'] },
      { type: 'two_column', title: '会场空间规划',     points: ['主论坛：3000 席宴会厅', '分论坛：6 个独立会议室', 'VIP 休息室 & 商务洽谈区', '展览区 & 赞助商展位'] },
      { type: 'content',    title: '直播传播方案',     points: ['多平台同步直播（官网/微博/视频号）', '实时文字直播与精华剪辑', '会后白皮书与演讲视频输出'] },
      { type: 'data',       title: '传播目标',         points: ['线下参会 500 人', '线上直播 50 万观看', '话题阅读量 3 亿+', '白皮书下载 1 万份+'] },
      { type: 'content',    title: '赞助权益体系',     points: ['首席赞助：全场权益 + 专属演讲', '战略赞助：展位 + 分论坛冠名', '支持赞助：品牌曝光 + 参会名额'] },
      { type: 'two_column', title: '预算规划',         points: ['场地与搭建 35%', '嘉宾接待差旅 20%', '传播与直播 25%', '餐饮与接待 20%'] },
      { type: 'timeline',   title: '执行时间线',       points: ['T-90天 主题确认', 'T-60天 嘉宾邀请', 'T-45天 赞助签约', 'T-30天 传播预热', 'T-7天 全流程彩排', 'T+7天 总结报告'] },
      { type: 'content',    title: '应急预案',         points: ['嘉宾临时缺席替代方案', '设备技术故障处理流程', '突发舆情应对机制'] },
      { type: 'end',        title: '感谢',             note: '主办方 / 承办方 / 合作伙伴鸣谢' },
    ],
  },
  {
    id: 'brand-anniversary',
    name: '品牌周年庆',
    desc: '品牌历程回顾、用户感恩互动与礼遇计划，强化情感连接与传播',
    icon: PhStar,
    accent: '#c2410c',
    duration: '1 天',
    span: 7,
    tags: ['品牌', '庆典', '用户'],
    prompt: '帮我做一个品牌周年庆活动策划PPT，',
    slides: [
      { type: 'cover',      title: 'X 周年庆典策划',   note: '品牌主视觉 + 周年标识 + 时间地点' },
      { type: 'toc',        title: '策划目录',          points: ['品牌历程', '活动主题', '感恩礼遇', '互动设计', '传播方案', '执行计划'] },
      { type: 'timeline',   title: '品牌发展历程',      points: ['创立初心与第一个里程碑', '关键增长节点（3 个）', '重大产品 / 服务突破', '当前规模与成就'] },
      { type: 'content',    title: '核心成就展示',      points: ['服务用户总量与增长曲线', '行业荣誉与媒体认可', '社会影响力数据'] },
      { type: 'content',    title: '周年庆主题方案',    points: ['主题定位：情感共鸣还是未来展望？', '视觉主题色 & 专属 LOGO', '核心 slogan 方向建议'] },
      { type: 'cards',      title: '用户感恩礼遇',      points: ['超级会员专属礼品盒', '老用户免费升级权益', '忠诚用户专属庆典邀请', '限量周年纪念款产品'] },
      { type: 'two_column', title: '现场活动设计',      points: ['品牌历史长廊 & 互动装置', '用户故事展区 & 征集视频', 'CEO 与用户圆桌对话', '周年纪念品抽奖环节'] },
      { type: 'content',    title: '明星 & KOL 助阵',   points: ['品牌代言人周年特别内容', '核心 KOL 邀请参与 & 传播', '用户代表 UGC 征集活动'] },
      { type: 'content',    title: '数字化互动方案',    points: ['专属 H5 时光机回忆生成', '话题挑战赛 & 投票活动', '线上直播 & 全球用户连线'] },
      { type: 'two_column', title: '传播方案',          points: ['预热期：用户故事征集 & 悬念', '爆发期：庆典直播 & 话题冲榜', '长尾期：纪念内容二次传播'] },
      { type: 'data',       title: '传播目标',          points: ['话题曝光 5 亿+', '直播观看 300 万+', 'UGC 内容 10 万条+', '品牌好感度提升 15%'] },
      { type: 'two_column', title: '预算规划',          points: ['用户礼品 30%', '活动场地 25%', '传播推广 30%', '接待与其他 15%'] },
      { type: 'end',        title: '感谢每一位陪伴者',  note: '感谢用户 + 团队 + 合作伙伴' },
    ],
  },
  {
    id: 'industry-forum',
    name: '行业论坛',
    desc: '议题框架搭建、圆桌讨论设计与会后白皮书输出，建立行业影响力',
    icon: PhUsers,
    accent: '#166534',
    duration: '半天',
    span: 6,
    tags: ['论坛', '圆桌', '白皮书'],
    prompt: '帮我做一个行业论坛的活动策划PPT，',
    slides: [
      { type: 'cover',      title: '行业论坛策划方案', note: '论坛主题视觉 + 主办方 + 时间地点' },
      { type: 'toc',        title: '策划目录',         points: ['论坛定位', '议题框架', '嘉宾阵容', '圆桌设计', '会后输出', '赞助方案'] },
      { type: 'content',    title: '论坛战略定位',     points: ['本届核心议题与行业痛点', '目标参会群体：高管 / 专家 / 投资人', '论坛品牌价值主张'] },
      { type: 'cards',      title: '四大核心议题',     points: ['议题一：行业变革趋势研判', '议题二：技术创新落地路径', '议题三：政策环境与合规应对', '议题四：全球化机遇与挑战'] },
      { type: 'two_column', title: '嘉宾阵容',         points: ['主题演讲：行业权威专家 × 3', '圆桌主持：资深行业观察者', '对话嘉宾：头部企业高管 × 6', '特邀观察：政策研究机构'] },
      { type: 'timeline',   title: '论坛议程',         points: ['09:00 开场 & 主题演讲', '10:00 专题对话 × 2', '11:30 圆桌讨论（封闭式）', '12:30 工作午餐 & 1v1 交流', '14:00 行业倡议发布', '14:30 闭幕总结'] },
      { type: 'content',    title: '圆桌讨论设计',     points: ['议题聚焦方向与主持人提纲', '参与嘉宾遴选标准', '讨论成果呈现与共识声明形式'] },
      { type: 'content',    title: '互动参与设计',     points: ['现场问答 & 话题投票', '行业调研实时数据发布', '参会者专属 APP 互动功能'] },
      { type: 'two_column', title: '会后成果输出',     points: ['行业白皮书（精华版 / 完整版）', '圆桌讨论实录整理', '演讲视频及 PPT 开放下载', '媒体报道与专访内容'] },
      { type: 'content',    title: '赞助权益体系',     points: ['首席赞助：冠名权 + 主旨演讲', '共同主办：议题设置参与权', '支持赞助：展位 + 品牌曝光'] },
      { type: 'end',        title: '感谢',             note: '主办方 / 合作机构 / 赞助伙伴' },
    ],
  },
  {
    id: 'roadshow',
    name: '路演推介',
    desc: '投资人洞察、核心指标呈现与融资逻辑闭环，为资本对话做充分准备',
    icon: PhChartBar,
    accent: '#3730a3',
    duration: '20-30 分钟',
    span: 6,
    tags: ['融资', '投资人', '数据'],
    prompt: '帮我做一个融资路演推介的PPT，',
    slides: [
      { type: 'cover',      title: '融资路演',         note: '公司 Logo + 核心一句话定位 + 融资轮次' },
      { type: 'content',    title: '公司使命',         points: ['一句话描述解决什么问题', '核心愿景与长期目标', '为什么是现在'] },
      { type: 'content',    title: '市场机会',         points: ['目标市场规模 TAM / SAM / SOM', '市场增速与驱动因素', '政策 & 产业背景利好'] },
      { type: 'content',    title: '痛点与解决方案',   points: ['现有方案的核心缺陷', '我们的差异化解决路径', '产品 / 服务核心功能演示'] },
      { type: 'data',       title: '产品核心数据',     points: ['活跃用户数 & 增长趋势', '关键留存率 & NPS 分数', '核心效率指标对比行业基准'] },
      { type: 'content',    title: '技术与产品壁垒',   points: ['核心技术专利 / 算法优势', '数据飞轮与网络效应', '关键资源与不可复制性'] },
      { type: 'two_column', title: '商业模式',         points: ['收入来源与定价逻辑', '获客成本 CAC vs 用户价值 LTV', '毛利率结构与改善路径'] },
      { type: 'data',       title: '财务表现',         points: ['近 12 个月 ARR / GMV 增长', '月均收入及增速', '当前 Burn Rate & Runway'] },
      { type: 'cards',      title: '竞争格局',         points: ['直接竞争对手矩阵分析', '差异化维度比较', '行业第一梯队与我们的关系'] },
      { type: 'content',    title: '增长策略',         points: ['获客渠道与 GTM 计划', '产品路线图（18 个月）', '关键里程碑与节点'] },
      { type: 'cards',      title: '核心团队',         points: ['CEO：背景与相关经验', 'CTO：技术能力证明', '核心高管：行业资源', '顾问：背书与赋能'] },
      { type: 'content',    title: '融资计划',         points: ['本轮融资金额与估值', '资金使用分配（产品/销售/团队）', '使用后能达到的里程碑'] },
      { type: 'data',       title: '股权结构',         points: ['现有股东及持股比例', '本轮稀释比例', '期权池预留方案'] },
      { type: 'content',    title: '已有投资方',       points: ['现有机构投资人背书', '战略资源与赋能能力', '联合投资欢迎方向'] },
      { type: 'two_column', title: '关键风险与应对',   points: ['市场风险 & 应对策略', '技术风险 & 备选路径', '监管风险 & 合规准备'] },
      { type: 'content',    title: '为什么现在投？',   points: ['市场窗口期判断', '团队当前动能证明', '本轮投资后的价值创造路径'] },
      { type: 'end',        title: '期待合作',         note: '联系方式 + 数据室访问申请' },
    ],
  },
]

/* ─────────────── Layout Templates ─────────────── */
const layoutTemplates = [
  {
    id: 'tech-blue',
    name: '科技蓝',
    desc: '简洁科技感，蓝色渐变封面，适合发布会与科技产品',
    primary: '#165dff',
    bgColor: '#ffffff',
    coverBg: 'linear-gradient(135deg, #165dff 0%, #0a2fa3 100%)',
    contentBg: '#ffffff',
    endBg: '#0d1a3f',
    titleColor: '#ffffff',
    colors: ['#165dff', '#0a2fa3', '#e8f0ff', '#1d2129'],
    specs: [
      { label: '字体', value: 'Outfit / PingFang SC' },
      { label: '标题字号', value: '40px · 粗体' },
      { label: '正文字号', value: '18px · 常规' },
      { label: '行高', value: '1.65' },
      { label: '封面排版', value: '左对齐大标题' },
      { label: '内容版式', value: '顶部色条 + 正文区' },
    ],
  },
  {
    id: 'warm-orange',
    name: '暖橙活力',
    desc: '几何切割构图，橙调背景，适合消费品与品牌活动',
    primary: '#ea580c',
    bgColor: '#fef7f0',
    coverBg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
    contentBg: '#fff8f4',
    endBg: '#7c2d12',
    titleColor: '#ffffff',
    colors: ['#ea580c', '#c2410c', '#fff1e6', '#1c0a00'],
    specs: [
      { label: '字体', value: 'Outfit / PingFang SC' },
      { label: '标题字号', value: '38px · 粗体' },
      { label: '正文字号', value: '17px · 常规' },
      { label: '行高', value: '1.7' },
      { label: '封面排版', value: '全出血渐变 + 居中标题' },
      { label: '内容版式', value: '暖色底 + 橙色强调' },
    ],
  },
  {
    id: 'dark-minimal',
    name: '深色极简',
    desc: '全暗色底，大面积留白，高端路演与私募投资首选',
    primary: '#e2e8f0',
    bgColor: '#0f172a',
    coverBg: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
    contentBg: '#1e293b',
    endBg: '#020617',
    titleColor: '#f1f5f9',
    colors: ['#0f172a', '#334155', '#64748b', '#f1f5f9'],
    specs: [
      { label: '字体', value: 'Geist / PingFang SC' },
      { label: '标题字号', value: '42px · 粗体' },
      { label: '正文字号', value: '18px · 常规' },
      { label: '行高', value: '1.6' },
      { label: '封面排版', value: '深色全屏 + 左下角标题' },
      { label: '内容版式', value: '深蓝卡片 + 细线分割' },
    ],
  },
  {
    id: 'gradient-violet',
    name: '流体渐变',
    desc: '紫蓝流体渐变背景，动感视觉，适合互联网与创意行业',
    primary: '#7c3aed',
    bgColor: '#faf5ff',
    coverBg: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
    contentBg: '#faf5ff',
    endBg: '#2e1065',
    titleColor: '#ffffff',
    colors: ['#4f46e5', '#7c3aed', '#e9d5ff', '#1e1b4b'],
    specs: [
      { label: '字体', value: 'Satoshi / PingFang SC' },
      { label: '标题字号', value: '40px · 粗体' },
      { label: '正文字号', value: '17px · 常规' },
      { label: '行高', value: '1.7' },
      { label: '封面排版', value: '流体渐变背景 + 居中大标题' },
      { label: '内容版式', value: '浅紫底 + 紫色强调色块' },
    ],
  },
  {
    id: 'business-classic',
    name: '商务经典',
    desc: '藏青金双色，分割构图，峰会论坛与政企汇报专用',
    primary: '#1e3a5f',
    bgColor: '#f8fafc',
    coverBg: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
    contentBg: '#f8fafc',
    endBg: '#0f2744',
    titleColor: '#f0c060',
    colors: ['#1e3a5f', '#0f2744', '#f0c060', '#f8fafc'],
    specs: [
      { label: '字体', value: 'Outfit / 思源黑体' },
      { label: '标题字号', value: '36px · 粗体' },
      { label: '正文字号', value: '16px · 常规' },
      { label: '行高', value: '1.65' },
      { label: '封面排版', value: '左侧藏青色块 + 金色标题' },
      { label: '内容版式', value: '白底 + 顶部藏青条 + 金色点缀' },
    ],
  },
  {
    id: 'fresh-green',
    name: '清新自然',
    desc: '绿白大留白风格，轻质感排版，公益、教育与环保主题',
    primary: '#16a34a',
    bgColor: '#f0fdf4',
    coverBg: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    contentBg: '#f0fdf4',
    endBg: '#14532d',
    titleColor: '#ffffff',
    colors: ['#16a34a', '#15803d', '#dcfce7', '#14532d'],
    specs: [
      { label: '字体', value: 'Outfit / PingFang SC' },
      { label: '标题字号', value: '38px · 粗体' },
      { label: '正文字号', value: '17px · 常规' },
      { label: '行高', value: '1.75' },
      { label: '封面排版', value: '绿色全出血 + 左对齐白字' },
      { label: '内容版式', value: '浅绿底 + 大留白 + 绿色强调' },
    ],
  },
]

/* ── Active layout ── */
const activeLayoutId = ref(localStorage.getItem('oc_active_layout') || '')
function applyLayout(tpl) {
  activeLayoutId.value = tpl.id
  localStorage.setItem('oc_active_layout', tpl.id)
  showToast(`已应用「${tpl.name}」风格`)
}

function usePlanningTemplate(tpl) {
  sessionStorage.setItem('oc_prefill_prompt', tpl.prompt)
  router.push('/agent')
}

/* ── Toast ── */
const toastVisible = ref(false)
const toastText    = ref('')
let   toastTimer   = null
function showToast(text) {
  toastText.value    = text
  toastVisible.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, 2800)
}

/* ── Spotlight ── */
function onSpotlight(e) {
  const el = e.currentTarget, r = el.getBoundingClientRect()
  el.style.setProperty('--glow-x', `${e.clientX - r.left}px`)
  el.style.setProperty('--glow-y', `${e.clientY - r.top}px`)
}
function clearSpotlight(e) {
  const el = e.currentTarget
  el.style.removeProperty('--glow-x')
  el.style.removeProperty('--glow-y')
}
</script>

<style scoped>
.tpl-root {
  height: 100%;
  overflow: hidden;
  padding: 32px 36px 0;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Header ── */
.tpl-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}
.tpl-title  { margin: 0 0 4px; font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.4px; }
.tpl-subtitle { margin: 0; font-size: 13px; color: #9ca3af; }

.tpl-tabs { display: flex; gap: 4px; background: rgba(0,0,0,0.04); border-radius: 10px; padding: 3px; flex-shrink: 0; }
.tab-pill {
  display: flex; align-items: center; gap: 5px; padding: 6px 14px;
  border: none; background: transparent; border-radius: 7px;
  font-family: inherit; font-size: 13px; font-weight: 500; color: #6b7280;
  cursor: pointer; white-space: nowrap;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}
.tab-pill.active { background: #fff; color: #111827; box-shadow: 0 1px 4px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04); }

/* ── Body ── */
.tpl-body {
  flex: 1; overflow: hidden;
  display: flex; gap: 16px; min-height: 0;
}
.tpl-body > .planning-grid,
.tpl-body > .layout-grid {
  flex: 1; overflow-y: auto; padding-bottom: 32px; min-width: 0;
}

/* ── Planning grid ── */
.planning-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 14px; align-content: start; }
.span-7 { grid-column: span 7; }
.span-5 { grid-column: span 5; }
.span-6 { grid-column: span 6; }

.plan-card {
  position: relative; background: #fff; border-radius: 16px;
  border: 1.5px solid rgba(0,0,0,0.06); cursor: pointer; overflow: hidden;
  animation: card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--index, 0) * 55ms);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}
.plan-card:hover  { border-color: rgba(0,0,0,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.07); transform: translateY(-2px); }
.plan-card:active { transform: translateY(0) scale(0.99); }
.plan-card.selected { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent); }

.card-glow {
  pointer-events: none; position: absolute; inset: 0; border-radius: inherit; z-index: 0;
  background: radial-gradient(280px circle at var(--glow-x, -999px) var(--glow-y, -999px),
    color-mix(in srgb, var(--accent) 8%, transparent), transparent 65%);
}
.card-inner { position: relative; z-index: 1; padding: 20px 22px 18px; display: flex; flex-direction: column; gap: 14px; height: 100%; }
.card-top { display: flex; align-items: center; justify-content: space-between; }
.card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.card-slides-badge { font-size: 11px; font-weight: 600; color: #9ca3af; background: #f3f4f6; padding: 3px 8px; border-radius: 20px; }
.card-text { flex: 1; }
.card-name { margin: 0 0 5px; font-size: 15px; font-weight: 700; color: #111827; letter-spacing: -0.2px; }
.card-desc { margin: 0; font-size: 12.5px; color: #6b7280; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.outline-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chip { font-size: 11px; font-weight: 500; color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); padding: 3px 9px; border-radius: 20px; white-space: nowrap; }
.card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 2px; border-top: 1px solid rgba(0,0,0,0.05); }
.footer-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.tag { font-size: 10.5px; color: #9ca3af; background: #f3f4f6; padding: 2px 7px; border-radius: 20px; white-space: nowrap; }
.preview-btn {
  display: flex; align-items: center; gap: 4px; padding: 5px 12px;
  border: 1.5px solid rgba(0,0,0,0.1); background: transparent; color: #374151;
  font-family: inherit; font-size: 11.5px; font-weight: 600; border-radius: 8px;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}
.preview-btn:hover  { background: #f9fafb; border-color: rgba(0,0,0,0.18); }
.preview-btn:active { transform: scale(0.96); }

/* ── Layout grid ── */
.layout-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-content: start; }

.layout-card {
  position: relative; background: #fff; border-radius: 16px;
  border: 1.5px solid rgba(0,0,0,0.07); cursor: pointer; overflow: hidden;
  animation: card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--index, 0) * 60ms);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}
.layout-card:hover  { border-color: rgba(0,0,0,0.12); box-shadow: 0 8px 28px rgba(0,0,0,0.07); transform: translateY(-2px); }
.layout-card:active { transform: scale(0.99); }
.layout-card.active, .layout-card.selected { border-color: #165dff; box-shadow: 0 0 0 3px rgba(22, 93, 255, 0.1); }
.active-ring { pointer-events: none; position: absolute; inset: 0; border-radius: inherit; background: rgba(22,93,255,0.025); }

.slide-strip { display: flex; gap: 6px; padding: 16px 16px 12px; background: #f9fafb; border-bottom: 1px solid rgba(0,0,0,0.05); }
.mini-slide { flex: 1; aspect-ratio: 16/9; border-radius: 5px; overflow: hidden; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; }
.ms-title-line { width: 55%; height: 4px; border-radius: 2px; opacity: 0.9; }
.ms-sub-line   { width: 38%; height: 3px; border-radius: 2px; opacity: 0.6; }
.ms-header-bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; }
.ms-content-lines { display: flex; flex-direction: column; gap: 3px; padding: 10px 6px 4px; width: 100%; }
.ms-line { height: 2.5px; background: rgba(0,0,0,0.12); border-radius: 2px; }
.ms-line.short { width: 60%; }
.ms-end-dot  { width: 10px; height: 10px; border-radius: 50%; opacity: 0.85; }
.ms-end-line { width: 36px; height: 2px; border-radius: 2px; }

.layout-meta { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; }
.layout-name-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.layout-name { font-size: 14px; font-weight: 700; color: #111827; letter-spacing: -0.2px; }
.active-badge { display: flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: #165dff; background: rgba(22,93,255,0.08); padding: 2px 8px; border-radius: 20px; flex-shrink: 0; }
.layout-desc { margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.swatches { display: flex; gap: 5px; margin-top: 2px; }
.swatch { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.7); box-shadow: 0 1px 3px rgba(0,0,0,0.15); display: inline-block; }

/* ── Preview Panel ── */
.preview-panel {
  width: 340px; flex-shrink: 0;
  background: #fff; border-radius: 18px; border: 1px solid rgba(0,0,0,0.07);
  overflow-y: auto; padding: 24px 22px 32px;
  position: relative; display: flex; flex-direction: column; gap: 0;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  margin-bottom: 32px;
}
.panel-close {
  position: absolute; top: 16px; right: 16px;
  width: 26px; height: 26px; border: none; background: #f3f4f6;
  border-radius: 50%; cursor: pointer; color: #6b7280;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}
.panel-close:hover { background: #e5e7eb; color: #111827; }

.panel-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.panel-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.panel-color-dot { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; }
.panel-title { margin: 0 0 6px; font-size: 17px; font-weight: 700; color: #111827; letter-spacing: -0.3px; padding-right: 28px; }
.panel-meta-row { display: flex; gap: 5px; flex-wrap: wrap; }
.panel-badge { font-size: 11px; font-weight: 600; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 20px; }
.panel-badge.active-text { color: #165dff; background: rgba(22,93,255,0.08); }
.panel-desc { margin: 0 0 20px; font-size: 13px; color: #6b7280; line-height: 1.6; }
.panel-section-title { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px; }

/* ── Slide list ── */
.slide-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; }

.slide-row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 9px 10px; border-radius: 10px;
  animation: card-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: var(--delay, 0ms);
  transition: background 0.15s ease;
  cursor: default;
}
.slide-row:hover { background: #f9fafb; }

.slide-row-left { display: flex; align-items: center; gap: 6px; flex-shrink: 0; padding-top: 2px; }

.slide-num { font-size: 10px; font-weight: 700; color: #d1d5db; font-variant-numeric: tabular-nums; width: 16px; text-align: right; }

.slide-type-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.type-cover    { background: #6366f1; }
.type-toc      { background: #8b5cf6; }
.type-content  { background: var(--accent, #165dff); opacity: 0.7; }
.type-two_column { background: #0ea5e9; }
.type-cards    { background: #10b981; }
.type-timeline { background: #f59e0b; }
.type-data     { background: #ef4444; }
.type-end      { background: #6b7280; }

.slide-row-body { flex: 1; min-width: 0; }
.slide-row-title { font-size: 13px; font-weight: 600; color: #1f2937; line-height: 1.3; margin-bottom: 4px; }
.slide-points { margin: 0; padding: 0 0 0 12px; display: flex; flex-direction: column; gap: 2px; }
.slide-points li { font-size: 11.5px; color: #6b7280; line-height: 1.4; }
.slide-note { font-size: 11.5px; color: #9ca3af; line-height: 1.4; font-style: italic; }

.slide-type-label {
  font-size: 9.5px; font-weight: 600; color: #9ca3af;
  background: #f3f4f6; padding: 2px 6px; border-radius: 6px;
  white-space: nowrap; flex-shrink: 0; margin-top: 2px;
}

/* Prompt */
.prompt-preview { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #374151; line-height: 1.5; margin-bottom: 8px; }
.prompt-cursor { display: inline-block; color: #165dff; font-weight: 700; animation: blink 1.1s step-end infinite; margin-left: 1px; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.prompt-hint { margin: 0 0 16px; font-size: 11.5px; color: #9ca3af; line-height: 1.5; }
.panel-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 20px; }

/* Large slides */
.large-slides { display: flex; flex-direction: column; gap: 12px; margin-bottom: 4px; }
.large-slide-wrap { display: flex; flex-direction: column; gap: 5px; }
.large-slide { width: 100%; aspect-ratio: 16/9; border-radius: 10px; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; }
.large-slide.two-col { display: grid; grid-template-columns: 1fr 1fr; }

.ls-cover-content { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; padding: 0 18px; width: 100%; }
.ls-cover-tag   { font-size: 8px; font-weight: 700; padding: 2px 7px; border-radius: 20px; letter-spacing: 0.4px; text-transform: uppercase; }
.ls-cover-title { font-size: 15px; font-weight: 700; letter-spacing: -0.3px; line-height: 1.2; }
.ls-cover-sub   { font-size: 9px; font-weight: 400; }
.ls-cover-line  { width: 36px; height: 2px; border-radius: 2px; margin: 2px 0; }
.ls-cover-org   { font-size: 8px; }

.ls-content-top { position: absolute; top: 0; left: 0; right: 0; height: 5px; }
.ls-content-body { padding: 14px 16px 10px; width: 100%; }
.ls-content-title { font-size: 11px; font-weight: 700; margin-bottom: 8px; }
.ls-content-items { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.ls-content-item { display: flex; align-items: center; gap: 5px; }
.ls-item-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.ls-content-chip { display: inline-block; font-size: 8px; font-weight: 700; padding: 2px 7px; border-radius: 20px; margin-top: 4px; }
.ls-line { height: 2.5px; background: rgba(0,0,0,0.1); border-radius: 2px; margin-bottom: 4px; }
.ls-line.short { width: 55%; }

.ls-col-left { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.ls-col-label { font-size: 8px; font-weight: 600; opacity: 0.8; }
.ls-col-num { font-size: 16px; font-weight: 800; letter-spacing: -0.5px; }
.ls-col-right { padding: 12px; display: flex; flex-direction: column; justify-content: center; }
.ls-col-title { font-size: 10px; font-weight: 700; margin-bottom: 8px; }
.ls-col-lines { display: flex; flex-direction: column; gap: 4px; }

.ls-end-content { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.ls-end-circle { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.ls-end-dot { width: 9px; height: 9px; border-radius: 50%; }
.ls-end-title { font-size: 11px; font-weight: 700; }
.ls-end-sub { font-size: 7px; font-weight: 600; letter-spacing: 1.5px; }
.ls-end-contact { font-size: 7px; margin-top: 2px; }

.slide-label { font-size: 11px; color: #9ca3af; font-weight: 500; padding-left: 2px; }

/* Palette */
.palette-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.palette-chip { flex: 1; min-width: 60px; border-radius: 8px; padding: 10px 8px 8px; display: flex; flex-direction: column; gap: 3px; }
.palette-hex  { font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.85); text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
.palette-role { font-size: 8.5px; color: rgba(255,255,255,0.6); text-shadow: 0 1px 2px rgba(0,0,0,0.3); }

/* Typo specs */
.typo-specs { display: flex; flex-direction: column; gap: 0; margin-bottom: 20px; }
.typo-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f3f4f6; }
.typo-row:last-child { border-bottom: none; }
.typo-label { font-size: 12px; color: #9ca3af; font-weight: 500; }
.typo-value { font-size: 12px; color: #374151; font-weight: 600; }

/* CTA */
.panel-use-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 11px 16px; border: none; color: #fff;
  font-family: inherit; font-size: 13px; font-weight: 700; border-radius: 11px;
  cursor: pointer; margin-top: auto;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.panel-use-btn:hover  { opacity: 0.88; }
.panel-use-btn:active { transform: scale(0.98); }

/* Toast */
.toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px; padding: 9px 18px;
  background: #111827; color: #fff; font-size: 13px; font-weight: 500;
  border-radius: 100px; box-shadow: 0 4px 20px rgba(0,0,0,0.22);
  white-space: nowrap; z-index: 200; pointer-events: none;
}

/* Transitions */
@keyframes card-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.panel-slide-enter-active { transition: opacity 0.28s ease, transform 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-slide-leave-active { transition: opacity 0.18s ease, transform 0.2s ease; }
.panel-slide-enter-from   { opacity: 0; transform: translateX(20px); }
.panel-slide-leave-to     { opacity: 0; transform: translateX(16px); }

.fade-up-enter-active { transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.fade-up-leave-active { transition: opacity 0.14s ease, transform 0.14s ease; }
.fade-up-enter-from   { opacity: 0; transform: translateY(6px); }
.fade-up-leave-to     { opacity: 0; transform: translateY(-4px); }

.toast-slide-enter-active { transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-slide-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.toast-slide-enter-from   { opacity: 0; transform: translateX(-50%) translateY(10px); }
.toast-slide-leave-to     { opacity: 0; transform: translateX(-50%) translateY(6px); }
</style>
