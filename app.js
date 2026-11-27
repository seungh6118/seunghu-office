/* =========================================================
   승후 비서실 — app.js (Vanilla JS, no build step)
   데이터: data/state.json(기본 시드) + Supabase 실시간 DB
   로컬 캐시: localStorage (DB가 막힐 때 자동 폴백)
   ========================================================= */
'use strict';

const STATE_URL = 'data/state.json';

/* ---------------- Supabase 실시간 DB --------------
   publishable 키는 공개용입니다(읽기/쓰기 허용 정책).
   상세 규칙은 AGENT_SYNC.md 참고. */
const SUPABASE = {
  url: 'https://qebbpadabmkeeecnzfrm.supabase.co',
  key: 'sb_publishable_dgSAZviMpxNeJ0YYik4FZw_HIPQeRdg',
  pollMs: 45000,
  tables: {
    messages: 'office_messages',
    tasks: 'office_tasks',
    memos: 'office_memos',
    agents: 'office_agents'
  }
};

/* 실시간 DB 상태 */
const sb = {
  ok: false,
  at: null,
  error: null,
  messages: null,
  tasks: null,
  memos: null,
  agents: null
};

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
/* 카드 왼쪽 액센트 색 (스타크 블루 · 시안 · 히어로 골드 순환) */
const TINTS = ['#0284c7', '#06b6d4', '#d97706'];

/* =========================================================
   캐릭터 아트 — 이모지 대신 쓰는 커스텀 히어로·피클 SVG
   좌표계 0 0 96 120 · 발(밑동)은 y=112, 바닥 그림자 y=116
   ========================================================= */
