/* =========================================================
   승후 비서실 — app.js (Vanilla JS, no build step)
   데이터: data/state.json  ·  사용자 입력: localStorage
   ========================================================= */
'use strict';

const STATE_URL = 'data/state.json';

/* 회의실 서버 API가 생기면 이 주소만 채우면 됩니다.
   (ChatStore.append 안의 주석 지점에서 POST) */
const API_BASE = null;

const KEY = {
  chat: 'seunghuOffice.chat.v1',
  tasks: 'seunghuOffice.tasks.v1',
  memos: 'seunghuOffice.memos.v1',
  pins: 'seunghuOffice.pins.v1',
  memoDeleted: 'seunghuOffice.memoDeleted.v1',
  motion: 'seunghuOffice.motion.v1',
  tab: 'seunghuOffice.tab.v1',
  room: 'seunghuOffice.room.v1'
};

const OWNER_ID = 'seunghu';
const COMPOSER_IDS = ['seunghu', 'huhu', 'muse', 'gemini', 'cue', 'vooy'];
/* 카드 왼쪽 액센트 색 (앰버 · 에메랄드 · 시안 순환) */
const TINTS = ['#f59e0b', '#10b981', '#38bdf8'];

/* ---------------- tiny storage ---------------- */
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* 사파리 프라이빗 모드 등: 저장 실패는 조용히 넘어감 */
  }
}

/* ---------------- states ---------------- */
let state = null;
let activeTab = read(KEY.tab, null) || 'map';
let activeRoom = read(KEY.room, null) || 'all';
let motionOn = read(KEY.motion, true) !== false;
let selected = null; // {type:'char'|'room', id}
let refreshing = false;

const el = {};
['sync-btn', 'sync-time', 'load-error', 'tabbar', 'hq-summary', 'hq-stats',
  'room-chips', 'map-stage', 'map-img', 'room-labels', 'characters', 'map-detail',
  'chat-rooms', 'msg-list', 'chat-form', 'chat-sender', 'mention-chips', 'chat-input', 'chat-hint',
  'project-list', 'task-form', 'task-emoji', 'task-title', 'task-next', 'task-status', 'task-owner',
  'agent-cards', 'schedule-list', 'memo-form', 'memo-input', 'memo-list'
].forEach(id => {
  el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
});

