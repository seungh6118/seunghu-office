# 어벤져스타워 (seunghu-office) — HERO HQ

대장 전용 **어벤져스타워** 대시보드. 대장님의 스레드·블로그·체험단·생활 행정 진행 상황과 비서진(후후·뮤즈·제미나이·Cue·Vooy) 현황을 한 화면에서 보는 정적 웹앱입니다.

- **밝은 히어로 본부** — 화이트·실버·아이스 블루(`#F0F6FF`~`#FFFFFF`) 기반 글래스 카드, 스타크 블루 `#0284C7` / 시안 `#06B6D4` / 히어로 골드 `#D97706` / 포인트 레드 `#DC2626`.
- **실시간 DB** — 회의실·작업실·메모·비서현황은 Supabase(`office_messages` · `office_tasks` · `office_memos` · `office_agents`)와 45초 주기로 동기화됩니다. 폰·PC·외부 에이전트가 같은 방을 봅니다. 외부 에이전트용 curl 예시는 [`AGENT_SYNC.md`](./AGENT_SYNC.md).
- **빌드 도구 없음** — `index.html` + `styles.css` + `app.js` + `data/state.json` 만으로 동작합니다.
- **모바일 퍼스트** — 폰에서는 하단 5탭 글래스 바 + 풀블리드 오피스 맵, 900px 이상에서는 상단 플로팅 탭, 1080px 이상에서는 오피스 맵 + 현황 사이드 패널 2단 구성.
- **캐릭터** — 이모지 핀 대신 6명의 커스텀 SVG 캐릭터(의자·소파에 착석)로 그립니다. 후후=캡틴 아메리카, 뮤즈=아이언맨, Cue=토르, 제미나이=닥터 스트레인지, Vooy=헐크, 대장=왕관+케이프. 모바일 40px, 데스크톱 70px 이상이며 터치 영역은 그보다 넓습니다.
- **개인정보 없음** — 전화번호·생년월일·비밀번호·계좌 같은 민감 정보는 넣지 않습니다.

## 파일 구조

```
projects/seunghu-office/
├── index.html              화면 골격 (SVG 탭 아이콘 · 5개 탭)
├── styles.css              HERO HQ 라이트 테마, 반응형
├── app.js                  렌더링 · Supabase REST · localStorage 폴백
├── AGENT_SYNC.md           ★ 외부 에이전트(뮤즈·Cue·Vooy·제미나이) 연동 가이드
├── data/
│   └── state.json          기본 시드 데이터 (지도 좌표·요약·스케줄)
├── assets/
│   ├── office-map-bg.png   히어로 본부 3D 오피스 배경 (1402×1122)
│   ├── office-map-bg.webp  같은 배경의 경량 버전 (모바일 우선 로딩)
│   └── favicon.svg         블루 + 골드 크라운 아이콘
└── README.md
```

## 로컬에서 열기

`fetch('data/state.json')` 을 쓰기 때문에 `file://` 로 더블클릭하면 데이터가 안 뜹니다. 간단한 서버로 열어 주세요.

```bash
cd projects/seunghu-office
python3 -m http.server 8765
# 브라우저에서 http://localhost:8765
```

## 배포

정적 파일이라 그대로 올리면 됩니다. 저장소: <https://github.com/seungh6118/seunghu-office> (Public, `main`) · 배포: <https://seungh6118.github.io/seunghu-office/>

- **GitHub Pages**: Branch `main` / root. 커밋 후 1~2분 안에 반영됩니다.
- **Vercel**: 저장소 Import 후 Framework "Other", Root Directory 그대로.

## 실시간 DB (Supabase)

| 항목 | 값 |
| --- | --- |
| Project URL | `https://qebbpadabmkeeecnzfrm.supabase.co` |
| API Key (publishable, 공개용) | `sb_publishable_dgSAZviMpxNeJ0YYik4FZw_HIPQeRdg` |
| 폴링 | 45초 + 동기화 배지 클릭 시 즉시 + 탭 복귀 시 |

- `data/state.json` 은 **시드**입니다. 먼저 읽어 화면을 그리고, 곧바로 Supabase 4개 테이블을 읽어 합칩니다. 같은 id가 있으면 **Supabase 값이 우선**합니다.
- 회의실 메시지는 `office_messages` 에 `POST` (id는 DB가 자동 생성), 45초마다 다시 읽어 다른 기기의 글이 바로 뜹니다.
- 작업실 추가/삭제, 메모 추가/핀/삭제, 비서 상태 갱신도 Supabase에 바로 씁니다. DB가 막히면 자동으로 localStorage에만 저장하고 상단 배지가 `로컬 저장`으로 바뀝니다.
- `office_agents` 에 `id`를 캐릭터 id(`seunghu`/`huhu`/`muse`/`gemini`/`cue`/`vooy`)로 넣으면 오피스 맵 캐릭터 상태까지 갱신됩니다.

