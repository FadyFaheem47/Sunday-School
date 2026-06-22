/* ============================================================
   NOTE ON REAL-TIME SYNC
   ============================================================
   In a production app, all shared state (room, players, buzzes,
   timer, question) would live in a backend like:
     • Firebase Realtime Database  → gameRef.on('value', cb)
     • Supabase                    → supabase.channel().on('*', cb)
     • Custom WebSocket server     → ws.onmessage = cb

   Here we SIMULATE multi-user sync using localStorage events
   so multiple tabs on the SAME browser can play together.
   Each state mutation calls broadcastState(), which writes to
   localStorage and triggers a 'storage' event in other tabs.
   ============================================================ */

// ============================================================
// CONSTANTS & DATA
// ============================================================

const BIBLE_BOOKS = [
  // Old Testament
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy",
  "Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings",
  "1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther",
  "Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon",
  "Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel",
  "Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum",
  "Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
  // New Testament
  "Matthew","Mark","Luke","John","Acts",
  "Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians",
  "Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews",
  "James","1 Peter","2 Peter","1 John","2 John","3 John",
  "Jude","Revelation"
];

/* Question bank: keyed by [book][difficulty] → array of {q, a}
   A curated sample; in production this would be a full database */
const QUESTION_BANK = {
  "Genesis": {
    easy: [
      { q: "Who was the first man God created according to Genesis?", a: "Adam" },
      { q: "What did God create on the first day?", a: "Light" },
      { q: "What was the forbidden fruit tree called in the Garden of Eden?", a: "The tree of the knowledge of good and evil" }
    ],
    medium: [
      { q: "How old was Noah when the flood began?", a: "600 years old (Genesis 7:6)" },
      { q: "What were the names of Noah's three sons?", a: "Shem, Ham, and Japheth" },
      { q: "In what city did Abraham originally come from before God called him?", a: "Ur of the Chaldeans" }
    ],
    hard: [
      { q: "What is the name of the river that flowed out of Eden and divided into four heads?", a: "The river Pishon, Gihon, Tigris (Hiddekel), and Euphrates — all heads of one river from Eden" },
      { q: "What was Jacob's name changed to, and who changed it?", a: "Israel — changed by God/the Angel during his wrestling at Peniel (Genesis 32)" }
    ]
  },
  "Exodus": {
    easy: [
      { q: "Who led the Israelites out of Egypt?", a: "Moses" },
      { q: "What body of water did God part for Moses and the Israelites?", a: "The Red Sea" }
    ],
    medium: [
      { q: "What were the first three plagues God sent on Egypt?", a: "Water to blood, frogs, and lice (gnats)" },
      { q: "On what mountain did God give Moses the Ten Commandments?", a: "Mount Sinai (also called Horeb)" }
    ],
    hard: [
      { q: "What was the exact wood specified for building the Ark of the Covenant?", a: "Acacia (shittim) wood" },
      { q: "How many years did the Israelites dwell in Egypt according to Exodus 12:40?", a: "430 years" }
    ]
  },
  "Psalms": {
    easy: [
      { q: "Who is traditionally credited with writing most of the Psalms?", a: "King David" },
      { q: "What number is the Psalm that begins 'The Lord is my shepherd'?", a: "Psalm 23" }
    ],
    medium: [
      { q: "Which Psalm is often called the 'Great Hallel' and is the longest chapter in the Bible?", a: "Psalm 119" },
      { q: "What does the Hebrew word 'Selah' mean and where is it found in the Psalms?", a: "Its exact meaning is uncertain — likely a musical pause or instruction; found throughout the Psalms" }
    ],
    hard: [
      { q: "Psalm 22 begins with words Jesus quoted on the cross. What are those opening words?", a: "'My God, my God, why hast thou forsaken me?'" }
    ]
  },
  "Matthew": {
    easy: [
      { q: "In the Sermon on the Mount, Jesus said 'Blessed are the meek, for they shall…' — finish the verse.", a: "'…inherit the earth'" },
      { q: "How many disciples did Jesus call in the beginning of his ministry?", a: "12 disciples (apostles)" }
    ],
    medium: [
      { q: "What was Matthew's occupation before he followed Jesus?", a: "Tax collector (publican)" },
      { q: "In which city was Jesus born according to Matthew's Gospel?", a: "Bethlehem" }
    ],
    hard: [
      { q: "In Matthew 18, Jesus says to forgive not seven times but how many times?", a: "'Seventy times seven' (490 times) — emphasizing limitless forgiveness" },
      { q: "What is the full name of the field purchased with Judas' betrayal money?", a: "Akeldama — 'Field of Blood' (Acts 1:19), called 'potter's field' in Matthew 27:7–8)" }
    ]
  },
  "John": {
    easy: [
      { q: "What is the first verse of the Gospel of John?", a: "'In the beginning was the Word, and the Word was with God, and the Word was God.'" },
      { q: "What was Jesus' first recorded miracle in the Gospel of John?", a: "Turning water into wine at a wedding in Cana" }
    ],
    medium: [
      { q: "Who did Jesus raise from the dead in John chapter 11?", a: "Lazarus of Bethany" },
      { q: "In John 3:16, what does God give so that whoever believes will not perish?", a: "His only begotten Son" }
    ],
    hard: [
      { q: "What are the 'seven I AM' statements of Jesus in the Gospel of John?", a: "Bread of Life; Light of the World; Door/Gate; Good Shepherd; Resurrection and Life; Way, Truth, Life; True Vine" }
    ]
  },
  "Revelation": {
    easy: [
      { q: "Who wrote the Book of Revelation?", a: "John (the Apostle), on the island of Patmos" },
      { q: "How many churches does Jesus address in the letters of Revelation chapters 2–3?", a: "Seven churches" }
    ],
    medium: [
      { q: "What is the number of the beast mentioned in Revelation?", a: "666" },
      { q: "What are the four living creatures described around God's throne in Revelation 4?", a: "A lion, an ox (calf), a man (face), and an eagle" }
    ],
    hard: [
      { q: "What are the seven seals in Revelation, and what does opening the first four release?", a: "The Four Horsemen: Conquest (white), War (red), Famine (black), Death (pale)" }
    ]
  },
  "Acts": {
    easy: [
      { q: "What event is described at the beginning of Acts where the Holy Spirit descended?", a: "Pentecost — tongues of fire and wind" },
      { q: "Who was chosen to replace Judas Iscariot as the twelfth apostle?", a: "Matthias" }
    ],
    medium: [
      { q: "On the road to which city did Saul have his dramatic conversion experience?", a: "Damascus" },
      { q: "Who was the first Christian martyr, stoned to death, as described in Acts 7?", a: "Stephen" }
    ],
    hard: [
      { q: "In Acts 17, Paul addresses philosophers in Athens at a place called what?", a: "The Areopagus (Mars Hill)" }
    ]
  },
  "Proverbs": {
    easy: [
      { q: "According to Proverbs 1:7, what is the beginning of wisdom?", a: "'The fear of the LORD'" },
      { q: "Which king is most often associated with the Book of Proverbs?", a: "King Solomon" }
    ],
    medium: [
      { q: "Proverbs 31 describes a virtuous woman — what does it say her price is far above?", a: "Rubies" }
    ],
    hard: [
      { q: "Proverbs 8 personifies Wisdom speaking. What does Wisdom say existed before creation?", a: "Wisdom herself — 'I was set up from everlasting, before the earth was' (Proverbs 8:23)" }
    ]
  }
};

