/* =========================================================
   어벤져스타워 — app.js (Vanilla JS, no build step)
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
   캐릭터 아트 — 이모지 대신 쓰는 커스텀 어벤져스 SVG
   후후=캡틴 아메리카 · 뮤즈=아이언맨(풀 페이스 마스크) · Cue=토르
   제미나이=닥터 스트레인지 · Vooy=헐크 · 승후=왕관+케이프 유지
   좌표계 0 0 96 120 · 발(밑동)은 y=112, 바닥 그림자 y=116
   ========================================================= */
const CHAR_ART = {
  huhu: `
  <defs>
    <linearGradient id="hhSuit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4f8dff"/><stop offset=".55" stop-color="#2454d6"/><stop offset="1" stop-color="#0e2a68"/>
    </linearGradient>
    <linearGradient id="hhHelm" x1=".1" y1="0" x2=".3" y2="1">
      <stop offset="0" stop-color="#77afff"/><stop offset=".5" stop-color="#2e60d8"/><stop offset="1" stop-color="#132f79"/>
    </linearGradient>
    <linearGradient id="hhShield" x1="0" y1="0" x2=".6" y2="1">
      <stop offset="0" stop-color="#ff6b5f"/><stop offset=".5" stop-color="#dc2626"/><stop offset="1" stop-color="#9b1410"/>
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
  <path d="M48 68c15 0 25 10 27 23 1 5 1 11 1 17H20c0-6 0-12 1-17 2-13 12-23 27-23z" fill="url(#hhSuit)" stroke="#0b2a66" stroke-width="1.3"/>
  <path d="M31 98h34v10H31z" fill="#d9231f"/>
  <path d="M36.4 98h3.6v10h-3.6zM45.6 98H49.2v10h-3.6zM54.8 98h3.6v10h-3.6zM64 98h1.4v10H64z" fill="#f6f9ff"/>
  <path d="M28 96c6 2 34 2 40 0v5H28z" fill="#6b4423"/>
  <path d="M48 75.5 50.12 81.09 56.08 81.37 51.42 85.11 53 90.88 48 87.6 43 90.88 44.58 85.11 39.92 81.37 45.88 81.09Z" fill="#f6f9ff"/>
  <path d="M66 74c5 4 7 11 7 18l-8 1c0-6-1-11-3-14z" fill="url(#hhSuit)" stroke="#0b2a66" stroke-width="1.1"/>
  <circle cx="70" cy="94" r="5.2" fill="#e0342f" stroke="#8f1a16" stroke-width="1"/>
  <circle cx="48" cy="43" r="22" fill="url(#hhHelm)" stroke="#122c6e" stroke-width="1.2"/>
  <path d="M31 48c-1 6 0 11 2 15l3-2c-2-4-2-9-2-13zM65 48c1 6 0 11-2 15l-3-2c2-4 2-9 2-13z" fill="#1d3f9e" opacity=".85"/>
  <path d="M48 63c-7.6 0-12.6-6.6-12.6-15.4 0-6.8 4.8-11.6 12.6-11.6s12.6 4.8 12.6 11.6C60.6 56.4 55.6 63 48 63z" fill="#f8cba6"/>
  <path d="M36.4 46.6c.8-8.6 5-14 11.6-14s10.8 5.4 11.6 14" fill="none" stroke="#dfa87e" stroke-width="1"/>
  <circle cx="43" cy="47" r="3.4" fill="#fff"/><circle cx="53" cy="47" r="3.4" fill="#fff"/>
  <circle cx="43.3" cy="47.6" r="1.9" fill="#14213d"/><circle cx="52.7" cy="47.6" r="1.9" fill="#14213d"/>
  <circle cx="44" cy="46.6" r=".65" fill="#fff"/><circle cx="53.4" cy="46.6" r=".65" fill="#fff"/>
  <path d="M39.4 41.6l5.2 1.2M56.6 41.6l-5.2 1.2" stroke="#16305e" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M45 55c2 2.4 4 2.4 6 0" fill="none" stroke="#b06a41" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M44.6 33.8 48 24.4l3.4 9.4" fill="none" stroke="#f6f9ff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M46.2 30.6h3.6" stroke="#f6f9ff" stroke-width="1.9" stroke-linecap="round"/>
  <path d="M28.6 34.6c-3.4-6.2-8.4-9-11.6-6.6 3 1.4 5.6 4.4 7.2 9z" fill="#f2f7ff" stroke="#b9c8dd" stroke-width=".85"/>
  <path d="M67.4 34.6c3.4-6.2 8.4-9 11.6-6.6-3 1.4-5.6 4.4-7.2 9z" fill="#f2f7ff" stroke="#b9c8dd" stroke-width=".85"/>
  <path d="M28.6 36.2c-2.6 3-3.6 6.4-3 9.8l3.6-.6c-.6-3 0-6 1.6-8.6z" fill="#1d3f9e"/>
  <path d="M67.4 36.2c2.6 3 3.6 6.4 3 9.8l-3.6-.6c.6-3 0-6-1.6-8.6z" fill="#1d3f9e"/>
  <path d="M29 52c2 2 4 4 7 5" fill="none" stroke="#1b3c8f" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M67 52c-2 2-4 4-7 5" fill="none" stroke="#1b3c8f" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="26" cy="94" r="16.4" fill="url(#hhShield)" stroke="#8f1410" stroke-width="1.1"/>
  <circle cx="26" cy="94" r="12.9" fill="#f2f6fd"/>
  <circle cx="26" cy="94" r="9.4" fill="url(#hhShield)"/>
  <circle cx="26" cy="94" r="5.8" fill="#2454d6"/>
  <path d="M26 89.6 27.1 92.44 30.13 92.6 27.85 94.46 28.61 97.4 26 95.8 23.39 97.4 24.15 94.46 21.87 92.6 24.9 92.44Z" fill="#f6f9ff"/>
  <path d="M13.2 88.4c1.4-5.2 5.2-8.8 9.8-10.4" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>`,

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
    <linearGradient id="msRed" x1=".2" y1="0" x2=".7" y2="1">
      <stop offset="0" stop-color="#f0604a"/><stop offset=".42" stop-color="#c0200f"/><stop offset="1" stop-color="#6d0f08"/>
    </linearGradient>
    <linearGradient id="msGold" x1=".2" y1="0" x2=".6" y2="1">
      <stop offset="0" stop-color="#fff0c2"/><stop offset=".42" stop-color="#f5c64f"/><stop offset="1" stop-color="#a9700c"/>
    </linearGradient>
    <radialGradient id="msCore" cx="50%" cy="42%" r="58%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#d5f7ff"/><stop offset="1" stop-color="#1ea8d6"/>
    </radialGradient>
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
  <path d="M48 67c15 0 26 10 28 24 1 5 1 11 1 17H19c0-6 0-12 1-17 2-14 13-24 28-24z" fill="url(#msRed)" stroke="#5e0d07" stroke-width="1.2"/>
  <path d="M35 92h26l-2.4 16H37.4z" fill="url(#msGold)" stroke="#8a5a08" stroke-width=".9"/>
  <path d="M37.4 97h21.2M38.6 101.4h18.8" stroke="#8a5a08" stroke-width=".9" opacity=".55"/>
  <path d="M31 75c5-4 11-6 17-6s12 2 17 6l-4 8c-4-3-8-5-13-5s-9 2-13 5z" fill="url(#msGold)" stroke="#8a5a08" stroke-width=".9"/>
  <path d="M48 69v5" stroke="#8a5a08" stroke-width="1"/>
  <path d="M30 71c-7 2-11 8-12 15l10 2c1-6 4-10 8-13z" fill="url(#msRed)" stroke="#5e0d07" stroke-width="1"/>
  <path d="M66 71c7 2 11 8 12 15l-10 2c-1-6-4-10-8-13z" fill="url(#msRed)" stroke="#5e0d07" stroke-width="1"/>
  <rect x="18.6" y="87" width="9.4" height="15" rx="4.4" fill="url(#msGold)" stroke="#8a5a08" stroke-width=".8"/>
  <rect x="68" y="87" width="9.4" height="15" rx="4.4" fill="url(#msGold)" stroke="#8a5a08" stroke-width=".8"/>
  <circle cx="48" cy="84.5" r="12.5" fill="#bdf3ff" opacity=".26"/>
  <circle cx="48" cy="84.5" r="8.2" fill="#5c0d07" stroke="#3d0a05" stroke-width=".8"/>
  <circle cx="48" cy="84.5" r="6.2" fill="url(#msCore)"/>
  <circle cx="48" cy="84.5" r="2.7" fill="#ffffff"/>
  <path d="M44.6 84.5a3.4 3.4 0 0 1 3.4-3.4" fill="none" stroke="#7fe6ff" stroke-width="1" opacity=".9"/>
  <path d="M48 19c13 0 22 9 22 21 0 7-2 13-5 18-4 7-10 12-17 15-7-3-13-8-17-15-3-5-5-11-5-18 0-12 9-21 22-21z" fill="url(#msRed)" stroke="#5e0d07" stroke-width="1.3"/>
  <path d="M48 25c8.4 0 14 5.6 14 14.4 0 5-1.4 9.8-4 13.8-2.8 4.4-6.2 7.8-10 9.8-3.8-2-7.2-5.4-10-9.8-2.6-4-4-8.8-4-13.8C34 30.6 39.6 25 48 25z" fill="url(#msGold)" stroke="#96630a" stroke-width="1.1"/>
  <path d="M37.6 43.6l8.4 2-1.2 3.7-8.2-2.3z" fill="#eafcff"/>
  <path d="M58.4 43.6l-8.4 2 1.2 3.7 8.2-2.3z" fill="#eafcff"/>
  <path d="M37.6 43.6l8.4 2-1.2 3.7-8.2-2.3z" fill="#a9f6ff" opacity=".6"/>
  <path d="M58.4 43.6l-8.4 2 1.2 3.7 8.2-2.3z" fill="#a9f6ff" opacity=".6"/>
  <path d="M43.4 56.6h9.2a1.4 1.4 0 0 1 0 2.8h-9.2a1.4 1.4 0 0 1 0-2.8z" fill="#4a2a06" opacity=".75"/>
  <path d="M48 59.6v4.8" stroke="#96630a" stroke-width="1.2"/>
  <path d="M40 30.4c2.4-2.4 5-3.6 8-3.6s5.6 1.2 8 3.6" fill="none" stroke="#ffe9a8" stroke-width="1.3" opacity=".7"/>
  <ellipse cx="26.4" cy="49.4" rx="3.6" ry="5" fill="url(#msGold)" stroke="#8a5a08" stroke-width=".8"/>
  <ellipse cx="69.6" cy="49.4" rx="3.6" ry="5" fill="url(#msGold)" stroke="#8a5a08" stroke-width=".8"/>
  <path d="M31 56c-2.4 3-3.4 6.4-3.2 9.8" fill="none" stroke="#5e0d07" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>
  <path d="M65 56c2.4 3 3.4 6.4 3.2 9.8" fill="none" stroke="#5e0d07" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`,

  gemini: `
  <defs>
    <linearGradient id="gmCloak" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#ef4a37"/><stop offset=".5" stop-color="#c01c1c"/><stop offset="1" stop-color="#6b0f0f"/>
    </linearGradient>
    <linearGradient id="gmInner" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8f1616"/><stop offset="1" stop-color="#4b0808"/>
    </linearGradient>
    <linearGradient id="gmTunic" x1="0" y1="0" x2=".4" y2="1">
      <stop offset="0" stop-color="#4a80e4"/><stop offset=".55" stop-color="#21458f"/><stop offset="1" stop-color="#10214f"/>
    </linearGradient>
    <linearGradient id="gmGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffeeb4"/><stop offset=".5" stop-color="#eab53c"/><stop offset="1" stop-color="#9a6a08"/>
    </linearGradient>
    <radialGradient id="gmEye" cx="45%" cy="38%" r="62%">
      <stop offset="0" stop-color="#f0ffe0"/><stop offset=".45" stop-color="#63e86f"/><stop offset="1" stop-color="#0f7c34"/>
    </radialGradient>
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
  <path d="M33 67c-10 5-17 15-19 27l-1 14h16c-1-11 0-20 5-27z" fill="url(#gmCloak)" stroke="#6b0f0f" stroke-width="1.1"/>
  <path d="M63 67c10 5 17 15 19 27l1 14H67c1-11 0-20-5-27z" fill="url(#gmCloak)" stroke="#6b0f0f" stroke-width="1.1"/>
  <path d="M31 68C19 60 14 44 18 30c1.6-5.6 5-9 9.6-9.6-1.8 12 1.2 24 7.4 32.6l2.6 14z" fill="url(#gmCloak)" stroke="#6b0f0f" stroke-width="1.1"/>
  <path d="M65 68c12-8 17-24 13-38-1.6-5.6-5-9-9.6-9.6 1.8 12-1.2 24-7.4 32.6l-2.6 14z" fill="url(#gmCloak)" stroke="#6b0f0f" stroke-width="1.1"/>
  <path d="M27.6 30.4c-1 8 1.6 16 6.4 22.4" fill="none" stroke="#8f1616" stroke-width="1.2" opacity=".7"/>
  <path d="M68.4 30.4c1 8-1.6 16-6.4 22.4" fill="none" stroke="#8f1616" stroke-width="1.2" opacity=".7"/>
  <path d="M31.6 65.2C20.4 57 16.2 42.4 20.2 30.2" fill="none" stroke="#eab53c" stroke-width="1.5" opacity=".5"/>
  <path d="M64.4 65.2C75.6 57 79.8 42.4 75.8 30.2" fill="none" stroke="#eab53c" stroke-width="1.5" opacity=".5"/>
  <path d="M48 68c14 0 25 10 27 23 1 5 1 11 1 17H20c0-6 0-13 1-17 2-13 13-23 27-23z" fill="url(#gmTunic)" stroke="#0f2350" stroke-width="1.2"/>
  <path d="M31 77c9 7 25 7 34-1l-3 14c-8 6-21 6-28-1z" fill="#2f5cb8" opacity=".55"/>
  <path d="M34 89h28l-3 6H37z" fill="url(#gmGold)" stroke="#8a5f08" stroke-width=".8"/>
  <path d="M40 71l8 11 8-11" fill="none" stroke="#8fb4f5" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="48" cy="96" r="9.6" fill="#8a5f08"/>
  <circle cx="48" cy="96" r="7.8" fill="url(#gmGold)"/>
  <ellipse cx="48" cy="96" rx="5.4" ry="5" fill="url(#gmEye)" stroke="#0b5c26" stroke-width=".9"/>
  <ellipse cx="48" cy="96" rx="2" ry="2.8" fill="#0b3d1c"/>
  <circle cx="49.6" cy="94.4" r=".75" fill="#eafff0"/>
  <path d="M37 66c2 5 5 8 11 8s9-3 11-8" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".22"/>
  <circle cx="48" cy="44" r="21" fill="#f4c39b" stroke="#c08a5c" stroke-width=".9"/>
  <path d="M27 44c0-13 9-22 21-22 7 0 12 2 16 7-4 5-11 6-18 3-8-3-13 1-15 7-1 2-2 3-2 5z" fill="#2b2f3a"/>
  <path d="M63 26c4 3 6 7 6 12-3-3-6-5-9-5z" fill="#7a828f" opacity=".95"/>
  <path d="M28.6 40c-.8 4-.6 8 .4 11.6l-3-.8c-1-3.8-1-8 .6-11.6z" fill="#7a828f" opacity=".9"/>
  <ellipse cx="41" cy="47" rx="4" ry="4.4" fill="#fff"/><ellipse cx="55" cy="47" rx="4" ry="4.4" fill="#fff"/>
  <circle cx="41.6" cy="47.4" r="2.3" fill="#20304a"/><circle cx="54.4" cy="47.4" r="2.3" fill="#20304a"/>
  <circle cx="42.4" cy="46.4" r=".75" fill="#fff"/><circle cx="55.2" cy="46.4" r=".75" fill="#fff"/>
  <path d="M37 41.4l5.4 1.4M59 41.4l-5.4 1.4" stroke="#2b2f3a" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M45.6 53h4.8" stroke="#c08a5c" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M43 55.4c1 3 2 5 5 5s4-2 5-5c-3 1-7 1-10 0z" fill="#3f2a1d"/>
  <path d="M44 59.4c2 1.6 6 1.6 8 0" fill="none" stroke="#8a5b3a" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="77" cy="85" r="13" fill="none" stroke="#fb923c" stroke-width="1.7" opacity=".9"/>
  <circle cx="77" cy="85" r="9.4" fill="none" stroke="#fdba74" stroke-width="1.1" opacity=".85"/>
  <circle cx="77" cy="85" r="5.2" fill="none" stroke="#fb923c" stroke-width="2.1" opacity=".95"/>
  <path d="M77 71l1.6 4.2 4.2 1.6-4.2 1.6L77 82.6l-1.6-4.2-4.2-1.6 4.2-1.6z" fill="#fdba74" opacity=".95"/>
  <path d="M63 60l1.2 3.1 3.1 1.2-3.1 1.2L63 68.6l-1.2-3.1-3.1-1.2 3.1-1.2z" fill="#fed7aa" opacity=".9"/>
  <path d="M89 99l1.2 3.1 3.1 1.2-3.1 1.2L89 107.6l-1.2-3.1-3.1-1.2 3.1-1.2z" fill="#fed7aa" opacity=".85"/>`,

  cue: `
  <defs>
    <linearGradient id="cqTunic" x1="0" y1="0" x2=".3" y2="1">
      <stop offset="0" stop-color="#3d4d68"/><stop offset=".5" stop-color="#1d2a3f"/><stop offset="1" stop-color="#0b121f"/>
    </linearGradient>
    <linearGradient id="cqCape" x1=".1" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#ef5240"/><stop offset=".5" stop-color="#c31a1a"/><stop offset="1" stop-color="#790c0c"/>
    </linearGradient>
    <linearGradient id="cqSteel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbfdff"/><stop offset=".45" stop-color="#cfdbe8"/><stop offset="1" stop-color="#8397ae"/>
    </linearGradient>
    <linearGradient id="cqHair" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fde68a"/><stop offset=".55" stop-color="#eab308"/><stop offset="1" stop-color="#a16207"/>
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
  <path d="M34 70c-9 5-14 15-16 27-1 4-1 8-1 11h14c-1-9 1-18 6-24z" fill="url(#cqCape)" stroke="#790c0c" stroke-width="1"/>
  <path d="M62 70c9 5 14 15 16 27 1 4 1 8 1 11H65c1-9-1-18-6-24z" fill="url(#cqCape)" stroke="#790c0c" stroke-width="1"/>
  <path d="M48 68c14 0 24 10 26 22 1 5 1 12 1 18H21c0-6 0-13 1-18 2-12 12-22 26-22z" fill="url(#cqTunic)" stroke="#0a1220" stroke-width="1.2"/>
  <path d="M35 74c4-3 8-5 13-5s9 2 13 5l-3 7c-3-2-6-3-10-3s-7 1-10 3z" fill="#27374d"/>
  <path d="M33 96h30v9H33z" fill="#f0b429" opacity=".95"/>
  <path d="M33 96h30v2.4H33z" fill="#fde68a" opacity=".8"/>
  <circle cx="48" cy="86" r="4.4" fill="url(#cqSteel)" stroke="#5f7085" stroke-width=".9"/>
  <circle cx="36" cy="90" r="3.2" fill="url(#cqSteel)" stroke="#5f7085" stroke-width=".8"/>
  <circle cx="60" cy="90" r="3.2" fill="url(#cqSteel)" stroke="#5f7085" stroke-width=".8"/>
  <path d="M28 72c-4 3-6 8-7 13l8 2c1-5 3-9 6-12z" fill="#2a3a52" stroke="#0a1220" stroke-width="1"/>
  <path d="M68 72c4 3 6 8 7 13l-8 2c-1-5-3-9-6-12z" fill="#2a3a52" stroke="#0a1220" stroke-width="1"/>
  <path d="M48 21c14 0 23 10 23 23 0 6-1 11-3 15l-7-3c2-4 2-8 2-12 0-9-7-14-15-14s-15 5-15 14c0 4 0 8 2 12l-7 3c-2-4-3-9-3-15 0-13 9-23 23-23z" fill="url(#cqHair)"/>
  <circle cx="48" cy="45" r="20.5" fill="#f7c9a2" stroke="#c4905f" stroke-width=".9"/>
  <path d="M33 50c1 9 6 15 15 15s14-6 15-15c-4 3-8 4-15 4s-11-1-15-4z" fill="url(#cqHair)"/>
  <path d="M39 51c3 2.4 6 3.2 9 3.2s6-.8 9-3.2c-1.4 3.6-4.6 5.4-9 5.4s-7.6-1.8-9-5.4z" fill="#a16207" opacity=".9"/>
  <ellipse cx="41" cy="44" rx="3.4" ry="3.9" fill="#fff"/><ellipse cx="55" cy="44" rx="3.4" ry="3.9" fill="#fff"/>
  <circle cx="41.4" cy="44.4" r="1.9" fill="#1f3a5f"/><circle cx="54.6" cy="44.4" r="1.9" fill="#1f3a5f"/>
  <circle cx="42" cy="43.6" r=".65" fill="#fff"/><circle cx="55.2" cy="43.6" r=".65" fill="#fff"/>
  <path d="M36.8 39.8l5.2 1.2M59.2 39.8l-5.2 1.2" stroke="#a16207" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M45 49.4c2 1.6 4 1.6 6 0" fill="none" stroke="#c4905f" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M44.8 56.2c2 1.8 4.4 1.8 6.4 0" fill="none" stroke="#8a5c22" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M48 18c14 0 23 9 23 20 0 2.4-.4 4.6-1.2 6.6-1.6-1-2.4-2.2-3-4.2-4 1.6-11 2.6-18.8 2.6s-14.8-1-18.8-2.6c-.6 2-1.4 3.2-3 4.2-.8-2-1.2-4.2-1.2-6.6 0-11 9-20 23-20z" fill="url(#cqSteel)" stroke="#7b8ea6" stroke-width="1"/>
  <path d="M26.4 31c-4.4-7.4-10.4-10.6-14.4-7.8 3.6 1.6 6.6 5 8.4 10.2z" fill="#f2f7fd" stroke="#a9b8c9" stroke-width=".9"/>
  <path d="M69.6 31c4.4-7.4 10.4-10.6 14.4-7.8-3.6 1.6-6.6 5-8.4 10.2z" fill="#f2f7fd" stroke="#a9b8c9" stroke-width=".9"/>
  <path d="M26.6 32.6c-2.6 3.4-3.4 7-2.6 10.6l3.8-1c-.6-3.2 0-6.6 1.8-9.4z" fill="#96a8bd"/>
  <path d="M69.4 32.6c2.6 3.4 3.4 7 2.6 10.6l-3.8-1c.6-3.2 0-6.6-1.8-9.4z" fill="#96a8bd"/>
  <path d="M46.4 36.6h3.2v6.4h-3.2z" fill="#dbe6f2" stroke="#8fa2b9" stroke-width=".7"/>
  <g transform="rotate(-14 76 82)">
    <path d="M76 84V62" stroke="#8a5a2b" stroke-width="4.8" stroke-linecap="round"/>
    <path d="M76 78.6h0M76 73.4h0M76 68.2h0" stroke="#5d3b18" stroke-width="3.4" stroke-linecap="round" opacity=".35"/>
    <path d="M64 47h24a2.6 2.6 0 0 1 2.6 2.6v7.4c0 3-2.2 5-5.2 5H66.6c-3 0-5.2-2-5.2-5v-7.4A2.6 2.6 0 0 1 64 47z" fill="url(#cqSteel)" stroke="#5d7288" stroke-width="1.2"/>
    <path d="M63 51.4h26" stroke="#f4f9ff" stroke-width="1.4" opacity=".9"/>
    <path d="M63 58.2h26" stroke="#7d92a8" stroke-width="1" opacity=".55"/>
    <path d="M75 51.8l-3.4 5.4h2.6l-1.6 4.4 4.8-5.8h-2.8z" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/>
  </g>
  <path d="M68 74c5 2 8 6 9 9" fill="none" stroke="#2a3a52" stroke-width="4.6" stroke-linecap="round"/>
  <circle cx="78" cy="84" r="5.6" fill="#f7c9a2" stroke="#c4905f" stroke-width=".9"/>
  <path d="M74 84.4c2-1.4 6-1.4 8 0" fill="none" stroke="#c4905f" stroke-width=".8"/>
  <path d="M88 40l-3.6 6.2 2.8.4-2.2 5 6.2-6.8-2.8-.4 2-4.4z" fill="#fde047" stroke="#d97706" stroke-width=".6"/>`,

  vooy: `
  <defs>
    <linearGradient id="vySkin" x1=".2" y1="0" x2=".7" y2="1">
      <stop offset="0" stop-color="#8bf0a8"/><stop offset=".42" stop-color="#48d97c"/><stop offset="1" stop-color="#137a38"/>
    </linearGradient>
    <linearGradient id="vyPants" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b066f7"/><stop offset="1" stop-color="#55209e"/>
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
  <circle cx="26" cy="75" r="11.6" fill="url(#vySkin)" stroke="#137a38" stroke-width="1.1"/>
  <circle cx="70" cy="75" r="11.6" fill="url(#vySkin)" stroke="#137a38" stroke-width="1.1"/>
  <path d="M48 61c18 0 30 11 32 25 1 5 1 12 1 22H15c0-10 0-17 1-22 2-14 14-25 32-25z" fill="url(#vySkin)" stroke="#137a38" stroke-width="1.3"/>
  <path d="M21 81c-5 4-7 11-6 18l2 8 8-2-2-8c0-5 1-9 3-12zM75 81c5 4 7 11 6 18l-2 8-8-2 2-8c0-5-1-9-3-12z" fill="url(#vySkin)" stroke="#137a38" stroke-width="1.1"/>
  <circle cx="21" cy="102" r="7.6" fill="url(#vySkin)" stroke="#137a38" stroke-width="1.1"/>
  <circle cx="75" cy="102" r="7.6" fill="url(#vySkin)" stroke="#137a38" stroke-width="1.1"/>
  <path d="M17.4 99.6c2 1.4 4 2 6 2M78.6 99.6c-2 1.4-4 2-6 2" stroke="#137a38" stroke-width="1.2" stroke-linecap="round" opacity=".5"/>
  <path d="M34 78c4-3 9-4 14-4s10 1 14 4" fill="none" stroke="#2bb45f" stroke-width="1.6" opacity=".8"/>
  <path d="M38 84c3 5 17 5 20 0" fill="none" stroke="#2bb45f" stroke-width="1.4" opacity=".55"/>
  <path d="M36 90c4-2 8-3 12-3s8 1 12 3" fill="none" stroke="#8bf0a8" stroke-width="1.4" opacity=".5"/>
  <path d="M27 95h42v13H27z" fill="url(#vyPants)" stroke="#4c1d95" stroke-width="1.1"/>
  <path d="M27 95h42v3.6H27z" fill="#d8b4fe" opacity=".85"/>
  <path d="M46.6 95h3v13h-3z" fill="#4c1d95" opacity=".55"/>
  <path d="M24 99c-3 2-4 5-4 9h9zM72 99c3 2 4 5 4 9h-9z" fill="url(#vyPants)" stroke="#4c1d95" stroke-width=".9"/>
  <circle cx="48" cy="43" r="21.5" fill="url(#vySkin)" stroke="#137a38" stroke-width="1.2"/>
  <path d="M27 41c0-11 9-19 21-19s21 8 21 19c0 3-1 5-2 6-3-7-9-10-19-10s-16 3-19 10c-1-1-2-3-2-6z" fill="#1c1b22"/>
  <path d="M30 30c5-4 11-6 18-6s13 2 18 6c-5 2-11 3-18 3s-13-1-18-3z" fill="#322f3d"/>
  <path d="M29 33c-1 2-1 4 0 6l3-1c-1-2-1-4 0-5zM67 33c1 2 1 4 0 6l-3-1c1-2 1-4 0-5z" fill="#1c1b22"/>
  <ellipse cx="40" cy="45" rx="5" ry="5.4" fill="#fff"/><ellipse cx="56" cy="45" rx="5" ry="5.4" fill="#fff"/>
  <circle cx="40.6" cy="45.8" r="2.6" fill="#14361f"/><circle cx="55.4" cy="45.8" r="2.6" fill="#14361f"/>
  <circle cx="41.6" cy="44.6" r=".85" fill="#fff"/><circle cx="56.4" cy="44.6" r=".85" fill="#fff"/>
  <path d="M34.4 38.4l7.8 2.6M61.6 38.4l-7.8 2.6" stroke="#123d22" stroke-width="2.3" stroke-linecap="round"/>
  <path d="M46 51.4c1.4 1.6 2.6 1.6 4 0" fill="none" stroke="#0f3d22" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M37.4 56.6c4 6 17.2 6 21.2 0-3 7-18.2 7-21.2 0z" fill="#0f3d22"/>
  <path d="M40.4 58.6c4.4 1.6 10.8 1.6 15.2 0-3.4 2.4-11.8 2.4-15.2 0z" fill="#f8fbff"/>
  <path d="M27 52c1.6 1.4 2.6 3 3.2 4.8M69 52c-1.6 1.4-2.6 3-3.2 4.8" stroke="#137a38" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`,
};

/* 히어로 정체성 — 지도 상세·비서현황 카드에 함께 표시 */
const HERO = {
  huhu: '캡틴 아메리카',
  muse: '아이언맨',
  cue: '토르',
  gemini: '닥터 스트레인지',
  vooy: '헐크'
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
          <h3>${esc(c.name)}${HERO[c.id] ? `<span class="hero-tag">${esc(HERO[c.id])}</span>` : ''}</h3>
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
          <p>${esc(a.role)}${HERO[a.id] ? ` · ${esc(HERO[a.id])}` : ''}</p>
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
