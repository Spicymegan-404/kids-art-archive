'use strict';

// ── Language ──────────────────────────────────────────────────────────────────
let currentLang = localStorage.getItem('kids_art_lang') || 'en';

function t(key) { return LANG[currentLang][key]; }

function datePrefix() {
  return currentLang === 'zh' ? '日期' : 'Date';
}

function fmtCount(n) {
  if (currentLang === 'zh') return `${n} 幅作品`;
  return n === 1 ? '1 drawing' : `${n} drawings`;
}

function normalizeAge(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (!/^\d+$/.test(raw)) return '';
  const age = Number(raw);
  if (!Number.isInteger(age) || age < 1 || age > 100) return '';
  return String(age);
}

function buildAgeOptions() {
  if (!ageInput) return;
  const currentValue = normalizeAge(ageInput.value);
  const defaultLabel = currentLang === 'zh' ? '请选择年龄' : 'Select age';
  ageInput.innerHTML = `<option value="">${defaultLabel}</option>`;
  for (let age = 1; age <= 100; age += 1) {
    ageInput.insertAdjacentHTML('beforeend', `<option value="${age}">${age}</option>`);
  }
  ageInput.value = currentValue;
}

function applyLang() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (LANG[currentLang][key] !== undefined) el.textContent = LANG[currentLang][key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (LANG[currentLang][key] !== undefined) el.placeholder = LANG[currentLang][key];
  });
  buildAgeOptions();
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  const importBtn = document.getElementById('btn-import');
  if (importBtn && currentLang === 'zh') importBtn.textContent = '恢复作品备份';
  if (!selectedFile) fileLabelTxt.textContent = t('dropZone');
  if (saveNotice) saveNotice.textContent = currentLang === 'zh' ? '已保存 ✓' : 'Saved ✓';
  renderGallery();
  if (currentView === 'yearly') renderYearly();
}

// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'kids_art_gallery';

function loadDrawings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveDrawings(drawings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drawings));
}

// ── State ─────────────────────────────────────────────────────────────────────
let drawings    = loadDrawings();
let currentView = 'home';
const insightsCache = {}; // { year: { status: 'idle'|'loading'|'done'|'error', text } }

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form         = document.getElementById('upload-form');
const titleInput   = document.getElementById('drawing-title');
const artistInput  = document.getElementById('drawing-artist');
const ageInput     = document.getElementById('drawing-age');
const storyInput   = document.getElementById('drawing-story');
const dateInput    = document.getElementById('drawing-date');
const fileInput    = document.getElementById('drawing-image');
const dropZone     = document.getElementById('drop-zone');
const fileLabelTxt = document.getElementById('file-label-text');
const previewWrap  = document.getElementById('image-preview-wrap');
const previewImg   = document.getElementById('image-preview');
const saveNotice   = document.getElementById('save-confirmation');
const gallery      = document.getElementById('gallery');
const emptyState   = document.getElementById('empty-state');
const lightbox     = document.getElementById('lightbox');
const lbImg        = document.getElementById('lightbox-img');
const lbTitle      = document.getElementById('lightbox-title');
const lbArtist     = document.getElementById('lightbox-artist');
const lbDate       = document.getElementById('lightbox-date');
const lbStory      = document.getElementById('lightbox-story');
let saveNoticeTimer = null;

dateInput.value   = new Date().toISOString().slice(0, 10);
artistInput.value = localStorage.getItem('kids_art_artist') || '';
buildAgeOptions();