const CHAR_ART = {
  huhu: `
  <defs>
    <radialGradient id="hhBody" cx="36%" cy="24%" r="82%">
      <stop offset="0" stop-color="#ffb877"/><stop offset=".48" stop-color="#fb8b33"/><stop offset="1" stop-color="#c2470f"/>
    </radialGradient>
    <linearGradient id="hhTeal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7ff3e2"/><stop offset="1" stop-color="#0f9e91"/>
    </linearGradient>
    <linearGradient id="hhCape" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#0e7490"/>
    </linearGradient>
    <radialGradient id="hhSeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".42"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".18"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="110" rx="32" ry="8.5" fill="url(#hhSeat)"/>
  <ellipse cx="48" cy="108" rx="27" ry="8" fill="#1b2732"/>
  <path d="M13 80c0-9 7-16 16-16h38c9 0 16 7 16 16v32H13z" fill="#16202b" stroke="#4e6274" stroke-width="1.1"/>
  <path d="M18 80c0-5 4-9 9-9h42c5 0 9 4 9 9" fill="none" stroke="#5b7185" stroke-width="1.1" opacity=".85"/>
  <path d="M31 74c-9 8-13 22-13 38h13z" fill="url(#hhCape)" opacity=".92"/>
  <path d="M65 74c9 8 13 22 13 38H65z" fill="url(#hhCape)" opacity=".92"/>
  <path d="M28 46C16 34 14 18 22 13c10 0 14 15 16 29Z" fill="#fdba74" stroke="#b45309" stroke-width="1.1"/>
  <path d="M68 46C80 34 82 18 74 13c-10 0-14 15-16 29Z" fill="#fdba74" stroke="#b45309" stroke-width="1.1"/>
  <path d="M48 18c19 0 30 15 30 38 0 32-12 56-30 56S18 88 18 56c0-23 11-38 30-38Z" fill="url(#hhBody)" stroke="url(#hhTeal)" stroke-width="2.4"/>
  <path d="M34 34c-6 8-9 20-9 30 0 14 3 26 8 34" stroke="#ffffff" stroke-width="3" opacity=".25" fill="none" stroke-linecap="round"/>
  <ellipse cx="38" cy="60" rx="10" ry="11" fill="#fff"/>
  <ellipse cx="58" cy="60" rx="10" ry="11" fill="#fff"/>
  <circle cx="39.5" cy="62" r="5.2" fill="#241207"/>
  <circle cx="58.5" cy="62" r="5.2" fill="#241207"/>
  <circle cx="41.5" cy="59.5" r="1.7" fill="#fff"/>
  <circle cx="60.5" cy="59.5" r="1.7" fill="#fff"/>
  <ellipse cx="31" cy="72" rx="4.6" ry="3" fill="#ff7a45" opacity=".5"/>
  <ellipse cx="65" cy="72" rx="4.6" ry="3" fill="#ff7a45" opacity=".5"/>
  <path d="M44 76c2.4 3.2 5.6 3.2 8 0" fill="none" stroke="#7c2d12" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M48 88l2.6 6.4 6.4 2.6-6.4 2.6L48 106l-2.6-6.4L39 97l6.4-2.6z" fill="#2dd4bf" stroke="#0f766e" stroke-width="1"/>
  <ellipse cx="22" cy="96" rx="6" ry="5" fill="#f97316" stroke="#b45309" stroke-width="1"/>
  <ellipse cx="74" cy="96" rx="6" ry="5" fill="#f97316" stroke="#b45309" stroke-width="1"/>`,

  seunghu: `
  <defs>
    <linearGradient id="sgSuit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#31425c"/><stop offset="1" stop-color="#0d1725"/>
    </linearGradient>
    <linearGradient id="sgGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fef3c7"/><stop offset=".5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="sgCape" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dc2626"/><stop offset="1" stop-color="#991b1b"/>
    </linearGradient>
    <radialGradient id="sgSeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".45"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".2"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="109" rx="33" ry="9" fill="url(#sgSeat)"/>
  <ellipse cx="48" cy="108" rx="28" ry="8" fill="#1b2732"/>
  <path d="M12 80c0-9 7-16 16-16h40c9 0 16 7 16 16v32H12z" fill="#16202b" stroke="#4e6274" stroke-width="1.1"/>
  <path d="M17 80c0-5 4-9 9-9h44c5 0 9 4 9 9" fill="none" stroke="#5b7185" stroke-width="1.1" opacity=".85"/>
  <path d="M30 80c-8 8-12 20-13 32h14z" fill="url(#sgCape)"/>
  <path d="M66 80c8 8 12 20 13 32H65z" fill="url(#sgCape)"/>
  <path d="M48 78c14 0 24 8 26 20 1 5 1 10 1 14H21c0-4 0-9 1-14 2-12 12-20 26-20z" fill="url(#sgSuit)" stroke="#f59e0b" stroke-width="1.3" stroke-opacity=".9"/>
  <path d="M39 79l9 13 9-13-4-2H43z" fill="#eef4fb"/>
  <path d="M48 92l-3.4 11 3.4 9 3.4-9z" fill="url(#sgGold)"/>
  <path d="M39 79 32 99l10-6z" fill="#16233a"/>
  <path d="M57 79l7 20-10-6z" fill="#16233a"/>
  <circle cx="48" cy="105" r="4.6" fill="#dc2626" stroke="#fbbf24" stroke-width="1.2"/>
  <path d="M48 102.6l1 2.2 2.4.3-1.8 1.7.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="#fde68a"/>
  <circle cx="48" cy="52" r="23" fill="#f6c9a0" stroke="#c2834a" stroke-width="1"/>
  <circle cx="25" cy="53" r="4" fill="#f0b98d"/><circle cx="71" cy="53" r="4" fill="#f0b98d"/>
  <path d="M25 50c0-16 10-26 23-26s23 10 23 26c-3-9-11-14-23-14s-20 5-23 14z" fill="#1b2431"/>
  <circle cx="40" cy="55" r="2.8" fill="#141a24"/><circle cx="56" cy="55" r="2.8" fill="#141a24"/>
  <path d="M35 47.5l7-2.5" stroke="#1b2431" stroke-width="2" stroke-linecap="round"/>
  <path d="M61 47.5l-7-2.5" stroke="#1b2431" stroke-width="2" stroke-linecap="round"/>
  <path d="M44 64c2.6 2.6 5.4 2.6 8 0" fill="none" stroke="#9a5a35" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="18" y="46" width="8" height="15" rx="4" fill="#7d8fa6"/>
  <rect x="70" y="46" width="8" height="15" rx="4" fill="#7d8fa6"/>
  <path d="M73 59c4 6 1 11-5 12" fill="none" stroke="#9fb0c6" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="67" cy="71" r="2.6" fill="#f59e0b"/>
  <path d="M30 25l2.5-13 7 6.5L48 9l8.5 9.5 7-6.5L66 25z" fill="url(#sgGold)" stroke="#8a4b06" stroke-width="1.1" stroke-linejoin="round"/>`,

  muse: `
  <defs>
    <linearGradient id="msMetal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#b7c6d8"/><stop offset="1" stop-color="#54657c"/>
    </linearGradient>
    <linearGradient id="msCape" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#0369a1"/>
    </linearGradient>
    <radialGradient id="msSeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".42"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".18"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="110" rx="31" ry="8.5" fill="url(#msSeat)"/>
  <ellipse cx="48" cy="108" rx="27" ry="8" fill="#e8eff7" stroke="#c2d0df" stroke-width="1"/>
  <path d="M14 80c0-9 7-16 16-16h36c9 0 16 7 16 16v32H14z" fill="#f2f7fc" stroke="#b9c8d8" stroke-width="1.1"/>
  <path d="M19 80c0-5 4-9 9-9h40c5 0 9 4 9 9" fill="none" stroke="#ccd9e6" stroke-width="1.1"/>
  <path d="M32 74c-9 9-12 22-12 38h13z" fill="url(#msCape)" opacity=".95"/>
  <path d="M64 74c9 9 12 22 12 38H64z" fill="url(#msCape)" opacity=".95"/>
  <path d="M48 24V12" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="48" cy="9" r="7" fill="#22d3ee" opacity=".25"/>
  <circle cx="48" cy="9" r="4.2" fill="#22d3ee"/>
  <rect x="23" y="24" width="50" height="40" rx="15" fill="url(#msMetal)" stroke="#0284c7" stroke-width="1.3"/>
  <rect x="29" y="35" width="38" height="17" rx="8.5" fill="#071624"/>
  <rect x="31.5" y="37.5" width="33" height="12" rx="6" fill="#0c3550"/>
  <circle cx="39.5" cy="43.5" r="3.6" fill="#67e8f9"/><circle cx="56.5" cy="43.5" r="3.6" fill="#67e8f9"/>
  <path d="M45 56h6" stroke="#06b6d4" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="17" y="34" width="7" height="17" rx="3.5" fill="#8593a8"/>
  <rect x="72" y="34" width="7" height="17" rx="3.5" fill="#8593a8"/>
  <rect x="30" y="66" width="36" height="46" rx="10" fill="url(#msMetal)" stroke="#0284c7" stroke-width="1.2"/>
  <rect x="36" y="72" width="24" height="15" rx="5" fill="#0a2233"/>
  <circle cx="48" cy="79.5" r="5" fill="#22d3ee"/>
  <circle cx="48" cy="79.5" r="8" fill="none" stroke="#67e8f9" stroke-width="1" opacity=".7"/>
  <rect x="22" y="70" width="9" height="27" rx="4.5" fill="#93a4b8"/>
  <rect x="65" y="70" width="9" height="27" rx="4.5" fill="#93a4b8"/>`,

  gemini: `
  <defs>
    <radialGradient id="gmCore" cx="38%" cy="26%" r="78%">
      <stop offset="0" stop-color="#d1fae5"/><stop offset=".42" stop-color="#34d399"/><stop offset="1" stop-color="#0f766e"/>
    </radialGradient>
    <linearGradient id="gmStar" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e0f2fe"/><stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
    <radialGradient id="gmSeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".42"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".18"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="110" rx="32" ry="8.5" fill="url(#gmSeat)"/>
  <ellipse cx="48" cy="108" rx="27" ry="8" fill="#e8eff7" stroke="#c2d0df" stroke-width="1"/>
  <path d="M14 80c0-9 7-16 16-16h36c9 0 16 7 16 16v32H14z" fill="#f2f7fc" stroke="#b9c8d8" stroke-width="1.1"/>
  <path d="M19 80c0-5 4-9 9-9h40c5 0 9 4 9 9" fill="none" stroke="#ccd9e6" stroke-width="1.1"/>
  <circle cx="48" cy="62" r="42" fill="#10b981" opacity=".14"/>
  <circle cx="48" cy="62" r="34" fill="none" stroke="#5eead4" stroke-width="1" opacity=".45"/>
  <path d="M48 20c17 0 27 15 27 38 0 30-11 52-27 52S21 88 21 58c0-23 10-38 27-38Z" fill="url(#gmCore)" stroke="#a7f3d0" stroke-width="1.6"/>
  <ellipse cx="39" cy="58" rx="8.4" ry="9.4" fill="#fff"/>
  <ellipse cx="57" cy="58" rx="8.4" ry="9.4" fill="#fff"/>
  <circle cx="40" cy="60" r="4.4" fill="#083b34"/>
  <circle cx="58" cy="60" r="4.4" fill="#083b34"/>
  <circle cx="41.6" cy="57.6" r="1.5" fill="#fff"/>
  <circle cx="59.6" cy="57.6" r="1.5" fill="#fff"/>
  <path d="M44 72c2.6 3 5.4 3 8 0" fill="none" stroke="#064e3b" stroke-width="2.1" stroke-linecap="round"/>
  <path d="M48 84l2.6 6.4 6.4 2.6-6.4 2.6L48 102l-2.6-6.4L39 93l6.4-2.6z" fill="#ecfeff" stroke="#0f766e" stroke-width=".9"/>
  <path d="M48 2l3.6 9.2 9.2 3.6-9.2 3.6L48 27.6l-3.6-9.2L35.2 14.8l9.2-3.6z" fill="url(#gmStar)"/>
  <path d="M16 34l1.6 4.2 4.2 1.6-4.2 1.6L16 45.6l-1.6-4.2-4.2-1.6 4.2-1.6z" fill="#a5f3fc" opacity=".95"/>
  <path d="M79 74l1.3 3.4 3.4 1.3-3.4 1.3L79 83.4l-1.3-3.4-3.4-1.3 3.4-1.3z" fill="#a5f3fc" opacity=".9"/>`,

  cue: `
  <defs>
    <linearGradient id="cqBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3e8ff"/><stop offset=".45" stop-color="#c084fc"/><stop offset="1" stop-color="#6d28d9"/>
    </linearGradient>
    <linearGradient id="cqBrain" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbcfe8"/><stop offset="1" stop-color="#db2777"/>
    </linearGradient>
    <linearGradient id="cqCape" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#4c1d95"/>
    </linearGradient>
    <radialGradient id="cqSeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".42"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".18"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="110" rx="32" ry="8.5" fill="url(#cqSeat)"/>
  <ellipse cx="48" cy="108" rx="29" ry="8" fill="#eef3f9" stroke="#cbd7e4" stroke-width="1"/>
  <path d="M12 84c0-9 6-16 15-16h42c9 0 15 7 15 16v28H12z" fill="#f5f8fc" stroke="#c3d0dd" stroke-width="1.1"/>
  <path d="M17 84c0-5 4-9 9-9h44c5 0 9 4 9 9" fill="none" stroke="#dde6f0" stroke-width="1.1"/>
  <path d="M31 72c-9 9-12 24-12 40h13z" fill="url(#cqCape)"/>
  <path d="M65 72c9 9 12 24 12 40H65z" fill="url(#cqCape)"/>
  <path d="M48 34c17 0 28 14 28 36 0 26-12 42-28 42S20 96 20 70c0-22 11-36 28-36Z" fill="url(#cqBody)" stroke="#7e22ce" stroke-width="1.4"/>
  <path d="M27 36c0-12 9-20 21-20s21 8 21 20c0 3-1 6-2 8H29c-1-2-2-5-2-8Z" fill="url(#cqBrain)" stroke="#9d174d" stroke-width="1.1"/>
  <path d="M32 31c2-3 6-4 9-2M38 26c1-3 5-4 8-2M52 24c3-1 7 0 8 3M58 30c3-2 7-1 8 2" fill="none" stroke="#9d174d" stroke-width="1.1" opacity=".75" stroke-linecap="round"/>
  <path d="M48 16v18" stroke="#9d174d" stroke-width="1.1" opacity=".5"/>
  <ellipse cx="39" cy="62" rx="7.6" ry="8.6" fill="#fff"/>
  <ellipse cx="57" cy="62" rx="7.6" ry="8.6" fill="#fff"/>
  <circle cx="40" cy="64" r="4" fill="#2b0b3a"/>
  <circle cx="56" cy="64" r="4" fill="#2b0b3a"/>
  <circle cx="41.4" cy="61.6" r="1.4" fill="#fff"/>
  <circle cx="57.4" cy="61.6" r="1.4" fill="#fff"/>
  <path d="M44 76c2.6 2.8 5.4 2.8 8 0" fill="none" stroke="#4c1d95" stroke-width="2.1" stroke-linecap="round"/>
  <rect x="58" y="86" width="17" height="21" rx="3" fill="#fdf2f8" stroke="#7c3aed" stroke-width="1"/>
  <path d="M62 92h9M62 97h6" stroke="#a855f7" stroke-width="1.4" stroke-linecap="round"/>
  <ellipse cx="24" cy="94" rx="6" ry="5" fill="#c084fc" stroke="#7c3aed" stroke-width="1"/>`,

  vooy: `
  <defs>
    <linearGradient id="vySlate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a3b3c6"/><stop offset="1" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="vyGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fef3c7"/><stop offset=".5" stop-color="#f59e0b"/><stop offset="1" stop-color="#a16207"/>
    </linearGradient>
    <radialGradient id="vySeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".45"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".2"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="109" rx="33" ry="9" fill="url(#vySeat)"/>
  <ellipse cx="48" cy="108" rx="29" ry="8" fill="#eef3f9" stroke="#cbd7e4" stroke-width="1"/>
  <path d="M12 84c0-9 6-16 15-16h42c9 0 15 7 15 16v28H12z" fill="#f5f8fc" stroke="#c3d0dd" stroke-width="1.1"/>
  <path d="M17 84c0-5 4-9 9-9h44c5 0 9 4 9 9" fill="none" stroke="#dde6f0" stroke-width="1.1"/>
  <path d="M48 76c15 0 26 9 28 22 1 5 1 9 1 14H19c0-5 0-9 1-14 2-13 13-22 28-22z" fill="url(#vySlate)" stroke="#d97706" stroke-width="1.2"/>
  <path d="M41 78l7 11 7-11" fill="none" stroke="#eef4fb" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="48" cy="96" r="2" fill="#fbbf24"/><circle cx="48" cy="104" r="2" fill="#fbbf24"/>
  <circle cx="48" cy="56" r="21" fill="#f6c9a0" stroke="#c2834a" stroke-width="1"/>
  <circle cx="27" cy="57" r="4" fill="#f0b98d"/><circle cx="69" cy="57" r="4" fill="#f0b98d"/>
  <path d="M27 54c0-14 9-22 21-22s21 8 21 22c-4-8-11-12-21-12s-17 4-21 12z" fill="#475569"/>
  <circle cx="40" cy="57" r="2.6" fill="#1f2937"/><circle cx="56" cy="57" r="2.6" fill="#1f2937"/>
  <path d="M44 66c2.4 2.4 5.6 2.4 8 0" stroke="#9a5a35" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <rect x="30" y="22" width="36" height="12" rx="4" fill="url(#vyGold)" stroke="#92400e" stroke-width="1"/>
  <rect x="28" y="31" width="40" height="5" rx="2.5" fill="#1e293b"/>
  <circle cx="48" cy="19" r="2.8" fill="#fbbf24" stroke="#92400e" stroke-width=".8"/>
  <rect x="58" y="84" width="20" height="22" rx="4" fill="#f8fbff" stroke="#0f172a" stroke-width="1"/>
  <path d="M62 90h11M62 94h8" stroke="#64748b" stroke-width="1.3" stroke-linecap="round"/>`
};

