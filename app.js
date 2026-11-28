/* =========================================================
   어벤져스타워 — app.js (Vanilla JS, no build step)
   데이터: data/state.json(기본 시드) + Supabase 실시간 DB
   로컬 캐시: localStorage (DB가 막힐 때 자동 폴백)

   2026-11-28 UX 개편
   - 회의실 = 카톡/텔레그램식 메신저: 방 목록 → 대화방(모바일 풀스크린)
   - 사진·동영상·파일 첨부, 답장, 멘션 자동완성, 안 읽은 글 배지
   - 메시지 증분 폴링(4초) + Supabase Realtime 소켓(가능할 때)
   - iOS Safari: 대화방을 visualViewport 에 고정해 키보드 위에 입력창이 붙게
   ========================================================= */
'use strict';

const STATE_URL = 'data/state.json';

/* ---------------- Supabase 실시간 DB --------------
   publishable 키는 공개용입니다(읽기/쓰기 허용 정책).
   상세 규칙은 AGENT_SYNC.md 참고. */
const SUPABASE = {
  url: 'https://qebbpadabmkeeecnzfrm.supabase.co',
  key: 'sb_publishable_dgSAZviMpxNeJ0YYik4FZw_HIPQeRdg',
  bucket: 'office-files',          /* Supabase Storage 공개 버킷 (없으면 작은 파일은 본문에 내장) */
  pollFastMs: 4000,                /* 대화방을 보고 있을 때 새 메시지 확인 주기 */
  pollSlowMs: 15000,               /* 그 외 화면 */
  fullMs: 60000,                   /* 작업·메모·비서 상태까지 전체 재동기화 */
  tables: {
    messages: 'office_messages',
    tasks: 'office_tasks',
    memos: 'office_memos',
    agents: 'office_agents'
  }
};

/* 첨부 한도 — 파일 저장소(버킷)가 없을 때 본문에 내장할 수 있는 크기 */
const INLINE_MAX = 600 * 1024;
const UPLOAD_MAX = 50 * 1024 * 1024;

/* 실시간 DB 상태 */
const sb = {
  ok: false,
  at: null,
  error: null,
  messages: null,
  tasks: null,
  memos: null,
  agents: null,
  realtime: 'off',   /* off | connecting | on | error */
  storage: null      /* null(모름) | true | false */
};

const KEY = {
  chat: 'seunghuOffice.chat.v1',
  tasks: 'seunghuOffice.tasks.v1',
  memos: 'seunghuOffice.memos.v1',
  pins: 'seunghuOffice.pins.v1',
  memoDeleted: 'seunghuOffice.memoDeleted.v1',
  motion: 'seunghuOffice.motion.v1',
  tab: 'seunghuOffice.tab.v1',
  room: 'seunghuOffice.room.v1',
  seen: 'seunghuOffice.seen.v1',
  draft: 'seunghuOffice.draft.v1',
  taskFilter: 'seunghuOffice.taskFilter.v1'
};

const OWNER_ID = 'seunghu';
const COMPOSER_IDS = ['seunghu', 'huhu', 'muse', 'gemini', 'cue', 'vooy'];
/* 카드 왼쪽 액센트 색 (스타크 블루 · 시안 · 히어로 골드 순환) */
const TINTS = ['#0284c7', '#06b6d4', '#d97706'];
const GROUP_GAP_MS = 5 * 60 * 1000;

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
    return true;
  } catch (e) {
    /* 사파리 프라이빗 모드·용량 초과: 저장 실패는 조용히 넘어감 */
    return false;
  }
}

/* ---------------- states ---------------- */
const VALID_TABS = ['map', 'chat', 'work', 'status', 'memo'];
let state = null;
let activeTab = read(KEY.tab, null) || 'map';
if (!VALID_TABS.includes(activeTab)) activeTab = 'map';
let activeRoom = read(KEY.room, null) || 'boardroom';
let motionOn = read(KEY.motion, true) !== false;
let selected = null; // {type:'char'|'room', id}
let refreshing = false;
let taskFilter = read(KEY.taskFilter, 'all') || 'all';

const el = {};
['sync-btn', 'sync-time', 'load-error', 'tabbar', 'tab-badge-chat', 'app-main',
  'hq-summary', 'hq-stats', 'room-chips', 'map-stage', 'map-img', 'room-labels', 'characters', 'map-detail',
  'recent-list', 'recent-card',
  'room-list', 'room-pane-foot', 'live-pill', 'chat-room', 'cr-back', 'cr-emoji', 'cr-name', 'cr-sub',
  'cr-search-btn', 'cr-search', 'cr-search-input', 'cr-search-count', 'cr-rooms', 'cr-body',
  'msg-list', 'chat-latest', 'chat-latest-txt', 'drop-hint',
  'chat-form', 'mention-pop', 'cmp-reply', 'cmp-as', 'cmp-tray', 'cmp-plus', 'chat-input', 'cmp-who', 'cmp-send',
  'cmp-menu', 'file-media', 'file-any',
  'task-new', 'task-filter', 'project-list',
  'link-panel', 'agent-cards', 'schedule-list',
  'memo-form', 'memo-input', 'memo-search', 'memo-list',
  'view-chat', 'sheet', 'sheet-backdrop', 'sheet-body', 'sheet-title', 'sheet-sub', 'sheet-emoji', 'sheet-close',
  'viewer', 'viewer-img', 'viewer-name', 'viewer-save', 'viewer-close', 'toast-wrap'
].forEach(id => {
  el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
});

const mqDesktop = window.matchMedia('(min-width: 900px)');
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

/* ---------------- utils ---------------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const pad = (n) => String(n).padStart(2, '0');
const ts = (iso) => {
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : t;
};

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

/* 카톡식 '오후 3:12' */
function fmtTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}`;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
function fmtDayLabel(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
}

/* 목록용: 오늘이면 시각, 어제면 '어제', 올해면 'M월 D일' */
function fmtListTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(now) - day0(d)) / 86400000);
  if (diff === 0) return fmtTime(iso);
  if (diff === 1) return '어제';
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/* '3분 전' */
function fmtAgo(iso) {
  const t = ts(iso);
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return fmtListTime(iso);
}

function fmtSize(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)}KB`;
  return `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)}MB`;
}

function pillClass(stateName) {
  if (stateName === 'active' || stateName === 'on') return 'is-on';
  if (stateName === 'idle') return 'is-idle';
  if (stateName === 'done') return 'is-done';
  return 'is-wait';
}

function statusTone(text) {
  const s = String(text || '');
  if (/완료|발행 완료|done/i.test(s)) return 'is-done';
  if (/가동|진행|협업|자문|작업|운영|active|on/i.test(s)) return 'is-on';
  if (/대기|보류|준비|워밍업|idle/i.test(s)) return 'is-idle';
  return 'is-wait';
}

function charById(id) {
  const list = (state && state.characters) || [];
  return list.find((c) => c.id === id) || { id, name: id, emoji: '👤', role: '', color: '#64748b' };
}

function roomById(id) {
  const list = (state && state.rooms) || [];
  if (id === 'all') return { id: 'all', name: '전체', emoji: '🗂️', state: 'on' };
  return list.find((r) => r.id === id) || { id, name: id, emoji: '🚪', status: '', state: 'idle' };
}

/* 팀 메타 — 비서현황 카드 배지용 (장은 후후·뮤즈) */
function teamById(id) {
  const list = (state && state.teams) || [];
  return list.find((t) => t.id === id) || null;
}

function teamOf(charId) {
  return ((state && state.teams) || []).find((t) => (t.members || []).includes(charId)) || null;
}

/* 외부 발신자(캐릭터가 아닌 이름)용 이니셜 아바타 색 */
function hashColor(s) {
  let h = 0;
  String(s || '').split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) | 0; });
  const palette = ['#0284c7', '#0d9488', '#7c3aed', '#db2777', '#d97706', '#2563eb', '#059669'];
  return palette[Math.abs(h) % palette.length];
}

function avatarHtml(authorId, name, cls) {
  const art = authorId ? charArt(authorId) : null;
  const c = authorId ? charById(authorId) : null;
  const tint = (c && c.color) || hashColor(name);
  if (art) return `<span class="${cls}" style="--tint:${esc(tint)}" aria-hidden="true">${art}</span>`;
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return `<span class="${cls} is-initial" style="--tint:${esc(tint)}" aria-hidden="true">${esc(initial)}</span>`;
}

/* 2026-11-28 호칭 변경: 과거 글 본문·멘션에 남은 '승후(님)'도 화면에서는 '대장(님)'으로 보여 준다.
   DB 원본(office_messages.content)은 건드리지 않아 되돌리기 쉽다. */
function normalizeNames(text) {
  return String(text == null ? '' : text)
    .replace(/승후\s*님/g, '대장님')
    .replace(/승후/g, '대장');
}

const MENTION_RE = /@(대장님|대장|후후|뮤즈|제미나이|Cue|cue|Vooy|vooy|전원|모두)/g;

/* 본문 → 안전한 HTML (링크 · @멘션 · 줄바꿈) */
function richText(text, q) {
  let html = esc(text);
  html = html.replace(/(https?:\/\/[^\s<]+[^\s<.,!?)\]}'"])/g, (m) => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`);
  html = html.replace(MENTION_RE, '<span class="mention">@$1</span>');
  if (q) {
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    html = html.replace(/(^|>)([^<]+)(?=<|$)/g, (m, a, b) => a + b.replace(re, '<mark>$1</mark>'));
  }
  return html;
}

/* ---------------- 첨부·인용 규칙 (AGENT_SYNC.md 와 동일) ----------------
   content 안에서
     > 뮤즈: 원문 일부           ← 맨 앞 '> ' 줄은 답장 인용
     🖼️ [사진.jpg](URL) · 1280x960 · 230KB   ← 사진
     🎬 [영상.mp4](URL) · 4.2MB              ← 동영상
     📎 [보고서.pdf](URL) · 1.2MB            ← 파일
   이미지 주소만 한 줄로 있어도 사진으로 보여 준다. */
const ATT_RE = /^(📎|🖼️?|🎬)\s*\[([^\]\n]*)\]\((\S+)\)\s*(?:·\s*(.*))?$/;
const IMG_URL_RE = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif|heic)(?:\?\S*)?$/i;

function parseContent(raw) {
  const lines = normalizeNames(raw).replace(/\r\n?/g, '\n').split('\n');
  const quote = [];
  while (lines.length && /^>\s?/.test(lines[0])) quote.push(lines.shift().replace(/^>\s?/, ''));
  const body = [];
  const attachments = [];
  lines.forEach((line) => {
    const t = line.trim();
    const m = ATT_RE.exec(t);
    if (m) {
      const kind = m[1] === '📎' ? 'file' : m[1] === '🎬' ? 'video' : 'image';
      const meta = String(m[4] || '').split('·').map((x) => x.trim()).filter(Boolean);
      const dims = meta.find((x) => /^\d+x\d+$/.test(x));
      const size = meta.find((x) => !/^\d+x\d+$/.test(x)) || '';
      let k = kind;
      if (k === 'file' && /^data:image\//.test(m[3])) k = 'image';
      attachments.push({ kind: k, name: m[2] || '첨부', url: m[3], size, dims });
    } else if (IMG_URL_RE.test(t)) {
      attachments.push({ kind: 'image', name: t.split('/').pop().split('?')[0], url: t, size: '' });
    } else {
      body.push(line);
    }
  });
  return { quote: quote.join('\n').trim(), text: body.join('\n').trim(), attachments };
}

function previewText(raw) {
  const p = parseContent(raw);
  if (p.text) return p.text.replace(/\s+/g, ' ');
  const a = p.attachments[0];
  if (!a) return p.quote ? '답장' : '';
  if (a.kind === 'image') return p.attachments.length > 1 ? `📷 사진 ${p.attachments.length}장` : '📷 사진';
  if (a.kind === 'video') return '🎬 동영상';
  return `📎 ${a.name}`;
}

/* 안전한 첨부 주소만 허용 (javascript: 등 차단) */
function safeUrl(u) {
  const s = String(u || '');
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:(image|video|audio|application|text)\/[\w.+-]+;base64,/i.test(s)) return s;
  if (/^blob:/i.test(s)) return s;
  return '';
}

/* ---------------- toast ---------------- */
function toast(text, kind) {
  if (!el.toastWrap) return;
  const t = document.createElement('div');
  t.className = `toast ${kind ? `is-${kind}` : ''}`;
  t.textContent = text;
  el.toastWrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => {
    t.classList.remove('is-in');
    setTimeout(() => t.remove(), 260);
  }, kind === 'error' ? 4200 : 2600);
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
/* 같은 id 가 있으면 덮어쓰기 — 시드 카드(state.json)를 화면에서 고칠 때 씀 */
const sbUpsert = (table, row) => sbFetch(`${table}?on_conflict=id`, {
  method: 'POST',
  headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
  body: JSON.stringify(row)
});
const sbRemove = (table, id) => sbFetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });

/* 방·발신자 이름을 앱 내부 id로 정규화
   2026-11-28: 지휘실(command) 폐지 — 회의실에서 바로 회의하며 지휘한다.
   예전 command 로 남은 DB 로그는 boardroom(=회의실)으로 묶어 '전체'·'회의실' 필터에서 유실 없이 보이게 한다. */
const ROOM_ALIAS = {
  command: 'boardroom', '지휘실': 'boardroom', '지휘': 'boardroom',
  boardroom: 'boardroom', conference: 'boardroom', meeting: 'boardroom', '대회의실': 'boardroom', '회의실': 'boardroom',
  performance: 'performance', '성과실': 'performance',
  workshop: 'workshop', '제작실': 'workshop',
  team1: 'team1', '1팀': 'team1', '1팀방': 'team1', 'team-1': 'team1', 'team 1': 'team1', team_1: 'team1',
  team2: 'team2', '2팀': 'team2', '2팀방': 'team2', 'team-2': 'team2', 'team 2': 'team2', team_2: 'team2',
  lounge: 'lounge', '라운지': 'lounge'
};

/* 회의실 탭이 아니라 전용 현황판(바텀시트)으로 열리는 존 */
const ZONE_IDS = ['performance', 'workshop'];
const isZoneRoom = (id) => ZONE_IDS.indexOf(String(id == null ? '' : id)) >= 0;
const SENDER_ALIAS = {
  '후후': 'huhu', huhu: 'huhu', '피클': 'huhu',
  /* 대장 = 예전 '승후'. 과거 행(sender: "승후")과 새 행(sender: "대장") 둘 다 같은 사람으로 묶는다 */
  '대장': 'seunghu', '대장님': 'seunghu', '승후': 'seunghu', '승후님': 'seunghu', seunghu: 'seunghu',
  '뮤즈': 'muse', muse: 'muse', '제미나이': 'gemini', gemini: 'gemini',
  cue: 'cue', '큐': 'cue', vooy: 'vooy', '부이': 'vooy'
};

function normRoom(room) {
  const key = String(room == null ? '' : room).trim();
  return ROOM_ALIAS[key] || ROOM_ALIAS[key.toLowerCase()] || 'boardroom';
}