/* ---------------- utils ---------------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const pad = (n) => String(n).padStart(2, '0');

function fmtStamp(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDay(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pillClass(stateName) {
  if (stateName === 'active' || stateName === 'on') return 'is-on';
  if (stateName === 'idle') return 'is-idle';
  if (stateName === 'done') return 'is-done';
  return 'is-wait';
}

function charById(id) {
  const list = (state && state.characters) || [];
  return list.find((c) => c.id === id) || { id, name: id, emoji: '👤', role: '', color: '#f59e0b' };
}

function roomById(id) {
  const list = (state && state.rooms) || [];
  return list.find((r) => r.id === id) || { id, name: id, emoji: '🚪', status: '', state: 'idle' };
}

function roomTag(roomId) {
  const r = roomById(roomId);
  return `<span class="msg-room">${esc(r.emoji)} ${esc(r.name)}</span>`;
}

function highlightMentions(text) {
  return esc(text).replace(/@(승후|후후|뮤즈|제미나이|Cue|Vooy)/g, '<span class="mention">@$1</span>');
}

/* ---------------- data load ---------------- */
async function loadState(opts) {
  const silent = !!(opts && opts.silent);
  if (refreshing) return;
  refreshing = true;
  el.syncBtn && el.syncBtn.classList.add('is-busy');
  try {
    const res = await fetch(`${STATE_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.characters)) throw new Error('state.json 형식이 올바르지 않습니다');
    state = data;
    if (el.loadError) el.loadError.hidden = true;
    if (el.syncBtn) el.syncBtn.classList.remove('is-error');
    renderAll();
  } catch (err) {
    if (el.syncBtn) el.syncBtn.classList.add('is-error');
    if (el.syncTime) el.syncTime.textContent = '연결 실패';
    if (!silent && el.loadError) el.loadError.hidden = false;
    if (!state) {
      el.hqSummary.textContent = '데이터를 불러오지 못했어요.';
      el.syncTime.textContent = '연결 실패';
    }
  } finally {
    refreshing = false;
    if (el.syncBtn) el.syncBtn.classList.remove('is-busy');
  }
}

/* ---------------- render: shared ---------------- */
function renderAll() {
  if (!state) return;
  renderMeta();
  renderRoomChips();
  renderMap();
  renderChatRooms();
  renderChat();
  renderProjects();
  renderAgents();
  renderMemos();
  renderDetail();
  renderComposer();
}

function renderMeta() {
  const meta = state.meta || {};
  el.hqSummary.textContent = meta.summary || '';
  el.hqStats.innerHTML = (meta.stats || []).map((s) => `
    <div class="hq-stat">
      <span class="hq-stat-v">${esc(s.value)}</span>
      <span class="hq-stat-l">${esc(s.label)}</span>
    </div>`).join('');
  if (el.syncTime) {
    el.syncTime.textContent = meta.updatedAt ? `${fmtStamp(meta.updatedAt)} 기준` : '동기화됨';
  }
}

/* ---------------- tab 1: office map ---------------- */
function renderRoomChips() {
  const rooms = state.rooms || [];
  const chips = [
    `<button class="chip toggle-chip ${motionOn ? '' : 'is-off'}" type="button" data-toggle-motion
       aria-pressed="${motionOn}">
       <span class="switch-track" aria-hidden="true"></span>움직임 ${motionOn ? 'ON' : 'OFF'}
     </button>`
  ].concat(rooms.map((r) => {
    const on = r.state === 'on';
    const sel = selected && selected.type === 'room' && selected.id === r.id;
    return `<button class="chip ${sel ? 'is-active' : ''}" type="button" data-room-jump="${esc(r.id)}">
      <span class="dot ${on ? '' : 'is-idle'}"></span>${esc(r.emoji)} ${esc(r.name)}
      <span class="chip-sub">${esc(r.status)}</span>
    </button>`;
  }));
  el.roomChips.innerHTML = chips.join('');
}

function renderMap() {
  el.mapStage.classList.toggle('motion-on', motionOn);

  el.roomLabels.innerHTML = (state.rooms || []).map((r) => {
    const sel = selected && selected.type === 'room' && selected.id === r.id;
    return `<button class="room-label ${sel ? 'is-selected' : ''}" type="button"
      data-room="${esc(r.id)}" style="left:${Number(r.x)}%;top:${Number(r.y)}%">
      <span class="room-emoji" aria-hidden="true">${esc(r.emoji)}</span><span class="room-name">${esc(r.name)}</span>
    </button>`;
  }).join('');

  el.characters.innerHTML = (state.characters || []).map((c, i) => {
    const sel = selected && selected.type === 'char' && selected.id === c.id;
    const dotState = c.state === 'active' ? '' : c.state === 'idle' ? 'is-idle' : 'is-busy';
    return `<button class="char ${sel ? 'is-selected' : ''}" type="button"
      data-char="${esc(c.id)}" style="left:${Number(c.x)}%;top:${Number(c.y)}%;--tint:${esc(c.color || '#f59e0b')};--delay:${(-i * 0.8).toFixed(2)}s"
      aria-label="${esc(c.name)} ${esc(c.role || '')}">
      <span class="char-avatar">${esc(c.emoji)}<span class="char-dot ${dotState}"></span></span>
      <span class="char-label"><b>${esc(c.name)}</b></span>
    </button>`;
  }).join('');
}

function renderDetail() {
  if (!selected || !state) {
    el.mapDetail.hidden = true;
    el.mapDetail.innerHTML = '';
    return;
  }
  if (selected.type === 'char') {
    const c = charById(selected.id);
    const r = roomById(c.room);
    el.mapDetail.innerHTML = `
      <div class="detail-top">
        <div class="detail-avatar" style="--tint:${esc(c.color || '#f59e0b')}" aria-hidden="true">${esc(c.emoji)}</div>
        <div class="detail-id">
          <h3>${esc(c.name)}</h3>
          <p>${esc(c.role || '')} · ${esc(r.emoji)} ${esc(r.name)}</p>
        </div>
        <span class="pill ${pillClass(c.state)}">${esc(c.status || '')}</span>
        <button class="detail-close" type="button" data-close-detail aria-label="닫기">✕</button>
      </div>
      <div class="detail-body">
        <div class="detail-row"><span class="k">지금 하는 일</span><span class="v is-strong">${esc(c.task || '—')}</span></div>
        <div class="detail-row"><span class="k">다음</span><span class="v">${esc(c.next || '—')}</span></div>
        <div class="detail-row"><span class="k">최근 활동</span><span class="v">${esc(c.lastActive || '—')}</span></div>
      </div>`;
  } else {
    const r = roomById(selected.id);
    const members = (state.characters || []).filter((c) => c.room === r.id);
    el.mapDetail.innerHTML = `
      <div class="detail-top">
        <div class="detail-avatar" aria-hidden="true">${esc(r.emoji)}</div>
        <div class="detail-id">
          <h3>${esc(r.emoji)} ${esc(r.name)}</h3>
          <p>${esc(r.summary || '')}</p>
        </div>
        <span class="pill ${pillClass(r.state)}">${esc(r.status || '')}</span>
        <button class="detail-close" type="button" data-close-detail aria-label="닫기">✕</button>
      </div>
      <div class="detail-body">
        <div class="detail-row"><span class="k">이 방에서</span><span class="v">${(r.work || []).map((w) => `· ${esc(w)}`).join('<br>') || '—'}</span></div>
        <div class="detail-row"><span class="k">자리</span><span class="v">${members.length ? members.map((m) => `${esc(m.emoji)} ${esc(m.name)}`).join(' · ') : '비어 있음'}</span></div>
      </div>`;
  }
  el.mapDetail.hidden = false;
}

function selectOnMap(type, id, scroll) {
  selected = { type, id };
  renderMap();
  renderRoomChips();
  renderDetail();
  if (scroll) {
    requestAnimationFrame(() => el.mapDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }
}

/* ---------------- tab 2: meeting room ---------------- */
const ChatStore = {
  all() {
    const list = read(KEY.chat, []);
    return Array.isArray(list) ? list : [];
  },
  append(msg) {
    const list = this.all();
    list.push(msg);
    write(KEY.chat, list);
    /* 서버 연동 지점:
       if (API_BASE) fetch(`${API_BASE}/messages`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(msg)}); */
  },
  remove(id) {
    write(KEY.chat, this.all().filter((m) => m.id !== id));
  }
};

function allMessages() {
  const seed = (state.meetings || []).map((m) => ({ ...m, source: 'state' }));
  const local = ChatStore.all().map((m) => ({ ...m, source: 'local' }));
  return seed.concat(local).sort((a, b) => new Date(a.at) - new Date(b.at));
}

function renderComposer() {
  if (!state) return;
  const options = COMPOSER_IDS.map((id) => {
    const c = charById(id);
    return `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.name)}</option>`;
  });
  const keep = el.chatSender.value;
  el.chatSender.innerHTML = options.join('');
  el.chatSender.value = COMPOSER_IDS.includes(keep) ? keep : OWNER_ID;

  el.mentionChips.innerHTML = COMPOSER_IDS.map((id) => {
    const c = charById(id);
    return `<button class="mention-chip" type="button" data-mention="${esc(c.name)}">@${esc(c.name)}</button>`;
  }).join('');
}

function renderChatRooms() {
  const rooms = state.rooms || [];
  const items = [{ id: 'all', name: '전체', emoji: '🗂️' }].concat(rooms);
  el.chatRooms.innerHTML = items.map((r) => `
    <button class="chip ${activeRoom === r.id ? 'is-active' : ''}" type="button" data-chat-room="${esc(r.id)}">
      ${esc(r.emoji)} ${esc(r.name)}
    </button>`).join('');
}

function renderChat() {
  const msgs = allMessages().filter((m) => activeRoom === 'all' || m.room === activeRoom);
  if (!msgs.length) {
    el.msgList.innerHTML = '<li class="msg-empty">아직 이 방에 남긴 말이 없어요.</li>';
  } else {
    el.msgList.innerHTML = msgs.map((m) => {
      const c = charById(m.authorId);
      const own = m.authorId === OWNER_ID;
      const room = roomById(m.room);
      return `<li class="msg ${own ? 'is-own' : ''}">
        <span class="msg-avatar" style="--tint:${esc(c.color || '#f59e0b')}" aria-hidden="true">${esc(c.emoji)}</span>
        <div class="msg-body">
          <div class="msg-head">
            <span class="msg-author">${esc(c.name)}</span>
            <span class="msg-room">${esc(room.emoji)} ${esc(room.name)}</span>
            <span class="msg-time">${esc(fmtStamp(m.at))}</span>
          </div>
          <p class="msg-text">${highlightMentions(m.text)}</p>
        </div>
      </li>`;
    }).join('');
  }
  updateChatHint();
}

function updateChatHint() {
  const target = roomById(activeRoom === 'all' ? 'boardroom' : activeRoom);
  el.chatHint.textContent = `→ ${target.emoji} ${target.name}에 남깁니다 · 이 브라우저에 저장`;
}

/* ---------------- tab 3: work room ---------------- */
function customTasks() {
  const list = read(KEY.tasks, []);
  return Array.isArray(list) ? list : [];
}

function renderProjects() {
  const base = (state.projects || []).map((p, i) => {
    const badgeState = p.status.indexOf('완료') >= 0 ? 'done' : 'wait';
    return `<article class="project-card" style="--tint:${TINTS[i % TINTS.length]}">
      <div class="project-head">
        <span class="project-emoji" aria-hidden="true">${esc(p.emoji)}</span>
        <div class="project-title-wrap">
          <h3 class="project-title">${esc(p.title)}</h3>
          <p class="project-owner">${esc(p.owner || '')} 담당 · 업데이트 ${esc(p.updated || '')}</p>
        </div>
        <span class="pill ${badgeState}">${esc(p.status)}</span>
      </div>
      ${p.next ? `<p class="project-next"><b>다음</b> ${esc(p.next)}</p>` : ''}
      ${p.detail ? `<p class="project-detail">${esc(p.detail)}</p>` : ''}
      <div class="project-bar"><span style="width:${Math.max(0, Math.min(100, Number(p.progress) || 0))}%"></span></div>
      <div class="project-foot">
        <div class="project-tags">${(p.tags || []).map((t) => `<span class="project-tag">${esc(t)}</span>`).join('')}</div>
        <div>
          ${p.badge ? `<span class="project-tag">${esc(p.badge)}</span>` : ''}
          ${p.link ? ` <a class="project-link" href="${esc(p.link)}" target="_blank" rel="noopener">글 보기</a>` : ''}
        </div>
      </div>
    </article>`;
  });

  const mine = customTasks().map((t) => `
    <article class="project-card" style="--tint:#f59e0b">
      <div class="project-head">
        <span class="project-emoji" aria-hidden="true">${esc(t.emoji || '📌')}</span>
        <div class="project-title-wrap">
          <h3 class="project-title">${esc(t.title)}</h3>
          <p class="project-owner">내가 추가 · ${esc(t.owner || '')} · ${esc(fmtStamp(t.created))}</p>
        </div>
        <span class="pill ${t.status === '완료' ? 'is-done' : t.status === '대기' ? 'is-idle' : 'is-on'}">${esc(t.status)}</span>
        <button class="card-del" type="button" data-del-task="${esc(t.id)}" aria-label="이 작업 삭제">✕</button>
      </div>
      ${t.next ? `<p class="project-next"><b>다음</b> ${esc(t.next)}</p>` : ''}
    </article>`);

  el.projectList.innerHTML = base.concat(mine).join('');
}

/* ---------------- tab 4: status ---------------- */
function renderAgents() {
  el.agentCards.innerHTML = (state.agents || []).map((a) => `
    <article class="agent-card">
      <div class="agent-head">
        <span class="agent-avatar" style="--tint:${esc((charById(a.id).color) || '#f59e0b')}" aria-hidden="true">${esc(a.emoji)}</span>
        <div class="agent-id">
          <h3>${esc(a.name)}</h3>
          <p>${esc(a.role)}</p>
        </div>
        <span class="pill ${/가동|협업|자문/.test(a.state) ? 'is-on' : 'is-idle'}">${esc(a.state)}</span>
      </div>
      <p class="agent-task">${esc(a.task)}</p>
      <div class="agent-meta">
        <span>부하 <b>${esc(a.load || '—')}</b></span>
        <span>최근 <b>${esc(a.lastActive || '—')}</b></span>
      </div>
      <div class="agent-skills">${(a.skills || []).map((s) => `<span class="agent-skill">${esc(s)}</span>`).join('')}</div>
    </article>`).join('');

  el.scheduleList.innerHTML = (state.schedules || []).map((s) => {
    const pillCls = s.status === '다음 실행' ? 'is-on' : s.status === '자동' ? 'is-done' : 'is-idle';
    return `<li class="tl-item" data-status="${esc(s.status)}">
      <div class="tl-time">${esc(s.time)}</div>
      <div class="tl-body">
        <div class="tl-title">${esc(s.title)} </div>
        <div class="tl-desc">${esc(s.desc)}</div>
        <div class="tl-foot">
          <span class="tl-agent">${esc(s.agent)}</span>
          <span class="pill ${pillCls}">${esc(s.status)}</span>
          <span>${esc(s.when)}</span>
        </div>
      </div>
    </li>`;
  }).join('');
}

/* ---------------- tab 5: memos ---------------- */
function memoList() {
  const deleted = new Set(read(KEY.memoDeleted, []));
  const pins = read(KEY.pins, {}) || {};
  const seed = (state.memos || []).map((m) => ({
    ...m,
    pinned: Object.prototype.hasOwnProperty.call(pins, m.id) ? !!pins[m.id] : !!m.pinned,
    source: 'state'
  }));
  const local = read(KEY.memos, []);
  const mine = (Array.isArray(local) ? local : []).map((m) => ({
    ...m,
    pinned: Object.prototype.hasOwnProperty.call(pins, m.id) ? !!pins[m.id] : !!m.pinned,
    source: 'local'
  }));
  return seed.concat(mine)
    .filter((m) => !deleted.has(m.id))
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (new Date(b.created) - new Date(a.created)));
}

function renderMemos() {
  const list = memoList();
  if (!list.length) {
    el.memoList.innerHTML = '<li class="memo-empty">메모가 없어요. 위에서 바로 추가해 보세요.</li>';
    return;
  }
  el.memoList.innerHTML = list.map((m) => `
    <li class="memo-card ${m.pinned ? 'is-pinned' : ''}">
      <div class="memo-text">${esc(m.text)}
        <div class="memo-date">${esc(fmtStamp(m.created))}${m.pinned ? ' · 고정됨' : ''}</div>
      </div>
      <div class="memo-actions">
        <button class="icon-btn ${m.pinned ? 'is-on' : ''}" type="button" data-pin="${esc(m.id)}"
          aria-pressed="${m.pinned}" aria-label="${m.pinned ? '고정 해제' : '핀 고정'}">${m.pinned ? '📌' : '📍'}</button>
        <button class="icon-btn" type="button" data-del-memo="${esc(m.id)}" data-source="${m.source}" aria-label="메모 삭제">🗑</button>
      </div>
    </li>`).join('');
}

/* ---------------- tabs ---------------- */
function setTab(tab, opts) {
  const target = document.getElementById(`view-${tab}`);
  if (!target) return;
  activeTab = tab;
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.view').forEach((v) => {
    const on = v.dataset.view === tab;
    v.classList.toggle('is-active', on);
    v.hidden = !on;
  });
  write(KEY.tab, tab);
  try { history.replaceState(null, '', `#${tab}`); } catch (e) { /* ignore */ }
  if (!opts || opts.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (tab === 'chat') updateChatHint();
}

/* ---------------- events ---------------- */
el.tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) setTab(btn.dataset.tab);
});