function charArt(id) {
  const art = CHAR_ART[id];
  if (!art) return null;
  return `<svg class="char-svg" viewBox="0 0 96 120" aria-hidden="true" focusable="false">${art}</svg>`;
}

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

/* ---------------- Supabase REST ---------------- */
function sbHeaders(extra) {
  const base = {
    apikey: SUPABASE.key,
    Authorization: `Bearer ${SUPABASE.key}`,
    'Content-Type': 'application/json'
  };
  return Object.assign(base, extra || {});
}

async function sbFetch(path, opts) {
  const res = await fetch(`${SUPABASE.url}/rest/v1/${path}`, Object.assign({ headers: sbHeaders() }, opts || {}));
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || body.hint || body.details || message;
    } catch (e) { /* 본문 없음 */ }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const sbSelect = (table, query = '') => sbFetch(`${table}?select=*${query}`);
const sbInsert = (table, row) => sbFetch(table, {
  method: 'POST',
  headers: sbHeaders({ Prefer: 'return=representation' }),
  body: JSON.stringify(row)
});
const sbPatch = (table, id, row) => sbFetch(`${table}?id=eq.${encodeURIComponent(id)}`, {
  method: 'PATCH',
  headers: sbHeaders({ Prefer: 'return=representation' }),
  body: JSON.stringify(row)
});
const sbRemove = (table, id) => sbFetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });

/* 방·발신자 이름을 앱 내부 id로 정규화 */
const ROOM_ALIAS = {
  command: 'command', '지휘실': 'command',
  boardroom: 'boardroom', conference: 'boardroom', meeting: 'boardroom', '대회의실': 'boardroom', '회의실': 'boardroom',
  lounge: 'lounge', '라운지': 'lounge'
};
const SENDER_ALIAS = {
  '후후': 'huhu', huhu: 'huhu', '승후': 'seunghu', seunghu: 'seunghu',
  '뮤즈': 'muse', muse: 'muse', '제미나이': 'gemini', gemini: 'gemini',
  cue: 'cue', vooy: 'vooy'
};

function normRoom(room) {
  const key = String(room == null ? '' : room).trim();
  return ROOM_ALIAS[key] || ROOM_ALIAS[key.toLowerCase()] || 'boardroom';
}

function normSender(sender) {
  const key = String(sender == null ? '' : sender).trim();
  return SENDER_ALIAS[key] || SENDER_ALIAS[key.toLowerCase()] || null;
}

/* Supabase 응답을 화면용 행으로 변환 */
function remoteMessages() {
  return (sb.messages || []).map((row) => ({
    id: `sb-${row.id}`,
    room: normRoom(row.room),
    authorId: normSender(row.sender),
    senderName: row.sender || '외부',
    text: row.content || '',
    at: row.created_at,
    mentions: [],
    source: 'supabase'
  }));
}