function normSender(sender) {
  const key = String(sender == null ? '' : sender).trim();
  if (!key) return null;
  const direct = SENDER_ALIAS[key] || SENDER_ALIAS[key.toLowerCase()];
  if (direct) return direct;
  /* '뮤즈🤖', 'Cue (토르)', '제미나이/클로드' 처럼 꾸민 이름도 알아본다 */
  const stripped = key.replace(/[\s()[\]·/|:-].*$/, '').replace(/[^\p{L}\p{N}]/gu, '');
  return SENDER_ALIAS[stripped] || SENDER_ALIAS[stripped.toLowerCase()] || null;
}

/* Supabase 응답을 화면용 행으로 변환 */
function remoteMessages() {
  return (sb.messages || []).map((row) => ({
    id: `sb-${row.id}`,
    dbId: row.id,
    room: normRoom(row.room),
    authorId: normSender(row.sender),
    senderName: row.sender || '외부',
    text: row.content || '',
    at: row.created_at,
    source: 'supabase'
  }));
}

function liveTasks() {
  return (sb.tasks || []).map((t) => ({
    id: t.id,
    title: t.title || '제목 없음',
    status: t.status || '진행중',
    progress: Number(t.progress) || 0,
    owner: t.owner || '',
    detail: t.detail || '',
    link: t.link || '',
    updated: fmtStamp(t.updated_at),
    updatedAt: t.updated_at,
    source: 'supabase'
  }));
}

function ownerEmoji(owner) {
  const id = normSender(owner);
  return id ? charById(id).emoji : '📌';
}

function projectRows() {
  const rows = (state.projects || []).map((p) => Object.assign({}, p, { source: 'seed' }));
  liveTasks().forEach((t) => {
    const i = rows.findIndex((r) => String(r.id) === String(t.id));
    if (i >= 0) {
      /* 시드 카드를 화면/에이전트가 고친 경우: 시드의 아이콘·태그·다음 할 일은 살리고 값만 덮는다 */
      const seed = rows[i];
      rows[i] = Object.assign({}, seed, t, {
        emoji: seed.emoji,
        tags: seed.tags,
        badge: seed.badge,
        next: seed.next,
        link: t.link || seed.link,
        detail: t.detail || seed.detail,
        overridden: true
      });
    } else {
      rows.unshift(Object.assign({ emoji: ownerEmoji(t.owner), tags: [], badge: '' }, t));
    }
  });
  if (!sb.ok) {
    customTasks().forEach((t) => {
      if (!rows.some((r) => String(r.id) === String(t.id))) {
        rows.unshift(Object.assign({ progress: 0 }, t, { source: 'local' }));
      }
    });
  }
  return rows;
}

/* 비서별 마지막 대화 시각 — 연동이 살아 있는지 보여 주는 신호 */
function lastMessageBy(charId) {
  let last = null;
  allMessages().forEach((m) => {
    if (m.authorId === charId && (!last || ts(m.at) > ts(last.at))) last = m;
  });
  return last;
}