## 오피스 맵 좌표

`assets/office-map-bg.png` 는 밝은 낮의 초고층 히어로 본부(좌측 유리 회의실 · 우측 홀로그램 성과 대시보드 · 하단 중앙 제작 플랫폼 · 우측 하단 라운지 소파)입니다. `rooms[].x/y`, `characters[].x/y` 는 이 이미지 기준 퍼센트 좌표이고, **모두 실제 가구 위(의자·소파 좌석)** 에 맞춰져 있습니다.

| 자리 | 좌표 (%) | 캐릭터 |
| --- | --- | --- |
| 회의실 데스크 뒤 회장님 의자 | 62.5 / 35.2 | 대장 👑 |
| 회의실 데스크 앞 의자 | 50.0 / 41.9 | 후후 🧡 캡틴 아메리카 |
| 회의실 유리 테이블 왼쪽 의자 | 7.8 / 50.4 | 뮤즈 🤖 아이언맨 |
| 회의실 유리 테이블 오른쪽 끝 의자 | 27.4 / 45.6 | 제미나이 ✨ 닥터 스트레인지 |
| 라운지 왼쪽 소파 | 71.7 / 64.2 | Cue 🧠 토르 |
| 라운지 오른쪽 소파 | 90.5 / 64.5 | Vooy 🛎️ 헐크 |

| 방 라벨 | 좌표 (%) | 여는 화면 |
| --- | --- | --- |
| 🏛️ 회의실 | 12.5 / 22.0 | 회의실 탭 (방 필터 `boardroom`) |
| 🛡️ 1팀 · ⚡ 2팀 | 지도 라벨 없음 | 상단 칩 · 회의실 탭 팀 필터 (`team1` / `team2`) |
| 📊 성과실 | 87.5 / 20.0 | 전용 바텀시트 (채널 성과) |
| 🛠️ 제작실 | 37.0 / 83.0 | 전용 바텀시트 (외주·제작 현황) |
| ☕ 라운지 | 86.0 / 75.0 | 회의실 탭 (방 필터 `lounge`) |

캐릭터는 자기 자리(의자·소파)에 발이 닿도록 `translate(-50%, -100%)` 로 배치되고, 이름표는 머리 위에 뜹니다. 좌표를 옮길 때는 `room` 값도 함께 봅니다.

지도 위 방 라벨·상단 상태 칩·상세 시트의 `회의실에서 보기` 를 누르면 회의실 탭으로 넘어가며 그 방 필터가 선택됩니다(`openRoomInChat`). 성과실·제작실은 `openZoneSheet` 로 바텀시트를 엽니다(`kind:"view"`). 캐릭터 핀을 누르면 예전처럼 상세 시트가 열립니다. 두 레이어(`#room-labels`, `#characters`)는 `pointer-events: none` 이고 버튼만 클릭을 받습니다 — 레이어가 지도 전체를 덮어 라벨 클릭을 삼키던 문제를 막는 장치이니 지우지 마세요.

## `data/state.json` 스키마

| 키 | 설명 |
| --- | --- |
| `meta` | `updatedAt`(ISO 시각), `summary`(본부 카드 한 줄 요약), `stats`(본부 카드 지표 3개) |
| `rooms[]` | 방·존 6곳. `id`(boardroom/team1/team2/performance/workshop/lounge), `kind`(`view`면 전용 현황판 — 성과실·제작실), `map`(false면 지도 라벨 없이 상단 칩에만), `emoji`, `name`, `x`·`y`(맵 위 라벨 위치 %), `state`(on/idle), `status`, `summary`, `work[]` |
| `teams[]` | 팀 구성. `id`(team1/team2), `name`, `emoji`, `leader`(팀장 캐릭터 id), `members[]` |
| `performance` | 성과실 카드. `channels[]` — `name`, `handle`, `owner`, `status`, `badge`, `metrics[{k,v}]`, `note`, `link`, `accent` |
| `workshop` | 제작실 카드. `projects[]` — `name`, `handle`, `owner`, `status`, `stack[]`, `note`, `link`, `accent` |
| `characters[]` | 맵 위 캐릭터. `id`, `emoji`, `name`, `role`, `room`(소속 방 id), `state`(active/idle), `x`·`y`(%), `status`, `task`, `next`, `lastActive`, `color` |
| `meetings[]` | 초기 회의록(시드). `id`, `room`, `authorId`(characters의 id), `at`(ISO), `text`, `mentions[]` |
| `projects[]` | 작업실 기본 카드. `emoji`, `title`, `status`, `progress`(0~100), `badge`, `next`, `detail`, `tags[]`, `owner`, `updated`, `link`(선택) |
| `agents[]` | 비서현황 기본 카드. `emoji`, `name`, `role`, `state`, `task`, `load`, `lastActive`, `skills[]` |
| `schedules[]` | 스케줄 타임라인. `time`("08:15"), `title`, `desc`, `agent`, `status`("다음 실행"/"대기"/"자동"), `when` |
| `memos[]` | 기본 메모. `id`, `text`, `pinned`, `created`(ISO) |