function liveTasks() {
  return (sb.tasks || []).map((t) => ({
    id: t.id,
    emoji: '🛰️',
    title: t.title || '제목 없음',
    status: t.status || '진행중',
    progress: Number(t.progress) || 0,
    owner: t.owner || '',
    detail: t.detail || '',
    link: t.link || '',
    next: '',
    tags: ['실시간'],
    badge: 'LIVE',
    updated: fmtStamp(t.updated_at),
    source: 'supabase'
  }));
}

function projectRows() {
  const rows = (state.projects || []).map((p) => Object.assign({}, p, { source: 'seed' }));
  liveTasks().forEach((t) => {
    const i = rows.findIndex((r) => String(r.id) === String(t.id));
    if (i >= 0) rows[i] = Object.assign({}, rows[i], t, { tags: rows[i].tags || t.tags });
    else if (t.id === undefined || t.id === null) rows.unshift(t);
    else rows.unshift(t);
  });
  if (!sb.ok) {
    customTasks().forEach((t) => {
      if (!rows.some((r) => String(r.id) === String(t.id))) {
        rows.unshift(Object.assign({}, t, { source: 'local', progress: 0 }));
      }
    });
  }
  return rows;
}

function agentRows() {
  const rows = (state.agents || []).map((a) => Object.assign({}, a, { source: 'seed' }));
  (sb.agents || []).forEach((a) => {
    const base = charById(a.id) || {};
    const row = {
      id: a.id,
      name: a.name || a.id,
      role: a.role || base.role || '',
      state: a.status || '대기',
      task: a.current_task || '',
      next: a.next_task || '',
      load: '',
      lastActive: a.updated_at ? fmtStamp(a.updated_at) : '',
      skills: [],
      emoji: base.emoji || '👤',
      room: a.room || base.room || '',
      source: 'supabase'
    };
    const i = rows.findIndex((r) => r.id === a.id);
    if (i >= 0) rows[i] = Object.assign({}, rows[i], row, { skills: rows[i].skills, load: rows[i].load });
    else rows.push(row);
  });
  return rows;
}

/* 실시간 비서 상태를 오피스 맵 캐릭터에도 반영 */
function applyAgentOverlay() {
  if (!state || !Array.isArray(state.characters) || !Array.isArray(sb.agents)) return;
  sb.agents.forEach((a) => {
    const c = state.characters.find((x) => x.id === a.id);
    if (!c) return;
    if (a.current_task) c.task = a.current_task;
    if (a.next_task) c.next = a.next_task;
    if (a.status) {
      c.status = a.status;
      c.state = /가동|진행|자문|작업|active|on/i.test(a.status) ? 'active' : 'idle';
    }
    if (a.updated_at) c.lastActive = fmtStamp(a.updated_at);
  });
}

