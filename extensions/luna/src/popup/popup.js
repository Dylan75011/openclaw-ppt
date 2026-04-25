const dot = document.getElementById('dot');
const state = document.getElementById('state');
const errMsg = document.getElementById('errMsg');
const urlInput = document.getElementById('url');
const reconnectBtn = document.getElementById('reconnect');
const saveBtn = document.getElementById('save');
const saved = document.getElementById('saved');
const grantsEl = document.getElementById('grants');
const clearGrantsBtn = document.getElementById('clearGrants');
const autoReadChk = document.getElementById('autoRead');

function renderState(authState, connected) {
  dot.classList.remove('on', 'off', 'warn');
  errMsg.style.display = 'none';
  if (authState === 'authed' || connected) {
    dot.classList.add('on');
    state.textContent = '已连接 Luna 后端';
  } else if (authState === 'token_missing') {
    dot.classList.add('warn');
    state.textContent = '无法获取 Token';
    errMsg.textContent = '检查 Node 后端是否已启动（默认 ws://127.0.0.1:3399）';
    errMsg.style.display = 'block';
  } else if (authState === 'token_bad') {
    dot.classList.add('warn');
    state.textContent = 'Token 已过期';
    errMsg.textContent = '扩展将自动重试拉取新 token…';
    errMsg.style.display = 'block';
  } else if (authState === 'pending') {
    dot.classList.add('off');
    state.textContent = '认证中…';
  } else {
    dot.classList.add('off');
    state.textContent = '未连接';
  }
}

async function refresh() {
  const resp = await chrome.runtime.sendMessage({ type: 'get_status' });
  renderState(resp?.authState, !!resp?.connected);
}

async function renderGrants() {
  const { sessionGrants = {}, autoAllowReadOnAllowlist = false } = await chrome.storage.session.get([
    'sessionGrants', 'autoAllowReadOnAllowlist'
  ]);
  autoReadChk.checked = !!autoAllowReadOnAllowlist;
  const entries = Object.entries(sessionGrants);
  if (entries.length === 0) {
    grantsEl.innerHTML = '<div class="empty">暂无授权。Agent 首次访问时会弹出审批。</div>';
    return;
  }
  grantsEl.innerHTML = entries.map(([host, g]) => `
    <div class="grant-row">
      <span><span class="host">${host}</span> <span class="pill">${g.mode || 'read'}</span></span>
      <button data-host="${host}" class="revoke">撤销</button>
    </div>
  `).join('');
  grantsEl.querySelectorAll('.revoke').forEach((b) => {
    b.addEventListener('click', async () => {
      const host = b.getAttribute('data-host');
      const cur = (await chrome.storage.session.get('sessionGrants')).sessionGrants || {};
      delete cur[host];
      await chrome.storage.session.set({ sessionGrants: cur });
      renderGrants();
    });
  });
}

chrome.storage.local.get(['bridgeUrl'], ({ bridgeUrl }) => {
  if (bridgeUrl) urlInput.value = bridgeUrl;
});

reconnectBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'reconnect' });
  setTimeout(refresh, 400);
});

saveBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!/^wss?:\/\//.test(url)) { alert('URL 需以 ws:// 或 wss:// 开头'); return; }
  // URL 变了，旧 token 肯定对不上新 backend，一起清掉让扩展重新拉
  await chrome.storage.local.set({ bridgeUrl: url });
  await chrome.storage.local.remove('bridgeToken');
  saved.style.visibility = 'visible';
  setTimeout(() => saved.style.visibility = 'hidden', 1500);
  await chrome.runtime.sendMessage({ type: 'reconnect' });
  setTimeout(refresh, 500);
});

clearGrantsBtn.addEventListener('click', async () => {
  await chrome.storage.session.set({ sessionGrants: {} });
  renderGrants();
});

autoReadChk.addEventListener('change', async () => {
  await chrome.storage.session.set({ autoAllowReadOnAllowlist: autoReadChk.checked });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'bridge_status') renderState(msg.state, msg.state === 'connected');
  if (msg.type === 'grants_changed') renderGrants();
});

refresh();
renderGrants();