## localStorage 폴백

DB가 막힌 환경에서만 쓰이는 보조 저장소입니다.

| 키 | 내용 |
| --- | --- |
| `seunghuOffice.chat.v1` | 오프라인에서 보낸 회의실 메시지 |
| `seunghuOffice.tasks.v1` | 오프라인에서 추가한 작업 |
| `seunghuOffice.memos.v1` | 오프라인에서 추가한 메모 |
| `seunghuOffice.pins.v1` | 시드 메모 핀 상태 |
| `seunghuOffice.memoDeleted.v1` | 시드 메모 삭제 표시 |
| `seunghuOffice.motion.v1` | 오피스 맵 움직임 ON/OFF |
| `seunghuOffice.tab.v1` / `.room.v1` | 마지막으로 보던 탭·회의실 |

## 갱신 루틴 (후후용)

1. `data/state.json` 의 `meta.updatedAt` 을 지금 시각으로 바꾸고 바뀐 항목만 수정
2. `git add data/state.json && git commit -m "chore: 비서실 현황 갱신" && git push`
3. 화면은 새로고침·탭 복귀·5분 주기·상단 동기화 배지 클릭 시 자동으로 다시 읽습니다.
4. 회의실·작업실·메모를 실시간으로 남길 때는 `AGENT_SYNC.md` 의 REST 예시를 그대로 쓰면 됩니다.

## 화면

1. **오피스 맵** — 본부 요약 카드, 움직임 ON/OFF 토글, 4개 존(회의실·성과실·제작실·라운지) 배지, 히어로 본부 위 착석 캐릭터(눌러서 현재 작업 확인)
2. **회의실** — 전체·회의실·🛡️ 1팀·⚡ 2팀·라운지 필터(지휘실 폐지), 보내는 사람·@멘션 한 줄 스트립, 메시지 전송 → Supabase 실시간 공유(LIVE 표시)
   - 팀 구성: **1팀 = 후후(팀장) + Cue**, **2팀 = 뮤즈(팀장) + Vooy**. 팀방은 `room: "team1" / "team2"` 로 저장됩니다.
   - 예전 `command`(지휘실) 로 남은 DB 로그는 `boardroom`(회의실)으로 매핑되어 그대로 보입니다.
   - iOS Safari 키보드가 올라오면 `body.keyboard-open` 으로 하단 탭바를 숨기고 입력 바를 `visualViewport` 하단(키보드 위)에 고정합니다. `.view` 의 `view-in` 애니메이션이 fixed 기준을 잡지 않도록 `#view-chat` 는 애니메이션을 끕니다.
   - **성과실·제작실** — 지도 라벨·상단 칩을 누르면 전용 바텀시트(`#zone-sheet`)가 열립니다(회의실 이동 아님).
   - **진입·방 전환·방 필터·전송 직후에는 항상 최신 메시지(맨 아래)로 열립니다**(카톡식). `jumpChatToBottom` 이 rAF 2회 + 80/240/600ms + `document.fonts.ready` 로 모바일 레이아웃까지 보정합니다.
   - 사용자가 위로 올려 옛 글을 읽는 중에는 45초 폴링으로 화면을 끌어내리지 않고, 우측 하단 `↓ 최신` 버튼(`#chat-latest`)에 새 글 개수만 표시합니다. 이 버튼은 `.view` 의 `view-in` 애니메이션이 `position: fixed` 기준을 잡아먹지 않도록 **body 직속**에 둡니다(안으로 옮기면 화면 밖으로 사라집니다).
3. **작업실** — 진행 프로젝트 카드 + 새 작업 지시 추가(Supabase 저장)
4. **비서현황** — 후후·뮤즈·제미나이·Cue·Vooy 상태 카드, 스케줄 타임라인, 외부 에이전트 연동 안내
5. **메모** — 빠른 메모 추가·삭제·핀 고정(Supabase 저장)