// Fallback questions when a book has no question bank
const FALLBACK_QUESTIONS = {
  easy:   [{ q: "Name one central theme of this Bible book.", a: "Varies — discuss with your group!" }],
  medium: [{ q: "Describe a key event or teaching found in this book.", a: "Varies — encourage discussion!" }],
  hard:   [{ q: "What is a lesser-known fact or detail from this Bible book?", a: "Research together as a group!" }]
};

// ============================================================
// STATE
// ============================================================
let state = {
  roomCode: null,
  role: null,           // 'leader' | 'participant'
  myName: null,
  players: {},          // { [name]: { score, isLeader } }
  currentQuestion: null,// { q, a, book, difficulty }
  usedQuestions: [],    // array of question texts to avoid repetition
  buzzer: null,         // name of player who buzzed in, or null
  timerValue: null,     // seconds remaining
  timerRunning: false,
  questionActive: false
};

let timerInterval = null;

// ============================================================
// LOBBY / ROLE SELECTION
// ============================================================

function selectRole(role) {
  document.getElementById('role-leader').classList.toggle('selected', role === 'leader');
  document.getElementById('role-participant').classList.toggle('selected', role === 'participant');
  document.getElementById('leader-setup').style.display      = role === 'leader'      ? 'block' : 'none';
  document.getElementById('participant-setup').style.display = role === 'participant' ? 'block' : 'none';
}

function generateRoomCode() {
  const words = ['FAITH','GRACE','TRUTH','LIGHT','PEACE','HOPE','LOVE','GLORY'];
  return words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(1000 + Math.random() * 9000);
}