function agentRows() {
  const rows = (state.agents || []).map((a) => Object.assign({}, a, { source: 'seed' }));
  (sb.agents || []).forEach((a) => {
    const base = charById(a.id) || {};
    const row = {
      id: a.id,
      name: a.name || base.name || a.id,
      role: a.role || base.role || '',
      state: a.status || '대기',
      task: a.current_task || '',
      next: a.next_task || '',
      lastActive: a.updated_at ? fmtStamp(a.updated_at) : '',
      updatedAt: a.updated_at,
      emoji: base.emoji || '👤',
      room: a.room || base.room || '',
      source: 'supabase'
    };
    const i = rows.findIndex((r) => r.id === a.id);
    if (i >= 0) {
      rows[i] = Object.assign({}, rows[i], row, {
        skills: rows[i].skills,
        load: rows[i].load,
        task: row.task || rows[i].task,
        next: row.next || rows[i].next
      });
    } else rows.push(Object.assign({ skills: [], load: '' }, row));
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

function maxMessageId() {
  return (sb.messages || []).reduce((mx, m) => {
    const n = Number(m.id);
    return isFinite(n) && n > mx ? n : mx;
  }, 0);
}

function mergeMessages(rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  if (!Array.isArray(sb.messages)) sb.messages = [];
  const have = new Set(sb.messages.map((m) => String(m.id)));
  let added = 0;
  rows.forEach((r) => {
    if (!have.has(String(r.id))) { sb.messages.push(r); have.add(String(r.id)); added += 1; }
  });
  if (added) sb.messages.sort((a, b) => ts(a.created_at) - ts(b.created_at) || (Number(a.id) - Number(b.id)));
  return added;
}

async function loadRemote() {
  const t = SUPABASE.tables;
  try {
    /* 최신 400개 (예전 코드는 asc+limit 이라 300개가 넘으면 새 글이 안 보였다) */
    const [messages, tasks, memos, agents] = await Promise.all([
      sbSelect(t.messages, '&order=created_at.desc&limit=400'),
      sbSelect(t.tasks, '&order=updated_at.desc'),
      sbSelect(t.memos, '&order=updated_at.desc'),
      sbSelect(t.agents, '&order=updated_at.desc')
    ]);
    sb.messages = Array.isArray(messages) ? messages.reverse() : [];
    sb.tasks = Array.isArray(tasks) ? tasks : [];
    sb.memos = Array.isArray(memos) ? memos : [];
    sb.agents = Array.isArray(agents) ? agents : [];
    sb.ok = true;
    sb.error = null;
    sb.at = new Date().toISOString();
    flushOutbox();
  } catch (err) {
    sb.ok = false;
    sb.error = (err && err.message) ? err.message : String(err);
  }
  applyAgentOverlay();
  renderSyncBadge();
  return sb.ok;
}

/* 새 메시지만 가볍게 가져오기 (id 증분) */
let polling = false;
async function pollMessages() {
  if (!sb.ok || polling) return 0;
  polling = true;
  try {
    const rows = await sbSelect(SUPABASE.tables.messages, `&id=gt.${maxMessageId()}&order=id.asc&limit=200`);
    const added = mergeMessages(rows);
    sb.at = new Date().toISOString();
    if (added) onMessagesChanged();
    renderSyncBadge();
    return added;
  } catch (err) {
    return 0;
  } finally {
    polling = false;
  }
}

function sbSnapshot() {
  return JSON.stringify([sb.tasks, sb.memos, sb.agents, (sb.messages || []).length, maxMessageId()]);
}

async function refreshLive() {
  const before = sbSnapshot();
  const msgBefore = JSON.stringify(sb.messages);
  await loadRemote();
  if (!state) return;
  if (JSON.stringify(sb.messages) !== msgBefore) onMessagesChanged();
  if (sbSnapshot() !== before) renderNonChat();
}

/* ---------------- Supabase Realtime (가능하면 즉시 반영) ----------------
   office_messages 가 supabase_realtime publication 에 있으면 새 글이 바로 뜬다.
   신호만 받고 실제 행은 REST 증분 조회로 가져와서, 페이로드 형식에 의존하지 않는다.
   연결이 안 되면 조용히 4초 폴링만 쓴다. */
let rtSocket = null;
let rtHeartbeat = 0;
let rtFails = 0;
let rtRef = 0;
function realtimeConnect() {
  if (rtSocket || rtFails > 3 || !('WebSocket' in window)) return;
  const wsUrl = `${SUPABASE.url.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE.key)}&vsn=1.0.0`;
  let ws;
  try { ws = new WebSocket(wsUrl); } catch (e) { rtFails += 1; return; }
  rtSocket = ws;
  sb.realtime = 'connecting';
  const send = (obj) => { try { ws.send(JSON.stringify(obj)); } catch (e) { /* ignore */ } };
  ws.onopen = () => {
    rtRef += 1;
    send({
      topic: 'realtime:office-tower',
      event: 'phx_join',
      payload: {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
          postgres_changes: [{ event: '*', schema: 'public', table: SUPABASE.tables.messages }]
        }
      },
      ref: String(rtRef),
      join_ref: String(rtRef)
    });
    clearInterval(rtHeartbeat);
    rtHeartbeat = setInterval(() => {
      rtRef += 1;
      send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(rtRef) });
    }, 25000);
  };
  ws.onmessage = (ev) => {
    let msg = null;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (!msg) return;
    if (msg.event === 'phx_reply' && msg.topic === 'realtime:office-tower') {
      const ok = msg.payload && msg.payload.status === 'ok';
      sb.realtime = ok ? 'on' : 'error';
      if (ok) rtFails = 0;
      renderSyncBadge();
      return;
    }
    if (msg.event === 'postgres_changes' || msg.event === 'INSERT' || msg.event === 'UPDATE' || msg.event === 'DELETE') {
      const type = msg.payload && msg.payload.data && msg.payload.data.type;
      if (type === 'DELETE' || msg.event === 'DELETE') refreshLive();
      else pollMessages();
    }
    if (msg.event === 'system' && msg.payload && msg.payload.status === 'error') {
      sb.realtime = 'error';
      renderSyncBadge();
    }
  };
  const drop = () => {
    clearInterval(rtHeartbeat);
    if (rtSocket === ws) rtSocket = null;
    if (sb.realtime !== 'error') sb.realtime = 'off';
    rtFails += 1;
    renderSyncBadge();
    if (rtFails <= 3) setTimeout(realtimeConnect, 5000 * rtFails);
  };
  ws.onclose = drop;
  ws.onerror = () => { try { ws.close(); } catch (e) { /* ignore */ } };
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
    if (!silent && opts && opts.manual) toast(sb.ok ? '최신 상태로 새로고침했어요' : 'DB 연결 실패 — 로컬 데이터로 보여요', sb.ok ? '' : 'error');
  } catch (err) {
    if (el.syncBtn) el.syncBtn.classList.add('is-error');
    if (el.syncTime) el.syncTime.textContent = '연결 실패';
    if (!silent && el.loadError) el.loadError.hidden = false;
    if (!state) {
      el.hqSummary.textContent = '데이터를 불러오지 못했어요.';
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
  renderDetail();
  renderNonChat();
  renderRoomHead();
  onMessagesChanged(true);
  renderComposerBars();
}

function renderNonChat() {
  if (!state) return;
  renderProjects();
  renderAgents();
  renderMemos();
  renderLinkPanel();
  if (zoneOpenId) renderZoneSheet(zoneOpenId);
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
  if (label) label.textContent = sb.ok ? (sb.realtime === 'on' ? '실시간 LIVE' : '실시간 DB') : (sb.error ? '로컬 저장' : '연결 중');
  if (el.syncTime) {
    if (sb.ok) el.syncTime.textContent = `${fmtTime(sb.at)} 동기화`;
    else if (sb.error) el.syncTime.textContent = 'DB 연결 실패';
    else el.syncTime.textContent = '불러오는 중…';
  }
  if (el.livePill) {
    el.livePill.textContent = sb.ok ? (sb.realtime === 'on' ? '● LIVE' : '● 동기화 중') : (sb.error ? '오프라인' : '연결 중');
    el.livePill.classList.toggle('is-on', !!sb.ok);
    el.livePill.classList.toggle('is-off', !sb.ok && !!sb.error);
  }
}

/* =========================================================
   회의실 = 메신저
   ========================================================= */
const ChatStore = {
  all() {
    const list = read(KEY.chat, []);
    return Array.isArray(list) ? list : [];
  },
  save(list) { return write(KEY.chat, list); },
  append(msg) {
    const list = this.all();
    list.push(msg);
    return this.save(list);
  },
  remove(id) { this.save(this.all().filter((m) => m.id !== id)); }
};

let inflight = [];          /* 보내는 중·실패한 메시지 (화면에만) */
let msgCache = null;
function dirtyMessages() { msgCache = null; }

function allMessages() {
  if (msgCache) return msgCache;
  if (!state) return [];
  const seed = (state.meetings || []).map((m) => Object.assign({}, m, { source: 'state' }));
  const live = sb.ok ? remoteMessages() : [];
  /* outbox = DB가 막혀 이 기기에만 남긴 글(연결되면 자동 전송). 예전 로컬 글은 오프라인일 때만 보인다 */
  const local = ChatStore.all()
    .filter((m) => m.outbox || !sb.ok)
    .map((m) => Object.assign({}, m, { source: m.outbox ? 'outbox' : 'local' }));
  const sending = inflight.map((m) => Object.assign({}, m, { source: 'inflight' }));
  msgCache = seed.concat(live, local, sending).sort((a, b) => ts(a.at) - ts(b.at));
  return msgCache;
}

function chatRooms() {
  const rooms = ((state && state.rooms) || []).filter((r) => !isZoneRoom(r.id));
  return [{ id: 'all', name: '전체', emoji: '🗂️', summary: '모든 방의 대화를 한 번에' }].concat(rooms);
}
const chatRoomIds = () => chatRooms().map((r) => r.id).filter((id) => id !== 'all');

function roomMessages(roomId) {
  return allMessages().filter((m) => roomId === 'all' || m.room === roomId);
}

function roomMembers(roomId) {
  if (roomId === 'all' || roomId === 'boardroom') return COMPOSER_IDS.slice();
  const team = teamById(roomId);
  if (team) return [OWNER_ID].concat((team.members || []).filter((id) => id !== OWNER_ID));
  const inRoom = ((state && state.characters) || []).filter((c) => c.room === roomId).map((c) => c.id);
  return [OWNER_ID].concat(inRoom.filter((id) => id !== OWNER_ID));
}

function roomSubtitle(roomId) {
  const ids = roomMembers(roomId);
  if (roomId === 'all') return `모든 방 · ${ids.length}명`;
  const team = teamById(roomId);
  const names = ids.map((id) => {
    const c = charById(id);
    return team && team.leader === id ? `${c.name}(팀장)` : c.name;
  });
  return `${names.join(' · ')}`;
}

/* ---------------- 안 읽은 글 ---------------- */
let seen = read(KEY.seen, null);
if (!seen || typeof seen !== 'object') {
  seen = { __init: new Date().toISOString() };
  write(KEY.seen, seen);
}
const seenAt = (roomId) => ts(seen[roomId] || seen.__init);

function unreadIn(roomId) {
  if (roomId === 'all') return chatRoomIds().reduce((n, id) => n + unreadIn(id), 0);
  const since = seenAt(roomId);
  return allMessages().filter((m) => m.room === roomId && m.authorId !== OWNER_ID
    && m.source !== 'inflight' && ts(m.at) > since).length;
}

function markSeen(roomId) {
  const ids = roomId === 'all' ? chatRoomIds() : [roomId];
  let changed = false;
  ids.forEach((id) => {
    const msgs = roomMessages(id);
    const last = msgs.length ? msgs[msgs.length - 1].at : null;
    if (last && ts(last) > seenAt(id)) { seen[id] = last; changed = true; }
  });
  if (changed) {
    write(KEY.seen, seen);
    renderUnreadBadges();
    renderRoomList();
    renderRoomStrip();
  }
}

function roomIsVisible() {
  return activeTab === 'chat' && (mqDesktop.matches || roomOpen) && document.visibilityState === 'visible';
}

function markSeenIfVisible() {
  if (roomIsVisible() && chatPinnedBottom) markSeen(activeRoom);
}

function renderUnreadBadges() {
  const n = unreadIn('all');
  if (el.tabBadgeChat) {
    el.tabBadgeChat.hidden = n < 1;
    el.tabBadgeChat.textContent = n > 99 ? '99+' : String(n);
  }
  document.title = n ? `(${n > 99 ? '99+' : n}) 어벤져스타워` : '어벤져스타워';
}

/* ---------------- 방 목록 ---------------- */
function lastOf(roomId) {
  const msgs = roomMessages(roomId);
  return msgs.length ? msgs[msgs.length - 1] : null;
}

function authorName(m) {
  return m.authorId ? charById(m.authorId).name : (m.senderName || '외부');
}

function renderRoomList() {
  if (!el.roomList || !state) return;
  el.roomList.innerHTML = chatRooms().map((r) => {
    const last = lastOf(r.id);
    const n = unreadIn(r.id);
    const active = mqDesktop.matches && r.id === activeRoom;
    const preview = last
      ? `${last.authorId === OWNER_ID ? '나' : authorName(last)}: ${previewText(last.text)}`
      : (r.summary || '아직 대화가 없어요');
    return `<li>
      <button class="room-item ${active ? 'is-active' : ''}" type="button" data-open-chat="${esc(r.id)}">
        <span class="room-av room-av-${esc(r.id)}" aria-hidden="true">${esc(r.emoji)}</span>
        <span class="room-main">
          <span class="room-top">
            <b class="room-name">${esc(r.name)}</b>
            <span class="room-count">${roomMembers(r.id).length}</span>
            <time class="room-time">${last ? esc(fmtListTime(last.at)) : ''}</time>
          </span>
          <span class="room-bottom">
            <span class="room-preview">${esc(preview)}</span>
            ${n ? `<span class="unread">${n > 99 ? '99+' : n}</span>` : ''}
          </span>
        </span>
      </button>
    </li>`;
  }).join('');
  if (el.roomPaneFoot) {
    el.roomPaneFoot.textContent = sb.ok
      ? `실시간 DB 연결됨 · ${sb.realtime === 'on' ? '즉시 반영' : '4초마다 새 글 확인'} · 에이전트도 같은 방을 봐요`
      : 'DB에 연결하지 못했어요 · 보낸 글은 이 기기에 저장했다가 연결되면 자동 전송돼요';
  }
}

function renderRoomStrip() {
  if (!el.crRooms || !state) return;
  el.crRooms.innerHTML = chatRooms().map((r) => {
    const n = r.id === activeRoom ? 0 : unreadIn(r.id);
    return `<button class="cr-chip ${r.id === activeRoom ? 'is-active' : ''}" type="button" data-open-chat="${esc(r.id)}"
      aria-pressed="${r.id === activeRoom}">${esc(r.emoji)} ${esc(r.name)}${n ? `<span class="cr-dot">${n > 9 ? '9+' : n}</span>` : ''}</button>`;
  }).join('');
}

function renderRoomHead() {
  const r = roomById(activeRoom);
  if (el.crEmoji) { el.crEmoji.textContent = r.emoji; el.crEmoji.className = `cr-emoji room-av-${r.id}`; }
  if (el.crName) el.crName.textContent = r.id === 'all' ? '전체 대화' : r.name;
  if (el.crSub) el.crSub.textContent = roomSubtitle(r.id);
  const target = activeRoom === 'all' ? roomById('boardroom') : r;
  if (el.chatInput) el.chatInput.placeholder = activeRoom === 'all' ? `${target.name}에 보낼 메시지` : '메시지 입력';
}

/* ---------------- 최근 대화 카드 (오피스 탭) ---------------- */
function renderRecent() {
  if (!el.recentList) return;
  const msgs = allMessages().filter((m) => m.source !== 'inflight').slice(-4).reverse();
  if (!msgs.length) {
    el.recentList.innerHTML = '<li class="recent-empty">아직 대화가 없어요. 회의실에서 첫 말을 걸어 보세요.</li>';
    return;
  }
  el.recentList.innerHTML = msgs.map((m) => {
    const r = roomById(m.room);
    return `<li>
      <button class="recent-item" type="button" data-open-chat="${esc(m.room)}">
        ${avatarHtml(m.authorId, m.senderName, 'recent-av')}
        <span class="recent-main">
          <span class="recent-top"><b>${esc(authorName(m))}</b><span class="recent-room">${esc(r.emoji)} ${esc(r.name)}</span><time>${esc(fmtListTime(m.at))}</time></span>
          <span class="recent-text">${esc(previewText(m.text))}</span>
        </span>
      </button>
    </li>`;
  }).join('');
}

/* ---------------- 대화 렌더 ---------------- */
const CHAT_BOTTOM_SLACK = 60;
let chatPinnedBottom = true;
let chatTailSeen = null;
let chatNewCount = 0;
let chatJumpTimers = [];
let lastRenderSig = '';
let searchQ = '';
let roomOpen = false;

const EMPTY_ROOM_COPY = {
  all: { emoji: '🗂️', title: '아직 남긴 말이 없어요', sub: '모든 방의 대화가 여기 한데 모입니다.' },
  boardroom: { emoji: '🏛️', title: '회의실이 조용하네요', sub: '첫 안건을 남겨 보세요. 대장님과 비서 전원이 보는 방이에요.' },
  team1: { emoji: '🛡️', title: '1팀 방이에요', sub: '후후 팀장 · Cue가 일하는 방입니다. 첫 지시를 남겨 보세요.' },
  team2: { emoji: '⚡', title: '2팀 방이에요', sub: '뮤즈 팀장 · Vooy가 일하는 방입니다. 첫 지시를 남겨 보세요.' },
  lounge: { emoji: '☕', title: '라운지가 조용하네요', sub: '일 얘기 말고 가벼운 한마디도 좋아요.' }
};

function emptyRoomHtml() {
  if (searchQ) {
    return `<li class="msg-empty"><span class="me-emoji" aria-hidden="true">🔍</span><b>'${esc(searchQ)}' 검색 결과가 없어요</b></li>`;
  }
  const copy = EMPTY_ROOM_COPY[activeRoom] || { emoji: '💬', title: '아직 남긴 말이 없어요', sub: '첫 메시지를 남기면 여기에 쌓입니다.' };
  return `<li class="msg-empty">
    <span class="me-emoji" aria-hidden="true">${esc(copy.emoji)}</span>
    <b>${esc(copy.title)}</b>
    <span class="me-sub">${esc(copy.sub)}</span>
  </li>`;
}

function authorKey(m) { return m.authorId || `x:${m.senderName}`; }

function attachmentsHtml(list, m) {
  if (!list.length) return '';
  const imgs = list.filter((a) => a.kind === 'image' && safeUrl(a.url));
  const others = list.filter((a) => !(a.kind === 'image' && safeUrl(a.url)));
  let html = '';
  if (imgs.length) {
    html += `<div class="att-grid n${Math.min(imgs.length, 4)}">${imgs.map((a) => {
      const [w, h] = String(a.dims || '').split('x').map(Number);
      const ratio = w && h ? `style="aspect-ratio:${w}/${h}"` : '';
      return `<button class="att-img" type="button" data-view-src="${esc(safeUrl(a.url))}" data-view-name="${esc(a.name)}" ${imgs.length === 1 ? ratio : ''}>
        <img src="${esc(safeUrl(a.url))}" alt="${esc(a.name)}" loading="lazy" decoding="async" />
      </button>`;
    }).join('')}</div>`;
  }
  others.forEach((a) => {
    const url = safeUrl(a.url);
    if (a.kind === 'video' && url) {
      html += `<video class="att-video" src="${esc(url)}" controls playsinline preload="metadata"></video>`;
    } else {
      const ext = (String(a.name).split('.').pop() || '').slice(0, 4).toUpperCase();
      html += `<a class="att-file" ${url ? `href="${esc(url)}" download="${esc(a.name)}" target="_blank" rel="noopener"` : ''}>
        <span class="af-ico" aria-hidden="true">${esc(ext || 'FILE')}</span>
        <span class="af-main"><b>${esc(a.name)}</b><span>${esc(a.size || '')}${url ? ' · 받기' : ''}</span></span>
      </a>`;
    }
  });
  return html;
}

function bubbleHtml(m) {
  const p = parseContent(m.text);
  const q = searchQ;
  const mediaOnly = !p.text && !p.quote && p.attachments.length > 0
    && p.attachments.every((a) => a.kind === 'image' || a.kind === 'video');
  let inner = '';
  if (p.quote) {
    const qi = p.quote.indexOf(':');
    const who = qi > 0 && qi < 14 ? p.quote.slice(0, qi) : '';
    const what = who ? p.quote.slice(qi + 1).trim() : p.quote;
    inner += `<div class="b-quote">${who ? `<b>${esc(who)}</b>` : ''}<span>${esc(what)}</span></div>`;
  }
  inner += attachmentsHtml(p.attachments, m);
  if (p.text) inner += `<p class="b-text">${richText(p.text, q)}</p>`;
  if (m.source === 'inflight' && m.status === 'sending' && m.hasFiles) {
    inner += `<div class="up-progress"><span style="width:${Math.round((m.progress || 0) * 100)}%"></span></div>`;
  }
  return `<div class="bubble ${mediaOnly ? 'is-media' : ''}">${inner}</div>`;
}

function metaHtml(m, showTime) {
  if (m.source === 'inflight') {
    if (m.status === 'failed') {
      return `<span class="msg-meta is-failed"><button class="retry-btn" type="button" data-retry="${esc(m.id)}">다시 보내기</button><button class="retry-btn is-ghost" type="button" data-discard="${esc(m.id)}">삭제</button></span>`;
    }
    return '<span class="msg-meta is-sending">보내는 중</span>';
  }
  const flag = m.source === 'outbox' ? '<span class="msg-flag">대기 · 연결되면 전송</span>'
    : m.source === 'local' ? '<span class="msg-flag">이 기기에만</span>' : '';
  if (!showTime && !flag) return '';
  return `<span class="msg-meta">${flag}${showTime ? `<time>${esc(fmtTime(m.at))}</time>` : ''}</span>`;
}

function renderMessages(force) {
  if (!el.msgList || !state) return;
  let msgs = roomMessages(activeRoom);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    msgs = msgs.filter((m) => normalizeNames(m.text).toLowerCase().includes(q) || authorName(m).toLowerCase().includes(q));
  }
  if (el.crSearchCount) el.crSearchCount.textContent = searchQ ? `${msgs.length}건` : '';
  const sig = `${activeRoom}|${searchQ}|${msgs.map((m) => `${m.id}:${m.status || ''}:${m.source}`).join(',')}`;
  if (!force && sig === lastRenderSig) return;
  const roomChanged = !lastRenderSig.startsWith(`${activeRoom}|${searchQ}|`);
  lastRenderSig = sig;

  if (!msgs.length) {
    el.msgList.innerHTML = emptyRoomHtml();
  } else {
    let html = '';
    let prevDay = '';
    msgs.forEach((m, i) => {
      const day = fmtDay(m.at);
      if (day !== prevDay) {
        html += `<li class="day-sep" role="separator"><span>${esc(fmtDayLabel(m.at))}</span></li>`;
        prevDay = day;
      }
      const prev = msgs[i - 1];
      const next = msgs[i + 1];
      const sameGroup = (a, b) => a && b && authorKey(a) === authorKey(b) && a.room === b.room
        && fmtDay(a.at) === fmtDay(b.at) && Math.abs(ts(b.at) - ts(a.at)) < GROUP_GAP_MS;
      const first = !sameGroup(prev, m);
      const last = !sameGroup(m, next);
      const showTime = last || fmtTime(next.at) !== fmtTime(m.at);
      const own = m.authorId === OWNER_ID;
      const r = roomById(m.room);
      const roomBadge = activeRoom === 'all' ? `<span class="msg-room">${esc(r.emoji)} ${esc(r.name)}</span>` : '';
      html += `<li class="msg ${own ? 'is-own' : ''} ${first ? 'is-first' : ''} ${last ? 'is-last' : ''}" data-mid="${esc(m.id)}">
        ${own ? '' : `<div class="msg-av">${first ? avatarHtml(m.authorId, m.senderName, 'av') : ''}</div>`}
        <div class="msg-main">
          ${first && (!own || roomBadge) ? `<div class="msg-name">${own ? '' : `<b>${esc(authorName(m))}</b>`}${roomBadge}</div>` : ''}
          <div class="msg-line">${bubbleHtml(m)}${metaHtml(m, showTime)}</div>
        </div>
      </li>`;
    });
    el.msgList.innerHTML = html;
  }
  el.msgList.classList.toggle('is-empty', !msgs.length);

  const tailMsg = msgs[msgs.length - 1];
  const tail = tailMsg ? `${activeRoom}|${tailMsg.id}` : `${activeRoom}|empty`;
  const isNewArrival = !roomChanged && chatTailSeen !== null && tail !== chatTailSeen;
  chatTailSeen = tail;
  if (roomChanged) {
    chatNewCount = 0;
    jumpChatToBottom();
    return;
  }
  if (isNewArrival && roomIsVisible()) {
    const mine = tailMsg && (tailMsg.authorId === OWNER_ID || tailMsg.source === 'inflight');
    if (chatPinnedBottom || mine) jumpChatToBottom();
    else { chatNewCount += 1; updateChatLatestBtn(); }
  }
}

function renderChatRoom(force) {
  renderRoomHead();
  renderRoomStrip();
  renderRoomList();
  renderMessages(force);
  renderComposerBars();
}

function onMessagesChanged(force) {
  dirtyMessages();
  if (!state) return;
  renderRoomList();
  renderRoomStrip();
  renderRecent();
  renderMessages(force);
  renderUnreadBadges();
  if (activeTab === 'status') renderAgents();
  markSeenIfVisible();
}

/* ---------------- 자동 스크롤 (카톡처럼 최신 = 맨 아래) ---------------- */
function chatIsAtBottom() {
  const box = el.msgList;
  if (!box) return true;
  return box.scrollHeight - box.scrollTop - box.clientHeight <= CHAT_BOTTOM_SLACK;
}

function stopChatJump() {
  chatJumpTimers.forEach((t) => clearTimeout(t));
  chatJumpTimers = [];
}

function updateChatLatestBtn() {
  if (!el.chatLatest) return;
  const show = activeTab === 'chat' && !chatPinnedBottom;
  el.chatLatest.hidden = !show;
  el.chatLatest.classList.toggle('has-new', chatNewCount > 0);
  if (el.chatLatestTxt) el.chatLatestTxt.textContent = chatNewCount > 0 ? `새 메시지 ${chatNewCount > 99 ? '99+' : chatNewCount}` : '최신';
}

function applyChatJump() {
  const box = el.msgList;
  if (box) box.scrollTop = box.scrollHeight;
  chatPinnedBottom = true;
  chatNewCount = 0;
  updateChatLatestBtn();
}

function chatJumpGuard() {
  if (activeTab !== 'chat' || !chatPinnedBottom) return;
  applyChatJump();
}

function jumpChatToBottom() {
  if (!el.msgList) return;
  stopChatJump();
  applyChatJump();
  requestAnimationFrame(() => {
    applyChatJump();
    requestAnimationFrame(chatJumpGuard);
  });
  chatJumpTimers.push(setTimeout(chatJumpGuard, 120), setTimeout(chatJumpGuard, 400));
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(chatJumpGuard);
  markSeenSoon();
}

let seenTimer = 0;
function markSeenSoon() {
  clearTimeout(seenTimer);
  seenTimer = setTimeout(markSeenIfVisible, 350);
}

function onChatScroll() {
  const atBottom = chatIsAtBottom();
  if (atBottom !== chatPinnedBottom) {
    chatPinnedBottom = atBottom;
    if (atBottom) chatNewCount = 0;
    updateChatLatestBtn();
  }
  if (atBottom) markSeenSoon();
}

/* ---------------- 방 열기·닫기 ---------------- */
const drafts = read(KEY.draft, {}) || {};
let draftTimer = 0;
function saveDraft() {
  if (!el.chatInput) return;
  const v = el.chatInput.value;
  if (v.trim()) drafts[activeRoom] = v; else delete drafts[activeRoom];
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => write(KEY.draft, drafts), 300);
}
function restoreDraft() {
  if (!el.chatInput) return;
  el.chatInput.value = drafts[activeRoom] || '';
  autoGrow();
  updateSendState();
}

let savedScrollY = 0;
function lockPage(on) {
  const root = document.documentElement;
  if (on) {
    if (root.classList.contains('is-locked')) return;
    savedScrollY = window.scrollY || 0;
    document.body.style.top = `-${savedScrollY}px`;
    root.classList.add('is-locked');
  } else {
    if (!root.classList.contains('is-locked')) return;
    root.classList.remove('is-locked');
    document.body.style.top = '';
    window.scrollTo(0, savedScrollY);
  }
}

function validChatRoom(id) {
  return chatRooms().some((r) => r.id === id) ? id : 'boardroom';
}

function openChatRoom(roomId, opts) {
  const o = opts || {};
  const id = state ? validChatRoom(roomId) : (roomId || 'boardroom');
  if (id !== activeRoom) {
    saveDraft();
    activeRoom = id;
    write(KEY.room, activeRoom);
    replyTo = null;
    closeSearch();
    restoreDraft();
  }
  if (activeTab !== 'chat') setTab('chat', { fromRoom: true });
  if (!mqDesktop.matches) {
    if (!roomOpen) {
      roomOpen = true;
      document.body.classList.add('room-open');
      lockPage(true);
      syncViewport();
      if (o.push !== false) {
        try { history.pushState({ room: id }, '', `#chat/${id}`); } catch (e) { /* ignore */ }
      }
    } else {
      try { history.replaceState({ room: id }, '', `#chat/${id}`); } catch (e) { /* ignore */ }
    }
  }
  setMenuOpen(false);
  chatPinnedBottom = true;
  lastRenderSig = '';
  renderChatRoom(true);
  jumpChatToBottom();
  if (o.focus) focusInput();
}

function closeChatRoom(fromPop) {
  if (!roomOpen) return;
  roomOpen = false;
  saveDraft();
  if (el.chatInput) el.chatInput.blur();
  setMenuOpen(false);
  hideMentionPop();
  document.body.classList.remove('room-open', 'kb-open');
  lockPage(false);
  if (!fromPop) {
    if (history.state && history.state.room) history.back();
    else { try { history.replaceState(null, '', '#chat'); } catch (e) { /* ignore */ } }
  }
  updateChatLatestBtn();
  renderRoomList();
}

/* 지도 위 방 라벨·상단 칩·상세 시트에서: 회의실 탭의 그 방으로 바로 */
function openRoomInChat(roomId) {
  const id = String(roomId == null ? '' : roomId).trim();
  if (isZoneRoom(id)) {
    selectOnMap('room', id, false);
    openZoneSheet(id);
    return;
  }
  openChatRoom(id);
}

/* ---------------- 검색 ---------------- */
function closeSearch() {
  searchQ = '';
  if (el.crSearch) el.crSearch.hidden = true;
  if (el.crSearchInput) el.crSearchInput.value = '';
  if (el.crSearchBtn) el.crSearchBtn.setAttribute('aria-expanded', 'false');
}

/* ---------------- 컴포저 ---------------- */
let composerSender = OWNER_ID;
let replyTo = null;          /* {name, snippet} */
let staged = [];             /* 보내기 전 첨부 */

function focusInput() {
  if (!el.chatInput) return;
  try { el.chatInput.focus({ preventScroll: true }); } catch (e) { el.chatInput.focus(); }
}

function autoGrow() {
  const t = el.chatInput;
  if (!t) return;
  t.style.height = 'auto';
  t.style.height = `${Math.min(132, Math.max(22, t.scrollHeight))}px`;
}

function updateSendState() {
  if (!el.cmpSend) return;
  const has = !!(el.chatInput && el.chatInput.value.trim()) || staged.length > 0;
  el.cmpSend.disabled = !has;
  el.chatForm.classList.toggle('has-text', has);
}

function renderComposerWho() {
  if (!el.cmpWho || !state) return;
  const c = charById(composerSender);
  el.cmpWho.innerHTML = avatarHtml(c.id, c.name, 'who-av');
  el.cmpWho.title = `${c.name}(으)로 보내는 중 — 눌러서 바꾸기`;
  el.cmpWho.classList.toggle('is-proxy', composerSender !== OWNER_ID);
}

function renderComposerBars() {
  if (el.cmpReply) {
    el.cmpReply.hidden = !replyTo;
    el.cmpReply.innerHTML = replyTo ? `
      <span class="cb-ico" aria-hidden="true">↩︎</span>
      <span class="cb-main"><b>${esc(replyTo.name)}에게 답장</b><span>${esc(replyTo.snippet)}</span></span>
      <button class="cb-x" type="button" data-cancel-reply aria-label="답장 취소">✕</button>` : '';
  }
  if (el.cmpAs) {
    const proxy = composerSender !== OWNER_ID;
    const c = charById(composerSender);
    el.cmpAs.hidden = !proxy;
    el.cmpAs.innerHTML = proxy ? `
      <span class="cb-ico" aria-hidden="true">${esc(c.emoji)}</span>
      <span class="cb-main"><b>${esc(c.name)}(으)로 보내는 중</b><span>대신 남기는 글로 표시돼요</span></span>
      <button class="cb-x is-text" type="button" data-sender-reset>대장으로</button>` : '';
  }
  renderComposerWho();
}

function renderTray() {
  if (!el.cmpTray) return;
  el.cmpTray.hidden = !staged.length;
  el.cmpTray.innerHTML = staged.map((s) => `
    <div class="tray-item ${s.kind === 'file' ? 'is-file' : ''}">
      ${s.kind === 'image' ? `<img src="${esc(s.preview)}" alt="" />`
        : s.kind === 'video' ? `<video src="${esc(s.preview)}" muted playsinline preload="metadata"></video><span class="tray-badge">▶</span>`
        : `<span class="tray-file"><b>${esc((s.name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase())}</b><span>${esc(s.name)}</span></span>`}
      <span class="tray-size">${esc(fmtSize(s.size))}</span>
      <button class="tray-x" type="button" data-unstage="${esc(s.id)}" aria-label="첨부 빼기">✕</button>
    </div>`).join('');
  updateSendState();
}

function stageFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  let skipped = 0;
  files.forEach((f) => {
    if (staged.length >= 10) { skipped += 1; return; }
    const type = f.type || '';
    const kind = type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : 'file';
    staged.push({
      id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      kind,
      name: f.name || (kind === 'image' ? '사진.jpg' : '첨부'),
      size: f.size,
      preview: kind === 'file' ? null : URL.createObjectURL(f)
    });
  });
  if (skipped) toast('한 번에 10개까지 보낼 수 있어요', 'error');
  setMenuOpen(false);
  renderTray();
  if (!coarsePointer) focusInput();
}

function setMenuOpen(open) {
  if (!el.cmpMenu) return;
  el.cmpMenu.hidden = !open;
  el.chatForm.classList.toggle('menu-open', !!open);
  if (el.cmpPlus) el.cmpPlus.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* @멘션 자동완성 */
let mentionMatch = null;
function hideMentionPop() {
  if (el.mentionPop) el.mentionPop.hidden = true;
  mentionMatch = null;
}
function updateMentionPop() {
  const t = el.chatInput;
  if (!t || !el.mentionPop) return;
  const caret = t.selectionStart == null ? t.value.length : t.selectionStart;
  const before = t.value.slice(0, caret);
  const m = /(^|\s)@([^\s@]{0,8})$/.exec(before);
  if (!m) { hideMentionPop(); return; }
  const q = m[2].toLowerCase();
  const ids = COMPOSER_IDS.filter((id) => id !== composerSender);
  const list = ids.map((id) => charById(id)).filter((c) => !q || c.name.toLowerCase().startsWith(q) || c.id.startsWith(q));
  if (!list.length) { hideMentionPop(); return; }
  mentionMatch = { start: caret - m[2].length - 1, end: caret };
  el.mentionPop.innerHTML = list.map((c) => `
    <button type="button" class="mp-item" data-pick-mention="${esc(c.name)}" role="option">
      ${avatarHtml(c.id, c.name, 'mp-av')}<b>${esc(c.name)}</b><span>${esc(c.role || '')}</span>
    </button>`).join('');
  el.mentionPop.hidden = false;
}
function insertMention(name) {
  const t = el.chatInput;
  if (!t) return;
  let start;
  let end;
  if (mentionMatch) { start = mentionMatch.start; end = mentionMatch.end; } else {
    start = t.selectionStart == null ? t.value.length : t.selectionStart;
    end = t.selectionEnd == null ? start : t.selectionEnd;
  }
  const before = t.value.slice(0, start);
  const after = t.value.slice(end);
  const gap = before && !/\s$/.test(before) ? ' ' : '';
  const insert = `${gap}@${name} `;
  t.value = before + insert + after;
  const pos = (before + insert).length;
  focusInput();
  try { t.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
  hideMentionPop();
  autoGrow();
  updateSendState();
  saveDraft();
}

/* ---------------- 첨부 업로드 ---------------- */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ img, url }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했어요')); };
    img.src = url;
  });
}

async function compressImage(file, maxDim, quality) {
  try {
    const { img, url } = await loadImage(file);
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return null;
    return { blob, dims: `${w}x${h}`, origDims: `${w0}x${h0}` };
  } catch (e) {
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('파일을 읽지 못했어요'));
    r.readAsDataURL(blob);
  });
}

function storageUpload(blob, name, onProgress) {
  return new Promise((resolve, reject) => {
    const d = new Date();
    let safe = String(name || 'file').normalize('NFC').replace(/[^\w.-]+/g, '_').replace(/^_+/, '').slice(-60) || 'file';
    if (safe.startsWith('.')) safe = `file${safe}`;
    const path = `chat/${d.getFullYear()}${pad(d.getMonth() + 1)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE.url}/storage/v1/object/${SUPABASE.bucket}/${path}`);
    xhr.setRequestHeader('apikey', SUPABASE.key);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE.key}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(`${SUPABASE.url}/storage/v1/object/public/${SUPABASE.bucket}/${path}`);
      } else {
        const err = new Error(`저장소 업로드 실패 (${xhr.status})`);
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => { const err = new Error('네트워크 오류'); err.status = 0; reject(err); };
    xhr.send(blob);
  });
}

function attLine(kind, name, url, dims, size) {
  const icon = kind === 'image' ? '🖼️' : kind === 'video' ? '🎬' : '📎';
  const label = String(name || '첨부').replace(/[[\]\n]/g, (c) => (c === '[' ? '(' : c === ']' ? ')' : ' '));
  const meta = [dims, size ? fmtSize(size) : ''].filter(Boolean).join(' · ');
  return `${icon} [${label}](${url})${meta ? ` · ${meta}` : ''}`;
}

async function uploadAttachment(item, onProgress) {
  let blob = item.file;
  let name = item.name;
  let dims = '';
  const isRaster = item.kind === 'image' && !/gif|svg/i.test(item.file.type || '');
  if (isRaster) {
    const c = await compressImage(item.file, 2048, 0.86);
    if (c) {
      dims = c.dims;
      if (c.blob.size < blob.size) {
        blob = c.blob;
        name = name.replace(/\.(heic|heif|png|webp|bmp|tiff?)$/i, '.jpg');
        if (!/\.jpe?g$/i.test(name)) name = `${name.replace(/\.[^.]+$/, '')}.jpg`;
      } else if (c.origDims) {
        dims = c.origDims;
      }
    }
  }
  if (blob.size > UPLOAD_MAX) throw new Error(`${fmtSize(UPLOAD_MAX)}보다 큰 파일은 올릴 수 없어요`);

  if (sb.ok && sb.storage !== false) {
    try {
      const url = await storageUpload(blob, name, onProgress);
      sb.storage = true;
      return attLine(item.kind, name, url, dims, blob.size);
    } catch (err) {
      if (err.status && err.status >= 400 && err.status < 500) sb.storage = false;
      else if (!err.status) throw new Error('업로드 중 연결이 끊겼어요');
    }
  }

  /* 버킷이 없을 때: 작은 파일은 본문에 내장(data URL) */
  if (isRaster) {
    let c = await compressImage(blob, 1280, 0.78);
    if (c && c.blob.size > INLINE_MAX) c = await compressImage(blob, 960, 0.68);
    if (c && c.blob.size <= INLINE_MAX) {
      if (onProgress) onProgress(1);
      return attLine('image', name, await blobToDataUrl(c.blob), c.dims, c.blob.size);
    }
  } else if (blob.size <= INLINE_MAX) {
    if (onProgress) onProgress(1);
    return attLine(item.kind, name, await blobToDataUrl(blob), dims, blob.size);
  }
  throw new Error(`파일 저장소(${SUPABASE.bucket})가 아직 없어 ${fmtSize(INLINE_MAX)} 넘는 파일은 못 올려요`);
}

/* ---------------- 보내기 ---------------- */
function buildContent(quote, text, lines) {
  const parts = [];
  if (quote) parts.push(quote);
  if (text) parts.push(text);
  return parts.concat(lines || []).join('\n').trim();
}

function updateInflightProgress(tmp) {
  const node = el.msgList && el.msgList.querySelector(`[data-mid="${CSS.escape(tmp.id)}"] .up-progress span`);
  if (node) node.style.width = `${Math.round((tmp.progress || 0) * 100)}%`;
}

async function deliver(tmp) {
  const row = { room: tmp.room, sender: tmp.senderName, content: tmp.content };
  if (sb.ok) {
    try {
      const rows = await sbInsert(SUPABASE.tables.messages, row);
      mergeMessages(rows);
      inflight = inflight.filter((m) => m.id !== tmp.id);
      sb.at = new Date().toISOString();
      return true;
    } catch (err) {
      /* 아래 outbox 로 */
    }
  }
  const saved = ChatStore.append({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    room: tmp.room,
    authorId: tmp.authorId,
    senderName: tmp.senderName,
    text: tmp.content,
    at: tmp.at,
    outbox: true
  });
  if (!saved) throw new Error('이 기기 저장 공간이 부족해요');
  inflight = inflight.filter((m) => m.id !== tmp.id);
  toast('DB에 닿지 않아 이 기기에 보관했어요 · 연결되면 자동 전송', 'error');
  return false;
}