// ── View switching ────────────────────────────────────────────────────────────
function switchView(view, scrollToYear = null) {
  currentView = view;
  document.getElementById('view-home').classList.toggle('hidden', view !== 'home');
  document.getElementById('view-yearly').classList.toggle('hidden', view !== 'yearly');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  if (view === 'yearly') {
    renderYearly();
    if (scrollToYear) {
      requestAnimationFrame(() => {
        const el = document.querySelector(`.year-group[data-year="${scrollToYear}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }
}

function handleRouteHash() {
  const hash = window.location.hash;

  if (hash === '#yearbook-section') {
    switchView('yearly');
    requestAnimationFrame(() => {
      document.getElementById('yearbook-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return;
  }

  if (hash === '#upload-section') {
    switchView('home');
    requestAnimationFrame(() => {
      document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
window.addEventListener('hashchange', handleRouteHash);

// ── Language switcher ─────────────────────────────────────────────────────────
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentLang = btn.dataset.lang;
    localStorage.setItem('kids_art_lang', currentLang);
    applyLang();
  });
});

// ── File / drag-drop ──────────────────────────────────────────────────────────
let selectedFile = null;

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  selectedFile = file;
  fileLabelTxt.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    previewWrap.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
  const dt = new DataTransfer();
  dt.items.add(e.dataTransfer.files[0]);
  fileInput.files = dt.files;
});

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  if (!selectedFile) { alert(t('alertNoImage')); return; }
  const normalizedAge = normalizeAge(ageInput.value);
  if (ageInput.value.trim() && !normalizedAge) {
    alert(currentLang === 'zh' ? '年龄只能填写 1 到 100 的整数。' : 'Age must be an integer between 1 and 100.');
    ageInput.focus();
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    const drawing = {
      id:       Date.now(),
      title:    titleInput.value.trim(),
      artist:   artistInput.value.trim(),
      age:      normalizedAge,
      story:    storyInput.value.trim(),
      date:     dateInput.value,
      imageUrl: ev.target.result,
    };
    if (drawing.artist) localStorage.setItem('kids_art_artist', drawing.artist);
    drawings.unshift(drawing);
    saveDrawings(drawings);
    renderGallery();
    resetForm();
    showSaveConfirmation();
  };
  reader.readAsDataURL(selectedFile);
});

function resetForm() {
  form.reset();
  dateInput.value   = new Date().toISOString().slice(0, 10);
  artistInput.value = localStorage.getItem('kids_art_artist') || '';
  selectedFile = null;
  fileLabelTxt.textContent = t('dropZone');
  previewWrap.classList.add('hidden');
  previewImg.src = '';
}

function showSaveConfirmation() {
  if (!saveNotice) return;
  saveNotice.textContent = currentLang === 'zh' ? '已保存 ✓' : 'Saved ✓';
  saveNotice.classList.remove('hidden');
  clearTimeout(saveNoticeTimer);
  saveNoticeTimer = setTimeout(() => {
    saveNotice.classList.add('hidden');
  }, 2000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const locale = currentLang === 'zh' ? 'zh-CN' : 'en-US';
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}
function getYear(drawing) { return drawing.date.slice(0, 4); }

// ── Timeline gallery (grouped by year) ───────────────────────────────────────
function renderGallery() {
  gallery.innerHTML = '';
  emptyState.classList.toggle('hidden', drawings.length > 0);

  let lastYear = null;
  drawings.forEach(d => {
    const safeAge = normalizeAge(d.age);
    const year = getYear(d);
    if (year !== lastYear) {
      lastYear = year;
      const divider = document.createElement('div');
      divider.className = 'year-divider';
      divider.dataset.year = year;
      divider.innerHTML = `<span class="year-divider-label">${year}</span><span class="year-divider-arrow">›</span>`;
      divider.title = currentLang === 'zh' ? `查看 ${year} 年度合集` : `View ${year} collection`;
      divider.addEventListener('click', () => switchView('yearly', year));
      gallery.appendChild(divider);
    }

    const card = document.createElement('div');
    card.className = 'drawing-card';
    card.innerHTML = `
      <div class="card-inner" data-id="${d.id}">
        <img class="card-thumb" src="${d.imageUrl}" alt="${escHtml(d.title)}" />
        <div class="card-info">
          <div class="card-title">${escHtml(d.title)}</div>
          ${d.artist ? `<div class="card-artist">👩‍🎨 ${escHtml(d.artist)}</div>` : ''}
          ${safeAge ? `<div class="card-artist">🌱 ${escHtml(safeAge)}</div>` : ''}
          <div class="card-date">📅 ${formatDate(d.date)}</div>
          ${d.story ? `<div class="card-story">${escHtml(d.story)}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn-delete" data-id="${d.id}"
            title="${t('deleteTitle')}"
            aria-label="${t('deleteLabel')}">🗑</button>
        </div>
      </div>`;

    card.querySelector('.card-inner').addEventListener('click', ev => {
      if (ev.target.closest('.btn-delete')) return;
      openLightbox(d);
    });
    card.querySelector('.btn-delete').addEventListener('click', ev => {
      ev.stopPropagation();
      deleteDrawing(d.id);
    });
    gallery.appendChild(card);
  });
}

function deleteDrawing(id) {
  if (!confirm(t('confirmDelete'))) return;
  drawings = drawings.filter(d => d.id !== id);
  saveDrawings(drawings);
  renderGallery();
}

// ── Yearly Collection view ────────────────────────────────────────────────────
function renderYearly() {
  const content = document.getElementById('yearly-content');
  content.innerHTML = '';

  if (drawings.length === 0) {
    content.innerHTML = `<div class="empty-state"><span>${t('yearlyEmpty')}</span></div>`;
    return;
  }

  renderApiKeySection(content);

  const groups = {};
  drawings.forEach(d => {
    const y = getYear(d);
    if (!groups[y]) groups[y] = [];
    groups[y].push(d);
  });

  Object.keys(groups).sort((a, b) => b - a).forEach(year => {
    const items = groups[year];
    const group = document.createElement('div');
    group.className = 'year-group';
    group.dataset.year = year;

    const header = document.createElement('div');
    header.className = 'year-group-header';
    header.innerHTML = `
      <span class="year-group-title">${year}</span>
      <span class="year-group-count">${fmtCount(items.length)}</span>`;
    group.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'year-grid';
    items.forEach(d => {
      const safeAge = normalizeAge(d.age);
      const card = document.createElement('div');
      card.className = 'year-thumb-card';
      card.innerHTML = `
        <div class="year-thumb-img-wrap">
          <img src="${d.imageUrl}" alt="${escHtml(d.title)}" />
        </div>
        <div class="year-thumb-info">
          <div class="year-thumb-title">${escHtml(d.title)}</div>
          ${d.artist ? `<div class="year-thumb-artist">👩‍🎨 ${escHtml(d.artist)}</div>` : ''}
          ${safeAge ? `<div class="year-thumb-age">🌱 ${escHtml(safeAge)}</div>` : ''}
          <div class="year-thumb-date">📅 ${formatDate(d.date)}</div>
        </div>`;
      card.addEventListener('click', () => {
        window.location.href = `art.html?id=${d.id}`;
      });
      grid.appendChild(card);
    });
    group.appendChild(grid);

    renderInsightsSection(year, items, group);
    content.appendChild(group);
  });
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(d) {
  const safeAge = normalizeAge(d.age);
  lbImg.src            = d.imageUrl;
  lbTitle.textContent  = d.title;
  lbArtist.textContent = d.artist ? `👩‍🎨 ${d.artist}` : '';
  lbDate.textContent   = (safeAge ? `🌱 ${safeAge}  ·  ` : '') + `📅 ${formatDate(d.date)}`;
  lbStory.textContent  = d.story || '';
  lbStory.classList.toggle('hidden', !d.story);
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.classList.add('hidden');
  document.body.style.overflow = '';
  lbImg.src = '';
}
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ── AI Growth Insights ────────────────────────────────────────────────────────

function renderApiKeySection(container) {
  const apiKey = localStorage.getItem('kids_art_apikey') || '';
  const section = document.createElement('div');
  section.className = 'api-key-section';
  section.id = 'api-key-section';

  if (apiKey) {
    section.innerHTML = `
      <div class="api-key-set">
        <span class="api-key-icon">🔑</span>
        <span>${t('apiKeySet')}</span>
        <button class="btn-link api-key-change">${t('apiKeyChange')}</button>
      </div>`;
    section.querySelector('.api-key-change').addEventListener('click', () => {
      localStorage.removeItem('kids_art_apikey');
      renderYearly();
    });
  } else {
    section.innerHTML = `
      <div class="api-key-form">
        <label class="api-key-label">${t('apiKeyLabel')}</label>
        <div class="api-key-row">
          <input type="password" id="api-key-input"
            placeholder="${escHtml(t('apiKeyPlaceholder'))}" autocomplete="off" />
          <button class="btn-api-save" id="api-key-save">${t('apiKeySave')}</button>
        </div>
        <p class="api-key-hint">${t('apiKeyHint')}</p>
      </div>`;
    const saveKey = () => {
      const val = section.querySelector('#api-key-input').value.trim();
      if (val) { localStorage.setItem('kids_art_apikey', val); renderYearly(); }
    };
    section.querySelector('#api-key-save').addEventListener('click', saveKey);
    section.querySelector('#api-key-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') saveKey();
    });
  }
  container.appendChild(section);
}

function renderInsightsSection(year, items, parentEl) {
  const section = document.createElement('div');
  section.className = 'insights-section';

  const heading = document.createElement('div');
  heading.className = 'insights-heading';
  heading.innerHTML = `<span class="insights-star">✨</span><span>${t('aiHeading')}</span>`;
  section.appendChild(heading);

  const body = document.createElement('div');
  body.className = 'insights-body';
  section.appendChild(body);

  renderInsightsBody(year, items, body);
  parentEl.appendChild(section);
}

function renderInsightsBody(year, items, bodyEl) {
  bodyEl.innerHTML = '';

  if (items.length < 2) {
    bodyEl.innerHTML = `<p class="insights-hint">${t('aiNotEnough')}</p>`;
    return;
  }

  const cache = insightsCache[year];

  if (cache && cache.status === 'loading') {
    bodyEl.innerHTML = `
      <div class="insights-loading">
        <span class="insights-spinner"></span>${t('aiLoading')}
      </div>`;
    return;
  }

  if (cache && cache.status === 'done') {
    const p = document.createElement('p');
    p.className = 'insights-text';
    p.textContent = cache.text;
    bodyEl.appendChild(p);
    const regenBtn = document.createElement('button');
    regenBtn.className = 'btn-insights-sm';
    regenBtn.textContent = t('aiBtnRegen');
    regenBtn.addEventListener('click', () => generateInsights(year, items, bodyEl));
    bodyEl.appendChild(regenBtn);
    return;
  }

  if (cache && cache.status === 'error') {
    const p = document.createElement('p');
    p.className = 'insights-error';
    p.textContent = t('aiError');
    bodyEl.appendChild(p);
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-insights';
    retryBtn.textContent = t('aiBtnGenerate');
    retryBtn.addEventListener('click', () => generateInsights(year, items, bodyEl));
    bodyEl.appendChild(retryBtn);
    return;
  }

  // Default: generate button
  const btn = document.createElement('button');
  btn.className = 'btn-insights';
  btn.textContent = t('aiBtnGenerate');
  btn.addEventListener('click', () => generateInsights(year, items, bodyEl));
  bodyEl.appendChild(btn);
}

async function generateInsights(year, items, bodyEl) {
  const apiKey = localStorage.getItem('kids_art_apikey') || '';
  if (!apiKey) {
    const keySection = document.getElementById('api-key-section');
    if (keySection) {
      keySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      keySection.classList.add('api-key-highlight');
      setTimeout(() => keySection.classList.remove('api-key-highlight'), 1600);
    }
    return;
  }

  insightsCache[year] = { status: 'loading' };
  renderInsightsBody(year, items, bodyEl);

  try {
    const prompt = buildInsightPrompt(year, items);
    const text = await callClaude(apiKey, prompt);
    insightsCache[year] = { status: 'done', text };
  } catch (err) {
    console.error('Insights error:', err);
    insightsCache[year] = { status: 'error' };
  }

  renderInsightsBody(year, items, bodyEl);
}

function buildInsightPrompt(year, items) {
  const list = items.map((d, i) => {
    const parts = [`"${d.title}"`];
    if (d.age) parts.push((currentLang === 'zh' ? '年龄 ' : 'age ') + d.age);
    if (d.date) parts.push(d.date);
    if (d.story) parts.push(`"${d.story}"`);
    return `${i + 1}. ${parts.join(' · ')}`;
  }).join('\n');

  if (currentLang === 'zh') {
    return `你是一位温暖专业的儿童成长观察者。以下是一个孩子在 ${year} 年创作的 ${items.length} 幅画：

${list}

请根据以上作品信息，用温暖、积极、充满爱的语气，写一段简短的成长观察（3-4句话）。关注孩子的创意、想象力、表达方式的成长特点。直接写正文段落，不要加标题或列表格式。用中文回答。`;
  } else {
    return `You are a warm and insightful child development observer. Here are ${items.length} artworks created by a child in ${year}:

${list}

Based on this, write a brief, warm, and encouraging growth observation (3-4 sentences) about the child's creativity, imagination, and artistic expression. Write a flowing paragraph without titles or bullet points. Reply in English.`;
  }
}

async function callClaude(apiKey, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                             apiKey,
      'anthropic-version':                     '2023-06-01',
      'content-type':                          'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-6',
      max_tokens: 400,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.content[0].text.trim();
}

// ── Init ──────────────────────────────────────────────────────────────────────
applyLang();
handleRouteHash();