function createRoom() {
  const name = document.getElementById('leader-name-input').value.trim();
  if (!name) { showToast('Please enter your name.'); return; }

  state.roomCode = generateRoomCode();
  state.role     = 'leader';
  state.myName   = name;
  state.players  = { [name]: { score: 0, isLeader: true } };

  // Populate book selector
  populateBookSelect();

  // Set invite link
  const link = buildInviteLink();
  document.getElementById('invite-link-box').value = link;
  document.getElementById('leader-room-code-display').textContent = state.roomCode;

  broadcastState();
  showScreen('screen-leader');
  showToast('Room created! Share the code: ' + state.roomCode);
}

function joinRoom() {
  const name = document.getElementById('participant-name-input').value.trim();
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!name) { showToast('Please enter your name.'); return; }
  if (!code) { showToast('Please enter the room code.'); return; }

  // Load existing state if present (simulates joining from another tab)
  const saved = loadStateFromStorage(code);
  if (saved) {
    state = saved;
  } else {
    // Create fresh if no existing room found
    state.roomCode = code;
  }

  state.role   = 'participant';
  state.myName = name;

  // Register player
  if (!state.players[name]) {
    state.players[name] = { score: 0, isLeader: false };
  }

  document.getElementById('participant-room-code-display').textContent = state.roomCode;
  document.getElementById('participant-name-display').textContent      = name;

  broadcastState();
  showScreen('screen-participant');
  renderParticipantView();
  showToast("Welcome" ,  + name + "! You've joined the room");
}

// Check if a room code is in the URL (e.g., ?room=FAITH-1234)
function checkURLForRoom() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('room');
  if (code) {
    document.getElementById('room-code-input').value = code.toUpperCase();
    selectRole('participant');
  }
}

// ============================================================
// BOOK SELECTOR
// ============================================================

function populateBookSelect() {
  const sel = document.getElementById('book-select');
  sel.innerHTML = '';
  BIBLE_BOOKS.forEach(book => {
    const opt = document.createElement('option');
    opt.value = book; opt.textContent = book;
    sel.appendChild(opt);
  });
}

// ============================================================
// QUESTION LOADING
// ============================================================

function loadQuestion() {
  const book       = document.getElementById('book-select').value;
  const difficulty = document.getElementById('difficulty-select').value;

  const pool = (QUESTION_BANK[book] && QUESTION_BANK[book][difficulty])
               ? QUESTION_BANK[book][difficulty]
               : FALLBACK_QUESTIONS[difficulty];

  // Filter out already-used questions
  const available = pool.filter(q => !state.usedQuestions.includes(q.q));

  if (available.length === 0) {
    showToast('All questions for this book/difficulty have been used! Try another combination.');
    return;
  }

  // Pick a random one
  const chosen = available[Math.floor(Math.random() * available.length)];
  state.usedQuestions.push(chosen.q);

  state.currentQuestion = { q: chosen.q, a: chosen.a, book, difficulty };
  state.buzzer          = null;
  state.timerValue      = null;
  state.timerRunning    = false;
  state.questionActive  = true;
  stopTimer();

  broadcastState();
  renderLeaderQuestion();
  resetBuzzerUI();
  showToast('New question loaded from ' + book + ' (' + difficulty + ')');
}

function renderLeaderQuestion() {
  const q = state.currentQuestion;
  if (!q) return;

  document.getElementById('leader-question-card').style.display = 'block';
  document.getElementById('leader-timer-card').style.display    = 'block';
  document.getElementById('leader-question-text').textContent   = q.q;
  document.getElementById('leader-answer-text').textContent     = q.a;

  const meta = document.getElementById('leader-question-meta');
  meta.innerHTML =
    `<span class="badge badge-gold">${q.book}</span>
     <span class="badge badge-${q.difficulty}">${q.difficulty.charAt(0).toUpperCase()+q.difficulty.slice(1)}</span>`;
}

// ============================================================
// BUZZ IN LOGIC
// ============================================================

function buzzIn() {
  if (state.buzzer) return;          // someone already buzzed
  if (!state.questionActive) return; // no question loaded

  state.buzzer = state.myName;
  state.timerValue   = 10;  // 10-second countdown
  state.timerRunning = true;

  broadcastState();
  renderParticipantView();
  startTimer();
}

function resetBuzzer() {
  state.buzzer       = null;
  state.timerValue   = null;
  state.timerRunning = false;
  stopTimer();
  broadcastState();
  renderLeaderView();
  showToast('Buzz reset — all players can now buzz in.');
}