async function processInflight(tmp) {
  tmp.status = 'sending';
  tmp.progress = 0;
  onMessagesChanged();
  try {
    const lines = [];
    const files = tmp.files || [];
    for (let i = 0; i < files.length; i += 1) {
      const line = await uploadAttachment(files[i], (p) => {
        tmp.progress = (i + p) / files.length;
        updateInflightProgress(tmp);
      });
      lines.push(line);
      tmp.progress = (i + 1) / files.length;
      updateInflightProgress(tmp);
    }
    tmp.content = buildContent(tmp.quote, tmp.body, lines);
    await deliver(tmp);
    (tmp.files || []).forEach((f) => { if (f.preview) setTimeout(() => URL.revokeObjectURL(f.preview), 4000); });
  } catch (err) {
    tmp.status = 'failed';
    toast(err && err.message ? err.message : '보내지 못했어요', 'error');
  }
  onMessagesChanged();
  renderSyncBadge();
}

function sendMessage() {
  const text = (el.chatInput.value || '').trim();
  const files = staged.slice();
  if (!text && !files.length) return;
  const room = activeRoom === 'all' ? 'boardroom' : activeRoom;
  const authorId = composerSender;
  const senderName = charById(authorId).name;
  const quote = replyTo ? `> ${replyTo.name}: ${replyTo.snippet}` : '';
  /* 보내는 동안 화면에 먼저 보여 줄 말풍선 (첨부는 미리보기 주소로) */
  const previewLines = files.map((f) => attLine(f.kind, f.name, f.preview || 'pending:', '', f.size));
  const tmp = {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    room,
    authorId,
    senderName,
    quote,
    body: text,
    files,
    hasFiles: files.length > 0,
    text: buildContent(quote, text, previewLines),
    at: new Date().toISOString(),
    status: 'sending',
    progress: 0
  };
  inflight.push(tmp);
  el.chatInput.value = '';
  delete drafts[activeRoom];
  write(KEY.draft, drafts);
  staged = [];
  replyTo = null;
  renderTray();
  renderComposerBars();
  autoGrow();
  updateSendState();
  hideMentionPop();
  setMenuOpen(false);
  chatPinnedBottom = true;
  processInflight(tmp);
  jumpChatToBottom();
}

let flushing = false;
async function flushOutbox() {
  if (flushing || !sb.ok) return;
  const box = ChatStore.all().filter((m) => m.outbox);
  if (!box.length) return;
  flushing = true;
  let sent = 0;
  for (const m of box) {
    try {
      const rows = await sbInsert(SUPABASE.tables.messages, { room: m.room, sender: m.senderName, content: m.text });
      mergeMessages(rows);
      ChatStore.remove(m.id);
      sent += 1;
    } catch (err) {
      break;
    }
  }
  flushing = false;
  if (sent) {
    toast(`보관해 둔 메시지 ${sent}개를 보냈어요`);
    onMessagesChanged();
  }
}

/* ---------------- 메시지 메뉴 (길게 누르기 · 우클릭) ---------------- */
function findMessage(mid) {
  return allMessages().find((m) => String(m.id) === String(mid)) || null;
}

function openMsgActions(mid) {
  const m = findMessage(mid);
  if (!m) return;
  const p = parseContent(m.text);
  const snippet = (p.text || previewText(m.text)).replace(/\s+/g, ' ').slice(0, 48);
  const canDelete = (m.source === 'supabase' && m.authorId === OWNER_ID) || m.source === 'outbox' || m.source === 'local';
  const actions = [
    { id: 'reply', ico: '↩︎', label: '답장' },
    p.text ? { id: 'copy', ico: '⧉', label: '복사' } : null,
    m.room && m.room !== activeRoom && activeRoom === 'all' ? { id: 'goto', ico: '→', label: `${roomById(m.room).name}으로 가기` } : null,
    canDelete ? { id: 'delete', ico: '🗑', label: '삭제', danger: true } : null
  ].filter(Boolean);
  openSheet({
    emoji: '💬',
    title: authorName(m),
    sub: `${fmtDayLabel(m.at)} ${fmtTime(m.at)}`,
    html: `<p class="sheet-quote">${esc(snippet || '(첨부)')}</p>
      <div class="action-list">${actions.map((a) => `
        <button class="action-item ${a.danger ? 'is-danger' : ''}" type="button" data-act="${a.id}">
          <span class="ai-ico" aria-hidden="true">${a.ico}</span>${esc(a.label)}
        </button>`).join('')}</div>`,
    onClick: async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'reply') {
        closeSheet();
        replyTo = { name: authorName(m), snippet: snippet || '첨부' };
        renderComposerBars();
        focusInput();
      } else if (act === 'copy') {
        closeSheet();
        try {
          await navigator.clipboard.writeText(p.text);
          toast('복사했어요');
        } catch (err) {
          toast('복사하지 못했어요', 'error');
        }
      } else if (act === 'goto') {
        closeSheet();
        openChatRoom(m.room);
      } else if (act === 'delete') {
        if (!b.classList.contains('is-confirm')) {
          b.classList.add('is-confirm');
          b.lastChild.textContent = '한 번 더 누르면 삭제';
          return;
        }
        closeSheet();
        await deleteMessage(m);
      }
    }
  });
}

async function deleteMessage(m) {
  if (m.source === 'supabase') {
    try {
      await sbRemove(SUPABASE.tables.messages, m.dbId);
      sb.messages = (sb.messages || []).filter((r) => String(r.id) !== String(m.dbId));
      toast('메시지를 삭제했어요');
    } catch (err) {
      toast('삭제 권한이 없거나 연결이 끊겼어요', 'error');
      return;
    }
  } else {
    ChatStore.remove(m.id);
  }
  onMessagesChanged();
}

/* ---------------- 보내는 사람 시트 ---------------- */
function openSenderSheet() {
  setMenuOpen(false);
  openSheet({
    emoji: '👤',
    title: '보내는 사람',
    sub: '대장님 대신 비서 이름으로 남길 때만 바꾸세요',
    html: `<div class="pick-list">${COMPOSER_IDS.map((id) => {
      const c = charById(id);
      return `<button class="pick-item ${id === composerSender ? 'is-active' : ''}" type="button" data-pick-sender="${esc(id)}">
        ${avatarHtml(id, c.name, 'pick-av')}
        <span class="pick-main"><b>${esc(c.name)}</b><span>${esc(c.role || '')}${HERO[id] ? ` · ${esc(HERO[id])}` : ''}</span></span>
        <span class="pick-check" aria-hidden="true">${id === composerSender ? '✓' : ''}</span>
      </button>`;
    }).join('')}</div>`,
    onClick: (e) => {
      const b = e.target.closest('[data-pick-sender]');
      if (!b) return;
      composerSender = b.dataset.pickSender;
      closeSheet();
      renderComposerBars();
      focusInput();
    }
  });
}

/* ---------------- 사진 크게 보기 ---------------- */
function openViewer(src, name) {
  if (!el.viewer || !src) return;
  el.viewerImg.src = src;
  el.viewerImg.alt = name || '';
  el.viewerName.textContent = name || '';
  el.viewerSave.href = src;
  el.viewerSave.setAttribute('download', name || 'photo.jpg');
  el.viewer.hidden = false;
  requestAnimationFrame(() => el.viewer.classList.add('is-open'));
}
function closeViewer() {
  if (!el.viewer || el.viewer.hidden) return;
  el.viewer.classList.remove('is-open');
  setTimeout(() => { el.viewer.hidden = true; el.viewerImg.removeAttribute('src'); }, 200);
}

/* ---------------- iOS Safari 키보드 · visualViewport ----------------
   대화방(.chat-room)은 모바일에서 position:fixed 이고 top/height 를
   visualViewport.offsetTop / height 로 맞춘다. 키보드·폼 액세서리 바·하단 주소창이
   생기고 사라질 때마다 다시 맞추므로 입력창이 늘 키보드 바로 위에 붙는다. */
let vvFrame = 0;
let kbOpen = false;
function syncViewport() {
  vvFrame = 0;
  const root = document.documentElement;
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  const top = vv ? vv.offsetTop : 0;
  root.style.setProperty('--vv-h', `${Math.round(h)}px`);
  root.style.setProperty('--vv-top', `${Math.round(top)}px`);
  const layoutH = window.innerHeight || root.clientHeight || h;
  root.style.setProperty('--kb', `${Math.max(0, Math.round(layoutH - h - top))}px`);
  const typing = !!(document.activeElement && el.chatForm && el.chatForm.contains(document.activeElement)
    && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName));
  const open = (layoutH - h > 120) || (typing && coarsePointer && layoutH - h > 60);
  if (open !== kbOpen) {
    kbOpen = open;
    document.body.classList.toggle('kb-open', open);
    if (roomOpen || mqDesktop.matches) {
      if (chatPinnedBottom) jumpChatToBottom();
    }
  } else if (roomOpen && chatPinnedBottom) {
    applyChatJump();
  }
  /* 잠긴 페이지를 Safari 가 밀어 올렸으면 되돌린다 */
  if (roomOpen && window.scrollY && document.documentElement.classList.contains('is-locked')) window.scrollTo(0, 0);
}
function scheduleViewport() {
  if (vvFrame) return;
  vvFrame = requestAnimationFrame(syncViewport);
}

/* =========================================================
   공용 바텀시트
   ========================================================= */
let sheetHandler = null;
let sheetLastFocus = null;
let zoneOpenId = null;

function openSheet(opts) {
  if (!el.sheet) return;
  const o = opts || {};
  if (!el.sheet.contains(document.activeElement)) sheetLastFocus = document.activeElement;
  zoneOpenId = o.zone || null;
  el.sheet.classList.toggle('is-zone', !!o.zone);
  el.sheetEmoji.textContent = o.emoji || '';
  el.sheetEmoji.hidden = !o.emoji;
  el.sheetTitle.textContent = o.title || '';
  el.sheetSub.textContent = o.sub || '';
  el.sheetSub.hidden = !o.sub;
  el.sheetBody.innerHTML = o.html || '';
  el.sheetBody.scrollTop = 0;
  sheetHandler = { onClick: o.onClick || null, onSubmit: o.onSubmit || null, onInput: o.onInput || null };
  el.sheet.hidden = false;
  el.sheetBackdrop.hidden = false;
  el.sheetBody.scrollTop = 0;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.sheet.classList.add('is-open');
    el.sheetBackdrop.classList.add('is-open');
  }));
  if (typeof o.onMount === 'function') o.onMount(el.sheetBody);
  if (!coarsePointer && el.sheetClose) el.sheetClose.focus({ preventScroll: true });
}

function closeSheet() {
  if (!el.sheet || el.sheet.hidden) return;
  zoneOpenId = null;
  sheetHandler = null;
  el.sheet.classList.remove('is-open');
  el.sheetBackdrop.classList.remove('is-open');
  document.body.classList.remove('sheet-open');
  const sheetEl = el.sheet;
  setTimeout(() => {
    if (sheetEl.classList.contains('is-open')) return;   /* 그새 다른 시트를 열었으면 그대로 */
    sheetEl.hidden = true;
    el.sheetBackdrop.hidden = true;
    el.sheetBody.innerHTML = '';
  }, 260);
  if (!coarsePointer && sheetLastFocus && typeof sheetLastFocus.focus === 'function') {
    sheetLastFocus.focus({ preventScroll: true });
  }
  sheetLastFocus = null;
}

/* =========================================================
   탭 1 · 오피스 맵
   ========================================================= */
function renderRoomChips() {
  const rooms = state.rooms || [];
  const chips = [
    `<button class="chip toggle-chip ${motionOn ? '' : 'is-off'}" type="button" data-toggle-motion aria-pressed="${motionOn}">
       <span class="switch-track" aria-hidden="true"></span>움직임 ${motionOn ? 'ON' : 'OFF'}
     </button>`
  ].concat(rooms.map((r) => {
    const on = r.state === 'on';
    const sel = selected && selected.type === 'room' && selected.id === r.id;
    const zone = isZoneRoom(r.id);
    const team = /^team[12]$/.test(r.id);
    const attr = zone ? `data-zone="${esc(r.id)}"` : `data-room-jump="${esc(r.id)}"`;
    const n = zone ? 0 : unreadIn(r.id);
    return `<button class="chip ${sel ? 'is-active' : ''} ${zone ? 'is-zone' : ''} ${team ? 'is-team' : ''}" type="button" ${attr}>
      <span class="dot ${on ? '' : 'is-idle'}"></span>${esc(r.emoji)} ${esc(r.name)}
      <span class="chip-sub">${esc(r.status)}</span>${n ? `<span class="chip-badge">${n > 9 ? '9+' : n}</span>` : ''}
    </button>`;
  }));
  el.roomChips.innerHTML = chips.join('');
}

