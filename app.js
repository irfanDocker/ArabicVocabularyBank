(() => {
  // ── Tajweed color map ──
  const TAJWEED = {
    'َ': '#e74c3c', 'ُ': '#27ae60', 'ِ': '#3498db',
    'ً': '#e67e22', 'ٌ': '#1abc9c', 'ٍ': '#9b59b6',
    'ّ': '#f39c12', 'ْ': '#95a5a6', 'ٰ': '#e74c3c', 'ٓ': '#3498db',
  };

  function tajweedHTML(arabic) {
    let html = '';
    for (const ch of arabic) {
      html += TAJWEED[ch] ? `<span style="color:${TAJWEED[ch]}">${ch}</span>` : ch;
    }
    return html;
  }

  // ── State ──
  let currentBook   = '1';
  let currentLesson = 'all';
  let deck = [];
  let cardIndex = 0;
  let isFlipped = false;

  let matchPairs = [];
  let selectedCard = null;
  let matchedCount = 0;
  let totalPairs = 0;
  let wrongTimeout = null;

  const $ = id => document.getElementById(id);

  function bookData() { return VOCAB_DATA[currentBook].lessons; }
  function lessonKeys() { return Object.keys(bookData()).sort((a, b) => +a - +b); }

  function getEntries(lesson) {
    const bd = bookData();
    if (lesson === 'all') return lessonKeys().flatMap(l => bd[l]);
    return bd[lesson] || [];
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Book selector ──
  document.querySelectorAll('.book-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.book-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBook = btn.dataset.book;
      currentLesson = 'all';
      buildLessonSelector();
      refreshCurrentMode();
    });
  });

  // ── Lesson selector ──
  function buildLessonSelector() {
    const sel = $('lesson-select');
    const bd = bookData();
    const isQuran = currentBook === '3';
    const unitLabel = isQuran ? 'Section' : 'Lesson';
    const allLabel = isQuran ? 'All Sections' : 'All Lessons';
    sel.innerHTML = `<option value="all">${allLabel}</option>` +
      lessonKeys().map(l => {
        const startNum = (parseInt(l) - 1) * 50 + 1;
        const endNum = startNum + bd[l].length - 1;
        const label = isQuran ? `${unitLabel} ${l} (#${startNum}–${endNum})` : `${unitLabel} ${l} (${bd[l].length})`;
        return `<option value="${l}">${label}</option>`;
      }).join('');
    sel.value = currentLesson === 'all' ? 'all' : currentLesson;
  }

  $('lesson-select').addEventListener('change', e => {
    currentLesson = e.target.value;
    refreshCurrentMode();
  });

  function refreshCurrentMode() {
    const active = document.querySelector('.mode.active')?.id;
    if (active === 'mode-flashcard') initFlashcard();
    else if (active === 'mode-match') initMatch();
    else if (active === 'mode-browse') renderBrowse();
    // adhkar modes don't need refresh on lesson/book change
  }

  // ── Mode switching ──
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Show/hide lesson bar (not needed in adhkar mode)
      const isAdhkar = btn.dataset.mode && btn.dataset.mode.startsWith('adhkar');
      $('lesson-bar').style.display = isAdhkar ? 'none' : '';
      document.querySelectorAll('.mode').forEach(m => m.classList.remove('active'));
      $('mode-' + btn.dataset.mode).classList.add('active');
      if (btn.dataset.mode === 'adhkar-morning') initAdhkar();
      else refreshCurrentMode();
    });
  });

  // ──────────────────────────────────────────────
  // FLASHCARD MODE
  // ──────────────────────────────────────────────
  function initFlashcard() {
    deck = getEntries(currentLesson).filter(e => e.arabic);
    cardIndex = 0;
    isFlipped = false;
    $('card').classList.remove('flipped');
    renderCard();
  }

  function renderCard() {
    if (!deck.length) return;
    const entry = deck[cardIndex];
    $('card-arabic').innerHTML = tajweedHTML(entry.arabic);
    $('card-english').textContent = entry.english;
    const ugEl = $('card-uyghur');
    ugEl.textContent = entry.uyghur || '';
    ugEl.style.display = entry.uyghur ? '' : 'none';
    $('card-counter').textContent = `${cardIndex + 1} / ${deck.length}`;
    $('progress-text').textContent = `${cardIndex + 1} of ${deck.length}`;
  }

  function flipCard() {
    isFlipped = !isFlipped;
    $('card').classList.toggle('flipped', isFlipped);
  }

  $('card').addEventListener('click', flipCard);
  $('card').addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') flipCard(); });

  $('btn-prev').addEventListener('click', () => {
    if (cardIndex > 0) { cardIndex--; isFlipped = false; $('card').classList.remove('flipped'); renderCard(); }
  });
  $('btn-next').addEventListener('click', () => {
    if (cardIndex < deck.length - 1) { cardIndex++; isFlipped = false; $('card').classList.remove('flipped'); renderCard(); }
  });
  $('btn-flip').addEventListener('click', flipCard);
  $('btn-shuffle').addEventListener('click', () => {
    deck = shuffle(deck);
    cardIndex = 0;
    isFlipped = false;
    $('card').classList.remove('flipped');
    renderCard();
  });

  document.addEventListener('keydown', e => {
    if (document.querySelector('.mode.active')?.id !== 'mode-flashcard') return;
    if (e.key === 'ArrowRight') $('btn-next').click();
    if (e.key === 'ArrowLeft')  $('btn-prev').click();
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
  });

  // ──────────────────────────────────────────────
  // MATCHING GAME
  // ──────────────────────────────────────────────
  const MATCH_COUNT = 6;

  function initMatch() {
    selectedCard = null;
    matchedCount = 0;
    clearTimeout(wrongTimeout);
    const entries = shuffle(getEntries(currentLesson).filter(e => e.arabic));
    matchPairs = entries.slice(0, MATCH_COUNT);
    totalPairs = matchPairs.length;
    $('match-result').classList.add('hidden');
    $('match-status').textContent = `Match ${totalPairs} pairs`;
    renderMatchBoard();
  }

  function renderMatchBoard() {
    const board = $('match-board');
    board.innerHTML = '';
    const engItems = shuffle(matchPairs.map((p, i) => ({ id: i, text: p.english, lang: 'en' })));
    const arItems  = shuffle(matchPairs.map((p, i) => ({ id: i, html: tajweedHTML(p.arabic), lang: 'ar' })));
    const combined = [];
    for (let i = 0; i < engItems.length; i++) combined.push(engItems[i], arItems[i]);
    combined.forEach(item => {
      const div = document.createElement('div');
      div.className = 'match-card';
      div.dataset.id = item.id;
      div.dataset.lang = item.lang;
      if (item.lang === 'ar') { div.innerHTML = item.html; div.lang = 'ar'; div.dir = 'rtl'; }
      else div.textContent = item.text;
      div.addEventListener('click', () => onMatchCardClick(div));
      board.appendChild(div);
    });
  }

  function onMatchCardClick(div) {
    if (div.classList.contains('matched') || div.classList.contains('wrong')) return;
    if (!selectedCard) {
      if (div.classList.contains('selected')) { div.classList.remove('selected'); return; }
      div.classList.add('selected');
      selectedCard = div;
      return;
    }
    if (div === selectedCard) { div.classList.remove('selected'); selectedCard = null; return; }
    if (div.dataset.lang === selectedCard.dataset.lang) {
      selectedCard.classList.remove('selected');
      div.classList.add('selected');
      selectedCard = div;
      return;
    }
    const first = selectedCard;
    selectedCard = null;
    first.classList.remove('selected');
    if (first.dataset.id === div.dataset.id) {
      first.classList.add('matched'); div.classList.add('matched');
      matchedCount++;
      $('match-status').textContent = `${matchedCount} / ${totalPairs} matched`;
      if (matchedCount === totalPairs) showMatchWin();
    } else {
      first.classList.add('wrong'); div.classList.add('wrong');
      clearTimeout(wrongTimeout);
      wrongTimeout = setTimeout(() => { first.classList.remove('wrong'); div.classList.remove('wrong'); }, 800);
    }
  }

  function showMatchWin() {
    const res = $('match-result');
    res.textContent = 'All matched! Great job!';
    res.classList.remove('hidden');
  }

  $('btn-new-match').addEventListener('click', initMatch);

  // ──────────────────────────────────────────────
  // BROWSE MODE
  // ──────────────────────────────────────────────
  function renderBrowse(filter = '') {
    const entries = getEntries(currentLesson).filter(e => e.arabic);
    const q = filter.toLowerCase();
    const filtered = q
      ? entries.filter(e => e.english.toLowerCase().includes(q) || e.arabic.includes(q))
      : entries;
    $('browse-tbody').innerHTML = filtered.map((e, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${e.english}</td>
        <td lang="ar" dir="rtl">${tajweedHTML(e.arabic)}</td>
        <td lang="ug" dir="rtl">${e.uyghur || ''}</td>
      </tr>`).join('');
    $('progress-text').textContent = `${filtered.length} entries`;
  }

  $('browse-search').addEventListener('input', e => renderBrowse(e.target.value));

  // ──────────────────────────────────────────────
  // MORNING ADHKAR MODE
  // ──────────────────────────────────────────────
  let adhkarIndex = 0;

  function initAdhkar() {
    adhkarIndex = 0;
    buildAdhkarDots();
    renderAdhkar();
  }

  function buildAdhkarDots() {
    const dots = $('adhkar-dots');
    dots.innerHTML = MORNING_ADHKAR.map((_, i) =>
      `<span class="adhkar-dot${i === 0 ? ' active' : ''}" data-i="${i}"></span>`
    ).join('');
    dots.querySelectorAll('.adhkar-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        adhkarIndex = +dot.dataset.i;
        renderAdhkar();
      });
    });
  }

  function renderAdhkar() {
    const d = MORNING_ADHKAR[adhkarIndex];
    // Arabic text: replace literal \n with line breaks for display
    $('adhkar-arabic').textContent = d.arabic.replace(/\\n/g, '\n');
    // Uyghur translation
    const ugEl = $('adhkar-uyghur');
    ugEl.textContent = d.uyghur.replace(/\\n/g, '\n');
    ugEl.style.display = d.uyghur.trim() ? '' : 'none';
    // Source
    const srcEl = $('adhkar-source');
    srcEl.textContent = d.source ? `[ ${d.source} ]` : '';
    srcEl.style.display = d.source ? '' : 'none';
    // Repeat badge
    $('adhkar-repeat-badge').textContent = `× ${d.repeat}`;
    // Counter
    $('adhkar-counter').textContent = `${adhkarIndex + 1} / ${MORNING_ADHKAR.length}`;
    // Dots
    document.querySelectorAll('.adhkar-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === adhkarIndex);
    });
    // Scroll card into view smoothly
    $('adhkar-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('adhkar-prev').addEventListener('click', () => {
    if (adhkarIndex > 0) { adhkarIndex--; renderAdhkar(); }
  });
  $('adhkar-next').addEventListener('click', () => {
    if (adhkarIndex < MORNING_ADHKAR.length - 1) { adhkarIndex++; renderAdhkar(); }
  });

  document.addEventListener('keydown', e => {
    if (document.querySelector('.mode.active')?.id !== 'mode-adhkar-morning') return;
    if (e.key === 'ArrowRight') $('adhkar-next').click();
    if (e.key === 'ArrowLeft')  $('adhkar-prev').click();
  });

  // ── Boot ──
  buildLessonSelector();
  initFlashcard();
  renderBrowse();
  initAdhkar();
})();