function resetBuzzerUI() {
  document.getElementById('leader-timer').textContent     = '—';
  document.getElementById('leader-buzzer-status').textContent = 'Waiting for a buzz…';
}

// ============================================================
// TIMER
// ============================================================

function startTimer() {
  stopTimer();
  renderTimer();
  timerInterval = setInterval(() => {
    if (state.timerValue > 0) {
      state.timerValue--;
      broadcastState();
      renderTimer();
    }
    else {
  stopTimer();
  showToast("Time's up!");

    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function addTime(seconds) {
  if (state.timerValue === null) return;
  state.timerValue = (state.timerValue || 0) + seconds;
  broadcastState();
  renderTimer();
  showToast(`+${seconds}s added to timer`);
}

function renderTimer() {
  const val = state.timerValue;
  const display = val === null ? '—' : String(val).padStart(2, '0');
  const urgent  = val !== null && val <= 5;

  // Leader timer
  const lt = document.getElementById('leader-timer');
  if (lt) {
    lt.textContent = display;
    lt.classList.toggle('urgent', urgent);
  }

  // Participant timer
  const pt = document.getElementById('participant-timer');
  if (pt) {
    pt.textContent = display;
    pt.classList.toggle('urgent', urgent);
  }
}

// ============================================================
// SCORING
// ============================================================

function awardPoints(pts) {
  if (!state.buzzer) { showToast('No player has buzzed in yet.'); return; }
  const player = state.buzzer;
  if (!state.players[player]) state.players[player] = { score: 0 };
  state.players[player].score += pts;

  const label = pts >= 0 ? `+${pts}` : `${pts}`;
  showToast(`${label} points to ${player}!`);
  broadcastState();
  renderScoreboard('leader');
}

// ============================================================
// RENDERING — LEADER VIEW
// ============================================================

function renderLeaderView() {
  renderScoreboard('leader');
  renderLeaderQuestion();
  renderTimer();

  const statusEl = document.getElementById('leader-buzzer-status');
  if (state.buzzer && statusEl) {
    statusEl.innerHTML = `🔔 <strong style="color:var(--gold)">${state.buzzer}</strong> buzzed in!`;
  } else if (statusEl) {
    statusEl.textContent = 'Waiting for a buzz…';
  }
}

// ============================================================
// RENDERING — PARTICIPANT VIEW
// ============================================================

function renderParticipantView() {
  const q = state.currentQuestion;
  const waitingCard   = document.getElementById('participant-waiting-card');
  const questionCard  = document.getElementById('participant-question-card');
  const buzzZone      = document.getElementById('participant-buzz-zone');
  const timerCard     = document.getElementById('participant-timer-card');
  const buzzBtn       = document.getElementById('buzz-btn');
  const buzzStatus    = document.getElementById('buzz-status-text');
  const banner        = document.getElementById('participant-buzzer-banner');

  if (!q) {
    waitingCard.style.display  = 'block';
    questionCard.style.display = 'none';
    buzzZone.style.display     = 'none';
    timerCard.style.display    = 'none';
    banner.classList.remove('active');
    return;
  }

  // Show question (without book/difficulty)
  waitingCard.style.display  = 'none';
  questionCard.style.display = 'block';
  buzzZone.style.display     = 'flex';

  document.getElementById('participant-question-text').textContent = q.q;
  document.getElementById('participant-question-meta').innerHTML   = '';

  // Buzz button state
  if (state.buzzer === state.myName) {
    // I buzzed in
    buzzBtn.disabled = false;
    buzzBtn.classList.add('buzzed-in');
    buzzBtn.textContent  = '🎉 BUZZED!';
    buzzStatus.textContent = 'You buzzed in! Answer now!';
    banner.textContent     = '🔔 You buzzed in! Answer the question!';
    banner.classList.add('active');
    timerCard.style.display = 'block';
    renderTimer();
  } else if (state.buzzer) {
    // Someone else buzzed in
    buzzBtn.disabled = true;
    buzzBtn.classList.remove('buzzed-in');
    buzzBtn.textContent    = 'BUZZ!';
    buzzStatus.textContent = state.buzzer + ' buzzed in first!';
    banner.textContent     = `⚡ ${state.buzzer} buzzed in first!`;
    banner.classList.add('active');
    timerCard.style.display = 'block';
    renderTimer();
  } else {
    // No buzz yet
    buzzBtn.disabled = false;
    buzzBtn.classList.remove('buzzed-in');
    buzzBtn.textContent    = 'BUZZ!';
    buzzStatus.textContent = 'Press when you know the answer!';
    banner.classList.remove('active');
    timerCard.style.display = 'none';
  }

  renderScoreboard('participant');
}

// ============================================================
// SCOREBOARD RENDERING (shared)
// ============================================================

function renderScoreboard(who) {
  const listId = who === 'leader' ? 'leader-player-list' : 'participant-player-list';
  const list   = document.getElementById(listId);
  if (!list) return;

  const sorted = Object.entries(state.players)
    .sort(([,a],[,b]) => b.score - a.score);

  if (sorted.length === 0) {
    list.innerHTML = '<li class="player-item"><span class="dim text-sm" style="width:100%;text-align:center">No players yet</span></li>';
    return;
  }

  list.innerHTML = sorted.map(([name, data]) => {
    const initials  = name.slice(0,2).toUpperCase();
    const isBuzzer  = state.buzzer === name;
    const isLeader  = data.isLeader;
    return `
      <li class="player-item ${isBuzzer ? 'buzzer' : ''}">
        <div class="player-avatar">${initials}</div>
        <div class="player-name">
          ${name}
          ${isLeader ? '<span class="player-role-badge">Leader</span>' : ''}
          ${isBuzzer ? ' 🔔' : ''}
        </div>
        ${who === 'leader' ? `
          <button class="btn btn-success btn-sm" onclick="manualAward('${name}', 100)">+100</button>
          <button class="btn btn-danger  btn-sm" onclick="manualAward('${name}', -50)">−50</button>
        ` : ''}
        <div class="player-score">${data.score}</div>
      </li>`;
  }).join('');
}

function manualAward(name, pts) {
  if (!state.players[name]) return;
  state.players[name].score += pts;
  broadcastState();
  renderLeaderView();
  showToast(`${pts >= 0 ? '+' : ''}${pts} pts to ${name}`);
}

// ============================================================
// INVITE LINK
// ============================================================

function buildInviteLink() {
  const base = window.location.href.split('?')[0];
  return `${base}?room=${state.roomCode}`;
}

function copyRoomLink() {
  const link = buildInviteLink();
  navigator.clipboard.writeText(link).then(() => showToast('Invite link copied to clipboard!')).catch(() => {
    // Fallback for browsers that block clipboard
    document.getElementById('invite-link-box').select();
    document.execCommand('copy');
    showToast('Invite link copied!');
  });
}

function shareWhatsApp() {
  /* NOTE: In production, this opens WhatsApp with a pre-filled message.
     Replace the link with your deployed game URL. */
  const link = buildInviteLink();
  const text = encodeURIComponent(
    `🕊️ You're invited to play Scripture Challenge!\n\nRoom Code: ${state.roomCode}\nJoin here: ${link}`
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

// ============================================================
// STATE BROADCAST (localStorage-based simulation)
// ============================================================

const STORAGE_KEY_PREFIX = 'scripture_game_';

function broadcastState() {
  if (!state.roomCode) return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + state.roomCode, JSON.stringify(state));
    // Trigger storage event in other tabs
    localStorage.setItem(STORAGE_KEY_PREFIX + '_ping', Date.now());
  } catch(e) { /* storage quota */ }
}

function loadStateFromStorage(code) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + code);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

/* Listen for changes from other tabs (simulated real-time) */
window.addEventListener('storage', (e) => {
  if (!state.roomCode) return;
  if (e.key === STORAGE_KEY_PREFIX + state.roomCode) {
    try {
      const newState = JSON.parse(e.newValue);
      if (!newState) return;

      const wasTimerRunning  = state.timerRunning;
      const prevTimerValue   = state.timerValue;
      const prevBuzzer       = state.buzzer;

      // Merge incoming state (preserve local role/name)
      const myRole = state.role;
      const myName = state.myName;
      state = { ...newState, role: myRole, myName };

      // Handle timer sync
      if (state.timerRunning && !wasTimerRunning) {
        startTimer();
      } else if (!state.timerRunning && wasTimerRunning) {
        stopTimer();
      }

      // If buzzer changed, update view
      if (myRole === 'leader') {
        renderLeaderView();
      } else {
        renderParticipantView();
        // Notify if someone buzzed
        if (state.buzzer && state.buzzer !== prevBuzzer) {
          showToast('🔔 ' + state.buzzer + ' buzzed in!');
        }
      }
    } catch(e) { /* parse error */ }
  }
});

// ============================================================
// SCREEN NAVIGATION
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  checkURLForRoom();
});
