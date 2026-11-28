/* =========================================================
   어벤져스타워 — heroes.js
   캐릭터 그림 = 대장님이 준비한 이미지(assets/heroes/*.png)
   · sprite(id) : 게임 월드용 전신 (CSS 로 걷기·일하기·앉기·잠자기·환호 연출)
   · bust(id)   : 아바타·카드용 얼굴 (assets/heroes/<id>-face.png)
   이미지는 한 장의 라인업에서 잘라 같은 비율을 유지한다 → 키 차이가 그대로 보인다.
   ========================================================= */
(function () {
  'use strict';

  /* 원본 라인업에서 잘라낸 픽셀 크기 (같은 축척) */
  const META = {
    huhu: { w: 247, h: 465 },
    muse: { w: 211, h: 467 },
    cue: { w: 295, h: 474 },
    gemini: { w: 260, h: 485 },
    vooy: { w: 257, h: 483 },
    seunghu: { w: 260, h: 500 }
  };
  const VER = '20261128-game3';
  const SPRITE_MAX_H = 150;               /* 가장 큰 캐릭터(왕관 포함)의 월드 높이(px) */
  const K = SPRITE_MAX_H / 500;

  const src = (id) => `assets/heroes/${id}.png?v=${VER}`;
  const face = (id) => `assets/heroes/${id}-face.png?v=${VER}`;

  function size(id) {
    const m = META[id];
    if (!m) return { w: 90, h: 140 };
    return { w: Math.round(m.w * K), h: Math.round(m.h * K) };
  }

  /* 미리 받아 두면 첫 화면에서 깜빡이지 않는다 */
  Object.keys(META).forEach((id) => {
    const a = new Image(); a.src = src(id);
    const b = new Image(); b.src = face(id);
  });

  window.HeroArt = {
    ids: Object.keys(META),
    has: (id) => !!META[id],
    size,
    sprite(id) {
      if (!META[id]) return null;
      const s = size(id);
      return `<div class="hero-art is-sprite" data-hero="${id}" style="width:${s.w}px;height:${s.h}px">
        <span class="h-shadow" aria-hidden="true"></span>
        <span class="h-body"><img class="h-img" src="${src(id)}" alt="" draggable="false" decoding="async" /></span>
        <span class="h-holo" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>`;
    },
    bust(id) {
      if (!META[id]) return null;
      return `<img class="hero-art is-bust" src="${face(id)}" alt="" draggable="false" decoding="async" />`;
    }
  };
})();
