<template>
  <a-layout class="app-shell">
    <!-- 左侧导航 -->
    <a-layout-sider
      class="app-sider"
      :collapsed="collapsed"
      :collapsed-width="60"
      :width="220"
      collapsible
      :trigger="null"
      hide-trigger
    >
      <!-- Logo -->
      <div class="sider-logo">
        <span class="logo-mark" v-show="collapsed">
          <PhSparkle :size="22" weight="duotone" />
        </span>
        <span class="logo-text-group" v-show="!collapsed">
          <span class="logo-text">Luna</span>
          <span class="logo-sub">活动策划助手</span>
        </span>
        <a-tooltip :content="collapsed ? '展开侧栏' : '收起侧栏'" position="right">
          <button class="collapse-btn" @click="collapsed = !collapsed">
            <PhCaretLeft :size="14" weight="bold" :class="{ 'rotated': collapsed }" />
          </button>
        </a-tooltip>
      </div>

      <!-- 自定义导航列表，绕过 Arco 图标字体限制 -->
      <nav class="sider-nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: currentRoute === item.path }"
          @click="onNavClick(item.path)"
        >
          <span class="nav-icon">
            <component :is="item.icon" :size="18" weight="duotone" />
          </span>
          <span class="nav-label" v-show="!collapsed">{{ item.label }}</span>
        </button>
      </nav>
    </a-layout-sider>

    <!-- 右侧内容 -->
    <a-layout class="app-content">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  PhFolderOpen,
  PhRobot,
  PhSliders,
  PhCaretLeft,
  PhSparkle,
  PhLayout,
} from '@phosphor-icons/vue'

const router = useRouter()
const route  = useRoute()
const APP_SIDER_COLLAPSED_KEY = 'oc_app_sider_collapsed'

const navItems = [
  { path: '/workspace', label: '策划空间', icon: PhFolderOpen },
  { path: '/agent',     label: '智能助手', icon: PhRobot      },
  { path: '/templates', label: '模版中心', icon: PhLayout     },
  { path: '/settings',  label: '配置中心', icon: PhSliders    },
]

function loadCollapsedState() {
  try { return localStorage.getItem(APP_SIDER_COLLAPSED_KEY) === '1' }
  catch { return false }
}

const collapsed    = ref(loadCollapsedState())
const currentRoute = computed(() => route.path)

function onNavClick(path) { router.push(path) }

watch(collapsed, (value) => {
  try { localStorage.setItem(APP_SIDER_COLLAPSED_KEY, value ? '1' : '0') }
  catch {}
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Satisfy&display=swap');

/* ── 全局重置 ── */
*, *::before, *::after { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; padding: 0; overflow: hidden; }
body {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif;
}

/* ── App Shell ── */
.app-shell { height: 100vh; overflow: hidden; }

/* ── Sider ── */
.app-sider {
  background: #faf9f7 !important;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(0,0,0,0.06) !important;
}

.app-sider :deep(.arco-layout-sider-children) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Logo ── */
.sider-logo {
  height: 72px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  flex-shrink: 0;
  user-select: none;
  overflow: hidden;
}

.logo-mark {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #44403c;
}

.logo-text-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
}

.logo-text {
  font-family: 'Satisfy', cursive;
  font-size: 22px;
  font-weight: 400;
  color: #44403c;
  white-space: nowrap;
  line-height: 1.2;
}

.logo-sub {
  font-size: 11px;
  font-weight: 400;
  color: #a8a29e;
  white-space: nowrap;
  letter-spacing: 0.1px;
}

/* ── Nav ── */
.sider-nav {
  flex: 1;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 16px);
  margin: 0 8px;
  padding: 0 10px;
  height: 38px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: #57534e;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  text-align: left;
  transition: background 0.18s cubic-bezier(0.16, 1, 0.3, 1),
              color      0.18s cubic-bezier(0.16, 1, 0.3, 1),
              transform  0.18s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
  overflow: hidden;
  white-space: nowrap;
}

.nav-item:hover:not(.active) {
  background: rgba(68,64,60,0.06);
  color: #44403c;
  transform: translateX(2px);
}

/* Active: full-width left bar 指示器 */
.nav-item.active {
  background: rgba(68,64,60,0.08);
  color: #1c1917;
  font-weight: 600;
  width: calc(100% - 8px);
  margin-left: 0;
  margin-right: 8px;
  border-radius: 0 8px 8px 0;
  padding-left: 18px;
  box-shadow: inset 3px 0 0 0 #44403c;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-item:hover:not(.active) .nav-icon {
  transform: scale(1.12);
}

.nav-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collapse-btn {
  margin-left: auto;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #a8a29e;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, color 0.18s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.collapse-btn:hover {
  background: rgba(68,64,60,0.08);
  color: #44403c;
}

.collapse-btn svg {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.collapse-btn svg.rotated {
  transform: rotate(180deg);
}

/* ── Content ── */
.app-content {
  flex: 1;
  overflow: hidden;
  background: #fff;
  display: flex;
  flex-direction: column;
}

/* ── Route transition ── */
.page-enter-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.page-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