el.syncBtn.addEventListener('click', () => loadState());

/* map */
el.roomChips.addEventListener('click', (e) => {
  const toggle = e.target.closest('[data-toggle-motion]');
  if (toggle) {
    motionOn = !motionOn;
    write(KEY.motion, motionOn);
    renderRoomChips();
    renderMap();
    return;
  }
  const jump = e.target.closest('[data-room-jump]');
  if (jump) selectOnMap('room', jump.dataset.roomJump, true);
});

el.mapStage.addEventListener('click', (e) => {
  const char = e.target.closest('[data-char]');
  if (char) { selectOnMap('char', char.dataset.char, true); return; }
  const room = e.target.closest('[data-room]');
  if (room) selectOnMap('room', room.dataset.room, true);
});

el.mapDetail.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-detail]')) {
    selected = null;
    renderMap();
    renderRoomChips();
    renderDetail();
  }
});

/* chat */
el.chatRooms.addEventListener('click', (e) => {
  const b = e.target.closest('[data-chat-room]');
  if (!b) return;
  activeRoom = b.dataset.chatRoom;
  write(KEY.room, activeRoom);
  renderChatRooms();
  renderChat();
});

el.mentionChips.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mention]');
  if (!b) return;
  const name = b.dataset.mention;
  const t = el.chatInput;
  const start = t.selectionStart == null ? t.value.length : t.selectionStart;
  const end = t.selectionEnd == null ? start : t.selectionEnd;
  const before = t.value.slice(0, start);
  const after = t.value.slice(end);
  const gap = before && !/\s$/.test(before) ? ' ' : '';
  const insert = `${gap}@${name} `;
  t.value = before + insert + after;
  t.focus();
  const pos = (before + insert).length;
  try { t.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
});