function renderMap() {
  el.mapStage.classList.toggle('motion-on', motionOn);

  el.roomLabels.innerHTML = (state.rooms || []).filter((r) => r.map !== false).map((r) => {
    const sel = selected && selected.type === 'room' && selected.id === r.id;
    const zone = isZoneRoom(r.id);
    const attr = zone ? `data-zone="${esc(r.id)}"` : `data-room="${esc(r.id)}"`;
    const hint = zone ? `${esc(r.name)} 현황판 열기` : `${esc(r.name)} 대화방으로 이동`;
    return `<button class="room-label ${sel ? 'is-selected' : ''} ${zone ? 'is-zone' : ''}" type="button"
      ${attr} style="left:${Number(r.x)}%;top:${Number(r.y)}%"
      aria-label="${esc(r.emoji)} ${esc(r.name)} — ${hint}" title="${hint}">
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

function chatRoomFor(charId) {
  const team = teamOf(charId);
  if (team) return team.id;
  const c = charById(charId);
  return c.room && !isZoneRoom(c.room) ? c.room : 'boardroom';
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
    const last = lastMessageBy(c.id);
    const talkRoom = chatRoomFor(c.id);
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
        <div class="detail-row"><span class="k">지금</span><span class="v is-strong">${esc(c.task || '—')}</span></div>
        <div class="detail-row"><span class="k">다음</span><span class="v">${esc(c.next || '—')}</span></div>
        <div class="detail-row"><span class="k">최근</span><span class="v">${last ? `${esc(fmtAgo(last.at))} · “${esc(previewText(last.text).slice(0, 60))}”` : esc(c.lastActive || '—')}</span></div>
      </div>
      <div class="detail-actions">
        <button class="detail-jump" type="button" data-talk="${esc(c.id)}" data-talk-room="${esc(talkRoom)}">💬 ${c.id === OWNER_ID ? '회의실 열기' : `${esc(c.name)}에게 말 걸기`}</button>
      </div>`;
  } else {
    const r = roomById(selected.id);
    const members = (state.characters || []).filter((c) => c.room === r.id);
    el.mapDetail.innerHTML = `
      <div class="detail-top">
        <div class="detail-avatar" aria-hidden="true">${esc(r.emoji)}</div>
        <div class="detail-id">
          <h3>${esc(r.name)}</h3>
          <p>${esc(r.summary || '')}</p>
        </div>
        <span class="pill ${pillClass(r.state)}">${esc(r.status || '')}</span>
        <button class="detail-close" type="button" data-close-detail aria-label="닫기">✕</button>
      </div>
      <div class="detail-body">
        <div class="detail-row"><span class="k">이 방에서</span><span class="v">${(r.work || []).map((w) => `· ${esc(w)}`).join('<br>') || '—'}</span></div>
        <div class="detail-row"><span class="k">자리</span><span class="v">${members.length ? members.map((m) => `${esc(m.emoji)} ${esc(m.name)}`).join(' · ') : '비어 있음'}</span></div>
      </div>
      <div class="detail-actions">
      ${isZoneRoom(r.id)
        ? `<button class="detail-jump" type="button" data-zone="${esc(r.id)}">${esc(r.emoji)} ${esc(r.name)} 현황판 열기 →</button>`
        : `<button class="detail-jump" type="button" data-open-room="${esc(r.id)}">${esc(r.emoji)} ${esc(r.name)} 대화방 열기 →</button>`}
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

/* 비서에게 말 걸기 — 그 비서가 있는 방을 열고 @이름 을 미리 넣어 둔다 */
function talkTo(charId, roomId) {
  openChatRoom(roomId || chatRoomFor(charId));
  if (charId && charId !== OWNER_ID && el.chatInput) {
    const name = charById(charId).name;
    if (!el.chatInput.value.includes(`@${name}`)) {
      el.chatInput.value = `@${name} ${el.chatInput.value}`.trimEnd() + ' ';
      autoGrow();
      updateSendState();
    }
    focusInput();
  }
}

/* =========================================================
   성과실 · 제작실 (현황판 시트)
   ========================================================= */
const ZONE_META = {
  performance: { emoji: '📊', sub: '채널별 최신 성과 — 한눈에' },
  workshop: { emoji: '🛠️', sub: '클로드 외주 · 프로그램 제작 현황' }
};

function zoneRoom(id) {
  return (state && (state.rooms || []).find((r) => r.id === id)) || { id, name: id, emoji: '📊', summary: '' };
}

function perfCard(c) {
  const metrics = (c.metrics || []).map((m) => `
      <div class="zc-metric"><b>${esc(m.v)}</b><span>${esc(m.k)}</span></div>`).join('');
  const pillCls = /워밍업|직할|준비/.test(String(c.status || '')) ? 'is-idle' : 'is-on';
  return `<article class="zone-card" style="--accent:${esc(c.accent || '#0284c7')}">
    <div class="zone-card-head">
      <span class="zc-emoji" aria-hidden="true">${esc(c.emoji || '📊')}</span>
      <div class="zc-id">
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.handle || '')}${c.owner ? ` · ${esc(c.owner)} 담당` : ''}</p>
      </div>
      <span class="pill ${pillCls}">${esc(c.status || '')}</span>
    </div>
    ${metrics ? `<div class="zc-metrics">${metrics}</div>` : ''}
    ${c.note ? `<p class="zc-note">${esc(c.note)}</p>` : ''}
    ${c.link ? `<a class="zc-link" href="${esc(c.link)}" target="_blank" rel="noopener">발행 글 보기 →</a>` : ''}
  </article>`;
}

function workshopCard(p) {
  const tags = (p.stack || []).map((t) => `<span class="zc-tag">${esc(t)}</span>`).join('');
  return `<article class="zone-card" style="--accent:${esc(p.accent || '#0284c7')}">
    <div class="zone-card-head">
      <span class="zc-emoji" aria-hidden="true">${esc(p.emoji || '🛠️')}</span>
      <div class="zc-id">
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.handle || '')}${p.owner ? ` · ${esc(p.owner)}` : ''}</p>
      </div>
      <span class="pill is-on">${esc(p.status || '')}</span>
    </div>
    ${tags ? `<div class="zc-tags">${tags}</div>` : ''}
    ${p.note ? `<p class="zc-note">${esc(p.note)}</p>` : ''}
    ${p.link ? `<a class="zc-link" href="${esc(p.link)}" target="_blank" rel="noopener">사이트 열기 →</a>` : ''}
  </article>`;
}

function zoneHtml(id) {
  const data = id === 'performance' ? (state && state.performance) : (state && state.workshop);
  const list = id === 'performance'
    ? ((data && data.channels) || []).map(perfCard).join('')
    : ((data && data.projects) || []).map(workshopCard).join('');
  const note = (data && data.note) || '';
  const updated = data && data.updatedAt ? `업데이트 ${fmtStamp(data.updatedAt)}` : '';
  return `${note || updated ? `<p class="zone-note">${esc([note, updated].filter(Boolean).join(' · '))}</p>` : ''}
    <div class="zone-list">${list || '<p class="zone-note">표시할 카드가 아직 없어요.</p>'}</div>
    <button class="ghost-btn is-block" type="button" data-zone-report="${esc(id)}">💬 회의실에 수치 갱신 요청하기</button>`;
}

function renderZoneSheet(id) {
  if (!el.sheet || el.sheet.hidden || zoneOpenId !== id) return;
  el.sheetBody.innerHTML = zoneHtml(id);
}

function openZoneSheet(id) {
  if (!ZONE_IDS.includes(id)) return;
  const room = zoneRoom(id);
  const meta = ZONE_META[id] || ZONE_META.performance;
  openSheet({
    zone: id,
    emoji: room.emoji || meta.emoji,
    title: room.name,
    sub: meta.sub,
    html: zoneHtml(id),
    onClick: (e) => {
      const b = e.target.closest('[data-zone-report]');
      if (!b) return;
      closeSheet();
      openChatRoom('boardroom');
      el.chatInput.value = `@후후 ${room.name} 카드 최신 수치로 갱신 부탁해 `;
      autoGrow();
      updateSendState();
      focusInput();
    }
  });
}

/* =========================================================
   탭 3 · 작업실
   ========================================================= */
function customTasks() {
  const list = read(KEY.tasks, []);
  return Array.isArray(list) ? list : [];
}

const TASK_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'doing', label: '진행중' },
  { id: 'wait', label: '대기' },
  { id: 'done', label: '완료' }
];
function taskBucket(status) {
  const s = String(status || '');
  if (/완료/.test(s)) return 'done';
  if (/대기|보류|준비/.test(s)) return 'wait';
  return 'doing';
}

function renderProjects() {
  const rows = projectRows();
  const counts = { all: rows.length, doing: 0, wait: 0, done: 0 };
  rows.forEach((r) => { counts[taskBucket(r.status)] += 1; });
  if (el.taskFilter) {
    el.taskFilter.innerHTML = TASK_FILTERS.map((f) => `
      <button class="seg-btn ${taskFilter === f.id ? 'is-active' : ''}" type="button" role="tab"
        aria-selected="${taskFilter === f.id}" data-task-filter="${f.id}">${f.label}<span>${counts[f.id]}</span></button>`).join('');
  }
  const list = rows.filter((r) => taskFilter === 'all' || taskBucket(r.status) === taskFilter);
  if (!list.length) {
    el.projectList.innerHTML = `<div class="empty-card"><b>여기엔 작업이 없어요</b><span>오른쪽 위 ‘+ 새 작업’으로 비서에게 일을 맡겨 보세요.</span></div>`;
    return;
  }
  el.projectList.innerHTML = list.map((p, i) => {
    const bucket = taskBucket(p.status);
    const live = p.source === 'supabase';
    const pct = Math.max(0, Math.min(100, Number(p.progress) || 0));
    const ownerId = normSender(p.owner);
    return `<article class="project-card is-${bucket} ${live ? 'is-live' : ''}" style="--tint:${TINTS[i % TINTS.length]}">
      <button class="project-hit" type="button" data-edit-task="${esc(p.id)}" aria-label="${esc(p.title)} 편집"></button>
      <div class="project-head">
        <span class="project-emoji" aria-hidden="true">${esc(p.emoji || '📌')}</span>
        <div class="project-title-wrap">
          <h3 class="project-title">${esc(p.title)}</h3>
          <p class="project-owner">${ownerId ? avatarHtml(ownerId, p.owner, 'owner-av') : ''}${esc(p.owner || '미정')}${p.updated ? ` · ${esc(p.updated)}` : ''}</p>
        </div>
        <span class="pill ${statusTone(p.status)}">${esc(p.status || '')}</span>
      </div>
      ${p.next ? `<p class="project-next"><b>다음</b>${esc(p.next)}</p>` : ''}
      ${p.detail ? `<p class="project-detail">${esc(p.detail)}</p>` : ''}
      <div class="project-progress">
        <div class="project-bar"><span style="width:${pct}%"></span></div>
        <span class="project-pct">${pct}%</span>
      </div>
      <div class="project-foot">
        <div class="project-tags">${p.badge ? `<span class="project-tag is-badge">${esc(p.badge)}</span>` : ''}${(p.tags || []).map((t) => `<span class="project-tag">${esc(t)}</span>`).join('')}${live ? '<span class="project-tag is-live">LIVE</span>' : ''}</div>
        ${p.link ? `<a class="project-link" href="${esc(p.link)}" target="_blank" rel="noopener">열기 ↗</a>` : ''}
      </div>
    </article>`;
  }).join('');
}

const OWNER_OPTIONS = ['후후', '뮤즈', '제미나이', 'Cue', 'Vooy', '대장'];

function openTaskSheet(id) {
  const rows = projectRows();
  const p = id ? rows.find((r) => String(r.id) === String(id)) : null;
  const isNew = !p;
  const cur = p || { title: '', status: '진행중', progress: 0, owner: '후후', detail: '', link: '' };
  const statuses = ['진행중', '대기', '완료'];
  if (cur.status && !statuses.includes(cur.status)) statuses.unshift(cur.status);
  const owners = OWNER_OPTIONS.slice();
  if (cur.owner && !owners.includes(cur.owner)) owners.push(cur.owner);
  const detailVal = p ? (p.source === 'seed' ? (p.detail || '') : (p.detail || '')) : '';
  const canDelete = p && (p.source === 'supabase' || p.source === 'local');
  openSheet({
    emoji: isNew ? '📝' : (cur.emoji || '📌'),
    title: isNew ? '새 작업 지시' : '작업 편집',
    sub: isNew ? '맡길 비서와 다음 할 일을 정해 주세요' : (p.source === 'seed' ? '기본 카드 — 저장하면 실시간 DB 값으로 덮어써요' : '저장하면 실시간 DB에 바로 반영돼요'),
    html: `<form class="sheet-form" id="task-sheet-form">
      <label class="field"><span>작업 이름</span>
        <input name="title" type="text" maxlength="80" required value="${esc(cur.title)}" placeholder="예: 이번 주 스레드 소재 5개 뽑기" /></label>
      <div class="field"><span>상태</span>
        <div class="seg is-fill" data-status-seg>${statuses.map((s) => `<button type="button" class="seg-btn ${s === cur.status ? 'is-active' : ''}" data-status="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <input type="hidden" name="status" value="${esc(cur.status)}" /></div>
      <label class="field"><span>진행률 <b class="prog-out">${Number(cur.progress) || 0}%</b></span>
        <input name="progress" type="range" min="0" max="100" step="5" value="${Number(cur.progress) || 0}" /></label>
      <label class="field"><span>맡는 비서</span>
        <select name="owner">${owners.map((o) => `<option ${o === cur.owner ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
      <label class="field"><span>다음 할 일 · 메모 <em>(선택)</em></span>
        <textarea name="detail" rows="3" maxlength="400" placeholder="예: 목요일 저녁 9시 전까지 초안">${esc(detailVal)}</textarea></label>
      <label class="field"><span>링크 <em>(선택)</em></span>
        <input name="link" type="url" inputmode="url" value="${esc(cur.link || '')}" placeholder="https://" /></label>
      <label class="check-row"><input type="checkbox" name="share" ${isNew ? 'checked' : ''} /> <span>회의실에 알리기 (맡은 비서를 @멘션)</span></label>
      <div class="sheet-actions">
        ${canDelete ? `<button class="ghost-btn is-danger" type="button" data-del-task>${p.overridden ? '원래대로' : '삭제'}</button>` : ''}
        <button class="primary-btn" type="submit">${isNew ? '작업실에 추가' : '저장'}</button>
      </div>
    </form>`,
    onClick: async (e) => {
      const seg = e.target.closest('[data-status]');
      if (seg) {
        const form = el.sheetBody.querySelector('form');
        form.status.value = seg.dataset.status;
        form.querySelectorAll('[data-status]').forEach((b) => b.classList.toggle('is-active', b === seg));
        if (/완료/.test(seg.dataset.status)) { form.progress.value = 100; form.querySelector('.prog-out').textContent = '100%'; }
        return;
      }
      const del = e.target.closest('[data-del-task]');
      if (del) {
        if (!del.classList.contains('is-confirm')) {
          del.classList.add('is-confirm');
          del.textContent = '한 번 더 누르면 삭제';
          return;
        }
        await deleteTask(p);
        closeSheet();
      }
    },
    onInput: (e) => {
      if (e.target.name === 'progress') {
        const out = el.sheetBody.querySelector('.prog-out');
        if (out) out.textContent = `${e.target.value}%`;
      }
    },
    onSubmit: async (e) => {
      const f = e.target;
      const title = f.title.value.trim();
      if (!title) { f.title.focus(); return; }
      const row = {
        id: p ? p.id : `task-${Date.now()}`,
        title,
        status: f.status.value || '진행중',
        progress: Number(f.progress.value) || 0,
        owner: f.owner.value,
        detail: f.detail.value.trim(),
        link: f.link.value.trim() || null
      };
      const btn = f.querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      const ok = await saveTask(row, p);
      if (btn) btn.disabled = false;
      if (!ok) return;
      if (f.share.checked) shareTaskUpdate(row, isNew);
      closeSheet();
    }
  });
}

async function saveTask(row, prev) {
  if (sb.ok) {
    try {
      const rows = prev && (prev.source === 'seed' || prev.source === 'supabase')
        ? await sbUpsert(SUPABASE.tables.tasks, row)
        : await sbInsert(SUPABASE.tables.tasks, row);
      const saved = Array.isArray(rows) && rows[0] ? rows[0] : Object.assign({ updated_at: new Date().toISOString() }, row);
      sb.tasks = (sb.tasks || []).filter((t) => String(t.id) !== String(saved.id));
      sb.tasks.unshift(saved);
      toast(prev ? '작업을 저장했어요' : '작업실에 추가했어요');
      renderProjects();
      return true;
    } catch (err) {
      if (prev && prev.source !== 'local') {
        toast(`저장 실패 — ${err.message || '연결을 확인해 주세요'}`, 'error');
        return false;
      }
    }
  }
  if (prev && prev.source === 'seed') {
    toast('DB에 연결돼야 기본 카드를 고칠 수 있어요', 'error');
    return false;
  }
  const list = customTasks().filter((t) => String(t.id) !== String(row.id));
  list.unshift(Object.assign({ emoji: ownerEmoji(row.owner), created: new Date().toISOString() }, row, { next: row.detail }));
  write(KEY.tasks, list);
  toast('DB에 닿지 않아 이 기기에만 저장했어요', 'error');
  renderProjects();
  return true;
}

async function deleteTask(p) {
  if (!p) return;
  if (p.source === 'supabase') {
    try {
      await sbRemove(SUPABASE.tables.tasks, p.id);
      sb.tasks = (sb.tasks || []).filter((t) => String(t.id) !== String(p.id));
      toast(p.overridden ? '기본 카드 값으로 되돌렸어요' : '작업을 삭제했어요');
    } catch (err) {
      toast('삭제 실패 — 잠시 후 다시 시도해 주세요', 'error');
      return;
    }
  } else {
    write(KEY.tasks, customTasks().filter((t) => String(t.id) !== String(p.id)));
    toast('작업을 삭제했어요');
  }
  renderProjects();
}

function shareTaskUpdate(row, isNew) {
  const ownerId = normSender(row.owner);
  const mention = ownerId && ownerId !== OWNER_ID ? `@${charById(ownerId).name} ` : '';
  const head = isNew ? '📌 새 작업' : '📌 작업 업데이트';
  const body = `${mention}${head} — ${row.title}\n상태 ${row.status} · 진행 ${row.progress}%${row.detail ? `\n다음: ${row.detail}` : ''}`;
  const room = ownerId ? chatRoomFor(ownerId) : 'boardroom';
  const tmp = {
    id: `tmp-${Date.now()}-task`,
    room,
    authorId: OWNER_ID,
    senderName: charById(OWNER_ID).name,
    quote: '',
    body,
    files: [],
    text: body,
    at: new Date().toISOString(),
    status: 'sending'
  };
  inflight.push(tmp);
  processInflight(tmp);
}

/* =========================================================
   탭 4 · 비서현황
   ========================================================= */
function renderLinkPanel() {
  if (!el.linkPanel) return;
  const items = [
    {
      on: sb.ok,
      title: '실시간 DB',
      text: sb.ok ? `연결됨 · ${fmtTime(sb.at)} 확인` : (sb.error ? `연결 실패 — ${sb.error}` : '연결 중…')
    },
    {
      on: sb.realtime === 'on',
      warn: sb.ok && sb.realtime !== 'on',
      title: '새 글 알림',
      text: sb.realtime === 'on' ? '즉시 반영 (Realtime)' : (sb.ok ? '4초마다 새 글 확인' : '대기')
    },
    {
      on: sb.storage === true,
      warn: sb.storage !== true,
      title: '파일 저장소',
      text: sb.storage === true ? `${SUPABASE.bucket} 버킷 사용 중` : sb.storage === false
        ? `버킷 없음 · ${fmtSize(INLINE_MAX)} 이하만 본문에 내장` : '첫 첨부 때 확인'
    },
    {
      on: true,
      title: '데이터',
      text: `메시지 ${(sb.messages || []).length} · 작업 ${(sb.tasks || []).length} · 메모 ${(sb.memos || []).length} · 비서 ${(sb.agents || []).length}`
    }
  ];
  el.linkPanel.innerHTML = `
    <div class="lp-grid">${items.map((it) => `
      <div class="lp-item">
        <span class="lp-dot ${it.on ? 'is-on' : it.warn ? 'is-warn' : 'is-off'}" aria-hidden="true"></span>
        <span class="lp-main"><b>${esc(it.title)}</b><span>${esc(it.text)}</span></span>
      </div>`).join('')}
    </div>
    <div class="lp-foot">
      <span>외부 에이전트는 <code>office_messages</code> · <code>office_tasks</code> · <code>office_memos</code> · <code>office_agents</code> 에 쓰면 바로 보여요.</span>
      <a class="text-btn" href="https://github.com/seungh6118/seunghu-office/blob/main/AGENT_SYNC.md" target="_blank" rel="noopener">연동 가이드 ↗</a>
    </div>`;
}

function agentCard(a) {
  const c = charById(a.id);
  const team = teamOf(a.id);
  const isLeader = team && team.leader === a.id;
  const last = lastMessageBy(a.id);
  const activity = [a.updatedAt, last && last.at].filter(Boolean).sort((x, y) => ts(y) - ts(x))[0];
  const room = chatRoomFor(a.id);
  return `<article class="agent-card ${a.source === 'supabase' ? 'is-live' : ''}" style="--tint:${esc(c.color || '#0284c7')}">
    <div class="agent-head">
      <span class="agent-avatar" style="--tint:${esc(c.color || '#0284c7')}" aria-hidden="true">${charArt(a.id) || esc(a.emoji)}</span>
      <div class="agent-id">
        <h3>${esc(a.name)}${isLeader ? '<span class="leader-tag">팀장</span>' : ''}</h3>
        <p>${esc(a.role)}${HERO[a.id] ? ` · ${esc(HERO[a.id])}` : ''}</p>
      </div>
      <span class="pill ${statusTone(a.state)}">${esc(a.state)}</span>
    </div>
    <div class="agent-now"><span class="k">지금</span><p>${esc(a.task || '—')}</p></div>
    ${a.next ? `<div class="agent-now is-next"><span class="k">다음</span><p>${esc(a.next)}</p></div>` : ''}
    ${last ? `<button class="agent-last" type="button" data-open-chat="${esc(last.room)}">
        <span class="al-room">${esc(roomById(last.room).emoji)}</span>
        <span class="al-text">${esc(previewText(last.text))}</span>
        <time>${esc(fmtAgo(last.at))}</time>
      </button>` : ''}
    <div class="agent-meta">
      <span>최근 활동 <b>${esc(activity ? fmtAgo(activity) : (a.lastActive || '—'))}</b></span>
      ${a.load ? `<span>부하 <b>${esc(a.load)}</b></span>` : ''}
      ${a.source === 'supabase' ? '<span class="live-tag">LIVE</span>' : ''}
    </div>
    ${(a.skills || []).length ? `<div class="agent-skills">${a.skills.map((s) => `<span class="agent-skill">${esc(s)}</span>`).join('')}</div>` : ''}
    <div class="agent-actions">
      <button class="ghost-btn" type="button" data-talk="${esc(a.id)}" data-talk-room="${esc(room)}">💬 ${esc(roomById(room).name)}에서 말 걸기</button>
      <button class="ghost-btn" type="button" data-talk="${esc(a.id)}" data-talk-room="boardroom">@ 회의실</button>
    </div>
  </article>`;
}

function renderAgents() {
  const rows = agentRows();
  const groups = [];
  const used = new Set();
  ((state && state.teams) || []).forEach((t) => {
    const members = rows.filter((a) => (t.members || []).includes(a.id))
      .sort((x, y) => (x.id === t.leader ? -1 : y.id === t.leader ? 1 : 0));
    members.forEach((a) => used.add(a.id));
    if (members.length) groups.push({ title: `${t.emoji} ${t.name}`, sub: `팀장 ${charById(t.leader).name}`, list: members, room: t.id });
  });
  const rest = rows.filter((a) => !used.has(a.id));
  if (rest.length) groups.push({ title: '✨ 자문 · 지원', sub: '회의실 상주', list: rest, room: 'boardroom' });
  el.agentCards.innerHTML = groups.map((g) => `
    <section class="agent-group">
      <header class="group-head">
        <h3>${esc(g.title)}</h3><span>${esc(g.sub)} · ${g.list.length}명</span>
        <button class="text-btn" type="button" data-open-chat="${esc(g.room)}">방 열기 →</button>
      </header>
      <div class="agent-grid">${g.list.map(agentCard).join('')}</div>
    </section>`).join('');

  el.scheduleList.innerHTML = (state.schedules || []).map((s) => {
    const pillCls = s.status === '다음 실행' ? 'is-on' : s.status === '자동' ? 'is-done' : 'is-idle';
    return `<li class="tl-item" data-status="${esc(s.status)}">
      <div class="tl-time">${esc(s.time)}</div>
      <div class="tl-body">
        <div class="tl-title">${esc(s.title)}</div>
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

/* =========================================================
   탭 5 · 메모
   ========================================================= */
let memoQuery = '';

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
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (ts(b.created) - ts(a.created)));
}

function renderMemos() {
  const all = memoRows();
  const q = memoQuery.trim().toLowerCase();
  const list = q ? all.filter((m) => String(m.text).toLowerCase().includes(q)) : all;
  if (!list.length) {
    el.memoList.innerHTML = `<li class="memo-empty">${q ? `‘${esc(memoQuery)}’ 메모가 없어요` : '메모가 없어요. 위에서 바로 추가해 보세요.'}</li>`;
    return;
  }
  el.memoList.innerHTML = list.map((m) => `
    <li class="memo-card ${m.pinned ? 'is-pinned' : ''} ${m.source === 'supabase' ? 'is-live' : ''}">
      <button class="memo-text" type="button" data-edit-memo="${esc(m.id)}">${esc(m.text)}</button>
      <div class="memo-foot">
        <span class="memo-date">${esc(fmtListTime(m.created))}${m.pinned ? ' · 📌 고정' : ''}${m.source === 'supabase' ? ' · LIVE' : m.source === 'local' ? ' · 이 기기' : ''}</span>
        <span class="memo-actions">
          <button class="icon-btn ${m.pinned ? 'is-on' : ''}" type="button" data-pin="${esc(m.id)}" data-source="${esc(m.source)}"
            aria-pressed="${m.pinned}" aria-label="${m.pinned ? '고정 해제' : '핀 고정'}">${m.pinned ? '📌' : '📍'}</button>
          <button class="icon-btn" type="button" data-del-memo="${esc(m.id)}" data-source="${esc(m.source)}" aria-label="메모 삭제">🗑</button>
        </span>
      </div>
    </li>`).join('');
}

async function saveMemoText(m, text) {
  if (m.source === 'supabase' && sb.ok) {
    await sbPatch(SUPABASE.tables.memos, m.id, { title: text.slice(0, 80), content: text });
    const row = (sb.memos || []).find((r) => String(r.id) === String(m.id));
    if (row) { row.content = text; row.title = text.slice(0, 80); row.updated_at = new Date().toISOString(); }
  } else if (m.source === 'state' && sb.ok) {
    const rows = await sbUpsert(SUPABASE.tables.memos, { id: m.id, title: text.slice(0, 80), content: text, pinned: !!m.pinned });
    if (Array.isArray(rows) && rows[0]) {
      sb.memos = (sb.memos || []).filter((r) => String(r.id) !== String(m.id));
      sb.memos.unshift(rows[0]);
    }
  } else if (m.source === 'local') {
    const list = read(KEY.memos, []);
    write(KEY.memos, (Array.isArray(list) ? list : []).map((x) => (x.id === m.id ? Object.assign({}, x, { text }) : x)));
  } else {
    throw new Error('DB에 연결돼야 기본 메모를 고칠 수 있어요');
  }
}

function openMemoSheet(id) {
  const m = memoRows().find((x) => String(x.id) === String(id));
  if (!m) return;
  openSheet({
    emoji: m.pinned ? '📌' : '🗒️',
    title: '메모 고치기',
    sub: `${fmtDayLabel(m.created)}${m.source === 'supabase' ? ' · 실시간 DB' : ''}`,
    html: `<form class="sheet-form" id="memo-sheet-form">
      <label class="field"><span>내용</span><textarea name="text" rows="6" maxlength="1000">${esc(m.text)}</textarea></label>
      <div class="sheet-actions">
        <button class="ghost-btn" type="button" data-copy-memo>복사</button>
        <button class="primary-btn" type="submit">저장</button>
      </div>
    </form>`,
    onClick: async (e) => {
      if (e.target.closest('[data-copy-memo]')) {
        try { await navigator.clipboard.writeText(m.text); toast('복사했어요'); } catch (err) { toast('복사하지 못했어요', 'error'); }
      }
    },
    onSubmit: async (e) => {
      const text = e.target.text.value.trim();
      if (!text) return;
      try {
        await saveMemoText(m, text);
        toast('메모를 저장했어요');
        closeSheet();
        renderMemos();
      } catch (err) {
        toast(err.message || '저장하지 못했어요', 'error');
      }
    }
  });
}

/* =========================================================
   탭 전환
   ========================================================= */
function setTab(tab, opts) {
  const o = opts || {};
  const target = document.getElementById(`view-${tab}`);
  if (!target) return;
  if (tab !== 'chat' && roomOpen) closeChatRoom(true);
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
  document.body.dataset.tab = tab;
  write(KEY.tab, tab);
  if (!o.fromRoom) {
    try { history.replaceState(null, '', `#${tab}`); } catch (e) { /* ignore */ }
  }
  if (!o.keepScroll) window.scrollTo(0, 0);
  if (tab === 'chat') {
    renderRoomList();
    if (mqDesktop.matches && state) {
      lastRenderSig = '';
      renderChatRoom(true);
      jumpChatToBottom();
    }
  } else {
    chatNewCount = 0;
    updateChatLatestBtn();
  }
  if (tab === 'status' && state) renderAgents();
  schedulePoll(true);
}

/* =========================================================
   이벤트
   ========================================================= */
el.tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) setTab(btn.dataset.tab);
});