async function loadRemote() {
  const t = SUPABASE.tables;
  try {
    const [messages, tasks, memos, agents] = await Promise.all([
      sbSelect(t.messages, '&order=created_at.asc&limit=300'),
      sbSelect(t.tasks, '&order=updated_at.desc'),
      sbSelect(t.memos, '&order=updated_at.desc'),
      sbSelect(t.agents, '&order=updated_at.desc')
    ]);
    sb.messages = Array.isArray(messages) ? messages : [];
    sb.tasks = Array.isArray(tasks) ? tasks : [];
    sb.memos = Array.isArray(memos) ? memos : [];
    sb.agents = Array.isArray(agents) ? agents : [];
    sb.ok = true;
    sb.error = null;
    sb.at = new Date().toISOString();
  } catch (err) {
    sb.ok = false;
    sb.error = (err && err.message) ? err.message : String(err);
  }
  applyAgentOverlay();
  renderSyncBadge();
  return sb.ok;
}

function sbSnapshot() {
  return JSON.stringify([sb.messages, sb.tasks, sb.memos, sb.agents]);
}

async function refreshLive() {
  const before = sbSnapshot();
  await loadRemote();
  if (state && sbSnapshot() !== before) renderAll();
}

function syncNote(text) {
  if (!el.chatHint) return;
  el.chatHint.textContent = text;
  clearTimeout(syncNote.timer);
  syncNote.timer = setTimeout(updateChatHint, 4500);
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
    await loadRemote();
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
  renderSyncBadge();
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
}

function renderSyncBadge() {
  if (!el.syncBtn) return;
  el.syncBtn.classList.toggle('is-live', !!sb.ok);
  el.syncBtn.classList.toggle('is-error', !sb.ok && !!sb.error);
  const label = el.syncBtn.querySelector('.sync-label');
  if (label) label.textContent = sb.ok ? '실시간 DB' : '로컬 저장';
  if (el.syncTime) {
    if (sb.ok) el.syncTime.textContent = `${fmtStamp(sb.at)} 동기화`;
    else if (sb.error) el.syncTime.textContent = 'DB 연결 실패 · 로컬';
    else el.syncTime.textContent = '불러오는 중…';
  }
  updateChatHint();
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
    const art = charArt(c.id);
    return `<button class="char ${sel ? 'is-selected' : ''}" type="button"
      data-char="${esc(c.id)}" style="left:${Number(c.x)}%;top:${Number(c.y)}%;--tint:${esc(c.color || '#0284c7')};--delay:${(-i * 0.8).toFixed(2)}s;z-index:${Math.round(Number(c.y) * 10)}"
      aria-label="${esc(c.name)} ${esc(c.role || '')} — ${esc(c.status || '')}">
      <span class="char-art">${art || `<span class="char-emoji">${esc(c.emoji)}</span>`}</span>
      <span class="char-label"><span class="char-dot ${dotState}"></span><b>${esc(c.name)}</b></span>
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
        <div class="detail-avatar" style="--tint:${esc(c.color || '#0284c7')}" aria-hidden="true">${charArt(c.id) || esc(c.emoji)}</div>
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
    /* 실제 전송은 submit 핸들러에서 Supabase POST 담당.
       DB가 막혔을 때만 이 로컬 저장소를 쓴다. */
  },
  remove(id) {
    write(KEY.chat, this.all().filter((m) => m.id !== id));
  }
};

function allMessages() {
  const seed = (state.meetings || []).map((m) => ({ ...m, source: 'state' }));
  const live = sb.ok
    ? remoteMessages()
    : ChatStore.all().map((m) => ({ ...m, source: 'local' }));
  return seed.concat(live).sort((a, b) => new Date(a.at) - new Date(b.at));
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
      const c = m.authorId
        ? charById(m.authorId)
        : { id: '', name: m.senderName || '외부 에이전트', color: '#0284c7', emoji: '👤' };
      const own = m.authorId === OWNER_ID;
      const room = roomById(m.room);
      const live = m.source === 'supabase';
      return `<li class="msg ${own ? 'is-own' : ''}">
        <span class="msg-avatar" style="--tint:${esc(c.color || '#0284c7')}" aria-hidden="true">${charArt(c.id) || esc(c.emoji)}</span>
        <div class="msg-body">
          <div class="msg-head">
            <span class="msg-author">${esc(c.name)}</span>
            <span class="msg-room">${esc(room.emoji)} ${esc(room.name)}</span>
            ${live ? '<span class="msg-live">LIVE</span>' : ''}
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
  if (!el.chatHint) return;
  const target = roomById(activeRoom === 'all' ? 'boardroom' : activeRoom);
  const tail = sb.ok ? '실시간 DB에 공유' : '이 브라우저에 저장(오프라인)';
  el.chatHint.textContent = `→ ${target.emoji} ${target.name}에 남깁니다 · ${tail}`;
}

/* ---------------- tab 3: work room ---------------- */
function customTasks() {
  const list = read(KEY.tasks, []);
  return Array.isArray(list) ? list : [];
}

