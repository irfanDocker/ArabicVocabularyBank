(() => {
  // ── State ──
  let currentLesson = 'all';
  let deck = [];
  let cardIndex = 0;
  let isFlipped = false;

  // Matching game state
  let matchPairs = [];
  let selectedCard = null;
  let matchedCount = 0;
  let totalPairs = 0;
  let wrongTimeout = null;

  // ── Helpers ──
  const $ = id => document.getElementById(id);
  const lessons = Object.keys(VOCAB_DATA).sort((a, b) => +a - +b);

  function getEntries(lesson) {
    if (lesson === 'all') {
      return lessons.flatMap(l => VOCAB_DATA[l]);
    }
    return VOCAB_DATA[lesson] || [];
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Lesson selector ──
  function buildLessonSelector() {
    const sel = $('lesson-select');
    sel.innerHTML = '<option value="all">All Lessons</option>' +
      lessons.map(l => `<option value="${l}">Lesson ${l} (${VOCAB_DATA[l].length})</option>`).join('');
    sel.value = 'all';
    sel.addEventListener('change', () => {
      currentLesson = sel.value;
      initFlashcard();
      if (document.querySelector('.mode.active').id === 'mode-match') initMatch();
      if (document.querySelector('.mode.active').id === 'mode-browse') renderBrowse();
    });
  }

  // ── Mode switching ──
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.mode').forEach(m => m.classList.remove('active'));
      $('mode-' + btn.dataset.mode).classList.add('active');
      if (btn.dataset.mode === 'flashcard') initFlashcard();
      if (btn.dataset.mode === 'match') initMatch();
      if (btn.dataset.mode === 'browse') renderBrowse();
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
    $('card-english').textContent = entry.english;
    $('card-arabic').textContent = entry.arabic;
    $('card-translit').textContent = entry.transliteration || '';
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

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    const mode = document.querySelector('.mode.active')?.id;
    if (mode !== 'mode-flashcard') return;
    if (e.key === 'ArrowRight') $('btn-next').click();
    if (e.key === 'ArrowLeft') $('btn-prev').click();
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
  });

  // ──────────────────────────────────────────────
  // MATCHING GAME
  // ──────────────────────────────────────────────
  const MATCH_COUNT = 6; // pairs per round

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

    // Build two columns: English (left) and Arabic (right), shuffled independently
    const engItems = shuffle(matchPairs.map((p, i) => ({ id: i, text: p.english, lang: 'en' })));
    const arItems  = shuffle(matchPairs.map((p, i) => ({ id: i, text: p.arabic,   lang: 'ar' })));

    // Interleave: eng[0], ar[0], eng[1], ar[1] … so grid-template-columns:1fr 1fr looks right
    const combined = [];
    for (let i = 0; i < engItems.length; i++) {
      combined.push(engItems[i], arItems[i]);
    }

    combined.forEach(item => {
      const div = document.createElement('div');
      div.className = 'match-card';
      div.dataset.id = item.id;
      div.dataset.lang = item.lang;
      div.textContent = item.text;
      if (item.lang === 'ar') {
        div.lang = 'ar';
        div.dir = 'rtl';
      }
      div.addEventListener('click', () => onMatchCardClick(div));
      board.appendChild(div);
    });
  }

  function onMatchCardClick(div) {
    if (div.classList.contains('matched') || div.classList.contains('wrong')) return;

    if (!selectedCard) {
      // First selection
      if (div.classList.contains('selected')) {
        div.classList.remove('selected');
        return;
      }
      div.classList.add('selected');
      selectedCard = div;
      return;
    }

    if (div === selectedCard) {
      div.classList.remove('selected');
      selectedCard = null;
      return;
    }

    // Second selection — must be opposite lang
    if (div.dataset.lang === selectedCard.dataset.lang) {
      // Switch selection to the new card
      selectedCard.classList.remove('selected');
      div.classList.add('selected');
      selectedCard = div;
      return;
    }

    const first = selectedCard;
    selectedCard = null;
    first.classList.remove('selected');

    if (first.dataset.id === div.dataset.id) {
      // Correct match
      first.classList.add('matched');
      div.classList.add('matched');
      matchedCount++;
      $('match-status').textContent = `${matchedCount} / ${totalPairs} matched`;
      if (matchedCount === totalPairs) showMatchWin();
    } else {
      // Wrong
      first.classList.add('wrong');
      div.classList.add('wrong');
      clearTimeout(wrongTimeout);
      wrongTimeout = setTimeout(() => {
        first.classList.remove('wrong');
        div.classList.remove('wrong');
      }, 800);
    }
  }

  function showMatchWin() {
    const res = $('match-result');
    res.textContent = '🎉 All matched! Great job!';
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

    const tbody = $('browse-tbody');
    tbody.innerHTML = filtered.map((e, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${e.english}</td>
        <td lang="ar" dir="rtl">${e.arabic}</td>
        <td><em>${e.transliteration || ''}</em></td>
      </tr>`).join('');

    $('progress-text').textContent = `${filtered.length} entries`;
  }

  $('browse-search').addEventListener('input', e => renderBrowse(e.target.value));

  // ── Boot ──
  buildLessonSelector();
  initFlashcard();
  renderBrowse();
})();