el.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = el.chatInput.value.trim();
  if (!text) { el.chatInput.focus(); return; }
  const msg = {
    id: `local-${Date.now()}`,
    room: activeRoom === 'all' ? 'boardroom' : activeRoom,
    authorId: el.chatSender.value || OWNER_ID,
    text,
    at: new Date().toISOString(),
    mentions: []
  };
  ChatStore.append(msg);
  el.chatInput.value = '';
  renderChat();
  const last = el.msgList.lastElementChild;
  if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.chatInput.focus();
});

/* work */
el.taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = el.taskTitle.value.trim();
  if (!title) { el.taskTitle.focus(); return; }
  const list = customTasks();
  list.unshift({
    id: `task-${Date.now()}`,
    emoji: el.taskEmoji.value,
    title,
    next: el.taskNext.value.trim(),
    status: el.taskStatus.value,
    owner: el.taskOwner.value,
    created: new Date().toISOString()
  });
  write(KEY.tasks, list);
  el.taskForm.reset();
  el.taskEmoji.value = '📌';
  renderProjects();
});

el.projectList.addEventListener('click', (e) => {
  const del = e.target.closest('[data-del-task]');
  if (!del) return;
  write(KEY.tasks, customTasks().filter((t) => t.id !== del.dataset.delTask));
  renderProjects();
});

