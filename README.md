# 승후 비서실 (seunghu-office)

승후님 전용 비서실 대시보드. 승후 님의 스레드·블로그·체험단·생활 행정 진행 상황과 비서진(후후·뮤즈·제미나이·Cue·Vooy) 현황을 한 화면에서 보는 정적 웹앱입니다.

- **모던 다크 스튜디오** — 딥 차콜/슬레이트 배경(`#090D16`~`#0F1623`), 반투명 다크 글래스 카드, 1px 헤어라인 보더, 앰버 골드·에메랄드·시안 포인트.
- **빌드 도구 없음** — `index.html` + `styles.css` + `app.js` + `data/state.json` 만으로 동작합니다.
- **모바일 퍼스트** — 폰에서는 하단 5탭 글래스 바, 900px 이상에서는 상단 플로팅 탭, 1080px 이상에서는 오피스 맵 + 현황 사이드 패널 2단 구성.
- **데이터 분리** — 화면 문구·현황은 전부 `data/state.json` 하나에서 나옵니다. 후후가 이 파일만 갱신해 커밋하면 새로고침(또는 5분 자동 갱신) 때 반영됩니다.
- **개인정보 없음** — 전화번호·생년월일·비밀번호·계좌 같은 민감 정보는 넣지 않습니다.

## 파일 구조

```
projects/seunghu-office/
├── index.html              화면 골격 (SVG 탭 아이콘 · 5개 탭)
├── styles.css              모던 다크 글래스 테마, 반응형
├── app.js                  렌더링·localStorage·state.json 로딩
├── data/
│   └── state.json          ★ 후후가 갱신하는 단일 데이터 소스
├── assets/
│   ├── office-map-bg.png   다크 펜트하우스 3D 오피스 배경 (1315×1196)
│   └── favicon.svg         다크 + 앰버 크라운 아이콘
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

## 오피스 맵 좌표

`assets/office-map-bg.png` 는 다크 통유리 펜트하우스(상단 중앙 지휘 데스크 · 좌측 하단 유리 대회의실 · 우측 하단 라운지 소파)입니다. `rooms[].x/y`, `characters[].x/y` 는 이 이미지 기준 퍼센트 좌표이며, 모두 가구가 없는 바닥 위에 놓여 있습니다.

| 방 | 라벨 좌표 | 소속 에이전트 |
| --- | --- | --- |
| 🎯 지휘실 | 39.5 / 39.0 | 승후 👑 · 후후 🧡 |
| 🏛️ 대회의실 | 38.0 / 48.2 | 뮤즈 🤖 · 제미나이 ✨ |
| ☕ 라운지 | 82.5 / 60.0 | Cue 🧠 · Vooy 🛎️ |

캐릭터 핀은 `room` 값을 그대로 따라가므로, 방을 옮길 때는 `room` 과 `x`·`y` 를 함께 고칩니다.

## `data/state.json` 스키마

| 키 | 설명 |
| --- | --- |
| `meta` | `updatedAt`(ISO 시각), `summary`(본부 카드 한 줄 요약), `stats`(본부 카드 지표 3개) |
| `rooms[]` | 방 3곳. `id`(command/boardroom/lounge), `emoji`, `name`, `x`·`y`(맵 위 라벨 위치 %), `state`(on/idle), `status`, `summary`, `work[]` |
| `characters[]` | 맵 위 캐릭터. `id`, `emoji`, `name`, `role`, `room`(소속 방 id), `state`(active/idle), `x`·`y`(%), `status`, `task`, `next`, `lastActive`, `color` |
| `meetings[]` | 초기 회의록. `id`, `room`, `authorId`(characters의 id), `at`(ISO), `text`, `mentions[]` |
| `projects[]` | 작업실 카드. `emoji`, `title`, `status`, `progress`(0~100), `badge`, `next`, `detail`, `tags[]`, `owner`, `updated`, `link`(선택) |
| `agents[]` | 비서현황 카드. `emoji`, `name`, `role`, `state`, `task`, `load`, `lastActive`, `skills[]` |
| `schedules[]` | 스케줄 타임라인. `time`("08:15"), `title`, `desc`, `agent`, `status`("다음 실행"/"대기"/"자동"), `when` |
| `memos[]` | 기본 메모. `id`, `text`, `pinned`, `created`(ISO) |

### 갱신 예시

```jsonc
// meta.updatedAt 을 지금 시각으로 바꾸고, 해당 배열의 항목만 고치면 됩니다.
"updatedAt": "2026-11-28T09:20:00+09:00"
```

## 브라우저 저장(localStorage)

`data/state.json` 은 읽기 전용 원본이고, 승후 님이 화면에서 만든 것은 브라우저에 따로 쌓입니다.

| 키 | 내용 |
| --- | --- |
| `seunghuOffice.chat.v1` | 회의실에서 보낸 메시지 |
| `seunghuOffice.tasks.v1` | 작업실에 추가한 작업 |
| `seunghuOffice.memos.v1` | 추가한 메모 |
| `seunghuOffice.pins.v1` | 메모 핀 고정 상태 |
| `seunghuOffice.memoDeleted.v1` | 기본 메모 삭제 표시 |
| `seunghuOffice.motion.v1` | 오피스 맵 움직임 ON/OFF |
| `seunghuOffice.tab.v1` / `.room.v1` | 마지막으로 보던 탭·회의실 |

회의실 메시지는 `app.js` 의 `ChatStore` 한 곳을 거칩니다. `API_BASE` 상수에 서버 주소를 넣고 `append()` 안의 주석 지점에서 POST 하면, 뮤즈·제미나이·Cue·Vooy 도 같은 회의실에 글을 남기는 구조로 확장할 수 있습니다.

## 갱신 루틴 (후후용)

1. `data/state.json` 의 `meta.updatedAt` 을 지금 시각으로 바꾸고 바뀐 항목만 수정
2. `git add data/state.json && git commit -m "chore: 비서실 현황 갱신" && git push`
3. 화면은 새로고침·탭 복귀·5분 주기·상단 동기화 배지 클릭 시 자동으로 다시 읽습니다.

승후 님이 화면에서 만든 메시지·작업·메모는 각자 브라우저(localStorage)에만 쌓이므로, 저장소에는 올라가지 않습니다.

## 화면

1. **오피스 맵** — 본부 요약 카드, 움직임 ON/OFF 토글, 방 상태 배지, 다크 오피스 위 캐릭터 핀(눌러서 현재 작업 확인)
2. **회의실** — 전체·지휘실·대회의실·라운지 필터, 발신자 선택(@멘션 칩), 메시지 전송
3. **작업실** — 진행 프로젝트 5개 카드 + 새 작업 지시 추가
4. **비서현황** — 후후·뮤즈·제미나이·Cue·Vooy 상태 카드, 08:15 / 15:00 / 00:00 스케줄 타임라인
5. **메모** — 빠른 메모 추가·삭제·핀 고정