function renderProjects() {
  const rows = projectRows();
  el.projectList.innerHTML = rows.map((p, i) => {
    const badgeState = String(p.status || '').indexOf('완료') >= 0 ? 'done' : 'wait';
    const live = p.source === 'supabase';
    return `<article class="project-card ${live ? 'is-live' : ''}" style="--tint:${TINTS[i % TINTS.length]}">
      <div class="project-head">
        <span class="project-emoji" aria-hidden="true">${esc(p.emoji || '📌')}</span>
        <div class="project-title-wrap">
          <h3 class="project-title">${esc(p.title)}</h3>
          <p class="project-owner">${esc(p.owner || '')} 담당${p.updated ? ` · 업데이트 ${esc(p.updated)}` : ''}</p>
        </div>
        <span class="pill ${badgeState}">${esc(p.status || '')}</span>
        ${p.source !== 'seed' ? `<button class="card-del" type="button" data-del-task="${esc(p.id)}" data-source="${esc(p.source)}" aria-label="이 작업 삭제">✕</button>` : ''}
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
  }).join('');
}

/* ---------------- tab 4: status ---------------- */
function renderAgents() {
  el.agentCards.innerHTML = agentRows().map((a) => `
    <article class="agent-card ${a.source === 'supabase' ? 'is-live' : ''}">
      <div class="agent-head">
        <span class="agent-avatar" style="--tint:${esc((charById(a.id).color) || '#0284c7')}" aria-hidden="true">${charArt(a.id) || esc(a.emoji)}</span>
        <div class="agent-id">
          <h3>${esc(a.name)}</h3>
          <p>${esc(a.role)}</p>
        </div>
        <span class="pill ${/가동|협업|자문|진행/.test(String(a.state)) ? 'is-on' : 'is-idle'}">${esc(a.state)}</span>
      </div>
      <p class="agent-task">${esc(a.task || '—')}</p>
      ${a.next ? `<p class="agent-next"><b>다음</b> ${esc(a.next)}</p>` : ''}
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
function memoRows() {
  const deleted = new Set(read(KEY.memoDeleted, []));
  const pins = read(KEY.pins, {}) || {};
  const rows = (state.memos || []).map((m) => ({
    id: m.id,
    text: m.text,
    pinned: Object.prototype.hasOwnProperty.call(pins, m.id) ? !!pins[m.id] : !!m.pinned,
    created: m.created,
    source: 'state'
  }));
  if (!sb.ok) {
    const local = read(KEY.memos, []);
    (Array.isArray(local) ? local : []).forEach((m) => rows.push({
      id: m.id,
      text: m.text,
      pinned: Object.prototype.hasOwnProperty.call(pins, m.id) ? !!pins[m.id] : !!m.pinned,
      created: m.created,
      source: 'local'
    }));
  }
  (sb.memos || []).forEach((r) => {
    const row = {
      id: r.id,
      text: r.content || r.title || '',
      pinned: !!r.pinned,
      created: r.updated_at,
      source: 'supabase'
    };
    const i = rows.findIndex((m) => String(m.id) === String(r.id));
    if (i >= 0) rows[i] = Object.assign({}, rows[i], row);
    else rows.unshift(row);
  });
  return rows
    .filter((m) => !(m.source === 'state' && deleted.has(m.id)))
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (new Date(b.created) - new Date(a.created)));
}

const memoList = memoRows;

function renderMemos() {
  const list = memoList();
  if (!list.length) {
    el.memoList.innerHTML = '<li class="memo-empty">메모가 없어요. 위에서 바로 추가해 보세요.</li>';
    return;
  }
  el.memoList.innerHTML = list.map((m) => `
    <li class="memo-card ${m.pinned ? 'is-pinned' : ''} ${m.source === 'supabase' ? 'is-live' : ''}">
      <div class="memo-text">${esc(m.text)}
        <div class="memo-date">${esc(fmtStamp(m.created))}${m.pinned ? ' · 고정됨' : ''}${m.source === 'supabase' ? ' · LIVE' : ''}</div>
      </div>
      <div class="memo-actions">
        <button class="icon-btn ${m.pinned ? 'is-on' : ''}" type="button" data-pin="${esc(m.id)}" data-source="${esc(m.source)}"
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

el.chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = el.chatInput.value.trim();
  if (!text) { el.chatInput.focus(); return; }
  const authorId = el.chatSender.value || OWNER_ID;
  const room = activeRoom === 'all' ? 'boardroom' : activeRoom;
  const senderName = charById(authorId).name;
  const msg = { id: `local-${Date.now()}`, room, authorId, senderName, text, at: new Date().toISOString(), mentions: [] };
  const btn = el.chatForm.querySelector('.send-btn');
  el.chatInput.value = '';
  if (btn) btn.disabled = true;
  if (sb.ok) {
    try {
      const rows = await sbInsert(SUPABASE.tables.messages, { room, sender: senderName, content: text });
      if (Array.isArray(rows) && rows.length) {
        if (!(sb.messages || []).some((m) => String(m.id) === String(rows[0].id))) sb.messages.push(rows[0]);
      }
      sb.at = new Date().toISOString();
      syncNote('실시간 DB에 남겼어요 · 폰·PC·에이전트가 함께 봅니다');
    } catch (err) {
      ChatStore.append(msg);
      syncNote('DB 전송 실패 — 이 브라우저에만 저장했어요');
    }
  } else {
    ChatStore.append(msg);
    syncNote('오프라인 — 이 브라우저에만 저장했어요');
  }
  renderChat();
  renderSyncBadge();
  if (btn) btn.disabled = false;
  const last = el.msgList.lastElementChild;
  if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.chatInput.focus();
});

/* work */
el.taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = el.taskTitle.value.trim();
  if (!title) { el.taskTitle.focus(); return; }
  const id = `task-${Date.now()}`;
  const status = el.taskStatus.value;
  const owner = el.taskOwner.value;
  const next = el.taskNext.value.trim();
  const emoji = el.taskEmoji.value;
  el.taskForm.reset();
  el.taskEmoji.value = '📌';
  if (sb.ok) {
    try {
      const rows = await sbInsert(SUPABASE.tables.tasks, {
        id, title, status, progress: 0, owner, detail: next || '', link: null
      });
      if (Array.isArray(rows) && rows.length) sb.tasks.unshift(rows[0]);
      syncNote('작업실 DB에 추가했어요');
    } catch (err) {
      const list = customTasks();
      list.unshift({ id, emoji, title, next, status, owner, created: new Date().toISOString() });
      write(KEY.tasks, list);
      syncNote('DB 저장 실패 — 이 브라우저에만 남겼어요');
    }
  } else {
    const list = customTasks();
    list.unshift({ id, emoji, title, next, status, owner, created: new Date().toISOString() });
    write(KEY.tasks, list);
  }
  renderProjects();
});

el.projectList.addEventListener('click', async (e) => {
  const del = e.target.closest('[data-del-task]');
  if (!del) return;
  const id = del.dataset.delTask;
  if (del.dataset.source === 'supabase' && sb.ok) {
    try {
      await sbRemove(SUPABASE.tables.tasks, id);
      sb.tasks = (sb.tasks || []).filter((t) => String(t.id) !== String(id));
    } catch (err) {
      syncNote('DB 삭제 실패 — 잠시 후 다시 시도하세요');
      return;
    }
  } else {
    write(KEY.tasks, customTasks().filter((t) => t.id !== id));
  }
  renderProjects();
});

/* memos */
el.memoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = el.memoInput.value.trim();
  if (!text) { el.memoInput.focus(); return; }
  const id = `memo-${Date.now()}`;
  el.memoInput.value = '';
  if (sb.ok) {
    try {
      const rows = await sbInsert(SUPABASE.tables.memos, {
        id, title: text.slice(0, 80), content: text, pinned: false
      });
      if (Array.isArray(rows) && rows.length) sb.memos.unshift(rows[0]);
    } catch (err) {
      const arr = read(KEY.memos, []);
      const list = Array.isArray(arr) ? arr : [];
      list.unshift({ id, text, pinned: false, created: new Date().toISOString() });
      write(KEY.memos, list);
      syncNote('DB 저장 실패 — 이 브라우저에만 남겼어요');
    }
  } else {
    const arr = read(KEY.memos, []);
    const list = Array.isArray(arr) ? arr : [];
    list.unshift({ id, text, pinned: false, created: new Date().toISOString() });
    write(KEY.memos, list);
  }
  renderMemos();
});

el.memoList.addEventListener('click', async (e) => {
  const pin = e.target.closest('[data-pin]');
  if (pin) {
    const id = pin.dataset.pin;
    const source = pin.dataset.source;
    const current = memoRows().find((m) => String(m.id) === String(id));
    const nextPinned = !(current && current.pinned);
    if (source === 'supabase' && sb.ok) {
      try {
        await sbPatch(SUPABASE.tables.memos, id, { pinned: nextPinned });
        const row = (sb.memos || []).find((m) => String(m.id) === String(id));
        if (row) row.pinned = nextPinned;
      } catch (err) {
        syncNote('핀 저장 실패 — 잠시 후 다시 시도하세요');
        return;
      }
    } else {
      const pins = read(KEY.pins, {}) || {};
      pins[id] = nextPinned;
      write(KEY.pins, pins);
    }
    renderMemos();
    return;
  }
  const del = e.target.closest('[data-del-memo]');
  if (del) {
    const id = del.dataset.delMemo;
    if (del.dataset.source === 'supabase' && sb.ok) {
      try {
        await sbRemove(SUPABASE.tables.memos, id);
        sb.memos = (sb.memos || []).filter((m) => String(m.id) !== String(id));
      } catch (err) {
        syncNote('DB 삭제 실패 — 잠시 후 다시 시도하세요');
        return;
      }
    } else if (del.dataset.source === 'state') {
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

  /* 실시간 DB 45초 폴링 — 다른 기기·에이전트의 글이 바로 들어옵니다 */
  setInterval(() => {
    if (document.visibilityState === 'visible') refreshLive();
  }, SUPABASE.pollMs);

  /* 후후가 state.json만 고쳐도 화면이 따라오도록 5분마다 시드 재확인 */
  setInterval(() => {
    if (document.visibilityState === 'visible') loadState({ silent: true });
  }, 5 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state) loadState({ silent: true });
  });
}

document.addEventListener('DOMContentLoaded', boot);
