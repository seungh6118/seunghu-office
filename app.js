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
   제미나이=닥터 스트레인지 · Vooy=헐크 · 대장=왕관+케이프 유지
   좌표계 0 0 96 120 · 발(밑동)은 y=112, 바닥 그림자 y=116
   ========================================================= */
const CHAR_ART = {
  huhu: `
  <defs>
    <linearGradient id="hhRim" x1=".12" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#ff8f7c"/><stop offset=".42" stop-color="#d92b22"/><stop offset="1" stop-color="#75090a"/>
    </linearGradient>
    <linearGradient id="hhRing" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#eef3f9"/><stop offset="1" stop-color="#b3c2d4"/>
    </linearGradient>
    <radialGradient id="hhBlue" cx="34%" cy="26%" r="74%">
      <stop offset="0" stop-color="#63a6ff"/><stop offset=".5" stop-color="#1e4fb5"/><stop offset="1" stop-color="#0a1c4c"/>
    </radialGradient>
    <radialGradient id="hhGloss" cx="33%" cy="22%" r="58%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".6"/><stop offset=".55" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="hhSeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".48"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".18"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="109" rx="27" ry="7.6" fill="url(#hhSeat)"/>
  <g transform="rotate(-6 48 58)">
    <circle cx="48" cy="58.6" r="38.6" fill="#400707"/>
    <circle cx="48" cy="58" r="37.2" fill="url(#hhRim)" stroke="#4a0707" stroke-width="1.3"/>
    <circle cx="48" cy="58" r="30.1" fill="url(#hhRing)" stroke="#a9b8c9" stroke-width=".7"/>
    <circle cx="48" cy="58" r="23" fill="url(#hhRim)" stroke="#7a0c0b" stroke-width=".6"/>
    <circle cx="48" cy="58" r="15.9" fill="url(#hhBlue)" stroke="#08204d" stroke-width=".8"/>
    <path d="M48 46.8 L50.8 54.2 L58.7 54.5 L52.5 59.5 L54.6 67.1 L48 62.7 L41.4 67.1 L43.5 59.5 L37.3 54.5 L45.2 54.2 Z" fill="#f8fbff" stroke="#dde7f2" stroke-width=".5"/>
    <path d="M47 50.6 L48.2 54.3 L52 54.4 L49 56.7 L50 60.4 L47 58.2 L44 60.4 L45 56.7 L42 54.4 L45.8 54.3 Z" fill="#ffffff" opacity=".75"/>
    <path d="M16.5 45a37.4 37.4 0 0 1 24-23.4" fill="none" stroke="#ffe2d8" stroke-width="2.6" stroke-linecap="round" opacity=".5"/>
    <path d="M83 70a37.4 37.4 0 0 1 -22 24.6" fill="none" stroke="#3a0605" stroke-width="2.2" stroke-linecap="round" opacity=".28"/>
    <path d="M22.4 70a26 26 0 0 0 51 0" fill="none" stroke="#6d0b0a" stroke-width="1.4" opacity=".18"/>
    <circle cx="48" cy="58" r="37.2" fill="url(#hhGloss)"/>
  </g>`,
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
    <linearGradient id="msRed" x1=".12" y1="0" x2=".72" y2="1">
      <stop offset="0" stop-color="#ff7a5c"/><stop offset=".34" stop-color="#cf2112"/><stop offset=".76" stop-color="#8f1309"/><stop offset="1" stop-color="#5a0804"/>
    </linearGradient>
    <linearGradient id="msGold" x1=".18" y1="0" x2=".72" y2="1">
      <stop offset="0" stop-color="#fff8dc"/><stop offset=".3" stop-color="#fbd45a"/><stop offset=".74" stop-color="#cf8c0b"/><stop offset="1" stop-color="#8a5404"/>
    </linearGradient>
    <radialGradient id="msEye" cx="45%" cy="40%" r="70%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".38" stop-color="#c9f9ff"/><stop offset=".78" stop-color="#38cdf5"/><stop offset="1" stop-color="#0b8fc4"/>
    </radialGradient>
    <radialGradient id="msSeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".45"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".16"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="107" rx="24" ry="6.6" fill="url(#msSeat)"/>
  <path d="M48 10.6C32.4 10.6 23.2 19.8 22.6 33.4L22 50c-.2 12 2.8 21.6 8.6 28.4 2.6 3 5.6 5.4 9 7.6 2.4 1.6 5.2 2.6 8.4 2.6s6-1 8.4-2.6c3.4-2.2 6.4-4.6 9-7.6 5.8-6.8 8.8-16.4 8.6-28.4l-.6-16.6C72.8 19.8 63.6 10.6 48 10.6z" fill="url(#msRed)" stroke="#4a0803" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M27.4 31.2c1.8-11.2 9.8-18.4 20.6-18.4 4.2 0 7.8 1 10.6 2.8-4 1.4-6.8 3.6-8.8 6.8-3.6 5.8-9.6 8.6-16.2 8-2.4-.2-4.4 0-6.2.8z" fill="#ffa48c" opacity=".26"/>
  <path d="M48 22.6c-8.8 0-13.8 5-14.6 13.6l-.6 13.8c-.4 8.4 1.4 15.2 4.8 20.2 2 2.8 5.4 5.2 10.4 6.8 5-1.6 8.4-4 10.4-6.8 3.4-5 5.2-11.8 4.8-20.2l-.6-13.8C62 27.6 56.8 22.6 48 22.6z" fill="url(#msGold)" stroke="#8a5404" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M34 30.6c.8-2.6 2.4-4.8 4.6-6.4 2.8-2 6-3 9.4-3s6.6 1 9.4 3c2.2 1.6 3.8 3.8 4.6 6.4-3.8-2.4-8.6-3.6-14-3.6s-10.2 1.2-14 3.6z" fill="#fff8dc" opacity=".5"/>
  <path d="M33.4 39.4c1.4-6 6.8-9.6 14.6-9.6s13.2 3.6 14.6 9.6" fill="none" stroke="#fff3c4" stroke-width="1.5" opacity=".4"/>
  <path d="M33.2 39.6 47 43.4 46.4 50.4 34 46.4z" fill="#2a0d04" stroke="#5e3403" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M62.8 39.6 49 43.4 49.6 50.4 62 46.4z" fill="#2a0d04" stroke="#5e3403" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M34.4 41.4 46.2 44.6 45.8 48.6 35.2 45.4z" fill="url(#msEye)"/>
  <path d="M61.6 41.4 49.8 44.6 50.2 48.6 60.8 45.4z" fill="url(#msEye)"/>
  <path d="M37.6 43.4 45 45.4 44.8 46.6 37.8 44.6z" fill="#ffffff" opacity=".85"/>
  <path d="M58.4 43.4 51 45.4 51.2 46.6 58.2 44.6z" fill="#ffffff" opacity=".85"/>
  <ellipse cx="40.4" cy="44.6" rx="6" ry="3.4" fill="#63d8ff" opacity=".28"/>
  <ellipse cx="55.6" cy="44.6" rx="6" ry="3.4" fill="#63d8ff" opacity=".28"/>
  <path d="M48 35.2v8.4" stroke="#c98f0c" stroke-width="1.1" opacity=".3"/>
  <path d="M43.4 52.4h9.2c1.4 0 2.4 1 2.3 2.4l-.2 1.8c-.1 1.1-1.1 1.9-2.2 1.9h-9c-1.1 0-2.1-.8-2.2-1.9l-.2-1.8c-.1-1.4.9-2.4 2.3-2.4z" fill="#3d1404" opacity=".85"/>
  <path d="M44 56h8" stroke="#f0b13f" stroke-width=".9" opacity=".5" stroke-linecap="round"/>
  <path d="M38 59c-.2 5.4 1 9.6 3.4 12.6M58 59c.2 5.4-1 9.6-3.4 12.6" stroke="#8a5404" stroke-width="1.2" stroke-linecap="round" opacity=".38"/>
  <path d="M24.6 42.6c-1.6 7.8-1.2 15.6 1.4 22.4 1.4 3.8 3.2 6.8 5.4 9.4" fill="none" stroke="#f2c46a" stroke-width="1.6" stroke-linecap="round" opacity=".42"/>
  <path d="M71.4 42.6c1.6 7.8 1.2 15.6-1.4 22.4-1.4 3.8-3.2 6.8-5.4 9.4" fill="none" stroke="#f2c46a" stroke-width="1.6" stroke-linecap="round" opacity=".42"/>
  <ellipse cx="23.8" cy="54.6" rx="4.2" ry="5.8" fill="url(#msGold)" stroke="#7d4b04" stroke-width=".9"/>
  <ellipse cx="72.2" cy="54.6" rx="4.2" ry="5.8" fill="url(#msGold)" stroke="#7d4b04" stroke-width=".9"/>
  <path d="M22 52.4c.8-1.2 1.8-2 3.2-2.2M74 52.4c-.8-1.2-1.8-2-3.2-2.2" fill="none" stroke="#fff8dc" stroke-width="1" stroke-linecap="round" opacity=".7"/>
  <path d="M32.6 21.8c3.6-4.6 8.8-7 15-7 3.2 0 6 .6 8.4 1.8" fill="none" stroke="#ffd9cd" stroke-width="2" stroke-linecap="round" opacity=".5"/>
  <path d="M39.4 84.6c2.6 2 5.6 3.2 8.6 3.2s6-1.2 8.6-3.2" fill="none" stroke="#380603" stroke-width="1.8" stroke-linecap="round" opacity=".26"/>`,
  gemini: `
  <defs>
    <linearGradient id="gmGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe9a8"/><stop offset=".5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/>
    </linearGradient>
    <radialGradient id="gmCore" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff7d6" stop-opacity=".95"/>
      <stop offset=".45" stop-color="#fb923c" stop-opacity=".55"/>
      <stop offset="1" stop-color="#c2410c" stop-opacity="0"/>
    </radialGradient>
    <filter id="gmBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.6"/>
    </filter>
    <radialGradient id="gmSeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".42"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".16"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="109" rx="25" ry="7" fill="url(#gmSeat)"/>
  <g filter="url(#gmBlur)" opacity=".55">
    <circle cx="48" cy="56" r="34" fill="none" stroke="#fb923c" stroke-width="4"/>
    <circle cx="48" cy="56" r="20" fill="none" stroke="#fdba74" stroke-width="3"/>
  </g>
  <circle cx="48" cy="56" r="33.5" fill="url(#gmCore)" opacity=".45"/>
  <circle cx="48" cy="56" r="34" fill="none" stroke="#fbbf24" stroke-width="1.8" opacity=".95"/>
  <circle cx="48" cy="56" r="30.6" fill="none" stroke="#fdba74" stroke-width="1" opacity=".8" stroke-dasharray="2.6 3.4"/>
  <path d="M48 30 L52.2 45.8 L66.4 37.6 L58.2 51.8 L74 56 L58.2 60.2 L66.4 74.4 L52.2 66.2 L48 82 L43.8 66.2 L29.6 74.4 L37.8 60.2 L22 56 L37.8 51.8 L29.6 37.6 L43.8 45.8 Z" fill="none" stroke="url(#gmGold)" stroke-width="1.5" stroke-linejoin="round" opacity=".95"/>
  <rect x="27.8" y="35.8" width="40.4" height="40.4" fill="none" stroke="#fdba74" stroke-width="1.2" opacity=".85" transform="rotate(45 48 56)"/>
  <rect x="33.6" y="41.6" width="28.8" height="28.8" fill="none" stroke="#fbbf24" stroke-width="1.3" opacity=".9"/>
  <circle cx="48" cy="56" r="17.4" fill="none" stroke="#fb923c" stroke-width="1.4" opacity=".9"/>
  <path d="M56 36.6 L54.1 49.9 L67.4 48 L56.6 56 L67.4 64 L54.1 62.1 L56 75.4 L48 64.6 L40 75.4 L41.9 62.1 L28.6 64 L39.4 56 L28.6 48 L41.9 49.9 L40 36.6 L48 47.4 Z" fill="none" stroke="#fde68a" stroke-width="1" opacity=".7" stroke-linejoin="round"/>
  <circle cx="48" cy="56" r="8.4" fill="none" stroke="#fed7aa" stroke-width="1.2" opacity=".9"/>
  <path d="M48 48.5 L48.9 53.8 L53.3 50.7 L50.2 55.1 L55.5 56 L50.2 56.9 L53.3 61.3 L48.9 58.2 L48 63.5 L47.1 58.2 L42.7 61.3 L45.8 56.9 L40.5 56 L45.8 55.1 L42.7 50.7 L47.1 53.8 Z" fill="#fff7d6" opacity=".95"/>
  <g stroke="#fdba74" stroke-width="1.4" stroke-linecap="round" opacity=".85">
    <path d="M48 19.4v4.2M48 88.4v4.2M11.4 56h4.2M80.4 56h4.2"/>
    <path d="M22.2 30.2l3 3M71 79l3 3M73.8 30.2l-3 3M25 79l-3 3"/>
  </g>
  <g fill="#fde68a" opacity=".9">
    <circle cx="48" cy="18.6" r="1.5"/><circle cx="48" cy="93.4" r="1.5"/>
    <circle cx="10.6" cy="56" r="1.5"/><circle cx="85.4" cy="56" r="1.5"/>
  </g>
  <path d="M20 40.6a34 34 0 0 1 19.4-16.4" fill="none" stroke="#fff3c4" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`,
  cue: `
  <defs>
    <linearGradient id="cqSteel" x1=".08" y1="0" x2=".6" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".18" stop-color="#eaf1f8"/><stop offset=".52" stop-color="#b9c9da"/><stop offset=".82" stop-color="#93a8bd"/><stop offset="1" stop-color="#6b8096"/>
    </linearGradient>
    <linearGradient id="cqTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c3d2e1"/>
    </linearGradient>
    <linearGradient id="cqSteelDark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b6c6d6"/><stop offset="1" stop-color="#54677d"/>
    </linearGradient>
    <linearGradient id="cqLeather" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7d5024"/><stop offset=".3" stop-color="#a9713c"/><stop offset=".72" stop-color="#6b411a"/><stop offset="1" stop-color="#46280f"/>
    </linearGradient>
    <radialGradient id="cqSeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".46"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".18"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="107" rx="26" ry="7.4" fill="url(#cqSeat)"/>
  <g transform="translate(48 52) rotate(-13)">
    <rect x="-5.6" y="-4" width="11.2" height="40" rx="4" fill="url(#cqLeather)" stroke="#3a210e" stroke-width=".9"/>
    <g stroke="#3a210e" stroke-width="1.4" opacity=".5" stroke-linecap="round">
      <path d="M-5 -.6 5 1.4M-5 5.4 5 7.4M-5 11.4 5 13.4M-5 17.4 5 19.4M-5 23.4 5 25.4"/>
    </g>
    <g stroke="#dcbb90" stroke-width=".9" opacity=".36" stroke-linecap="round">
      <path d="M-4.8 2.4 4.8 4.2M-4.8 8.4 4.8 10.2M-4.8 14.4 4.8 16.2M-4.8 20.4 4.8 22.2"/>
    </g>
    <rect x="-7.4" y="29.4" width="14.8" height="8.2" rx="3.8" fill="url(#cqSteelDark)" stroke="#4a5d73" stroke-width=".9"/>
    <path d="M-6.6 32.6h13.2" stroke="#eef6ff" stroke-width="1.2" opacity=".6" stroke-linecap="round"/>
    <path d="M-5.8 37c-4.2 4.2-4.6 9.2-1 12.6 3.2 3 8.4 2.8 11.9-.6" fill="none" stroke="#48280f" stroke-width="5.4" stroke-linecap="round"/>
    <path d="M-5.8 37c-4.2 4.2-4.6 9.2-1 12.6 3.2 3 8.4 2.8 11.9-.6" fill="none" stroke="#8a5a2b" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M-9.6 -8.2h19.2l-1.6 6.4h-16z" fill="url(#cqSteelDark)" stroke="#4d6076" stroke-width=".9"/>
    <path d="M-25 -46h50a4.4 4.4 0 0 1 4.4 4.4v29.8a4.4 4.4 0 0 1-4.4 4.4h-50a4.4 4.4 0 0 1-4.4-4.4V-41.6A4.4 4.4 0 0 1-25-46z" fill="url(#cqSteel)" stroke="#4a5d73" stroke-width="1.3"/>
    <path d="M-25 -46h50a4.4 4.4 0 0 1 4.4 4.4v5.2h-58.8v-5.2A4.4 4.4 0 0 1-25-46z" fill="url(#cqTop)" stroke="#7d90a6" stroke-width=".8"/>
    <path d="M-29.4 -35.4h58.8v26.4h-58.8z" fill="#c3d2e1" opacity=".18"/>
    <path d="M-29.4 -35.4h58.8" stroke="#8b9fb4" stroke-width="1" opacity=".7"/>
    <path d="M-29.4 -13.4h58.8v1.6h-58.8z" fill="#4d6076" opacity=".4"/>
    <path d="M-29.4 -6.6h58.8" stroke="#556a80" stroke-width="1.6" opacity=".35"/>
    <g fill="none" stroke="#5b6f86" stroke-width="1.5" stroke-linejoin="round" opacity=".8">
      <path d="M-15.4 -31.6 -10.6 -26.4 -15.4 -21.2 -20.2 -26.4Z"/>
      <path d="M0 -31.6 4.8 -26.4 0 -21.2 -4.8 -26.4Z"/>
      <path d="M15.4 -31.6 20.2 -26.4 15.4 -21.2 10.6 -26.4Z"/>
    </g>
    <g fill="#7f93a9">
      <circle cx="-15.4" cy="-26.4" r="1.5"/><circle cx="0" cy="-26.4" r="1.5"/><circle cx="15.4" cy="-26.4" r="1.5"/>
    </g>
    <path d="M-29.4 -42.4c-5 12.4-6 25.6-3 38.4" fill="none" stroke="#ffffff" stroke-width="2" opacity=".55" stroke-linecap="round"/>
    <g fill="#eaf2fb" stroke="#6b7f95" stroke-width=".8">
      <circle cx="-27.4" cy="-43.4" r="1.4"/><circle cx="27.4" cy="-43.4" r="1.4"/>
      <circle cx="-27.4" cy="-9.6" r="1.4"/><circle cx="27.4" cy="-9.6" r="1.4"/>
    </g>
    <path d="M24.6 -46c3.6 1.8 5.2 5.8 5.2 12.4v26.2" fill="none" stroke="#5a6d83" stroke-width="1.6" opacity=".45"/>
    <path d="M-28 -12.4c8.4 1.6 48.6 1.6 56 0" fill="none" stroke="#435668" stroke-width="1.4" opacity=".3"/>
  </g>
  <g fill="#bae6fd" opacity=".95">
    <path d="M17.4 28.6l-3.4 7.6h2.8l-2 5.6 5.8-8.2h-3l1.8-5z"/>
    <path d="M78.6 74.6l-2.6 5.8h2.2l-1.6 4.2 4.4-6.2h-2.3l1.3-3.8z" opacity=".8"/>
  </g>
  <g stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" opacity=".8">
    <path d="M27.6 86.6l-4 3.4M30.4 90.6l-5.2 1.4"/>
    <path d="M68.6 28.6l3.6-3M70.4 33.2l5-1.2"/>
  </g>
  <g fill="#e0f2fe">
    <circle cx="21.6" cy="26.4" r="1.2" opacity=".85"/><circle cx="75.4" cy="82.4" r="1.2" opacity=".8"/>
    <circle cx="33.4" cy="92.4" r="1" opacity=".65"/><circle cx="66.4" cy="25.6" r="1" opacity=".6"/>
  </g>`,
  vooy: `
  <defs>
    <linearGradient id="vySkin" x1=".2" y1="0" x2=".72" y2="1">
      <stop offset="0" stop-color="#a6f6ba"/><stop offset=".38" stop-color="#4fc46c"/><stop offset="1" stop-color="#0f5b28"/>
    </linearGradient>
    <linearGradient id="vyFinger" x1="0" y1="0" x2=".85" y2="1">
      <stop offset="0" stop-color="#b5ffc8"/><stop offset=".4" stop-color="#5ccb77"/><stop offset="1" stop-color="#177034"/>
    </linearGradient>
    <radialGradient id="vySeat" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0b2545" stop-opacity=".5"/>
      <stop offset=".6" stop-color="#0b2545" stop-opacity=".2"/>
      <stop offset="1" stop-color="#0b2545" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="48" cy="107" rx="27" ry="7.2" fill="url(#vySeat)"/>
  <path d="M34.6 86.4h26.8c3 0 5.4 2.4 5.6 5.4l.4 6.4c.2 3-1.8 5.2-4.8 5.2H33.4c-3 0-5-2.2-4.8-5.2l.4-6.4c.2-3 2.6-5.4 5.6-5.4z" fill="url(#vySkin)" stroke="#12552a" stroke-width="1.3"/>
  <path d="M21 63c0-8 1.4-13.6 4.4-16.4-1-3.2-.4-6.4 2-8.4 2.6-2.2 6-2 8.2.4 1.6-2.2 4.2-3.2 6.8-2.4 2.8.8 4.6 3.2 4.8 6.2 1.4-2.4 4-3.8 6.8-3.4 2.8.4 4.8 2.6 5.2 5.4 2.8-.6 5.6.6 7.2 3 1.6 2.4 1.6 5.6 0 8.4 3.4 2.6 5.2 8 5.2 15.4v16.4c0 9.6-5.8 15.2-15.4 15.2H36.4c-9.6 0-15.4-5.6-15.4-15.2z" fill="url(#vySkin)" stroke="#12552a" stroke-width="1.4" stroke-linejoin="round"/>
  <g fill="#e6ffe9" opacity=".22">
    <path d="M23.6 52h48.8v18H23.6z"/>
  </g>
  <g fill="url(#vyFinger)" stroke="#12552a" stroke-width="1.3">
    <path d="M23.4 40.6c0-4.6 2.6-7.6 6.6-7.6s6.6 3 6.6 7.6V64H23.4z"/>
    <path d="M36.6 38.6c0-4.8 2.7-7.9 6.8-7.9s6.8 3.1 6.8 7.9V64H36.6z"/>
    <path d="M50.2 38.9c0-4.8 2.7-7.9 6.8-7.9s6.8 3.1 6.8 7.9V64H50.2z"/>
    <path d="M63.8 40.6c0-4.6 2.6-7.6 6.6-7.6s6.6 3 6.6 7.6V64H63.8z"/>
  </g>
  <g fill="#ffffff" opacity=".28">
    <path d="M25.6 38.6c.6-2.4 2.4-4 4.8-4.2-1 1.8-1.4 4-1.4 6.4v4h-3.4z"/>
    <path d="M38.8 36.6c.6-2.4 2.4-4 4.8-4.2-1 1.8-1.4 4-1.4 6.4v4h-3.4z"/>
    <path d="M52.4 36.9c.6-2.4 2.4-4 4.8-4.2-1 1.8-1.4 4-1.4 6.4v4h-3.4z"/>
    <path d="M66 38.6c.6-2.4 2.4-4 4.8-4.2-1 1.8-1.4 4-1.4 6.4v4H66z"/>
  </g>
  <g stroke="#0f4d26" stroke-width="1.4" stroke-linecap="round" opacity=".4" fill="none">
    <path d="M36.8 42.6c-.4 6 0 13 .6 20M50.4 42.9c-.4 6 0 13 .6 20M64 42.6c-.4 6 0 13 .6 20"/>
  </g>
  <path d="M22.8 66.4c-2.4 7.8 1.6 13.8 8.6 15.6 6.4 1.6 12.8-.6 17.2-5.4" fill="none" stroke="#12552a" stroke-width="15.6" stroke-linecap="round"/>
  <path d="M22.8 66.4c-2.4 7.8 1.6 13.8 8.6 15.6 6.4 1.6 12.8-.6 17.2-5.4" fill="none" stroke="url(#vySkin)" stroke-width="13" stroke-linecap="round"/>
  <path d="M20 67.8c-1.6 6.8 1.8 12 8 13.6" fill="none" stroke="#c8ffd8" stroke-width="1.8" stroke-linecap="round" opacity=".5"/>
  <path d="M29.4 69.2c2.8 3.4 6.8 5.2 11 4.8" fill="none" stroke="#0f4d26" stroke-width="1.4" stroke-linecap="round" opacity=".4"/>
  <path d="M39.4 75.4c-1.4 3.6-1.2 7 .6 9.8" fill="none" stroke="#0f4d26" stroke-width="1.4" stroke-linecap="round" opacity=".35"/>
  <path d="M28 81.4c11 2.4 22 2 32.4-1.4" fill="none" stroke="#0f4d26" stroke-width="1.6" opacity=".3"/>
  <path d="M24.6 52.6c-.4 7.6 1 14 4 18.6" fill="none" stroke="#d8ffe4" stroke-width="1.6" stroke-linecap="round" opacity=".38"/>
  <path d="M71.4 56c.4 6.6-.6 12-3.2 15.8" fill="none" stroke="#d8ffe4" stroke-width="1.5" stroke-linecap="round" opacity=".3"/>`,
};

/* 히어로 정체성 — 지도 상세·비서현황 카드에 함께 표시 */
const HERO = {
  huhu: '캡틴 아메리카',
  muse: '아이언맨',
  cue: '토르',
  gemini: '닥터 스트레인지',
  vooy: '헐크'
};

/* 같은 아이콘이 화면 여러 곳(지도·상세·채팅·비서현황)에 들어가므로
   그라디언트/필터 id가 겹치지 않게 사본마다 접미사를 붙인다.
   (겹치면 브라우저가 숨은 첫 사본의 정의를 잡아 색이 깨진다) */
let artSeq = 0;
function charArt(id) {
  const art = CHAR_ART[id];
  if (!art) return null;
  const n = ++artSeq;
  const html = art
    .replace(/id="([\w-]+)"/g, (m, k) => `id="${k}-${n}"`)
    .replace(/url\(#([\w-]+)\)/g, (m, k) => `url(#${k}-${n})`);
  return `<svg class="char-svg" viewBox="0 0 96 120" aria-hidden="true" focusable="false">${html}</svg>`;
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
  'chat-latest', 'chat-latest-count',
  'sender-chips', 'sender-toggle', 'sender-toggle-emoji', 'sender-toggle-name', 'composer-panel',
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
  /* 2026-11-28 호칭 변경: 과거 글 본문·멘션에 남은 '승후(님)'도 화면에서는 '대장(님)'으로 보여 준다.
     DB 원본(office_messages.content)은 건드리지 않아 되돌리기 쉽다. */
  const normalized = String(text == null ? '' : text)
    .replace(/승후\s*님/g, '대장님')
    .replace(/승후/g, '대장');
  return esc(normalized).replace(/@(대장|후후|뮤즈|제미나이|Cue|Vooy)/g, '<span class="mention">@$1</span>');
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
  '후후': 'huhu', huhu: 'huhu',
  /* 대장 = 예전 '승후'. 과거 행(sender: "승후")과 새 행(sender: "대장") 둘 다 같은 사람으로 묶는다 */
  '대장': 'seunghu', '대장님': 'seunghu', '승후': 'seunghu', seunghu: 'seunghu',
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
  /* DB 최초 로드·동기화 완료 — 회의실 탭이 열려 있으면 그때도 바닥(최신)으로 */
  if (activeTab === 'chat' && !chatBootJumped) {
    chatBootJumped = true;
    jumpChatToBottom();
  }
  updateChatLatestBtn();
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
      data-room="${esc(r.id)}" style="left:${Number(r.x)}%;top:${Number(r.y)}%"
      aria-label="${esc(r.emoji)} ${esc(r.name)} — 회의실에서 보기" title="${esc(r.name)} 회의실로 이동">
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
      </div>
      ${c.room ? `<button class="detail-jump" type="button" data-open-room="${esc(c.room)}">${esc(r.emoji)} ${esc(r.name)} 회의실에서 보기 →</button>` : ''}`;
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
      </div>
      <button class="detail-jump" type="button" data-open-room="${esc(r.id)}">${esc(r.emoji)} ${esc(r.name)} 회의실에서 보기 →</button>`;
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

/* 지도 위 방 핀·라벨, 상단 상태 칩을 누르면 회의실 탭에서 그 방 필터로 바로 이동 */
function openRoomInChat(roomId) {
  const id = String(roomId == null ? '' : roomId).trim();
  if (!(state.rooms || []).some((r) => r.id === id)) return;
  activeRoom = id;
  write(KEY.room, activeRoom);
  selected = { type: 'room', id };
  renderMap();
  renderRoomChips();
  renderDetail();
  renderChatRooms();
  renderChat();
  setTab('chat');
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

/* ---------------- 카톡형 컴포저: 접힘 ↔ 펼침 ---------------- */
let composerSuppressOpen = false;

function currentSenderId() {
  const v = el.chatSender && el.chatSender.value;
  return COMPOSER_IDS.includes(v) ? v : OWNER_ID;
}

function syncSenderUI() {
  const cur = currentSenderId();
  const c = charById(cur);
  if (el.senderToggleEmoji) el.senderToggleEmoji.textContent = c.emoji || '👑';
  if (el.senderToggleName) el.senderToggleName.textContent = c.name;
  if (el.senderChips) {
    el.senderChips.querySelectorAll('[data-sender]').forEach((b) => {
      const on = b.dataset.sender === cur;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
}

function autoGrowComposer() {
  const t = el.chatInput;
  if (!t) return;
  if (!el.chatForm.classList.contains('is-open')) { t.style.height = ''; return; }
  t.style.height = 'auto';
  t.style.height = `${Math.min(110, Math.max(40, t.scrollHeight))}px`;
}

function setComposerOpen(open) {
  if (!el.chatForm) return;
  const isOpen = !!open;
  el.chatForm.classList.toggle('is-open', isOpen);
  if (el.senderToggle) el.senderToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  /* 접힌 동안엔 패널 안 칩을 탭·탭키 대상에서 뺀다 */
  if (el.composerPanel) el.composerPanel.inert = !isOpen;
  if (!isOpen) {
    if (el.chatInput) el.chatInput.style.height = '';
  } else {
    autoGrowComposer();
  }
}

/* 칩 선택 뒤 입력창으로 돌아갈 때 패널이 다시 펼쳐지지 않게 */
function focusComposerQuietly() {
  if (!el.chatInput) return;
  composerSuppressOpen = true;
  el.chatInput.focus();
  composerSuppressOpen = false;
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

  if (el.senderChips) {
    el.senderChips.innerHTML = COMPOSER_IDS.map((id) => {
      const c = charById(id);
      return `<button class="sender-chip" type="button" data-sender="${esc(c.id)}" aria-pressed="false">${esc(c.emoji)} ${esc(c.name)}</button>`;
    }).join('');
  }
  syncSenderUI();
}

function renderChatRooms() {
  const rooms = state.rooms || [];
  const items = [{ id: 'all', name: '전체', emoji: '🗂️' }].concat(rooms);
  el.chatRooms.innerHTML = items.map((r) => `
    <button class="chip ${activeRoom === r.id ? 'is-active' : ''}" type="button" data-chat-room="${esc(r.id)}">
      ${esc(r.emoji)} ${esc(r.name)}
    </button>`).join('');
}

/* ---------------- 회의실 자동 스크롤 (카톡처럼 최신 메시지 = 맨 아래) --------------
   · 회의실 탭 진입 · 지도/칩에서 방 이동 · 방 필터 변경 · 전송 직후 · 최초 DB 로드
     → 레이아웃·폰트 반영을 몇 번 더 보정해 폰에서도 확실히 바닥에 붙인다.
   · 사용자가 위로 올려 옛 글을 읽는 중에는 45초 폴링으로 화면을 끌어내리지 않고
     우측 하단 ↓ 최신 버튼에만 새 글 개수를 표시한다. */
const CHAT_BOTTOM_SLACK = 56;   /* 바닥에서 이만큼 안쪽이면 '바닥을 보고 있다'로 본다 */
let chatPinnedBottom = true;    /* 사용자가 바닥에 붙어 있는지 */
let chatTailSeen = null;        /* 마지막으로 그린 최신 메시지 식별자 */
let chatNewCount = 0;           /* 안 보는 동안 들어온 새 글 수 */
let chatJumpTimers = [];
let chatBootJumped = false;     /* 첫 데이터 렌더에서 한 번은 무조건 바닥으로 */

function chatScrollMax() {
  const doc = document.documentElement;
  return Math.max(0, doc.scrollHeight - window.innerHeight);
}

function chatIsAtBottom() {
  return chatScrollMax() - window.scrollY <= CHAT_BOTTOM_SLACK;
}

function stopChatJump() {
  chatJumpTimers.forEach((t) => clearTimeout(t));
  chatJumpTimers = [];
}

function updateChatLatestBtn() {
  if (!el.chatLatest) return;
  el.chatLatest.hidden = !(activeTab === 'chat' && !chatPinnedBottom);
  if (el.chatLatestCount) {
    el.chatLatestCount.hidden = chatNewCount < 1;
    el.chatLatestCount.textContent = chatNewCount > 9 ? '9+' : String(chatNewCount);
  }
}

function applyChatJump() {
  window.scrollTo(0, chatScrollMax());
  chatPinnedBottom = true;
  if (chatNewCount) chatNewCount = 0;
  updateChatLatestBtn();
}

/* 사용자가 그새 위로 올라갔으면 보정 스크롤을 포기한다 */
function chatJumpGuard() {
  if (activeTab !== 'chat' || !chatPinnedBottom) return;
  applyChatJump();
}

function jumpChatToBottom() {
  if (activeTab !== 'chat' || !el.msgList) return;
  stopChatJump();
  applyChatJump();
  /* 레이아웃 반영 뒤 두 프레임 더 + 느린 모바일 보정(폰트·줄바꿈·입력바 펼침) */
  requestAnimationFrame(() => {
    applyChatJump();
    requestAnimationFrame(chatJumpGuard);
  });
  chatJumpTimers.push(
    setTimeout(chatJumpGuard, 80),
    setTimeout(chatJumpGuard, 240),
    setTimeout(chatJumpGuard, 600)
  );
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(chatJumpGuard);
  }
}

/* 창 스크롤이 바닥에서 떨어지면 ↓ 최신 버튼을 띄운다 */
function onChatScroll() {
  if (activeTab !== 'chat') return;
  const atBottom = chatIsAtBottom();
  if (atBottom === chatPinnedBottom) {
    if (atBottom && chatNewCount) { chatNewCount = 0; updateChatLatestBtn(); }
    return;
  }
  chatPinnedBottom = atBottom;
  if (atBottom) chatNewCount = 0;
  updateChatLatestBtn();
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
  const tail = msgs.length
    ? `${msgs[msgs.length - 1].id}|${msgs[msgs.length - 1].at}`
    : 'empty';
  const isNewArrival = chatTailSeen !== null && tail !== chatTailSeen;
  chatTailSeen = tail;
  updateChatHint();
  /* 새 글이 들어왔을 때: 바닥을 보고 있었으면 따라 내려가고,
     옛 글을 읽는 중이면 화면을 끌어내리지 않고 새 글 개수만 표시 */
  if (isNewArrival && activeTab === 'chat') {
    if (chatPinnedBottom) jumpChatToBottom();
    else { chatNewCount += 1; updateChatLatestBtn(); }
  }
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
  if (!opts || opts.scroll !== false) {
    /* 회의실은 카톡처럼 열자마자 최신 메시지(맨 아래) — 다른 탭은 위에서부터 */
    if (tab !== 'chat') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (tab === 'chat') {
    updateChatHint();
    /* 적어 둔 글은 펼친 상태로 되살림 */
    if (el.chatInput && el.chatInput.value.trim()) setComposerOpen(true);
    /* 데이터가 이미 있으면 여기서 바로 붙이고, 첫 로드 전이면 renderAll이 한 번 더 붙인다 */
    if (state) chatBootJumped = true;
    jumpChatToBottom();
  } else {
    setComposerOpen(false);
    chatNewCount = 0;
    if (el.chatLatest) el.chatLatest.hidden = true;
  }
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
  if (jump) { openRoomInChat(jump.dataset.roomJump); }
});

el.mapStage.addEventListener('click', (e) => {
  const char = e.target.closest('[data-char]');
  if (char) { selectOnMap('char', char.dataset.char, true); return; }
  const room = e.target.closest('[data-room]');
  if (room) openRoomInChat(room.dataset.room);
});

el.mapDetail.addEventListener('click', (e) => {
  const jump = e.target.closest('[data-open-room]');
  if (jump) { openRoomInChat(jump.dataset.openRoom); return; }
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
  jumpChatToBottom();
});

window.addEventListener('scroll', onChatScroll, { passive: true });

if (el.chatLatest) {
  el.chatLatest.addEventListener('click', () => {
    jumpChatToBottom();
    updateChatLatestBtn();
  });
}

if (el.senderToggle) {
  el.senderToggle.addEventListener('click', () => {
    setComposerOpen(!el.chatForm.classList.contains('is-open'));
  });
}

if (el.senderChips) {
  el.senderChips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sender]');
    if (!b) return;
    el.chatSender.value = b.dataset.sender;
    syncSenderUI();
    if (!el.chatInput.value.trim()) setComposerOpen(false);
    focusComposerQuietly();
  });
}

el.chatInput.addEventListener('focus', () => {
  if (!composerSuppressOpen) setComposerOpen(true);
});
el.chatInput.addEventListener('input', autoGrowComposer);
el.chatInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  el.chatInput.blur();
  setComposerOpen(false);
});

/* 입력창 바깥을 누르면 내용이 비어 있을 때 슬림 바로 접기 */
document.addEventListener('pointerdown', (e) => {
  if (!el.chatForm || el.chatForm.contains(e.target)) return;
  if (!el.chatInput.value.trim()) setComposerOpen(false);
}, true);

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
  setComposerOpen(false);
  el.chatInput.blur();
  autoGrowComposer();
  /* 내 새 메시지가 바로 보이도록 맨 아래로 */
  jumpChatToBottom();
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