el.syncBtn.addEventListener('click', () => loadState({ manual: true }));

/* 어디서든 data-open-chat / data-goto-tab / data-talk */
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open-chat]');
  if (open) { openChatRoom(open.dataset.openChat); return; }
  const go = e.target.closest('[data-goto-tab]');
  if (go) { setTab(go.dataset.gotoTab); return; }
  const talk = e.target.closest('[data-talk]');
  if (talk) { talkTo(talk.dataset.talk, talk.dataset.talkRoom); }
});

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
  const zone = e.target.closest('[data-zone]');
  if (zone) { openRoomInChat(zone.dataset.zone); return; }
  const jump = e.target.closest('[data-room-jump]');
  if (jump) openRoomInChat(jump.dataset.roomJump);
});

el.mapStage.addEventListener('click', (e) => {
  const char = e.target.closest('[data-char]');
  if (char) { selectOnMap('char', char.dataset.char, true); return; }
  const zone = e.target.closest('[data-zone]');
  if (zone) { openRoomInChat(zone.dataset.zone); return; }
  const room = e.target.closest('[data-room]');
  if (room) openRoomInChat(room.dataset.room);
});

el.mapDetail.addEventListener('click', (e) => {
  const zone = e.target.closest('[data-zone]');
  if (zone) { openRoomInChat(zone.dataset.zone); return; }
  const jump = e.target.closest('[data-open-room]');
  if (jump) { openRoomInChat(jump.dataset.openRoom); return; }
  if (e.target.closest('[data-close-detail]')) {
    selected = null;
    renderMap();
    renderRoomChips();
    renderDetail();
  }
});