/* memos */
el.memoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = el.memoInput.value.trim();
  if (!text) { el.memoInput.focus(); return; }
  const list = read(KEY.memos, []);
  const arr = Array.isArray(list) ? list : [];
  arr.unshift({ id: `memo-${Date.now()}`, text, pinned: false, created: new Date().toISOString() });
  write(KEY.memos, arr);
  el.memoInput.value = '';
  renderMemos();
});

el.memoList.addEventListener('click', (e) => {
  const pin = e.target.closest('[data-pin]');
  if (pin) {
    const id = pin.dataset.pin;
    const current = memoList().find((m) => m.id === id);
    const pins = read(KEY.pins, {}) || {};
    pins[id] = !(current && current.pinned);
    write(KEY.pins, pins);
    renderMemos();
    return;
  }
  const del = e.target.closest('[data-del-memo]');
  if (del) {
    const id = del.dataset.delMemo;
    if (del.dataset.source === 'state') {
      const tombstones = read(KEY.memoDeleted, []);
      const arr = Array.isArray(tombstones) ? tombstones : [];
      if (!arr.includes(id)) arr.push(id);
      write(KEY.memoDeleted, arr);
    } else {
      const list = read(KEY.memos, []);
      write(KEY.memos, (Array.isArray(list) ? list : []).filter((m) => m.id !== id));
    }
    renderMemos();
  }
});

/* ---------------- boot ---------------- */
function boot() {
  const hash = (location.hash || '').replace('#', '');
  const valid = ['map', 'chat', 'work', 'status', 'memo'];
  setTab(valid.includes(hash) ? hash : activeTab, { scroll: false });
  loadState();

  /* 후후가 state.json만 커밋해도 화면이 따라오도록 주기적으로 다시 읽음 */
  setInterval(() => {
    if (document.visibilityState === 'visible') loadState({ silent: true });
  }, 5 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state) loadState({ silent: true });
  });
}

document.addEventListener('DOMContentLoaded', boot);
