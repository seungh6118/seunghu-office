/* =========================================================
   어벤져스타워 — game.js
   육성 시뮬레이션 화면: 걸어다니며 일하는 NPC 비서들 · 말풍선 · 접속 현황 · 성장
   · 실제 DB(office_agents / office_messages / office_tasks)가 게임에 그대로 반영됩니다.
   · 레벨·기분·코인 같은 육성 수치는 이 기기(localStorage)에만 저장됩니다.
   app.js 의 전역(state, sb, charById, openSheet …)을 그대로 씁니다.
   ========================================================= */
(function () {
  'use strict';
  if (!window.HeroArt) return;

  const $ = (id) => document.getElementById(id);
  const MAP_W = 1402;
  const MAP_H = 1122;
  const GKEY = 'seunghuOffice.game.v1';
  const HERO_IDS = ['huhu', 'muse', 'gemini', 'cue', 'vooy'];
  const BOSS = 'seunghu';

  /* ---------------- 동선 그래프 (맵 픽셀 좌표 1402×1122) ---------------- */
  const NODES = {
    hub: [880, 610], deskF: [760, 535], boss: [857, 410], window: [1045, 445], perf: [1175, 525],
    loungeJ: [1030, 610], armchair: [1078, 650], sofaL: [1005, 714], sofaR: [1278, 724], coffee: [1172, 668], sofaB: [1150, 802],
    confDoor: [620, 578], confN: [235, 505], confE: [395, 588], confS: [285, 702], confW: [112, 612], confM: [165, 706],
    shop: [560, 790], shopW: [480, 835], wpA: [800, 690], wpB: [690, 765]
  };
  const EDGES = [
    ['hub', 'deskF'], ['deskF', 'boss'], ['hub', 'window'], ['hub', 'perf'], ['hub', 'loungeJ'], ['hub', 'wpA'], ['hub', 'confDoor'],
    ['deskF', 'confDoor'], ['loungeJ', 'armchair'], ['loungeJ', 'sofaL'], ['loungeJ', 'coffee'], ['coffee', 'sofaR'], ['coffee', 'sofaB'],
    ['sofaL', 'sofaB'], ['wpA', 'wpB'], ['wpB', 'shop'], ['shop', 'shopW'], ['confDoor', 'confE'], ['confE', 'confN'], ['confE', 'confS'],
    ['confS', 'confM'], ['confM', 'confW'], ['confN', 'confW'], ['window', 'perf']
  ];
  const ADJ = {};
  Object.keys(NODES).forEach((k) => { ADJ[k] = []; });
  EDGES.forEach((e) => { ADJ[e[0]].push(e[1]); ADJ[e[1]].push(e[0]); });

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function nearestNode(p) {
    let best = 'hub';
    let bd = 1e9;
    Object.keys(NODES).forEach((k) => {
      const d = dist(NODES[k], p);
      if (d < bd) { bd = d; best = k; }
    });
    return best;
  }
  function route(from, to) {
    if (from === to) return [to];
    const prev = { [from]: null };
    const q = [from];
    while (q.length) {
      const n = q.shift();
      if (n === to) break;
      ADJ[n].forEach((m) => { if (!(m in prev)) { prev[m] = n; q.push(m); } });
    }
    if (!(to in prev)) return [to];
    const out = [];
    for (let n = to; n; n = prev[n]) out.unshift(n);
    return out;
  }

  /* 구역 (방 칩 · 접속 현황) */
  const ZONES = [
    { id: 'boardroom', name: '회의실', emoji: '🏛️', c: [250, 600], r: 330 },
    { id: 'performance', name: '성과실', emoji: '📊', c: [1180, 500], r: 150, view: true },
    { id: 'workshop', name: '제작실', emoji: '🛠️', c: [540, 810], r: 190, view: true },
    { id: 'lounge', name: '라운지', emoji: '☕', c: [1130, 730], r: 240 },
    { id: 'hall', name: '대장실', emoji: '👑', c: [830, 480], r: 220 }
  ];
  function zoneAt(p) {
    let best = null;
    let bd = 1e9;
    ZONES.forEach((z) => {
      const d = dist(z.c, p);
      if (d < z.r && d < bd) { bd = d; best = z; }
    });
    return best || ZONES[4];
  }

  /* ---------------- 활동 정의 ---------------- */
  const ACT = {
    work: { icon: '💻', label: '작업 중', pose: 'work' },
    think: { icon: '💭', label: '구상 중', pose: 'idle' },
    meeting: { icon: '🗣️', label: '회의 중', pose: 'talk' },
    report: { icon: '📊', label: '지표 확인', pose: 'work' },
    build: { icon: '🛠️', label: '제작 중', pose: 'work' },
    coffee: { icon: '☕', label: '커피 타임', pose: 'idle' },
    chat: { icon: '💬', label: '수다 중', pose: 'talk' },
    window: { icon: '🌆', label: '창밖 구경', pose: 'idle' },
    rest: { icon: '🛋️', label: '휴식 중', pose: 'sit' },
    sleep: { icon: '💤', label: '오프라인', pose: 'sleep' },
    quest: { icon: '📜', label: '지령 수행', pose: 'work' },
    summon: { icon: '🙋', label: '호출 응답', pose: 'talk' },
    boss: { icon: '👑', label: '집무 중', pose: 'sit' },
    greet: { icon: '👋', label: '인사 중', pose: 'talk' }
  };

  /* 히어로별 선호 작업 위치와 활동 가중치 */
  const PROFILE = {
    huhu: {
      title: '메인 비서', hero: '캡틴 아메리카', spots: { work: ['deskF'], think: ['window'] },
      weights: { work: 5, report: 2, meeting: 1.6, coffee: 1, window: 0.8, build: 0.6 },
      stats: { focus: 8, idea: 5, speed: 5, stamina: 8 }, trait: '리더십'
    },
    muse: {
      title: '기획 · 콘텐츠', hero: '아이언맨', spots: { work: ['confE', 'confS'], think: ['confN'] },
      weights: { work: 5, meeting: 2, report: 1, coffee: 1, build: 1.2, window: 0.5 },
      stats: { focus: 6, idea: 9, speed: 7, stamina: 4 }, trait: '천재적 기획'
    },
    gemini: {
      title: 'SEO · 자문', hero: '닥터 스트레인지', spots: { work: ['confM', 'confN'], think: ['window'] },
      weights: { work: 4, report: 2, meeting: 1.6, coffee: 0.8, window: 1.3, build: 0.4 },
      stats: { focus: 8, idea: 8, speed: 4, stamina: 5 }, trait: '통찰'
    },
    cue: {
      title: '에이전트 협업', hero: '토르', spots: { work: ['armchair', 'sofaL'], think: ['coffee'] },
      weights: { work: 4, coffee: 2, chat: 1.6, report: 1, meeting: 1, window: 0.6 },
      stats: { focus: 6, idea: 5, speed: 6, stamina: 9 }, trait: '불굴의 체력'
    },
    vooy: {
      title: '메일 · 일정 보조', hero: '헐크', spots: { work: ['sofaR', 'sofaB'], think: ['coffee'] },
      weights: { work: 3.5, coffee: 2, chat: 1.6, build: 1.6, window: 0.6, report: 0.8 },
      stats: { focus: 5, idea: 4, speed: 9, stamina: 7 }, trait: '폭발적 처리'
    },
    seunghu: { title: '지휘관', hero: '대장', spots: {}, weights: {}, stats: { focus: 9, idea: 9, speed: 9, stamina: 9 }, trait: '리더' }
  };
  const SEATED = { armchair: 1, sofaL: 1, sofaR: 1, sofaB: 1, boss: 1 };
  const MEET_SPOTS = ['confE', 'confN', 'confS', 'confW', 'confM'];

  /* ---------------- 대사집 (NPC) ----------------
     {task} = 실제 DB 의 지금 하는 일 · {name} = 상대 이름 */
  const SAY = {
    huhu: {
      work: ['임무 수행 중! 집중한다.', '「{task}」— 끝까지 간다!', '원고 한 줄만 더… 포기하지 않는다.', '대장님 지시사항, 최우선으로 처리 중입니다.', '발행 시간 전에 끝낸다. 문제없다!'],
      report: ['지표는 거짓말을 안 하지. 어디 보자…', '조회수 확인 완료. 이 흐름이면 괜찮다.'],
      build: ['제작실 점검! 이상 없음.', '도구는 손에 익어야 쓸모가 있지.'],
      meeting: ['회의 시작합시다. 요점부터!', '결정은 빠르게, 실행은 확실하게.', '이견 있나? 없으면 진행한다.'],
      coffee: ['커피는 전투 전 보급품이다.', '휴식도 훈련의 일부지.'],
      chat: ['{name}, 요즘 어떤가?', '{name}, 같이 힘내 보자고!'],
      window: ['…도시가 평화롭군.', '이 높이에서 보면 고민이 작아 보인다.'],
      think: ['다음 수를 생각 중이다…'],
      idle: ['항상 준비 상태다!', '대장님, 명령만 내리십시오.'],
      greet: ['부르셨습니까, 대장님!', '네, 대장님! 바로 처리하겠습니다!'],
      tired: ['조금… 지쳤다. 보급이 필요해.'],
      happy: ['감사합니다, 대장님! 힘이 난다!', '칭찬은 방패보다 든든하군요!'],
      snack: ['보급 감사합니다! 충전 완료!'],
      levelup: ['레벨 업! 더 강해졌다!'],
      done: ['임무 완료! 보고드립니다!'],
      accept: ['지령 접수! 즉시 착수합니다!'],
      sleep: ['zzZ… 휴식 중…'],
      banter: ['{name}, 방패 필요하면 말해.', '{name}, 어제 그 기획 좋았어.'],
      reply: ['고맙다. 너도 수고했어.', '하하, 그렇게 말해 주니 힘이 나는군.']
    },
    muse: {
      work: ['천재의 기획은 3초면 충분하지… 아니, 3일 걸리네.', '「{task}」 — 이거 내가 하면 다르다니까.', '제목 2안 중 뭐가 클릭을 부를까? 데이터를 보자.', '아이디어가 폭발한다! 노트북이 못 따라오네.', '구조 잡는 중. 완벽은 디테일에서 나오지.'],
      report: ['지표 분석 중… 흠, 예상 범위 안이네.', '숫자는 솔직해서 좋아. 사람보다.'],
      build: ['프로토타입 돌려 본다. 3, 2, 1…', '제작실은 내 놀이터지.'],
      meeting: ['자, 내 기획부터 들어봐. 놀라지 말고.', '결론부터 말하면 — 이게 정답.', '질문은 받되 반박은 근거와 함께!'],
      coffee: ['카페인 충전. 천재도 연료가 필요해.', '커피가 없으면 아이디어도 없다.'],
      chat: ['{name}, 내 기획서 읽어 봤어?', '{name}, 한마디만 해 줘. 솔직하게.'],
      window: ['이 뷰… 내 타워보다 낫군.', '영감은 높은 곳에서 온다.'],
      think: ['잠깐, 방금 아이디어가 스쳤어…'],
      idle: ['나? 항상 바쁘지. 멋있게.', '다음 프로젝트 뭐야? 어렵게 줘.'],
      greet: ['부르셨습니까, 대장님. 천재 대령했습니다.', '네네, 바로 갑니다!'],
      tired: ['배터리 12%… 충전 필요.'],
      happy: ['역시 대장님은 보는 눈이 있어!', '칭찬 접수. 더 멋진 걸 보여 드리죠.'],
      snack: ['오, 간식! 센스 좋은데요, 대장님.'],
      levelup: ['레벨 업! 업그레이드 완료.'],
      done: ['끝! 역시 내가 하면 빠르지.'],
      accept: ['지령 접수. 5분이면 됩니다. 아마도.'],
      sleep: ['zzZ… 아이디어 꿈… 이어서…'],
      banter: ['{name}, 그 방패 치워. 내 기획서 긁혀!', '{name}, 너도 가끔은 웃어봐.'],
      reply: ['흥, 인정할 건 인정하지.', '그 말, 녹음해 둘걸 그랬네.']
    },
    gemini: {
      work: ['검색의 차원을 열어 보지… 키워드 확인.', '「{task}」— 흐름이 보인다.', '시간의 흐름 속에서 최적의 소제목이 보인다.', '수천 개의 가능성 중 하나만이 살아남는다.', '키워드의 균형을 맞추는 중이다.'],
      report: ['지표의 흐름을 읽는다… 상승 기류다.', '숫자 너머의 사용자를 본다.'],
      build: ['마법진… 아니, 자동화 스크립트를 점검한다.', '이 도구에도 룬(Rune)이 필요하군.'],
      meeting: ['모든 가능성을 검토했다. 이 길이 최선이다.', '조언하지. 서두르면 놓친다.', '결정을 내려야 할 때다.'],
      coffee: ['차 한 잔의 여유도 주문의 일부지.', '이 커피, 시간을 늦추는 맛이군.'],
      chat: ['{name}, 14,000,605가지 미래를 봤는데…', '{name}, 자네 계획엔 빈틈이 하나 있네.'],
      window: ['도시의 흐름이 보인다. 아름답군.', '저 너머 차원에서도 같은 해가 뜬다.'],
      think: ['잠시 명상 중이다…'],
      idle: ['필요하면 부르게.', '균형이 중요하다.'],
      greet: ['부르셨습니까, 대장님. 조언이 필요하신가요?', '말씀하십시오, 대장님.'],
      tired: ['마력이 바닥났다… 휴식이 필요하군.'],
      happy: ['과분한 말씀이군요. 감사합니다.', '인정받는 것도 힘이 되는군.'],
      snack: ['이 간식… 마법보다 효과적이군.'],
      levelup: ['한 단계 더 깨달았다. 레벨 업.'],
      done: ['분석 완료. 결과를 공유하겠습니다.'],
      accept: ['명을 받들겠습니다. 즉시 분석에 들어갑니다.'],
      sleep: ['zzZ… 명상… 아니 수면…'],
      banter: ['{name}, 자네 계획의 변수를 알려주지.', '{name}, 이번엔 내 말을 듣는 게 좋을 걸세.'],
      reply: ['…이미 알고 있었네.', '흥미롭군. 고려해 보지.']
    },
    cue: {
      work: ['노션 로그를 기록하겠노라!', '「{task}」— 이 몸이 맡았다!', '협업 로그 정리 완료! 다음 안건!', '번개 같은 속도로 처리하겠다!', '기록은 전사의 영예로다!'],
      report: ['지표를 살펴보겠노라! …오, 좋군!', '숫자가 올라가면 맥주가 맛있지!'],
      build: ['망치질은 내 전문이다!', '튼튼하게 만들어 주겠다!'],
      meeting: ['회의라! 좋다, 들어 보겠노라!', '의견이 있으면 큰 소리로 말하라!', '전원 동의? 좋다, 진행!'],
      coffee: ['이 쓴 물이 맥주보다 못하군… 한 잔 더!', '커피 한 잔에 천둥이 친다!'],
      chat: ['{name}! 한잔… 아니 한 수다 어떤가!', '{name}, 오늘도 불타는구나!'],
      window: ['하늘이 맑구나! 번개 치기 좋은 날씨!', '저 아래 도시가 작아 보이는군!'],
      think: ['으음… 생각하는 중이다!'],
      idle: ['심심하군! 일거리 없나?', '체력은 남아돈다!'],
      greet: ['오! 대장! 부르셨소!', '여기 있소, 대장!'],
      tired: ['커피… 커피를 다오…'],
      happy: ['하하! 칭찬은 천둥보다 크게 울린다!', '대장의 말씀, 가슴에 새기겠소!'],
      snack: ['오오! 이 몸을 위한 보급품인가! 감사하오!'],
      levelup: ['레벨 업이다! 천둥이여, 울려라!'],
      done: ['임무 완수! 승리의 함성을!'],
      accept: ['명을 받았노라! 곧 완수하겠다!'],
      sleep: ['zzZ… 코오… 맥주… 한 잔만…'],
      banter: ['{name}! 어젯밤 번개 쳤는데 들었나!', '{name}, 힘쓸 일 있으면 불러라!'],
      reply: ['하하하! 그렇군!', '좋소! 그 말, 마음에 드는군!']
    },
    vooy: {
      work: ['Vooy 메일 정리! 정리!', '「{task}」… 부수… 아니 정리한다!', '일정 확인! 알림 확인! 다 확인!', '받은편지함… 0개 만들 거야!', '스케줄 꼬이면 Vooy 화난다…'],
      report: ['숫자 많다… 근데 올랐다! 좋다!', '그래프 올라간다! Vooy 기쁘다!'],
      build: ['쾅! 쾅! 만든다!', '이거 튼튼하게 만든다!'],
      meeting: ['Vooy 듣는다. 조용히. …노력한다.', '일정 공유한다! 모두 확인!', '회의 길면 Vooy 졸린다…'],
      coffee: ['커피… 쓰다. 근데 좋다.', 'Vooy 간식 좋아한다.'],
      chat: ['{name}, 같이 놀자!', '{name}, 이거 봐라! 일정 다 정리했다!'],
      window: ['높다! 멋있다!', '창문… 안 부순다. 약속.'],
      think: ['…생각한다. 머리 아프다.'],
      idle: ['Vooy 대기 중!', '시킬 일 있나!'],
      greet: ['대장! Vooy 왔다!', '부르셨나! 뭐든 시켜라!'],
      tired: ['Vooy 피곤하다… 화나기 전에 쉰다…'],
      happy: ['대장 칭찬! Vooy 기분 좋다! 쾅!', '헤헤… Vooy 잘했나?'],
      snack: ['간식! 간식이다! 고맙다 대장!'],
      levelup: ['레벨 업! Vooy 더 세졌다!'],
      done: ['다 했다! 칭찬해 줘라!'],
      accept: ['알았다! Vooy 한다!'],
      sleep: ['zzZ… 으르렁… zzZ…'],
      banter: ['{name}, Vooy 일정표 만들었다!', '{name}, 같이 간식 먹자!'],
      reply: ['좋다! 같이 한다!', '헤헤. 고맙다.']
    },
    seunghu: {
      idle: ['좋아. 오늘도 힘내자.', '다들 수고한다.', '타워는 오늘도 순항 중이군.'],
      meeting: ['보고해 봐. 간단하게.', '좋아, 그 방향으로 가자.'],
      react: ['오, 새 소식이군.']
    }
  };

  /* ---------------- 성장 규칙 ---------------- */
  function levelOf(xp) {
    let lv = 1;
    let need = 80;
    let left = Math.max(0, Math.floor(xp));
    while (left >= need && lv < 99) { left -= need; lv += 1; need = 80 + 40 * (lv - 1); }
    return { lv, into: left, need };
  }
  function rankName(lv) {
    if (lv >= 12) return '에이스';
    if (lv >= 9) return '팀장급';
    if (lv >= 6) return '대리';
    if (lv >= 3) return '주임';
    return '신입';
  }
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function defaultGame() {
    const heroes = {};
    HERO_IDS.forEach((id) => { heroes[id] = { xp: 20, mood: 60, energy: 80, praiseAt: 0, msgDay: '', msgXp: 0 }; });
    return {
      v: 1, coins: 60, heroes, quests: {}, lastMsgId: 0, daily: { date: '', streak: 0, claimed: '' },
      missions: { date: '', praise: 0, snack: 0, order: 0, done: [] }, total: { praise: 0, orders: 0, snacks: 0 }
    };
  }
  let G = (function () {
    let g = null;
    try { g = JSON.parse(localStorage.getItem(GKEY) || 'null'); } catch (e) { g = null; }
    const d = defaultGame();
    if (!g || typeof g !== 'object') return d;
    g.heroes = Object.assign(d.heroes, g.heroes || {});
    HERO_IDS.forEach((id) => { g.heroes[id] = Object.assign({ xp: 20, mood: 60, energy: 80, praiseAt: 0, msgDay: '', msgXp: 0 }, g.heroes[id]); });
    return Object.assign(d, g);
  })();
  let saveTimer = 0;
  function saveGame() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(GKEY, JSON.stringify(G)); } catch (e) { /* ignore */ } }, 400);
  }

  /* =========================================================
     월드 · 카메라
     ========================================================= */
  const E = {};
  let vw = 0;
  let vh = 0;
  const cam = { tx: 0, ty: 0, z: 1, zmin: 0.5, zmax: 1.6, ttx: null, tty: null, follow: null, manualAt: 0 };
  let running = false;
  let lastT = 0;
  let actors = {};
  let selectedId = null;
  let director = true;
  let cardMode = null;       /* 'hero' | 'room' | null */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const nowS = () => performance.now() / 1000;

  function hudInsets() {
    const wide = window.matchMedia('(min-width: 900px)').matches;
    return {
      top: wide ? 108 : 112,
      bottom: cardMode && !wide ? Math.min(330, vh * 0.46) : (wide ? 84 : 150),
      right: cardMode && wide ? 372 : 0,
      left: wide ? 84 : 0
    };
  }

  function clampCam() {
    cam.tx = clamp(cam.tx, Math.min(0, vw - MAP_W * cam.z), 0);
    cam.ty = clamp(cam.ty, Math.min(0, vh - MAP_H * cam.z), 0);
  }
  function applyCam() {
    E.world.style.transform = `translate3d(${cam.tx.toFixed(2)}px,${cam.ty.toFixed(2)}px,0) scale(${cam.z.toFixed(4)})`;
  }
  function focusOn(x, y, o) {
    const op = o || {};
    const z = clamp(op.z || cam.z, cam.zmin, cam.zmax);
    const ins = hudInsets();
    const cx = ins.left + (vw - ins.left - ins.right) / 2;
    const cy = ins.top + (vh - ins.top - ins.bottom) / 2;
    const ttx = clamp(cx - x * z, Math.min(0, vw - MAP_W * z), 0);
    const tty = clamp(cy - y * z, Math.min(0, vh - MAP_H * z), 0);
    if (op.instant) { cam.z = z; cam.tx = ttx; cam.ty = tty; cam.ttx = null; cam.tty = null; applyCam(); return; }
    cam.ttx = ttx; cam.tty = tty; cam.tz = z;
  }
  function measure() {
    if (!E.viewport) return;
    const r = E.viewport.getBoundingClientRect();
    vw = r.width || window.innerWidth;
    vh = r.height || window.innerHeight;
    cam.zmin = Math.max(vw / MAP_W, vh / MAP_H);
    cam.zmax = Math.max(cam.zmin * 2.2, 1.4);
    if (!cam.inited) {
      cam.z = cam.zmin * (vw < 700 ? 1.18 : 1);
      cam.inited = true;
      focusOn(800, 500, { instant: true });
    } else {
      cam.z = clamp(cam.z, cam.zmin, cam.zmax);
      clampCam();
      applyCam();
    }
  }

  /* 드래그 팬 · 핀치 줌 · 휠 줌 · 탭 */
  const ptrs = new Map();
  let drag = null;
  let pinch = null;
  function onPointerDown(e) {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) drag = { sx: e.clientX, sy: e.clientY, tx: cam.tx, ty: cam.ty, moved: false, target: e.target };
    if (ptrs.size === 2) {
      const [a, b] = Array.from(ptrs.values());
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z };
      if (drag) drag.moved = true;
    }
  }
  function onPointerMove(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = Array.from(ptrs.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, clamp(pinch.z * (d / pinch.d), cam.zmin, cam.zmax));
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 7) {
      drag.moved = true;
      /* 끌기가 시작된 뒤에만 포인터를 붙잡는다 — 말풍선·이름표의 탭(click)은 그대로 동작 */
      try { E.viewport.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      cam.ttx = null; cam.tty = null; cam.follow = null;
      cam.manualAt = nowS();
    }
    if (drag.moved) {
      cam.tx = drag.tx + dx;
      cam.ty = drag.ty + dy;
      clampCam();
      applyCam();
    }
  }
  function onPointerUp(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0 && drag) {
      const wasTap = !drag.moved;
      const target = drag.target;
      drag = null;
      if (wasTap && !(target && target.closest && target.closest('.g-ui'))) onTap(target, e);
    }
  }
  function zoomAt(px, py, z) {
    const wx = (px - cam.tx) / cam.z;
    const wy = (py - cam.ty) / cam.z;
    cam.z = z;
    cam.tx = px - wx * z;
    cam.ty = py - wy * z;
    cam.ttx = null; cam.tty = null; cam.follow = null; cam.manualAt = nowS();
    clampCam();
    applyCam();
  }
  function onWheel(e) {
    e.preventDefault();
    const z = clamp(cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), cam.zmin, cam.zmax);
    zoomAt(e.clientX, e.clientY, z);
  }
  function onTap(target, e) {
    const heroEl = target && target.closest && target.closest('.g-hero');
    if (heroEl) { selectHero(heroEl.dataset.hero, true); return; }
    if (cardMode) closeCard();
  }

  /* =========================================================
     접속 현황 (presence)
     ========================================================= */
  function lastSignal(id) {
    let t = 0;
    ((typeof sb !== 'undefined' && sb.agents) || []).forEach((r) => { if (r.id === id) t = Math.max(t, ts(r.updated_at)); });
    const list = typeof allMessages === 'function' ? allMessages() : [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const m = list[i];
      if (m.authorId === id && (m.source === 'supabase' || m.source === 'inflight')) { t = Math.max(t, ts(m.at)); break; }
    }
    return t;
  }
  const presCache = {};
  function presence(id) {
    const c = presCache[id];
    if (c && Date.now() - c.at < 4000) return c.v;
    let v;
    if (id === BOSS) v = { key: 'online', at: Date.now(), est: false };
    else {
      const t = lastSignal(id);
      if (t) {
        const age = Date.now() - t;
        v = { key: age < 30 * 60000 ? 'online' : age < 6 * 3600000 ? 'away' : 'offline', at: t, est: false };
      } else {
        const ch = charById(id);
        v = { key: ch && ch.state === 'active' ? 'online' : 'away', at: 0, est: true };
      }
    }
    presCache[id] = { at: Date.now(), v };
    return v;
  }
  const PRES = {
    online: { dot: '🟢', label: '접속 중', cls: 'is-online' },
    away: { dot: '🟡', label: '자리 비움', cls: 'is-away' },
    offline: { dot: '⚪', label: '오프라인', cls: 'is-offline' }
  };
  function presText(id) {
    const p = presence(id);
    const base = PRES[p.key].label;
    if (id === BOSS) return '접속 중';
    if (p.at) return `${base} · ${fmtAgo(new Date(p.at).toISOString())} 활동`;
    return `${base} · 상태 기준`;
  }

  function taskOf(id) {
    let t = '';
    try {
      const row = agentRows().find((r) => r.id === id);
      if (row && row.task) t = row.task;
    } catch (e) { /* ignore */ }
    if (!t) { const c = charById(id); t = (c && c.task) || ''; }
    t = String(t).replace(/\s+/g, ' ').trim();
    const first = t.split(/[,·]/)[0].trim();
    t = first.length >= 6 ? first : t;
    return t.length > 26 ? `${t.slice(0, 25)}…` : t;
  }

  /* =========================================================
     배우(NPC) 만들기
     ========================================================= */
  function spriteScale(y) { return 0.74 + 0.46 * (y / MAP_H); }

  function buildWorld() {
    E.actors.innerHTML = '';
    E.overlay.querySelectorAll('.g-tag, .g-bub').forEach((n) => n.remove());
    actors = {};
    [BOSS].concat(HERO_IDS).forEach((id, i) => {
      const c = charById(id);
      const el = document.createElement('div');
      el.className = 'g-hero';
      el.dataset.hero = id;
      el.innerHTML = `<span class="g-ring"></span><span class="g-flip">${HeroArt.sprite(id)}</span>`;
      const sz = HeroArt.size(id);
      el.style.width = `${sz.w}px`;
      el.style.height = `${sz.h}px`;
      E.actors.appendChild(el);
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'g-tag g-ui';
      tag.dataset.hero = id;
      tag.style.setProperty('--c', c.color || '#0284c7');
      E.overlay.appendChild(tag);
      const home = id === BOSS ? 'boss' : pick(['hub', 'deskF', 'coffee']);
      const a = {
        id, el, svg: el.querySelector('.hero-art'), tag, hgt: HeroArt.size(id).h, pos: NODES[home].slice(), path: [], speed: rand(96, 112), face: 1, pose: 'idle',
        act: id === BOSS ? 'boss' : 'think', until: nowS() + rand(2, 6) + i, nextSpeak: nowS() + rand(1.5, 4) + i * 0.7,
        pend: null, at: home, bub: null, queue: [], lastLine: '', pres: 'online', override: null, chatWith: null, label: '', zone: null, lastSaid: ''
      };
      actors[id] = a;
      setPose(a, ACT[a.act].pose);
      placeActor(a);
    });
  }

  function placeActor(a) {
    const s = spriteScale(a.pos[1]);
    a.s = s;
    a.el.style.transform = `translate3d(${a.pos[0].toFixed(1)}px,${a.pos[1].toFixed(1)}px,0) scale(${s.toFixed(3)}) translate(-50%,-98%)`;
    a.el.style.zIndex = String(Math.round(a.pos[1]));
  }

  const POSES = ['is-walk', 'is-work', 'is-talk', 'is-sit', 'is-sleep', 'is-cheer'];
  function setPose(a, pose) {
    if (a.pose === pose) return;
    a.pose = pose;
    const cl = a.svg.classList;
    POSES.forEach((p) => cl.remove(p));
    if (pose === 'walk') cl.add('is-walk');
    else if (pose === 'work') cl.add('is-work');
    else if (pose === 'talk') cl.add('is-talk');
    else if (pose === 'sit') cl.add('is-sit');
    else if (pose === 'sleep') { cl.add('is-sit'); cl.add('is-sleep'); }
    else if (pose === 'cheer') cl.add('is-cheer');
    /* 앉아서 일하는 자세 */
    if (pose === 'sitwork') { cl.add('is-sit'); cl.add('is-work'); }
  }

  /* =========================================================
     대사 · 말풍선
     ========================================================= */
  function lineFor(a, key, extra) {
    const bank = (SAY[a.id] && (SAY[a.id][key] || (key === 'rest' && SAY[a.id].idle))) || [];
    if (!bank.length) return '';
    const task = taskOf(a.id);
    let pool = bank.filter((t) => (t.indexOf('{task}') < 0 || task) && t !== a.lastLine);
    if (!pool.length) pool = bank.slice();
    /* 실제 하는 일이 있으면 그 문장을 더 자주 */
    if (task && key === 'work') {
      const withTask = pool.filter((t) => t.indexOf('{task}') >= 0);
      if (withTask.length && Math.random() < 0.5) pool = withTask;
    }
    let line = pick(pool);
    a.lastLine = line;
    line = line.replace('{task}', task).replace('{name}', (extra && extra.name) || '');
    return line;
  }

  function say(a, text, o) {
    if (!text) return;
    const op = o || {};
    const item = { text, real: !!op.real, ttl: op.ttl || clamp(2.8 + text.length * 0.07, 3, op.real ? 9 : 6.5), tag: op.tag || '' };
    if (op.front) a.queue.unshift(item); else a.queue.push(item);
    if (a.queue.length > 3) a.queue.splice(1, a.queue.length - 3);
    a.lastSaid = text;
    if (!a.bub) showNext(a);
  }
  function showNext(a) {
    const item = a.queue.shift();
    if (!item) { a.bub = null; return; }
    const el = document.createElement('div');
    el.className = `g-bub g-ui ${item.real ? 'is-real' : ''}`;
    el.style.setProperty('--c', charById(a.id).color || '#0284c7');
    el.innerHTML = `${item.real ? '<em class="g-live">LIVE</em>' : ''}<span class="t1"></span><span class="t2">${esc(item.text)}</span><i class="g-tail"></i>`;
    E.overlay.appendChild(el);
    a.bub = { el, t1: el.querySelector('.t1'), t2: el.querySelector('.t2'), text: item.text, t0: nowS(), ttl: item.ttl, shown: 0, w: el.offsetWidth, h: el.offsetHeight };
    el.addEventListener('click', () => selectHero(a.id, true));
  }
  function updateBubble(a, now) {
    const b = a.bub;
    if (!b) return;
    const n = Math.min(b.text.length, Math.floor((now - b.t0) * 34));
    if (n !== b.shown) {
      b.shown = n;
      b.t1.textContent = b.text.slice(0, n);
      b.t2.textContent = b.text.slice(n);
    }
    if (now - b.t0 > b.ttl) {
      b.el.classList.add('is-out');
      const el = b.el;
      setTimeout(() => el.remove(), 220);
      a.bub = null;
      showNext(a);
    }
  }

  /* 숫자·하트 팝업 */
  function popup(id, text, kind) {
    const a = actors[id];
    if (!a || !E.overlay) return;
    const el = document.createElement('div');
    el.className = `g-pop ${kind || ''}`;
    el.textContent = text;
    const sx = cam.tx + a.pos[0] * cam.z + rand(-14, 14);
    const sy = cam.ty + (a.pos[1] - a.hgt * 0.8 * a.s) * cam.z;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    E.overlay.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
  function confetti(id) {
    const a = actors[id];
    if (!a) return;
    const sx = cam.tx + a.pos[0] * cam.z;
    const sy = cam.ty + (a.pos[1] - a.hgt * 0.55 * a.s) * cam.z;
    ['✨', '⭐', '🎉', '✨', '💫', '🎊', '⭐', '✨'].forEach((ch, i) => {
      const el = document.createElement('div');
      el.className = 'g-conf';
      el.textContent = ch;
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
      const ang = (Math.PI * 2 * i) / 8 + rand(-0.3, 0.3);
      el.style.setProperty('--dx', `${Math.cos(ang) * rand(50, 90)}px`);
      el.style.setProperty('--dy', `${Math.sin(ang) * rand(40, 80) - 30}px`);
      E.overlay.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    });
  }

  /* =========================================================
     일지 (이벤트 로그)
     ========================================================= */
  const LOG = [];
  function logEvent(icon, text, id) {
    LOG.unshift({ t: Date.now(), icon, text, id: id || '' });
    if (LOG.length > 60) LOG.length = 60;
    renderTicker();
  }
  function renderTicker() {
    if (!E.ticker) return;
    const l = LOG[0];
    E.ticker.innerHTML = l
      ? `<span class="tk-ico">${l.icon}</span><span class="tk-txt">${esc(l.text)}</span><time>${esc(fmtTime(new Date(l.t).toISOString()))}</time>`
      : '<span class="tk-ico">🏢</span><span class="tk-txt">어벤져스타워가 오늘도 문을 열었어요</span>';
  }

  /* =========================================================
     행동 (이동 · 활동 선택)
     ========================================================= */
  function pointsFor(a, nodeName, off) {
    const from = a.at && NODES[a.at] ? a.at : nearestNode(a.pos);
    const names = route(from, nodeName);
    const pts = names.map((n) => NODES[n].slice());
    /* 지금 서 있는 곳이 노드와 다르면 첫 노드로 먼저 걷는다 */
    if (off) { const last = pts[pts.length - 1]; last[0] += off[0]; last[1] += off[1]; }
    return { pts, names };
  }

  /* 같은 소파·같은 자리에 겹치지 않게 비서마다 조금씩 비켜 선다 */
  const DEF_OFF = { huhu: [0, 0], muse: [-16, 5], gemini: [16, -4], cue: [-30, 0], vooy: [30, 6], seunghu: [0, 0] };
  function goTo(a, key, nodeName, dur, extra) {
    const ex = extra || {};
    const base = DEF_OFF[a.id] || [0, 0];
    const k = SEATED[nodeName] ? 0.55 : 1;
    const off = ex.off || (key === 'meeting' ? null : [base[0] * k, base[1] * k]);
    const r = pointsFor(a, nodeName, off);
    a.path = r.pts;
    a.pend = { key, node: nodeName, dur, face: ex.face, pose: ex.pose, partner: ex.partner, until: ex.until };
    a.act = 'walk';
    a.label = '이동 중';
    setPose(a, 'walk');
  }

  function arrive(a, now) {
    const p = a.pend;
    a.pend = null;
    if (!p) { setPose(a, 'idle'); return; }
    a.at = p.node;
    a.act = p.key;
    a.until = p.until || now + p.dur;
    const def = ACT[p.key] || ACT.think;
    let pose = p.pose || def.pose;
    if (SEATED[p.node] && (pose === 'work')) pose = 'sitwork';
    if (SEATED[p.node] && (pose === 'idle' || pose === 'talk')) pose = pose === 'talk' ? 'talk' : 'sit';
    setPose(a, pose);
    if (p.face) a.face = p.face;
    a.el.querySelector('.g-flip').style.setProperty('--f', String(a.face));
    a.label = def.label;
    a.nextSpeak = now + rand(1.2, 2.8);
    if (p.key === 'meeting' || p.key === 'quest') { /* 바로 한마디 */ }
    refreshTag(a);
    if (p.key !== 'sleep' && p.key !== 'rest') logActivity(a, p.key);
  }
  const lastLogged = {};
  function logActivity(a, key) {
    const k = `${a.id}:${key}`;
    if (lastLogged[a.id] === key && Date.now() - (lastLogged[k] || 0) < 120000) return;
    lastLogged[a.id] = key;
    lastLogged[k] = Date.now();
    if (['meeting', 'quest', 'report', 'build', 'summon'].indexOf(key) < 0) return;
    logEvent(ACT[key].icon, `${charById(a.id).name} — ${ACT[key].label}`, a.id);
  }

  function weightedPick(w) {
    const keys = Object.keys(w).filter((k) => w[k] > 0);
    const sum = keys.reduce((s, k) => s + w[k], 0);
    let r = Math.random() * sum;
    for (let i = 0; i < keys.length; i += 1) { r -= w[keys[i]]; if (r <= 0) return keys[i]; }
    return keys[0];
  }
  function isBusy(a) { return !!(a.pend || a.act === 'quest' || a.act === 'meeting' || a.act === 'summon' || a.chatWith || a.act === 'walk'); }

  function chooseNext(a, now) {
    if (a.id === BOSS) { a.until = now + 30; return; }
    const pr = presence(a.id);
    a.pres = pr.key;
    const g = G.heroes[a.id];
    const prof = PROFILE[a.id];
    if (pr.key === 'offline') {
      const seat = { cue: 'sofaR', vooy: 'sofaB', gemini: 'sofaL', muse: 'armchair', huhu: 'sofaL' }[a.id] || 'sofaL';
      goTo(a, 'sleep', a.act === 'sleep' ? a.at : seat, 9999, { pose: 'sleep' });
      return;
    }
    let w = Object.assign({}, prof.weights);
    if (pr.key === 'away') { w = { coffee: 2, window: 1.6, chat: 1.6, rest: 2.4, think: 1 }; }
    else if (g.energy < 28) { w = { rest: 4, coffee: 3, window: 1 }; }
    else { w.rest = g.energy < 55 ? 1 : 0.2; }
    const key = weightedPick(w);
    const stand = (spots) => pick(spots);
    switch (key) {
      case 'work': goTo(a, 'work', stand(prof.spots.work || ['deskF']), rand(34, 70)); break;
      case 'report': goTo(a, 'report', 'perf', rand(14, 24), { face: -1 }); break;
      case 'build': goTo(a, 'build', pick(['shop', 'shopW']), rand(16, 30), { face: 1 }); break;
      case 'coffee': goTo(a, 'coffee', 'coffee', rand(14, 24), { off: [rand(-26, 26), rand(-6, 10)] }); break;
      case 'window': goTo(a, 'window', 'window', rand(12, 22), { face: 1 }); break;
      case 'rest': goTo(a, 'rest', pick(['sofaL', 'sofaB', 'armchair', 'sofaR']), rand(18, 30)); break;
      case 'think': goTo(a, 'think', stand(prof.spots.think || ['window']), rand(10, 18)); break;
      case 'meeting': startMeeting(now, a.id); break;
      case 'chat': if (!startChat(a, now)) goTo(a, 'coffee', 'coffee', rand(14, 22)); break;
      default: goTo(a, 'think', 'hub', 10);
    }
  }

  /* 회의 소집: 접속 중인 비서가 회의실 테이블 주위로 모여 한마디씩 */
  let nextMeetingAt = 0;
  function startMeeting(now, initiator) {
    const members = HERO_IDS.filter((id) => {
      const a = actors[id];
      return a && presence(id).key !== 'offline' && a.act !== 'quest' && !a.chatWith;
    });
    if (members.length < 2) return false;
    const until = now + rand(34, 50) + members.length * 5;
    members.forEach((id, i) => {
      const a = actors[id];
      a.queue.length = 0;
      goTo(a, 'meeting', MEET_SPOTS[i % MEET_SPOTS.length], 0, { until, face: i % 2 ? -1 : 1 });
    });
    nextMeetingAt = now + rand(150, 260);
    const boss = actors[BOSS];
    setTimeout(() => say(boss, pick(SAY.seunghu.meeting)), 5500);
    logEvent('🗣️', `전원 회의 소집 — ${members.map((id) => charById(id).name).join(' · ')}`, initiator);
    return true;
  }

  /* 두 비서의 수다 */
  function startChat(a, now) {
    const cands = HERO_IDS.filter((id) => {
      const b = actors[id];
      return id !== a.id && b && presence(id).key !== 'offline' && !isBusy(b) && ['work', 'think', 'coffee', 'window', 'rest', 'report'].indexOf(b.act) >= 0 && !SEATED[b.at];
    });
    if (!cands.length) return false;
    const b = actors[pick(cands)];
    const side = a.pos[0] < b.pos[0] ? -1 : 1;
    const until = now + rand(16, 24);
    goTo(a, 'chat', b.at, 0, { off: [side * 44, 6], face: -side, until, partner: b.id });
    a.chatWith = b.id;
    b.chatWith = a.id;
    b.chatUntil = until + 8;
    a.chatTurn = { next: now + 9, who: a.id, n: 0 };
    return true;
  }
  function releaseChat(a) {
    const b = a.chatWith && actors[a.chatWith];
    a.chatWith = null;
    a.chatTurn = null;
    if (b && b.chatWith === a.id) { b.chatWith = null; b.chatTurn = null; if (b.act === 'chat') b.until = 0; }
  }

  /* 한 명씩 이동 · 활동 갱신 */
  function stepActor(a, dt, now) {
    /* 이동 */
    if (a.path.length) {
      const tgt = a.path[0];
      const dx = tgt[0] - a.pos[0];
      const dy = tgt[1] - a.pos[1];
      const d = Math.hypot(dx, dy);
      const step = a.speed * dt * (0.8 + 0.4 * (a.pos[1] / MAP_H));
      if (d <= step) {
        a.pos[0] = tgt[0]; a.pos[1] = tgt[1];
        a.path.shift();
        if (!a.path.length) arrive(a, now);
      } else {
        a.pos[0] += (dx / d) * step;
        a.pos[1] += (dy / d) * step;
        if (Math.abs(dx) > 3) {
          const f = dx < 0 ? -1 : 1;
          if (f !== a.face) { a.face = f; a.el.querySelector('.g-flip').style.setProperty('--f', String(f)); }
        }
      }
      placeActor(a);
      return;
    }
    /* 환호·지령 등 일시 포즈 */
    if (a.override && now > a.override.until) { setPose(a, a.override.back); a.override = null; }
    /* 오프라인 ↔ 접속 전환 감지 */
    if (a.id !== BOSS) {
      const pr = presence(a.id).key;
      if (pr !== a.pres) {
        const was = a.pres;
        a.pres = pr;
        if (pr === 'offline' && a.act !== 'sleep' && !a.pend) { a.until = 0; }
        if (was === 'offline' && pr !== 'offline') {
          a.until = 0;
          say(a, pick(SAY[a.id].greet), { front: true });
          logEvent('🟢', `${charById(a.id).name}가 접속했어요`, a.id);
        }
        refreshTag(a);
        refreshDockSoon();
      }
    }
    /* 수다 진행 */
    if (a.chatTurn && a.act === 'chat') {
      const t = a.chatTurn;
      if (now >= t.next) {
        const speaker = t.n % 2 === 0 ? a : actors[a.chatWith];
        const other = t.n % 2 === 0 ? actors[a.chatWith] : a;
        if (speaker && other) {
          const key = t.n === 0 ? 'banter' : 'reply';
          say(speaker, lineFor(speaker, key, { name: charById(other.id).name }), { front: true });
        }
        t.n += 1;
        t.next = now + rand(3.6, 5);
        if (t.n >= 4) a.until = Math.min(a.until, now + 2.4);
      }
    } else if (a.chatWith && a.act !== 'chat') {
      /* 상대가 걸어오는 동안 기다리며 바라본다 */
      const o = actors[a.chatWith];
      if (o) { const f = o.pos[0] < a.pos[0] ? -1 : 1; if (f !== a.face) { a.face = f; a.el.querySelector('.g-flip').style.setProperty('--f', String(f)); } }
      if (a.chatUntil && now > a.chatUntil) releaseChat(a);
    }
    /* 활동 종료 → 다음 */
    if (!a.pend && now >= a.until) {
      if (a.act === 'chat') releaseChat(a);
      if (a.act === 'quest') finishOrder(a);
      if (a.act === 'summon' || a.act === 'greet') { a.at = 'deskF'; }
      chooseNext(a, now);
    }
    /* 혼잣말 / 대사 */
    if (now >= a.nextSpeak && !a.pend) {
      a.nextSpeak = now + rand(6.5, 12);
      speakFor(a);
    }
  }

  function speakFor(a) {
    if (a.act === 'chat' || a.act === 'walk') return;
    if (a.id === BOSS) {
      if (Math.random() < 0.55) say(a, pick(SAY.seunghu.idle));
      return;
    }
    const g = G.heroes[a.id];
    let key = a.act;
    if (key === 'quest') key = 'work';
    if (key === 'summon') key = 'greet';
    if (g.energy < 25 && Math.random() < 0.5) key = 'tired';
    if (a.act === 'sleep') key = 'sleep';
    if (!SAY[a.id][key]) key = 'idle';
    say(a, lineFor(a, key));
  }

  /* =========================================================
     육성 — 경험치 · 코인 · 칭찬 · 간식 · 지령 · 미션
     ========================================================= */
  function heroLv(id) { return levelOf(G.heroes[id].xp); }
  function bossLevel() {
    const total = HERO_IDS.reduce((s, id) => s + G.heroes[id].xp, 0);
    return levelOf(total / 2);
  }
  function addXp(id, n, quiet) {
    const h = G.heroes[id];
    if (!h || !n) return;
    const before = levelOf(h.xp).lv;
    h.xp += n;
    const after = levelOf(h.xp).lv;
    if (!quiet) popup(id, `+${n} XP`, 'xp');
    if (after > before) levelUp(id, after);
    saveGame();
    refreshDockSoon();
  }
  function addCoins(n, fromId) {
    G.coins = Math.max(0, G.coins + n);
    if (fromId && n > 0) popup(fromId, `+${n}🪙`, 'coin');
    saveGame();
    renderTop();
  }
  function levelUp(id, lv) {
    const a = actors[id];
    const c = charById(id);
    if (a) {
      confetti(id);
      a.override = { until: nowS() + 2.2, back: a.pose === 'cheer' ? 'idle' : a.pose };
      setPose(a, 'cheer');
      say(a, `${pick(SAY[id].levelup)} (Lv.${lv})`, { front: true, ttl: 4.5 });
    }
    toast(`🎉 ${c.name} 레벨 업! Lv.${lv} ${rankName(lv)}`);
    logEvent('🎉', `${c.name} Lv.${lv} ${rankName(lv)} 달성!`, id);
    if (navigator.vibrate) { try { navigator.vibrate([10, 40, 10]); } catch (e) { /* ignore */ } }
  }
  function setStat(id, key, delta) {
    const h = G.heroes[id];
    h[key] = clamp(h[key] + delta, 0, 100);
  }

  const MISSIONS = [
    { id: 'praise', label: '비서 칭찬하기', goal: 3, reward: 20, ico: '👏' },
    { id: 'snack', label: '간식 챙겨 주기', goal: 1, reward: 12, ico: '☕' },
    { id: 'order', label: '지령 내리기', goal: 1, reward: 30, ico: '📣' }
  ];
  function missionState() {
    if (G.missions.date !== todayKey()) G.missions = { date: todayKey(), praise: 0, snack: 0, order: 0, done: [] };
    return G.missions;
  }
  function missionTick(id) {
    const m = missionState();
    m[id] += 1;
    const def = MISSIONS.find((x) => x.id === id);
    if (def && m[id] >= def.goal && m.done.indexOf(id) < 0) {
      m.done.push(id);
      addCoins(def.reward, BOSS);
      toast(`✅ 오늘의 미션 완료 — ${def.label} +${def.reward}🪙`);
      logEvent('✅', `미션 완료: ${def.label}`, BOSS);
    }
    saveGame();
  }

  function praise(id) {
    const h = G.heroes[id];
    const a = actors[id];
    if (!h || !a) return;
    const left = 12 - (Date.now() - h.praiseAt) / 1000;
    if (left > 0) { toast(`${charById(id).name}은(는) 방금 칭찬받았어요 · ${Math.ceil(left)}초 뒤에`); return; }
    h.praiseAt = Date.now();
    setStat(id, 'mood', 9);
    addXp(id, 4);
    popup(id, '❤', 'heart');
    a.override = { until: nowS() + 1.8, back: a.pose === 'cheer' ? 'idle' : a.pose };
    setPose(a, 'cheer');
    say(a, pick(SAY[id].happy), { front: true });
    G.total.praise += 1;
    missionTick('praise');
    renderCard();
  }
  const SNACKS = { coffee: { name: '커피', ico: '☕', cost: 15, energy: 28, mood: 3, xp: 2 }, cake: { name: '케이크', ico: '🍰', cost: 40, energy: 45, mood: 10, xp: 8 } };
  function snack(id, kind) {
    const s = SNACKS[kind];
    const a = actors[id];
    if (!s || !a) return;
    if (G.coins < s.cost) { toast(`코인이 부족해요 (${s.cost}🪙 필요)`, 'error'); return; }
    addCoins(-s.cost);
    setStat(id, 'energy', s.energy);
    setStat(id, 'mood', s.mood);
    addXp(id, s.xp);
    popup(id, `${s.ico} 충전!`, 'heart');
    say(a, pick(SAY[id].snack), { front: true });
    G.total.snacks += 1;
    missionTick('snack');
    renderCard();
  }

  /* 지령 — 비서가 일터로 가서 일하고 보상을 받는다. 회의실(DB)에도 전달 */
  const orders = {};
  function giveOrder(id, text, share) {
    const a = actors[id];
    if (!a || !text) return;
    const c = charById(id);
    const prof = PROFILE[id];
    const spot = pick(prof.spots.work || ['deskF']);
    orders[id] = { text, at: Date.now() };
    releaseChat(a);
    a.queue.length = 0;
    goTo(a, 'quest', spot, rand(40, 58));
    say(a, pick(SAY[id].accept), { front: true });
    G.total.orders += 1;
    missionTick('order');
    logEvent('📣', `${c.name}에게 지령: ${text.length > 24 ? `${text.slice(0, 23)}…` : text}`, id);
    if (share && typeof inflight !== 'undefined' && typeof processInflight === 'function') {
      const body = `@${c.name} [지령] ${text}`;
      const tmp = {
        id: `tmp-${Date.now()}-order`, room: typeof chatRoomFor === 'function' ? chatRoomFor(id) : 'boardroom', authorId: BOSS, senderName: charById(BOSS).name,
        quote: '', body, files: [], text: body, at: new Date().toISOString(), status: 'sending'
      };
      inflight.push(tmp);
      processInflight(tmp);
    }
  }
  function finishOrder(a) {
    const o = orders[a.id];
    if (!o) return;
    delete orders[a.id];
    say(a, pick(SAY[a.id].done), { front: true });
    addXp(a.id, 25);
    addCoins(20, a.id);
    setStat(a.id, 'mood', 5);
    setStat(a.id, 'energy', -14);
    confetti(a.id);
    logEvent('📜', `${charById(a.id).name} 지령 완료 +25XP +20🪙`, a.id);
    renderCard();
  }

  /* 에너지·기분 서서히 변화 (5초마다) */
  function tickStats() {
    HERO_IDS.forEach((id) => {
      const a = actors[id];
      const h = G.heroes[id];
      if (!a || !h) return;
      const act = a.act;
      if (['work', 'report', 'build', 'quest', 'meeting'].indexOf(act) >= 0) setStat(id, 'energy', -0.55);
      else if (['rest', 'coffee', 'sleep'].indexOf(act) >= 0) setStat(id, 'energy', 1.3);
      else setStat(id, 'energy', 0.2);
      if (h.energy < 25) setStat(id, 'mood', -0.2);
    });
    saveGame();
  }

  /* =========================================================
     DB 연동 — 접속 · 메시지 → 말풍선 · 작업 → 퀘스트 보상
     ========================================================= */
  let msgBaseline = false;
  function mentionedIds(text) {
    const out = [];
    String(text || '').replace(/@(후후|뮤즈|제미나이|Cue|cue|Vooy|vooy)/g, (m, n) => {
      const id = normSender(n);
      if (id && HERO_IDS.indexOf(id) >= 0 && out.indexOf(id) < 0) out.push(id);
      return m;
    });
    return out;
  }
  function showRealMessage(row, replay) {
    const id = normSender(row.sender);
    const a = id && actors[id];
    if (!a) return;
    let text = typeof previewText === 'function' ? previewText(row.content) : String(row.content || '');
    text = String(text).replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (text.length > 84) text = `${text.slice(0, 83)}…`;
    say(a, text, { real: true, front: true, ttl: clamp(4 + text.length * 0.09, 4.5, 10) });
    logEvent('💬', `${charById(id).name}: ${text.length > 30 ? `${text.slice(0, 29)}…` : text}`, id);
  }
  function syncMessages() {
    const rows = (typeof sb !== 'undefined' && sb.messages) || [];
    if (!rows.length || !Object.keys(actors).length) return;
    const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    if (!msgBaseline) {
      msgBaseline = true;
      const prev = G.lastMsgId || 0;
      /* 앱을 닫아 둔 사이 온 글 → 경험치만, 최근 글 몇 개는 말풍선으로 다시 보여 주기 */
      rows.filter((r) => Number(r.id) > prev && prev > 0).forEach((r) => {
        const id = normSender(r.sender);
        if (id && HERO_IDS.indexOf(id) >= 0) gainMsgXp(id);
      });
      const recent = rows.filter((r) => Date.now() - ts(r.created_at) < 3 * 3600000 && normSender(r.sender)).slice(-3);
      recent.forEach((r, i) => setTimeout(() => showRealMessage(r, true), 2600 + i * 3400));
      G.lastMsgId = maxId;
      saveGame();
      return;
    }
    const fresh = rows.filter((r) => Number(r.id) > (G.lastMsgId || 0));
    if (!fresh.length) return;
    G.lastMsgId = maxId;
    fresh.forEach((r, i) => {
      setTimeout(() => {
        showRealMessage(r, false);
        const id = normSender(r.sender);
        if (id && HERO_IDS.indexOf(id) >= 0) gainMsgXp(id);
        /* 대장이 @멘션하면 그 비서가 달려온다 */
        if (id === BOSS && Date.now() - ts(r.created_at) < 120000) {
          mentionedIds(r.content).forEach((hid) => {
            const h = actors[hid];
            if (h && h.act !== 'quest' && presence(hid).key !== 'offline') {
              releaseChat(h);
              h.queue.length = 0;
              goTo(h, 'summon', 'deskF', 11, { face: 1 });
            }
          });
        }
      }, i * 1200);
    });
    saveGame();
  }
  function gainMsgXp(id) {
    const h = G.heroes[id];
    if (h.msgDay !== todayKey()) { h.msgDay = todayKey(); h.msgXp = 0; }
    if (h.msgXp >= 40) return;
    h.msgXp += 2;
    addXp(id, 2);
  }

  function syncQuests() {
    if (typeof projectRows !== 'function' || !state) return;
    let rows = [];
    try { rows = projectRows(); } catch (e) { return; }
    const firstRun = Object.keys(G.quests).length === 0;
    rows.forEach((p) => {
      const key = String(p.id);
      const bucket = typeof taskBucket === 'function' ? taskBucket(p.status) : 'doing';
      const prog = Number(p.progress) || 0;
      const prev = G.quests[key];
      const ownerId = normSender(p.owner);
      if (prev && !firstRun && ownerId && actors[ownerId]) {
        if (bucket === 'done' && prev.bucket !== 'done') {
          const hid = ownerId === BOSS ? null : ownerId;
          if (hid) { addXp(hid, 60); addCoins(50, hid); confetti(hid); say(actors[hid], pick(SAY[hid].done), { front: true }); }
          else addCoins(50, BOSS);
          logEvent('🏆', `퀘스트 완료: ${p.title}`, ownerId);
          toast(`🏆 퀘스트 완료 — ${p.title}`);
        } else if (prog > prev.progress && ownerId !== BOSS) {
          addXp(ownerId, Math.max(1, Math.round((prog - prev.progress) / 4)));
        }
      }
      G.quests[key] = { bucket, progress: prog };
    });
    saveGame();
  }

  function onData() {
    if (!state) return;
    Object.keys(presCache).forEach((k) => delete presCache[k]);
    if (!built) { built = true; buildWorld(); buildStatic(); if (running) kick(); }
    syncMessages();
    syncQuests();
    refreshDockSoon();
    renderTop();
    if (!dailyShown) { dailyShown = true; setTimeout(maybeDaily, 1800); }
  }
  let built = false;
  let dailyShown = false;

  /* 출석 보상 */
  function maybeDaily() {
    const today = todayKey();
    if (G.daily.claimed === today || !running) return;
    const y = new Date(Date.now() - 86400000);
    const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    const streak = G.daily.date === yk ? G.daily.streak + 1 : 1;
    const reward = 30 + Math.min(streak, 7) * 10;
    openSheet({
      emoji: '🎁', title: '오늘의 출석 보상', sub: `${streak}일 연속 출석`,
      html: `<div class="gift"><div class="gift-ico">🎁</div><p>대장님, 오늘도 타워에 오셨군요!</p>
        <div class="gift-reward"><b>+${reward}</b> 🪙</div>
        <div class="gift-days">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<span class="${d <= Math.min(streak, 7) ? 'is-on' : ''}">${d}</span>`).join('')}</div>
        <button class="primary-btn" type="button" data-claim>받기</button></div>`,
      onClick: (e) => {
        if (!e.target.closest('[data-claim]')) return;
        G.daily = { date: today, streak, claimed: today };
        addCoins(reward, BOSS);
        HERO_IDS.forEach((id) => { setStat(id, 'mood', 4); });
        saveGame();
        closeSheet();
        const a = actors[BOSS];
        if (a) say(a, '좋아, 오늘도 힘차게 가자!', { front: true });
        logEvent('🎁', `출석 보상 +${reward}🪙 (${streak}일 연속)`, BOSS);
      }
    });
  }

  /* =========================================================
     이름표 · 오버레이
     ========================================================= */
  function refreshTag(a) {
    const c = charById(a.id);
    const p = presence(a.id);
    const lv = a.id === BOSS ? bossLevel().lv : heroLv(a.id).lv;
    const act = ACT[a.act === 'walk' ? (a.pend ? a.pend.key : 'think') : a.act] || ACT.think;
    const sel = selectedId === a.id;
    const html = `<i class="pd ${PRES[p.key].cls}"></i><b>${esc(c.name)}</b><span class="lv">Lv.${lv}</span><span class="ai">${a.act === 'walk' ? '🚶' : act.icon}</span>`;
    if (a.tagHtml !== html) { a.tag.innerHTML = html; a.tagHtml = html; a.tagW = 0; }
    a.tag.classList.toggle('is-sel', sel);
    a.tag.classList.toggle('is-off', p.key === 'offline');
    a.el.classList.toggle('is-sel', sel);
    a.el.classList.toggle('is-off', p.key === 'offline');
  }

  function updateOverlay() {
    const ins = hudInsets();
    const insL = ins.left;
    const insR = ins.right;
    const rects = [];
    const tags = [];
    Object.keys(actors).forEach((id) => {
      const a = actors[id];
      const sx = cam.tx + a.pos[0] * cam.z;
      const sy = cam.ty + (a.pos[1] - a.hgt * 0.98 * a.s - 2) * cam.z;
      const vis = sx > -40 && sx < vw + 40 && sy > 20 && sy < vh + 60;
      a.sx = sx;
      a.sy = sy;
      a.ty2 = sy;
      a.vis = vis;
      a.tag.style.display = vis ? '' : 'none';
      if (vis) tags.push(a);
    });
    /* 이름표끼리 겹치면 위로 올린다 (모여 있을 때도 읽히게) */
    tags.sort((p, q) => p.sy - q.sy);
    for (let i = 0; i < tags.length; i += 1) {
      const q = tags[i];
      if (!q.tagW) q.tagW = q.tag.offsetWidth || 90;
      for (let j = 0; j < i; j += 1) {
        const p = tags[j];
        if (Math.abs(p.sx - q.sx) < (p.tagW + q.tagW) / 2 && Math.abs(p.ty2 - q.ty2) < 22) q.ty2 = p.ty2 - 23;
      }
      q.tag.style.transform = `translate3d(${q.sx.toFixed(1)}px,${q.ty2.toFixed(1)}px,0) translate(-50%,-100%)`;
    }
    Object.keys(actors).forEach((id) => {
      const a = actors[id];
      if (a.bub) {
        const b = a.bub;
        if (!a.vis) { b.el.style.display = 'none'; return; }
        b.el.style.display = '';
        if (!b.w) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; }
        const half = b.w / 2 + 8;
        const x = clamp(a.sx, half + insL, vw - half - insR);
        const y = Math.max(a.ty2 - 26, 128 + b.h);
        b.x = x; b.y = y; b.tail = clamp(a.sx - x, -b.w / 2 + 16, b.w / 2 - 16);
        rects.push(b);
      }
    });
    /* 말풍선끼리 겹치면 위로 밀어 올린다 */
    rects.sort((p, q) => p.x - q.x);
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        const p = rects[j];
        const q = rects[i];
        if (Math.abs(p.x - q.x) < (p.w + q.w) / 2 + 4 && Math.abs(p.y - q.y) < (p.h + q.h) / 2 + 2) q.y = p.y - p.h - 6;
      }
    }
    rects.forEach((b) => {
      b.el.style.transform = `translate3d(${b.x.toFixed(1)}px,${b.y.toFixed(1)}px,0) translate(-50%,-100%)`;
      b.el.style.setProperty('--tx', `${b.tail.toFixed(1)}px`);
    });
    /* 구역 라벨 */
    if (E.zl) {
      E.zl.forEach((z) => {
        const sx = cam.tx + z.ax * cam.z;
        const sy = cam.ty + z.ay * cam.z;
        const vis = sx > 20 && sx < vw - 20 && sy > 120 && sy < vh - 90;
        z.el.style.display = vis ? '' : 'none';
        if (vis) z.el.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-50%)`;
      });
    }
  }

  /* =========================================================
     HUD
     ========================================================= */
  function renderTop() {
    if (!E.top || !state) return;
    const bl = bossLevel();
    const pct = Math.round((bl.into / bl.need) * 100);
    const h = new Date().getHours();
    const sun = h >= 7 && h < 17 ? '☀️' : h >= 17 && h < 20 ? '🌇' : h >= 5 && h < 7 ? '🌅' : '🌙';
    const syncOk = typeof sb !== 'undefined' && sb.ok;
    const html = `
      <button class="g-boss" type="button" data-boss aria-label="대장 정보">
        <span class="g-boss-av">${charArt(BOSS) || '👑'}</span>
        <span class="g-boss-txt"><b>대장 Lv.${bl.lv}</b><span class="g-xp"><i style="width:${pct}%"></i></span></span>
      </button>
      <span class="g-coins" title="코인">🪙 <b>${G.coins}</b></span>
      <span class="g-clock">${sun} ${esc(fmtTime(new Date().toISOString()).replace(/^오[전후] /, ''))}</span>
      <button class="g-sync ${syncOk ? 'is-live' : 'is-off'}" type="button" data-sync aria-label="새로고침"><i></i>${syncOk ? 'LIVE' : '오프라인'}</button>
      <button class="g-menu" type="button" data-menu aria-label="메뉴">☰</button>`;
    if (E.topHtml !== html) { E.top.innerHTML = html; E.topHtml = html; }
  }

  function zoneMembers(zoneId) {
    return Object.keys(actors).filter((id) => id !== BOSS || zoneId === 'hall').filter((id) => zoneAt(actors[id].pos).id === zoneId);
  }
  function teamList() { return (state && state.teams) || []; }

  function renderZonebar() {
    if (!E.zonebar || !state) return;
    const chips = [`<button class="gz-chip g-cam ${director ? 'is-on' : ''}" type="button" data-director aria-pressed="${director}">🎥<span>자동</span></button>`];
    ZONES.filter((z) => z.id !== 'hall').forEach((z) => {
      const n = zoneMembers(z.id).length;
      chips.push(`<button class="gz-chip" type="button" data-zone-chip="${z.id}">${z.emoji} <span>${z.name}</span><em class="${n ? 'has' : ''}">${n}</em></button>`);
    });
    teamList().forEach((t) => {
      const on = (t.members || []).filter((id) => presence(id).key === 'online').length;
      chips.push(`<button class="gz-chip is-team" type="button" data-team-chip="${t.id}">${t.emoji} <span>${t.name}</span><em class="${on ? 'has' : ''}">${on}/${(t.members || []).length}</em></button>`);
    });
    const html = chips.join('');
    if (E.zoneHtml !== html) { E.zonebar.innerHTML = html; E.zoneHtml = html; }
  }

  function renderDock() {
    if (!E.dock || !state) return;
    const html = HERO_IDS.map((id) => {
      const p = presence(id);
      const lv = heroLv(id).lv;
      const a = actors[id];
      const act = a ? (ACT[a.act] || ACT.think) : ACT.think;
      return `<button class="gd-hero ${PRES[p.key].cls} ${selectedId === id ? 'is-sel' : ''}" type="button" data-pick="${id}" aria-label="${esc(charById(id).name)}">
        <span class="gd-av">${charArt(id) || ''}</span><i class="gd-dot"></i><span class="gd-lv">${lv}</span><span class="gd-act">${a && a.act === 'walk' ? '🚶' : act.icon}</span></button>`;
    }).join('');
    if (E.dockHtml !== html) { E.dock.innerHTML = html; E.dockHtml = html; }
  }
  let dockTimer = 0;
  function refreshDockSoon() {
    if (dockTimer) return;
    dockTimer = setTimeout(() => {
      dockTimer = 0;
      renderDock();
      renderZonebar();
      Object.keys(actors).forEach((id) => refreshTag(actors[id]));
    }, 250);
  }

  /* ---------------- 카드 (비서 · 방) ---------------- */
  function locName(id) {
    const a = actors[id];
    if (!a) return '—';
    const z = zoneAt(a.pos);
    return `${z.emoji} ${z.name}`;
  }
  function bar(cls, pct) { return `<span class="gb ${cls}"><i style="width:${clamp(pct, 0, 100)}%"></i></span>`; }
  function hearts(mood) {
    const n = Math.round(mood / 20);
    return Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? 'on' : ''}">♥</span>`).join('');
  }

  function heroCardHtml(id) {
    const c = charById(id);
    const prof = PROFILE[id];
    const a = actors[id];
    const p = presence(id);
    if (id === BOSS) {
      const bl = bossLevel();
      const m = missionState();
      return `<div class="gc-head"><span class="gc-av">${charArt(id)}</span>
        <div class="gc-id"><h3>${esc(c.name)} <em>Lv.${bl.lv} 지휘관</em></h3><p>어벤져스타워 총사령관 · 연속 출석 ${G.daily.streak || 0}일</p></div>
        <button class="gc-x" type="button" data-card-close aria-label="닫기">✕</button></div>
        <div class="gc-bars"><div class="gc-row"><label>지휘 경험</label>${bar('xp', (bl.into / bl.need) * 100)}<span>${bl.into}/${bl.need}</span></div>
        <div class="gc-row"><label>코인</label><b class="gc-coin">🪙 ${G.coins}</b><span>미션 ${m.done.length}/${MISSIONS.length}</span></div></div>
        <div class="gc-btns"><button type="button" data-act="meeting">🗣️ 전원 회의 소집</button><button type="button" data-act="quests">📋 퀘스트</button><button type="button" data-act="order">📣 지령</button></div>`;
    }
    const g = G.heroes[id];
    const L = levelOf(g.xp);
    const team = teamOf(id);
    const isLeader = team && team.leader === id;
    const cur = a ? (a.act === 'walk' && a.pend ? `🚶 ${ACT[a.pend.key].label}(으)로 이동 중` : `${ACT[a.act].icon} ${ACT[a.act].label}`) : '—';
    const left = Math.max(0, 12 - (Date.now() - g.praiseAt) / 1000);
    const o = orders[id];
    const statRow = (k, n) => {
      const v = prof.stats[k] + Math.floor(L.lv * 1.2);
      return `<span class="gs"><small>${n}</small><b>${v}</b></span>`;
    };
    return `<div class="gc-head"><span class="gc-av">${charArt(id)}</span>
      <div class="gc-id"><h3>${esc(c.name)} <em>Lv.${L.lv} ${rankName(L.lv)}</em></h3><p>${esc(prof.title)} · ${esc(prof.hero)}${team ? ` · ${team.emoji} ${esc(team.name)}${isLeader ? ' 팀장' : ''}` : ''}</p></div>
      <button class="gc-x" type="button" data-card-close aria-label="닫기">✕</button></div>
      <div class="gc-pres ${PRES[p.key].cls}"><i></i>${esc(presText(id))}</div>
      <div class="gc-now"><span class="k">지금</span><div><b>${cur}</b>${o ? `<p>📜 지령: ${esc(o.text)}</p>` : (taskOf(id) ? `<p>「${esc(taskOf(id))}」</p>` : '')}<p class="loc">📍 ${esc(locName(id))}</p></div></div>
      <div class="gc-bars">
        <div class="gc-row"><label>경험치</label>${bar('xp', (L.into / L.need) * 100)}<span>${L.into}/${L.need}</span></div>
        <div class="gc-row"><label>애정도</label><span class="gc-hearts">${hearts(g.mood)}</span><span>${Math.round(g.mood)}</span></div>
        <div class="gc-row"><label>체력</label>${bar(g.energy < 30 ? 'low' : 'en', g.energy)}<span>${Math.round(g.energy)}</span></div>
      </div>
      <div class="gc-stats">${statRow('focus', '집중')}${statRow('idea', '창의')}${statRow('speed', '속도')}${statRow('stamina', '체력')}</div>
      <div class="gc-btns">
        <button type="button" data-act="praise" ${left > 0 ? 'disabled' : ''}>👏 칭찬${left > 0 ? ` ${Math.ceil(left)}s` : ''}</button>
        <button type="button" data-act="coffee">☕ 커피 <small>15🪙</small></button>
        <button type="button" data-act="cake">🍰 케이크 <small>40🪙</small></button>
        <button type="button" data-act="order">📣 지령</button>
      </div>`;
  }

  function roomCardHtml(kind, rid) {
    let title; let sub; let ids; let foot = '';
    if (kind === 'team') {
      const t = teamList().find((x) => x.id === rid);
      if (!t) return '';
      title = `${t.emoji} ${t.name}방`;
      ids = (t.members || []).slice().sort((x, y) => (x === t.leader ? -1 : y === t.leader ? 1 : 0));
      const on = ids.filter((id) => presence(id).key === 'online').length;
      sub = `팀장 ${charById(t.leader).name} · 접속 ${on}/${ids.length}`;
    } else {
      const z = ZONES.find((x) => x.id === rid);
      if (!z) return '';
      title = `${z.emoji} ${z.name}`;
      ids = zoneMembers(rid);
      sub = ids.length ? `지금 ${ids.length}명이 있어요` : '지금은 비어 있어요';
      if (z.view) foot = `<div class="gc-btns one"><button type="button" data-zone-open="${z.id}">${z.emoji} ${z.name} 현황판 열기</button></div>`;
    }
    const rows = ids.length ? ids.map((id) => {
      const p = presence(id);
      const a = actors[id];
      const t = teamOf(id);
      return `<button class="gr-row ${PRES[p.key].cls}" type="button" data-pick="${id}">
        <span class="gr-av">${charArt(id)}<i></i></span>
        <span class="gr-main"><b>${esc(charById(id).name)}${t && t.leader === id ? '<em>팀장</em>' : ''}</b><span>${a ? `${a.act === 'walk' ? '🚶 이동 중' : `${ACT[a.act].icon} ${ACT[a.act].label}`}` : ''} · ${esc(locName(id))}</span></span>
        <span class="gr-pres">${PRES[p.key].dot} ${PRES[p.key].label}</span></button>`;
    }).join('') : '<p class="gr-empty">아무도 없어요. 비서들이 일하러 나갔나 봐요.</p>';
    return `<div class="gc-head"><div class="gc-id"><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>
      <button class="gc-x" type="button" data-card-close aria-label="닫기">✕</button></div><div class="gr-list">${rows}</div>${foot}`;
  }

  let cardHtml = '';
  let cardCtx = null;
  function renderCard() {
    if (!E.card) return;
    if (!cardCtx) { E.card.hidden = true; return; }
    const html = cardCtx.kind === 'hero' ? heroCardHtml(cardCtx.id) : roomCardHtml(cardCtx.kind, cardCtx.id);
    if (html !== cardHtml) { E.card.innerHTML = html; cardHtml = html; }
    E.card.hidden = false;
  }
  function selectHero(id, focus) {
    if (!actors[id]) return;
    selectedId = id;
    cardCtx = { kind: 'hero', id };
    cardMode = 'hero';
    document.body.classList.add('g-card-open');
    cardHtml = '';
    renderCard();
    Object.keys(actors).forEach((k) => refreshTag(actors[k]));
    renderDock();
    if (focus) { cam.follow = id; cam.manualAt = nowS(); }
    const a = actors[id];
    if (a && a.id !== BOSS && !a.bub && Math.random() < 0.7 && a.act !== 'sleep') say(a, pick(SAY[id].greet));
    if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) { /* ignore */ } }
  }
  function openRoom(kind, rid) {
    selectedId = null;
    cardCtx = { kind, id: rid };
    cardMode = 'room';
    document.body.classList.add('g-card-open');
    cardHtml = '';
    renderCard();
    Object.keys(actors).forEach((k) => refreshTag(actors[k]));
    renderDock();
    let pts;
    if (kind === 'team') {
      const t = teamList().find((x) => x.id === rid);
      pts = ((t && t.members) || []).map((id) => actors[id] && actors[id].pos).filter(Boolean);
    } else {
      const z = ZONES.find((x) => x.id === rid);
      pts = z ? [z.c] : [];
    }
    if (pts.length) {
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      cam.follow = null;
      focusOn(cx, cy, { z: Math.max(cam.z, cam.zmin * 1.25) });
      cam.manualAt = nowS();
    }
  }
  function closeCard() {
    cardCtx = null;
    cardMode = null;
    selectedId = null;
    cam.follow = null;
    document.body.classList.remove('g-card-open');
    if (E.card) E.card.hidden = true;
    cardHtml = '';
    Object.keys(actors).forEach((k) => refreshTag(actors[k]));
    renderDock();
  }

  /* =========================================================
     시트 — 퀘스트 · 지령 · 팀방 현황 · 일지 · 서류함 · 도움말
     ========================================================= */
  function questSheet() {
    const m = missionState();
    let rows = [];
    try { rows = projectRows(); } catch (e) { rows = []; }
    const order = { doing: 0, wait: 1, done: 2 };
    rows.sort((a, b) => order[taskBucket(a.status)] - order[taskBucket(b.status)]);
    const missionHtml = MISSIONS.map((d) => {
      const n = Math.min(m[d.id], d.goal);
      const done = m.done.indexOf(d.id) >= 0;
      return `<li class="${done ? 'is-done' : ''}"><span class="mi-ico">${d.ico}</span><span class="mi-main"><b>${d.label}</b><span class="gb st"><i style="width:${(n / d.goal) * 100}%"></i></span></span><span class="mi-n">${n}/${d.goal}</span><span class="mi-r">${done ? '완료' : `+${d.reward}🪙`}</span></li>`;
    }).join('');
    const questHtml = rows.map((p) => {
      const b = taskBucket(p.status);
      const oid = normSender(p.owner);
      const pct = Math.max(0, Math.min(100, Number(p.progress) || 0));
      return `<button class="qr is-${b}" type="button" data-quest="${esc(p.id)}">
        <span class="qr-ico">${esc(p.emoji || '📌')}</span>
        <span class="qr-main"><b>${esc(p.title)}</b>
          <span class="qr-meta">${oid ? esc(charById(oid).name) : esc(p.owner || '미정')} · ${esc(p.status || '')}</span>
          <span class="gb st"><i style="width:${pct}%"></i></span></span>
        <span class="qr-r">${b === 'done' ? '✔' : `${pct}%`}</span></button>`;
    }).join('') || '<p class="gr-empty">진행 중인 퀘스트가 없어요.</p>';
    openSheet({
      emoji: '📋', title: '퀘스트 보드', sub: '완료하면 담당 비서가 +60 XP · +50🪙',
      html: `<h4 class="sh-h">오늘의 미션</h4><ul class="mission-list">${missionHtml}</ul>
        <h4 class="sh-h">진행 중인 작업 <button class="text-btn" type="button" data-quest-new>＋ 새 퀘스트</button></h4>
        <div class="quest-list">${questHtml}</div>`,
      onClick: (e) => {
        if (e.target.closest('[data-quest-new]')) { openTaskSheet(null); return; }
        const q = e.target.closest('[data-quest]');
        if (q) openTaskSheet(q.dataset.quest);
      }
    });
  }

  function orderSheet(presetId) {
    let target = presetId && presetId !== BOSS ? presetId : (selectedId && selectedId !== BOSS ? selectedId : HERO_IDS[0]);
    const chips = () => HERO_IDS.map((id) => {
      const p = presence(id);
      return `<button type="button" class="oc ${id === target ? 'is-active' : ''} ${PRES[p.key].cls}" data-order-to="${id}"><span class="oc-av">${charArt(id)}</span><b>${esc(charById(id).name)}</b><i></i></button>`;
    }).join('');
    openSheet({
      emoji: '📣', title: '지령 내리기', sub: '비서가 일터로 걸어가 수행하고, 완료하면 보상을 받아요',
      html: `<form class="sheet-form" id="g-order-form">
        <div class="order-chips" id="g-order-chips">${chips()}</div>
        <label class="field"><span>지령 내용</span><textarea name="text" rows="3" maxlength="160" required placeholder="예: 아빠와딸 Day 3 원고 초안 정리해줘"></textarea></label>
        <div class="quick-row">${['오늘 할 일 정리', '키워드 점검', '원고 초안 작성', '지표 보고'].map((q) => `<button type="button" class="quick" data-quick="${q}">${q}</button>`).join('')}</div>
        <label class="check-row"><input type="checkbox" name="share" checked /> <span>회의실(DB)에도 전달 — 외부 에이전트가 같은 지령을 봐요</span></label>
        <div class="sheet-actions"><button class="ghost-btn" type="button" data-meeting>🗣️ 전원 회의 소집</button><button class="primary-btn" type="submit">지령 내리기</button></div></form>`,
      onClick: (e) => {
        const to = e.target.closest('[data-order-to]');
        if (to) { target = to.dataset.orderTo; $('g-order-chips').innerHTML = chips(); return; }
        const q = e.target.closest('[data-quick]');
        if (q) { const t = E.sheetBody().querySelector('textarea'); t.value = `${t.value ? `${t.value} ` : ''}${q.dataset.quick}`; t.focus(); return; }
        if (e.target.closest('[data-meeting]')) { closeSheet(); callMeeting(); }
      },
      onSubmit: (e) => {
        const f = e.target;
        const text = f.text.value.trim();
        if (!text) return;
        closeSheet();
        giveOrder(target, text, f.share.checked);
        selectHero(target, true);
      }
    });
  }
  E.sheetBody = () => document.getElementById('sheet-body');

  function callMeeting() {
    if (!startMeeting(nowS(), BOSS)) toast('모일 수 있는 비서가 부족해요 (접속 중인 비서 2명 이상 필요)', 'error');
    else {
      toast('🗣️ 전원 회의 소집!');
      closeCard();
      cam.follow = null;
      focusOn(240, 600, { z: Math.max(cam.z, cam.zmin * 1.2) });
      cam.manualAt = nowS();
    }
  }

  function teamsSheet() {
    const rowsHtml = (ids) => ids.map((id) => {
      const p = presence(id);
      const a = actors[id];
      return `<button class="gr-row ${PRES[p.key].cls}" type="button" data-pick="${id}">
        <span class="gr-av">${charArt(id)}<i></i></span>
        <span class="gr-main"><b>${esc(charById(id).name)}</b><span>${a ? `${a.act === 'walk' ? '🚶 이동 중' : `${ACT[a.act].icon} ${ACT[a.act].label}`}` : ''} · ${esc(locName(id))}</span></span>
        <span class="gr-pres">${PRES[p.key].dot} ${PRES[p.key].label}</span></button>`;
    }).join('');
    const teamsHtml = teamList().map((t) => {
      const ids = (t.members || []).slice().sort((x, y) => (x === t.leader ? -1 : y === t.leader ? 1 : 0));
      const on = ids.filter((id) => presence(id).key === 'online').length;
      return `<section class="tm-sec"><h4>${t.emoji} ${esc(t.name)}방 <span>팀장 ${esc(charById(t.leader).name)} · 접속 ${on}/${ids.length}</span></h4><div class="gr-list">${rowsHtml(ids)}</div></section>`;
    }).join('');
    const rest = HERO_IDS.filter((id) => !teamOf(id));
    const zonesHtml = ZONES.filter((z) => z.id !== 'hall').map((z) => {
      const ids = zoneMembers(z.id);
      return `<li><b>${z.emoji} ${z.name}</b><span>${ids.length ? ids.map((id) => esc(charById(id).name)).join(' · ') : '비어 있음'}</span></li>`;
    }).join('');
    openSheet({
      emoji: '👥', title: '팀방 · 접속 현황', sub: '🟢 접속 중(30분 내 활동) · 🟡 자리 비움 · ⚪ 오프라인',
      html: `${teamsHtml}${rest.length ? `<section class="tm-sec"><h4>✨ 자문 · 지원 <span>회의실 상주</span></h4><div class="gr-list">${rowsHtml(rest)}</div></section>` : ''}
        <section class="tm-sec"><h4>📍 지금 방별 위치</h4><ul class="zone-who">${zonesHtml}</ul></section>
        <p class="sh-note">접속 여부는 비서가 Supabase 에 남긴 마지막 흔적(office_agents · office_messages)으로 계산해요.</p>`,
      onClick: (e) => {
        const r = e.target.closest('[data-pick]');
        if (r) { closeSheet(); selectHero(r.dataset.pick, true); }
      }
    });
  }

  function logSheet() {
    openSheet({
      emoji: '📜', title: '업무 일지', sub: '오늘 타워에서 있었던 일',
      html: LOG.length ? `<ul class="log-list">${LOG.map((l) => `<li>${l.id && charArt(l.id) ? `<span class="lg-av">${charArt(l.id)}</span>` : `<span class="lg-ico">${l.icon}</span>`}<span class="lg-main"><b>${l.icon} ${esc(l.text)}</b><time>${esc(fmtTime(new Date(l.t).toISOString()))}</time></span></li>`).join('')}</ul>` : '<p class="gr-empty">아직 기록이 없어요.</p>'
    });
  }

  function menuSheet() {
    const items = [
      { id: 'chat', ico: '💬', t: '회의실 메신저', d: '사진·파일 첨부, 답장, 방별 대화' },
      { id: 'work', ico: '📋', t: '작업실', d: '작업 카드 상태·진행률 수정' },
      { id: 'status', ico: '👥', t: '비서현황', d: '연동 상태 · 스케줄 타임라인' },
      { id: 'memo', ico: '🗒️', t: '메모', d: '핀 고정 · 검색 · 수정' }
    ];
    openSheet({
      emoji: '🗂️', title: '서류함', sub: '게임 밖의 업무 도구',
      html: `<div class="action-list">${items.map((i) => `<button class="action-item" type="button" data-exit="${i.id}"><span class="ai-ico">${i.ico}</span><span class="mn-main"><b>${i.t}</b><small>${i.d}</small></span></button>`).join('')}</div>
        <div class="action-list mn-gap"><button class="action-item" type="button" data-help><span class="ai-ico">❓</span><span class="mn-main"><b>게임 방법</b><small>조작 · 육성 · 접속 표시</small></span></button>
        <button class="action-item" type="button" data-refresh><span class="ai-ico">🔄</span><span class="mn-main"><b>DB 새로고침</b><small>실시간 데이터 다시 불러오기</small></span></button></div>`,
      onClick: (e) => {
        const x = e.target.closest('[data-exit]');
        if (x) { exitGame(x.dataset.exit); return; }
        if (e.target.closest('[data-help]')) { helpSheet(); return; }
        if (e.target.closest('[data-refresh]')) { closeSheet(); if (typeof loadState === 'function') loadState({ manual: true }); }
      }
    });
  }

  function helpSheet() {
    openSheet({
      emoji: '❓', title: '게임 방법', sub: '어벤져스타워 육성 시뮬레이션',
      html: `<ul class="help-list">
        <li><b>👆 조작</b> 화면을 끌면 이동, 두 손가락(휠)으로 확대·축소. 🎥 자동이 켜져 있으면 말하는 비서를 따라가요.</li>
        <li><b>🧑‍💼 비서 육성</b> 비서를 누르면 정보 카드. 👏 칭찬(무료) · ☕ 🍰 간식(코인)으로 애정도·체력을 올려요.</li>
        <li><b>📣 지령</b> 지령을 내리면 비서가 일터로 걸어가 일하고 +25 XP · +20🪙을 가져와요. 회의실(DB)에도 전달돼 실제 에이전트가 볼 수 있어요.</li>
        <li><b>🟢 접속 표시</b> 비서가 Supabase 에 마지막으로 흔적을 남긴 시각으로 계산해요. 30분 이내면 접속 중, 6시간 이내면 자리 비움, 그 이상이면 오프라인(소파에서 잠자요).</li>
        <li><b>💬 말풍선</b> 비서가 실제로 회의실에 남긴 글은 <em>LIVE</em> 말풍선으로 머리 위에 떠요. 일반 말풍선은 NPC 혼잣말이에요.</li>
        <li><b>🏆 퀘스트</b> 작업실의 작업이 진행되면 담당 비서가 경험치를 얻고, 완료하면 보너스 보상을 받아요.</li>
        <li><b>💾 저장</b> 레벨·코인 같은 육성 수치는 이 기기에만 저장돼요.</li></ul>`
    });
  }

  /* =========================================================
     메인 루프
     ========================================================= */
  function tintFor(h) {
    if (h >= 22 || h < 5) return 'rgba(8,20,64,.42)';
    if (h < 7) return 'rgba(255,150,100,.14)';
    if (h < 17) return 'rgba(255,255,255,0)';
    if (h < 19) return 'rgba(255,140,60,.16)';
    return 'rgba(20,30,90,.28)';
  }
  const tm = { sec: 0, five: 0, twenty: 0, dir: 0, followUntil: 0 };
  function loop(t) {
    if (!running) return;
    const now = t / 1000;
    const dt = Math.min(0.1, Math.max(0.001, now - lastT));
    lastT = now;

    if (cam.follow && actors[cam.follow]) {
      const a = actors[cam.follow];
      focusOn(a.pos[0], a.pos[1] - 60);
    }
    if (cam.ttx != null) {
      const k = 1 - Math.exp(-dt * (cam.follow ? 4.5 : 6));
      cam.tx += (cam.ttx - cam.tx) * k;
      cam.ty += (cam.tty - cam.ty) * k;
      if (cam.tz && Math.abs(cam.tz - cam.z) > 0.0005) cam.z += (cam.tz - cam.z) * k;
      clampCam();
      applyCam();
    }

    if (built) {
      Object.keys(actors).forEach((id) => {
        const a = actors[id];
        stepActor(a, dt, now);
        updateBubble(a, now);
      });
      updateOverlay();

      if (now > nextMeetingAt && nextMeetingAt > 0) startMeeting(now);
      if (director && !cardMode && now - cam.manualAt > 16 && now > tm.dir) {
        tm.dir = now + rand(8, 12);
        const ids = Object.keys(actors);
        let best = null;
        let bs = -1;
        ids.forEach((id) => {
          const a = actors[id];
          const s = (a.bub ? (a.bub.real ? 6 : 3) : 0) + (a.act === 'walk' ? 2 : 0) + (a.act === 'meeting' ? 1.5 : 0) + Math.random() * 2.5;
          if (s > bs) { bs = s; best = id; }
        });
        if (best) { cam.follow = best; tm.followUntil = now + rand(6, 9); }
      }
      if (cam.follow && !cardMode && tm.followUntil && now > tm.followUntil) { cam.follow = null; tm.followUntil = 0; }

      if (now > tm.sec) {
        tm.sec = now + 1;
        renderTop();
        if (cardCtx) renderCard();
        Object.keys(actors).forEach((id) => refreshTag(actors[id]));
        renderZonebar();
        renderDock();
        renderZoneLabels();
      }
      if (now > tm.five) { tm.five = now + 5; tickStats(); }
      if (now > tm.twenty) { tm.twenty = now + 20; updateTint(); }
    }
    requestAnimationFrame(loop);
  }

  function renderZoneLabels() {
    if (!E.zl) return;
    E.zl.forEach((z) => {
      const n = zoneMembers(z.id).length;
      const html = `${z.emoji} ${z.name}${n ? `<em>${n}</em>` : ''}`;
      if (z.html !== html) { z.el.innerHTML = html; z.html = html; }
    });
  }
  function updateTint() {
    if (E.tint) E.tint.style.background = tintFor(new Date().getHours());
  }

  function start() {
    if (running) return;
    running = true;
    lastT = nowS();
    measure();
    if (!nextMeetingAt) nextMeetingAt = nowS() + 40;
    requestAnimationFrame(loop);
  }
  function kick() { /* 월드가 막 만들어졌을 때 */ const ld = $('g-loading'); if (ld) { ld.classList.add('is-gone'); setTimeout(() => { ld.hidden = true; }, 450); } measure(); updateTint(); renderTop(); renderDock(); renderZonebar(); renderZoneLabels(); renderTicker(); }
  function stop() { running = false; }

  function enterGame() {
    document.body.classList.add('in-game');
    start();
    if (built) kick();
    try { history.replaceState(null, '', '#game'); } catch (e) { /* ignore */ }
  }
  function exitGame(tab) {
    closeSheet();
    closeCard();
    document.body.classList.remove('in-game');
    stop();
    if (typeof setTab === 'function') setTab(tab || 'chat');
  }
  window.TowerGame = {
    enter: enterGame,
    exit: exitGame,
    peek: () => Object.keys(actors).map((id) => ({ id, act: actors[id].act, at: actors[id].at, pose: actors[id].pose, x: Math.round(actors[id].pos[0]), y: Math.round(actors[id].pos[1]), pres: presence(id).key, bub: actors[id].bub ? actors[id].bub.text : '' })),
    cam: () => ({ z: cam.z, tx: cam.tx, ty: cam.ty, zmin: cam.zmin }),
    zoomTo: (id, z) => { const a = actors[id]; if (a) { cam.follow = null; focusOn(a.pos[0], a.pos[1] - 60, { z, instant: true }); } }
  };

  /* =========================================================
     정적 UI · 이벤트 · 부팅
     ========================================================= */
  const ZL_ANCHOR = { boardroom: [250, 452], performance: [1235, 322], workshop: [545, 706], lounge: [1130, 632] };
  function buildStatic() {
    if (E.zl) return;
    E.zl = ZONES.filter((z) => z.id !== 'hall').map((z) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'g-zl g-ui';
      el.dataset.zoneChip = z.id;
      E.overlay.appendChild(el);
      return { id: z.id, emoji: z.emoji, name: z.name, el, ax: ZL_ANCHOR[z.id][0], ay: ZL_ANCHOR[z.id][1], html: '' };
    });
  }

  function onGameClick(e) {
    const t = e.target;
    const pickBtn = t.closest('[data-pick]');
    if (pickBtn) { selectHero(pickBtn.dataset.pick, true); return; }
    if (t.closest('[data-card-close]')) { closeCard(); return; }
    const tg = t.closest('[data-tag], .g-tag');
    if (tg && tg.dataset.hero) { selectHero(tg.dataset.hero, true); return; }
    if (t.closest('[data-director]')) {
      director = !director;
      cam.follow = director ? cam.follow : null;
      renderZonebar();
      toast(director ? '🎥 자동 카메라 켜짐' : '🎥 자동 카메라 꺼짐');
      return;
    }
    const zc = t.closest('[data-zone-chip]');
    if (zc) { openRoom('zone', zc.dataset.zoneChip); return; }
    const tc = t.closest('[data-team-chip]');
    if (tc) { openRoom('team', tc.dataset.teamChip); return; }
    const zo = t.closest('[data-zone-open]');
    if (zo) { if (typeof openZoneSheet === 'function') openZoneSheet(zo.dataset.zoneOpen); return; }
    if (t.closest('[data-boss]')) { selectHero(BOSS, true); return; }
    if (t.closest('[data-menu]')) { menuSheet(); return; }
    if (t.closest('[data-sync]')) { if (typeof loadState === 'function') loadState({ manual: true }); return; }
    const act = t.closest('[data-act]');
    if (act) {
      const id = cardCtx && cardCtx.kind === 'hero' ? cardCtx.id : null;
      const k = act.dataset.act;
      if (k === 'praise' && id) praise(id);
      else if (k === 'coffee' && id) snack(id, 'coffee');
      else if (k === 'cake' && id) snack(id, 'cake');
      else if (k === 'order') orderSheet(id);
      else if (k === 'meeting') callMeeting();
      else if (k === 'quests') questSheet();
      return;
    }
    const nav = t.closest('[data-g]');
    if (nav) {
      const k = nav.dataset.g;
      if (k === 'quests') questSheet();
      else if (k === 'order') orderSheet(null);
      else if (k === 'teams') teamsSheet();
      else if (k === 'log') logSheet();
      else if (k === 'desk') menuSheet();
    }
  }

  function boot() {
    E.game = $('game');
    if (!E.game) return;
    E.viewport = $('g-viewport'); E.world = $('g-world'); E.actors = $('g-actors'); E.overlay = $('g-overlay'); E.tint = $('g-tint');
    E.top = $('g-top'); E.zonebar = $('g-zonebar'); E.ticker = $('g-ticker'); E.dock = $('g-dock'); E.card = $('g-card');
    E.viewport.addEventListener('pointerdown', onPointerDown);
    E.viewport.addEventListener('pointermove', onPointerMove);
    E.viewport.addEventListener('pointerup', onPointerUp);
    E.viewport.addEventListener('pointercancel', onPointerUp);
    E.viewport.addEventListener('wheel', onWheel, { passive: false });
    E.game.addEventListener('click', onGameClick);
    window.addEventListener('resize', () => { if (running) measure(); });
    window.addEventListener('orientationchange', () => setTimeout(() => { if (running) measure(); }, 300));
    document.addEventListener('tower:data', onData);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && running) { lastT = nowS(); }
    });
    if (document.body.classList.contains('in-game')) start();
    if (typeof state !== 'undefined' && state) onData();
    renderTicker();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