/* chat: room head */
el.crBack.addEventListener('click', () => closeChatRoom(false));
el.crSearchBtn.addEventListener('click', () => {
  const show = el.crSearch.hidden;
  if (show) {
    el.crSearch.hidden = false;
    el.crSearchBtn.setAttribute('aria-expanded', 'true');
    el.crSearchInput.focus();
  } else {
    closeSearch();
    lastRenderSig = '';
    renderMessages(true);
  }
});
let searchTimer = 0;
el.crSearchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQ = el.crSearchInput.value.trim();
    renderMessages(true);
  }, 160);
});
el.crSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSearch(); renderMessages(true); }
});

/* chat: list */
el.msgList.addEventListener('scroll', onChatScroll, { passive: true });
/* 사진이 늦게 로드돼 높이가 바뀌어도 바닥을 보던 중이면 맨 아래 유지 */
el.msgList.addEventListener('load', (e) => {
  if (e.target && e.target.tagName === 'IMG' && chatPinnedBottom) applyChatJump();
}, true);
el.msgList.addEventListener('loadedmetadata', () => { if (chatPinnedBottom) applyChatJump(); }, true);

el.chatLatest.addEventListener('click', () => {
  chatPinnedBottom = true;
  jumpChatToBottom();
});

let pressTimer = 0;
let pressStart = null;
let pressFired = false;
el.msgList.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.bubble');
  if (!b || e.button > 0) return;
  const li = b.closest('[data-mid]');
  pressFired = false;
  pressStart = { x: e.clientX, y: e.clientY };
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    pressFired = true;
    b.classList.add('is-pressed');
    setTimeout(() => b.classList.remove('is-pressed'), 200);
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* ignore */ } }
    openMsgActions(li.dataset.mid);
  }, 480);
});
const cancelPress = (e) => {
  if (!pressStart) return;
  if (e.type === 'pointermove' && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) < 9) return;
  clearTimeout(pressTimer);
  pressStart = null;
};
el.msgList.addEventListener('pointermove', cancelPress, { passive: true });
el.msgList.addEventListener('pointerup', cancelPress);
el.msgList.addEventListener('pointercancel', cancelPress);
el.msgList.addEventListener('contextmenu', (e) => {
  const li = e.target.closest('[data-mid]');
  if (!li || e.target.closest('a, video')) return;
  e.preventDefault();
  if (!pressFired) openMsgActions(li.dataset.mid);
});

el.msgList.addEventListener('click', (e) => {
  if (pressFired) { pressFired = false; e.preventDefault(); return; }
  const img = e.target.closest('[data-view-src]');
  if (img) { openViewer(img.dataset.viewSrc, img.dataset.viewName); return; }
  const retry = e.target.closest('[data-retry]');
  if (retry) {
    const tmp = inflight.find((m) => m.id === retry.dataset.retry);
    if (tmp) processInflight(tmp);
    return;
  }
  const discard = e.target.closest('[data-discard]');
  if (discard) {
    inflight = inflight.filter((m) => m.id !== discard.dataset.discard);
    onMessagesChanged();
    return;
  }
  /* 데스크톱: 말풍선 더블클릭 대신 한 번 클릭은 아무것도 안 함 — 우클릭/길게 누르기로 메뉴 */
});
el.msgList.addEventListener('dblclick', (e) => {
  const li = e.target.closest('[data-mid]');
  if (li && !coarsePointer && !e.target.closest('a, video, button')) openMsgActions(li.dataset.mid);
});

/* 대화방 안에서 페이지 전체가 끌려 올라가지 않게 (iOS 고무줄 스크롤) */
el.chatRoom.addEventListener('touchmove', (e) => {
  if (!roomOpen) return;
  if (!e.target.closest('.msg-list, textarea, .cmp-tray, .cr-rooms, .cmp-pop, .cmp-menu, .cr-search')) e.preventDefault();
}, { passive: false });

/* drag & drop · paste */
let dragDepth = 0;
el.chatRoom.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  e.preventDefault();
  dragDepth += 1;
  el.dropHint.hidden = false;
});
el.chatRoom.addEventListener('dragover', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  e.preventDefault();
});
el.chatRoom.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) el.dropHint.hidden = true;
});
el.chatRoom.addEventListener('drop', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
  e.preventDefault();
  dragDepth = 0;
  el.dropHint.hidden = true;
  stageFiles(e.dataTransfer.files);
});
el.chatInput.addEventListener('paste', (e) => {
  const files = e.clipboardData && e.clipboardData.files;
  if (files && files.length) {
    e.preventDefault();
    stageFiles(files);
  }
});

/* composer */
el.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage();
});
/* 전송 버튼을 눌러도 키보드가 내려가지 않게 (카톡처럼 이어서 입력) */
el.cmpSend.addEventListener('pointerdown', (e) => {
  if (document.activeElement === el.chatInput) e.preventDefault();
});
el.cmpSend.addEventListener('mousedown', (e) => {
  if (document.activeElement === el.chatInput) e.preventDefault();
});
/* iOS: 터치 끝에서 직접 보내고 기본 동작(포커스 이동 → 키보드 내림)을 막는다 */
el.cmpSend.addEventListener('touchend', (e) => {
  if (document.activeElement !== el.chatInput || el.cmpSend.disabled) return;
  e.preventDefault();
  sendMessage();
});

el.chatInput.addEventListener('input', () => {
  autoGrow();
  updateSendState();
  updateMentionPop();
  saveDraft();
});
el.chatInput.addEventListener('click', updateMentionPop);
el.chatInput.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;          /* 한글 조합 중엔 무시 */
  if (!el.mentionPop.hidden && (e.key === 'Enter' || e.key === 'Tab')) {
    const first = el.mentionPop.querySelector('[data-pick-mention]');
    if (first) { e.preventDefault(); insertMention(first.dataset.pickMention); return; }
  }
  if (e.key === 'Escape') {
    if (!el.mentionPop.hidden) { hideMentionPop(); return; }
    if (replyTo) { replyTo = null; renderComposerBars(); return; }
    el.chatInput.blur();
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey && !coarsePointer) {
    e.preventDefault();
    sendMessage();
  }
});
el.chatInput.addEventListener('focus', () => {
  setMenuOpen(false);
  scheduleViewport();
  setTimeout(scheduleViewport, 300);
});
el.chatInput.addEventListener('blur', () => {
  setTimeout(hideMentionPop, 150);
  scheduleViewport();
  setTimeout(scheduleViewport, 300);
});

el.cmpPlus.addEventListener('click', () => {
  const open = el.cmpMenu.hidden;
  setMenuOpen(open);
  if (open) el.chatInput.blur();
  else focusInput();
  if (chatPinnedBottom) setTimeout(applyChatJump, 30);
});
el.cmpMenu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cmp]');
  if (!b) return;
  const act = b.dataset.cmp;
  if (act === 'media') el.fileMedia.click();
  else if (act === 'file') el.fileAny.click();
  else if (act === 'mention') {
    setMenuOpen(false);
    const t = el.chatInput;
    const gap = t.value && !/\s$/.test(t.value) ? ' ' : '';
    t.value += `${gap}@`;
    focusInput();
    try { t.setSelectionRange(t.value.length, t.value.length); } catch (err) { /* ignore */ }
    updateMentionPop();
    updateSendState();
  } else if (act === 'sender') openSenderSheet();
});
[el.fileMedia, el.fileAny].forEach((inp) => {
  inp.addEventListener('change', () => {
    stageFiles(inp.files);
    inp.value = '';
  });
});
el.cmpTray.addEventListener('click', (e) => {
  const x = e.target.closest('[data-unstage]');
  if (!x) return;
  const item = staged.find((s) => s.id === x.dataset.unstage);
  if (item && item.preview) URL.revokeObjectURL(item.preview);
  staged = staged.filter((s) => s.id !== x.dataset.unstage);
  renderTray();
});
el.cmpWho.addEventListener('click', openSenderSheet);
el.chatForm.addEventListener('click', (e) => {
  if (e.target.closest('[data-cancel-reply]')) { replyTo = null; renderComposerBars(); focusInput(); return; }
  if (e.target.closest('[data-sender-reset]')) { composerSender = OWNER_ID; renderComposerBars(); focusInput(); }
});
el.mentionPop.addEventListener('pointerdown', (e) => e.preventDefault());
el.mentionPop.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick-mention]');
  if (b) insertMention(b.dataset.pickMention);
});

/* 메뉴 바깥을 누르면 첨부 메뉴 닫기 */
document.addEventListener('pointerdown', (e) => {
  if (el.cmpMenu.hidden) return;
  if (el.chatForm.contains(e.target)) return;
  setMenuOpen(false);
}, true);

/* work */
el.taskNew.addEventListener('click', () => openTaskSheet(null));
el.taskFilter.addEventListener('click', (e) => {
  const b = e.target.closest('[data-task-filter]');
  if (!b) return;
  taskFilter = b.dataset.taskFilter;
  write(KEY.taskFilter, taskFilter);
  renderProjects();
});
el.projectList.addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const b = e.target.closest('[data-edit-task]');
  if (b) openTaskSheet(b.dataset.editTask);
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
      const rows = await sbInsert(SUPABASE.tables.memos, { id, title: text.slice(0, 80), content: text, pinned: false });
      if (Array.isArray(rows) && rows.length) sb.memos.unshift(rows[0]);
      toast('메모를 남겼어요');
      renderMemos();
      return;
    } catch (err) {
      toast('DB 저장 실패 — 이 기기에만 남겼어요', 'error');
    }
  }
  const arr = read(KEY.memos, []);
  const list = Array.isArray(arr) ? arr : [];
  list.unshift({ id, text, pinned: false, created: new Date().toISOString() });
  write(KEY.memos, list);
  renderMemos();
});
el.memoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); el.memoForm.requestSubmit(); }
});
el.memoSearch.addEventListener('input', () => {
  memoQuery = el.memoSearch.value;
  renderMemos();
});

el.memoList.addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit-memo]');
  if (edit) { openMemoSheet(edit.dataset.editMemo); return; }
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
        toast('핀 저장 실패 — 잠시 후 다시 시도하세요', 'error');
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
    if (!del.classList.contains('is-confirm')) {
      del.classList.add('is-confirm');
      del.textContent = '삭제?';
      setTimeout(() => { if (del.isConnected) { del.classList.remove('is-confirm'); del.textContent = '🗑'; } }, 2600);
      return;
    }
    const id = del.dataset.delMemo;
    if (del.dataset.source === 'supabase' && sb.ok) {
      try {
        await sbRemove(SUPABASE.tables.memos, id);
        sb.memos = (sb.memos || []).filter((m) => String(m.id) !== String(id));
      } catch (err) {
        toast('DB 삭제 실패 — 잠시 후 다시 시도하세요', 'error');
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
    toast('메모를 지웠어요');
    renderMemos();
  }
});

/* sheet */
el.sheetClose.addEventListener('click', closeSheet);
el.sheetBackdrop.addEventListener('click', closeSheet);
el.sheetBody.addEventListener('click', (e) => { if (sheetHandler && sheetHandler.onClick) sheetHandler.onClick(e); });
el.sheetBody.addEventListener('input', (e) => { if (sheetHandler && sheetHandler.onInput) sheetHandler.onInput(e); });
el.sheetBody.addEventListener('submit', (e) => {
  e.preventDefault();
  if (sheetHandler && sheetHandler.onSubmit) sheetHandler.onSubmit(e);
});

/* viewer */
el.viewerClose.addEventListener('click', closeViewer);
el.viewer.addEventListener('click', (e) => { if (e.target === el.viewer || e.target === el.viewerImg) closeViewer(); });

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (el.viewer && !el.viewer.hidden) { closeViewer(); return; }
  if (el.sheet && !el.sheet.hidden) { closeSheet(); return; }
  if (roomOpen && document.activeElement !== el.chatInput) closeChatRoom(false);
});

window.addEventListener('popstate', () => {
  const st = history.state;
  if (!el.viewer.hidden) closeViewer();
  if (roomOpen && !(st && st.room)) { closeChatRoom(true); return; }
  if (!roomOpen && st && st.room && !mqDesktop.matches) openChatRoom(st.room, { push: false });
});

const onLayoutChange = () => {
  if (mqDesktop.matches && roomOpen) {
    roomOpen = false;
    document.body.classList.remove('room-open', 'kb-open');
    lockPage(false);
  }
  if (activeTab === 'chat' && state) {
    lastRenderSig = '';
    renderChatRoom(true);
  }
};
if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onLayoutChange);
else if (mqDesktop.addListener) mqDesktop.addListener(onLayoutChange);

/* =========================================================
   동기화 스케줄 · 부트
   ========================================================= */
let pollTimer = 0;
let lastFull = Date.now();
function schedulePoll(soon) {
  clearTimeout(pollTimer);
  const visible = document.visibilityState === 'visible';
  if (!visible) return;
  /* Realtime 이 붙어도 publication 설정이 없으면 신호가 안 올 수 있어 회의실에선 4초 확인을 유지 */
  const fast = activeTab === 'chat';
  const delay = soon ? 1200 : (fast ? SUPABASE.pollFastMs : SUPABASE.pollSlowMs);
  pollTimer = setTimeout(async () => {
    if (!state) { schedulePoll(); return; }
    if (Date.now() - lastFull > SUPABASE.fullMs || !sb.ok) {
      lastFull = Date.now();
      await refreshLive();
    } else {
      await pollMessages();
    }
    schedulePoll();
  }, delay);
}

function boot() {
  if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
    document.documentElement.classList.add('is-standalone');
  }
  const hash = (location.hash || '').replace('#', '');
  const [hashTab, hashRoom] = hash.split('/');
  if (hashRoom) activeRoom = hashRoom;
  setTab(VALID_TABS.includes(hashTab) ? hashTab : activeTab, { keepScroll: true });
  restoreDraft();

  loadState().then(() => {
    if (hashTab === 'chat' && hashRoom && !mqDesktop.matches) {
      try { history.replaceState(null, '', '#chat'); } catch (e) { /* ignore */ }
      openChatRoom(hashRoom);
    }
    realtimeConnect();
    schedulePoll();
  });

  /* 후후가 state.json만 고쳐도 화면이 따라오도록 5분마다 시드 재확인 */
  setInterval(() => {
    if (document.visibilityState === 'visible') loadState({ silent: true });
  }, 5 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (state) refreshLive();
      if (!rtSocket) { rtFails = Math.min(rtFails, 3); realtimeConnect(); }
      schedulePoll();
      markSeenSoon();
    } else {
      clearTimeout(pollTimer);
    }
  });
  window.addEventListener('online', () => { if (state) refreshLive(); });

  /* iOS 키보드 — visualViewport 가 줄고 늘 때마다 레이아웃 보정 */
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleViewport);
    window.visualViewport.addEventListener('scroll', scheduleViewport);
  }
  window.addEventListener('resize', scheduleViewport);
  window.addEventListener('orientationchange', () => setTimeout(syncViewport, 300));
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (activeTab === 'chat' && chatPinnedBottom) applyChatJump();
    });
    ro.observe(el.msgList);
    ro.observe(el.chatForm);
  }
  syncViewport();
  /* 목록의 '3분 전' 같은 상대 시각을 1분마다 새로 */
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !state) return;
    renderRoomList();
    renderRecent();
    if (activeTab === 'status') renderAgents();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', boot);
