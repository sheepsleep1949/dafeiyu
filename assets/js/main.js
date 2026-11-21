import { createScene } from './scene.js';
import { WORKS, SITE } from './works-data.js';

/* ------------------------------------------------------------------ *
 * 站点信息：联系方式 + 备案号
 * 都从 works-data.js 的 SITE 里读，留空就不渲染，不占位、不留空链接。
 * ------------------------------------------------------------------ */

function renderSiteInfo() {
  const contact = document.getElementById('about-contact');
  if (contact && (SITE.email || SITE.github)) {
    const links = [];
    if (SITE.email) {
      links.push(`<a href="mailto:${SITE.email}">${SITE.email}</a>`);
    }
    if (SITE.github) {
      links.push(`<a href="${SITE.github}" target="_blank" rel="noopener noreferrer">GitHub</a>`);
    }
    contact.innerHTML = links.join('<span aria-hidden="true">·</span>');
    contact.hidden = false;
  }

  const legal = document.getElementById('footer-legal');
  if (!legal) return;
  const items = [];
  // 备案要求在首页底部展示备案号，并能跳到工信部系统核验
  if (SITE.icp) {
    items.push(
      `<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">${SITE.icp}</a>`,
    );
  }
  // 公安联网备案号：形如「京公网安备 11011502039387号」，数字部分拼进查询链接
  if (SITE.police) {
    const code = (SITE.police.match(/\d{10,}/) || [''])[0];
    const href = code
      ? `https://beian.mps.gov.cn/#/query/webSearch?code=${code}`
      : 'https://beian.mps.gov.cn/';
    items.push(`<a href="${href}" target="_blank" rel="noopener noreferrer">${SITE.police}</a>`);
  }
  if (items.length) {
    legal.innerHTML = items.join('<span aria-hidden="true">·</span>');
    legal.hidden = false;
  }
}

renderSiteInfo();

/* ------------------------------------------------------------------ *
 * 作品列表
 * ------------------------------------------------------------------ */

const grid = document.getElementById('works-grid');
const empty = document.getElementById('grid-empty');
const countEl = document.getElementById('work-count');
const filters = Array.from(document.querySelectorAll('.filter'));

countEl.textContent = String(WORKS.length);

function cardTemplate(work, index) {
  const num = String(index + 1).padStart(2, '0');
  const play = work.type === 'video'
    ? `<span class="card-play" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>`
    : '';
  const meta = [work.year, ...work.meta.slice(0, 2)]
    .map((m) => `<span>${m}</span>`)
    .join('');
  return `
    <article class="card" role="button" tabindex="0" data-id="${work.id}"
      aria-label="打开作品：${work.title}" style="animation-delay:${Math.min(index * 45, 360)}ms">
      <div class="card-media">
        <img src="${work.cover}" alt="${work.title} 封面" loading="lazy" decoding="async">
        <span class="card-badge">${work.cat}</span>
        <span class="card-idx">${num}</span>
        ${play}
      </div>
      <div class="card-body">
        <h3>${work.title}</h3>
        <p class="card-meta">${meta}</p>
      </div>
    </article>`;
}

function renderCards(filter = '全部') {
  const list = filter === '全部' ? WORKS : WORKS.filter((w) => w.cat === filter);
  grid.innerHTML = list.map((w, i) => cardTemplate(w, i)).join('');
  empty.hidden = list.length > 0;
  grid.hidden = list.length === 0;
}

renderCards();

filters.forEach((btn) => {
  btn.addEventListener('click', () => {
    filters.forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    renderCards(btn.dataset.filter);
  });
});

/* ------------------------------------------------------------------ *
 * 弹层
 * ------------------------------------------------------------------ */

const modal = document.getElementById('modal');
const modalMedia = document.getElementById('modal-media');
const modalCat = document.getElementById('modal-cat');
const modalTitle = document.getElementById('modal-title');
const modalMeta = document.getElementById('modal-meta');
const modalDesc = document.getElementById('modal-desc');
const modalTags = document.getElementById('modal-tags');
const modalFoot = document.getElementById('modal-foot');
const modalGhost = document.getElementById('modal-ghost');
let lastFocus = null;

function openModal(id) {
  const work = WORKS.find((w) => w.id === id);
  if (!work) return;

  lastFocus = document.activeElement;
  modalCat.textContent = `${work.cat} · ${work.year}`;
  modalTitle.textContent = work.title;
  modalMeta.textContent = work.meta.join(' · ');
  modalDesc.textContent = work.desc;
  modalGhost.textContent = String(WORKS.findIndex((w) => w.id === id) + 1).padStart(2, '0');
  modalTags.innerHTML = work.tags.map((t) => `<li>${t}</li>`).join('');
  modalFoot.textContent = work.foot;

  if (work.type === 'video') {
    const video = document.createElement('video');
    video.src = work.video;
    video.poster = work.poster;
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    modalMedia.replaceChildren(video);
  } else {
    const img = document.createElement('img');
    img.src = work.cover;
    img.alt = `${work.title} 封面`;
    modalMedia.replaceChildren(img);
  }

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modal.querySelector('.modal-close').focus({ preventScroll: true });
}

function closeModal() {
  const video = modalMedia.querySelector('video');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  modal.hidden = true;
  modalMedia.replaceChildren();
  document.body.style.overflow = '';
  if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
}

grid.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) openModal(card.dataset.id);
});

grid.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.card');
  if (!card) return;
  e.preventDefault();
  openModal(card.dataset.id);
});

modal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});

/* ------------------------------------------------------------------ *
 * 3D 场景
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('stage');
let scene = null;

try {
  scene = createScene(canvas);
  document.documentElement.dataset.scene = 'ok';
  setTimeout(() => {
    document.documentElement.dataset.canvas = `${canvas.width}x${canvas.height}`;
  }, 600);
} catch (err) {
  console.error('3D 场景初始化失败：', err);
  document.documentElement.dataset.scene = `error:${err && err.message}`;
  canvas.style.display = 'none';
  const note = document.createElement('p');
  note.textContent = '这个浏览器暂时无法显示 3D 场景，作品列表在下方。';
  note.style.cssText = 'position:absolute;right:6vw;bottom:20vh;color:#1b2a3a99;font-size:13px;';
  canvas.parentElement.appendChild(note);
}

if (scene) {
  if (new URLSearchParams(location.search).has('debug')) window.__portfolioScene = scene;

  const chips = Array.from(document.querySelectorAll('[data-accessory]'));
  const state = { glasses: false, headphones: false, tie: false };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const name = chip.dataset.accessory;
      state[name] = !state[name];
      chip.setAttribute('aria-pressed', state[name] ? 'true' : 'false');
      scene.setAccessory(name, state[name]);
    });
  });

  document.getElementById('reset-view').addEventListener('click', () => scene.resetView());

  // 滚出首屏后暂停渲染，省电
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) scene.resume();
      else scene.pause();
    },
    { threshold: 0.02 },
  );
  io.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scene.pause();
    else scene.resume();
  });

  // 导航里的「看这条鱼」：滚回顶部并给一点反馈
  document.querySelector('[data-scene-focus]')?.addEventListener('click', () => {
    scene.resume();
    scene.resetView();
  });
}

/* ------------------------------------------------------------------ *
 * 杂项
 * ------------------------------------------------------------------ */

const nav = document.querySelector('.nav');
function onScroll() {
  nav.classList.toggle('is-scrolled', window.scrollY > 24);
}
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });
