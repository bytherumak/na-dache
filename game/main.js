import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';

/* Модели: в одиночной сборке (dist/index.html) лежат внутри файла (window.EMBED), при разработке берутся из assets/ */
const asset = n => (window.EMBED && window.EMBED[n]) || `./assets/${n}.glb`;

/* ================= Настройки и данные ================= */
const FACE_OFFSET = Math.PI;   // поворот модели, если она смотрит не вперёд (лицо у модели смотрит в -Z, а вперёд при ходьбе +Z)
const CHAR_HEIGHT = 2.4;
const YARD = 19;                // половина размера двора
const WOOD = new THREE.Vector3(-15, 0, -15);   // поленница (ветки)
const BOX = new THREE.Vector3(15, 0, -15);     // коробка (листья)
const TREE = new THREE.Vector3(0, 0, 0);       // дерево силы
const DROP_R = 3.6;

/* Места сдачи. Коробка и поленница стоят всегда, остальные появляются, когда нужны работе. */
const DROPS = {
  box:     { pos: BOX,  name: 'в коробку (справа сзади)' },
  wood:    { pos: WOOD, name: 'на поленницу (слева сзади)' },
  compost: { pos: new THREE.Vector3(-16, 0, 9),  name: 'в компостную кучу (слева)' },
  crate:   { pos: new THREE.Vector3(16, 0, 9),   name: 'в ящик (справа)' },
  barrel:  { pos: new THREE.Vector3(0, 0, -16),  name: 'в бочку (у дома)' },
};
const DROP_NAME = Object.fromEntries(Object.entries(DROPS).map(([k, v]) => [k, v.name]));

/* Работы. mech: 'sweep' (метёшь всё вокруг, как листья) или 'hold' (встал у предмета и держишь, как ветки).
   col: цвет того, что убираешь (им же краснеет рюкзак). spiders: прячутся ли под этим паучки. help: сколько несёт помощник и сколько возится. */
const JOBS = {
  leaves:   { name: 'Убрать листья',     icon: '🍂', tools: ['broom', 'rake', 'wrake'],            drop: 'box',  boss: 'Листовой Пугало', unlock: 1, mech: 'sweep', col: 0xd9822b, item: 'leaf', spiders: true, help: { cap: 25, time: 0.25 },
            hint: 'Держи ПРОБЕЛ у листьев, потом неси их в коробку справа сзади (жёлтое кольцо). Shift: бег' },
  branches: { name: 'Пилить ветки',      icon: '🪵', tools: ['saw', 'lsaw', 'tsaw', 'chain'],      drop: 'wood', boss: 'Дровосек-Болван', unlock: 2, mech: 'hold',  col: 0x8a5a30, item: 'log', spiders: true, help: { cap: 1, time: 2.8 }, word: 'Бревно',
            hint: 'Встань у ветки и держи ПРОБЕЛ: распилишь. Бревно неси на поленницу слева сзади. Shift: бег' },
  pile:     { name: 'Листья в коробку',  icon: '📦', tools: ['scoop', 'shovel', 'bucket'],         drop: 'box',  boss: 'Куча-Великан',    unlock: 3, mech: 'hold',  col: 0xc0592b, item: 'heap', spiders: true, fly: true, help: { cap: 2, time: 1.4 }, word: 'Полный совок',
            hint: 'Подбирай кучки листьев совком (ПРОБЕЛ) и неси в коробку справа сзади. Shift: бег' },
};

/* Новые профессии: по три в каждой главе (сезоне), открываются с 4-го уровня главы.
   [id, название, значок, с какого уровня, mech, куда сдавать, цвет, предмет, имя босса, подсказка, [[инструмент, значок, вид, размер], ×3]] */
const NEW_JOBS = [
  ['grass', 'Косить траву', '🌿', 11, 'sweep', 'compost', 0x5fae3a, 'grass', 'Зелёный Колосок', 'косишь траву', [['Серп', '🌾', 'blade', 1], ['Коса', '🌾', 'blade', 1.5], ['Газонокосилка', '⚙️', 'mower', 1]]],
  ['apples', 'Собрать яблоки', '🍎', 12, 'hold', 'crate', 0xd63a2f, 'apple', 'Яблочный Гигант', 'собираешь яблоки', [['Корзинка', '🧺', 'basket', 1], ['Плодосъёмник', '🪝', 'hook', 1.2], ['Садовая тележка', '🛒', 'basket', 1.7]]],
  ['weeds', 'Полоть сорняки', '🌱', 13, 'hold', 'compost', 0x4e8f2e, 'weed', 'Король Сорняков', 'полешь грядки', [['Тяпка', '🪴', 'hoe', 1], ['Большая тяпка', '🪴', 'hoe', 1.4], ['Культиватор', '⚙️', 'hoe', 1.9]]],
  ['acorns', 'Собрать жёлуди', '🌰', 21, 'sweep', 'crate', 0x8a5a2b, 'acorn', 'Дуб-Дубина', 'сгребаешь жёлуди', [['Грабельки', '🔱', 'rake', 0.75], ['Садовые грабли', '🔱', 'rake', 1], ['Желудёвый ролик', '🧲', 'rake', 1.35]]],
  ['mush', 'Собрать грибы', '🍄', 22, 'hold', 'crate', 0xe8d8c0, 'mushroom', 'Мухомор-Задира', 'ищешь грибы', [['Грибной нож', '🔪', 'hook', 0.8], ['Корзина грибника', '🧺', 'basket', 1.2], ['Большой короб', '🧺', 'basket', 1.8]]],
  ['stones', 'Убрать камни', '🪨', 23, 'hold', 'barrel', 0x8c8f94, 'stone', 'Каменный Бык', 'убираешь камни', [['Лом', '⛏️', 'hook', 1], ['Кирка', '⛏️', 'hook', 1.4], ['Тачка', '🛒', 'basket', 1.9]]],
  ['pumpkins', 'Собрать тыквы', '🎃', 31, 'hold', 'crate', 0xf08a1c, 'pumpkin', 'Тыквоголовый', 'собираешь тыквы', [['Садовый нож', '🔪', 'blade', 0.8], ['Тележка', '🛒', 'basket', 1.5], ['Подъёмник', '🏗️', 'hook', 1.8]]],
  ['trash', 'Собрать мусор', '🗑️', 32, 'sweep', 'barrel', 0x7d8a95, 'trash', 'Мусорный Монстр', 'убираешь мусор', [['Щётка', '🧹', 'broom', 1], ['Совок-щётка', '🧹', 'rake', 0.9], ['Мусоросборник', '⚙️', 'mower', 1]]],
  ['webs', 'Снять паутину', '🕸️', 33, 'sweep', 'compost', 0xe6e6ee, 'web', 'Паучья Королева', 'снимаешь паутину', [['Метёлка', '🪶', 'broom', 0.9], ['Длинная метёлка', '🪶', 'broom', 1.5], ['Пылесос', '⚙️', 'chain', 1]]],
  ['snow', 'Чистить снег', '❄️', 41, 'sweep', 'barrel', 0xeaf4ff, 'snow', 'Снеговик-Великан', 'чистишь снег', [['Лопата для снега', '🥄', 'scoop', 1], ['Широкая лопата', '🥄', 'scoop', 1.5], ['Снегоуборщик', '⚙️', 'mower', 1.2]]],
  ['potato', 'Копать картошку', '🥔', 42, 'hold', 'crate', 0xc9a45c, 'potato', 'Картофельный Голем', 'копаешь картошку', [['Вилы', '🔱', 'hook', 1], ['Лопата-штык', '🥄', 'scoop', 1.3], ['Картофелекопалка', '⚙️', 'mower', 1.4]]],
  ['berries', 'Собрать ягоды', '🫐', 51, 'hold', 'crate', 0x5b4ac7, 'berry', 'Ягодный Хулиган', 'собираешь ягоды', [['Лукошко', '🧺', 'basket', 0.9], ['Ягодный совок', '🥄', 'scoop', 1.1], ['Ягодоуборщик', '⚙️', 'mower', 1.2]]],
  ['carrots', 'Дёргать морковку', '🥕', 52, 'hold', 'compost', 0xef7d1a, 'carrot', 'Морковный Кролик', 'дёргаешь морковку', [['Мотыжка', '🪴', 'hoe', 0.9], ['Копалка', '🔱', 'hook', 1.2], ['Овощной комбайн', '⚙️', 'mower', 1.3]]],
  ['hay', 'Собрать сено', '🌾', 53, 'sweep', 'compost', 0xe3c35a, 'hay', 'Сенной Великан', 'сгребаешь сено', [['Деревянные грабли', '🔱', 'rake', 0.9], ['Сенные вилы', '🔱', 'rake', 1.2], ['Сенокосилка', '⚙️', 'mower', 1.2]]],
  ['sunflower', 'Срезать подсолнухи', '🌻', 43,'hold', 'compost', 0xf2c21b, 'sunflower', 'Подсолнух-Громила', 'срезаешь подсолнухи', [['Секатор', '✂️', 'blade', 0.8], ['Садовые ножницы', '✂️', 'blade', 1.2], ['Мотокоса', '⚙️', 'chain', 1.3]]],
];

/* Инструменты. price = цена в листочках (0: есть сразу). cap = сколько несёшь за раз, capStep = прибавка вместимости от улучшения.
   Листья: reach/rate/n (охват, пауза между взмахами, сколько листьев за взмах). Ветки и кучки: range/time (дальность, секунды работы). */
const TOOLS = {
  broom:  { job: 'leaves',   name: 'Веник',            icon: '🧹', price: 0,  cap: 20, capStep: 8,  reach: 1.4, rate: 0.06, n: 3, look: 'broom', scale: 1 },
  rake:   { job: 'leaves',   name: 'Грабли',           icon: '🔱', price: 15, cap: 30, capStep: 10, reach: 2.0, rate: 0.07, n: 6, look: 'rake',  scale: 1 },
  wrake:  { job: 'leaves',   name: 'Веерные грабли',   icon: '🪭', price: 45, cap: 45, capStep: 12, reach: 2.8, rate: 0.06, n: 9, look: 'rake',  scale: 1.35 },
  saw:    { job: 'branches', name: 'Пила',             icon: '🪚', price: 0,  cap: 1,  capStep: 1,  range: 2.4, time: 1.3, look: 'saw', scale: 1 },
  lsaw:   { job: 'branches', name: 'Длинная пила',     icon: '🪚', price: 15, cap: 2,  capStep: 1,  range: 3.0, time: 1.0, look: 'saw', scale: 1.5 },
  tsaw:   { job: 'branches', name: 'Двуручная пила',   icon: '🪚', price: 40, cap: 3,  capStep: 1,  range: 3.2, time: 0.7, look: 'saw', scale: 2 },
  chain:  { job: 'branches', name: 'Бензопила',        icon: '⚙️', price: 80, cap: 4,  capStep: 1,  range: 3.4, time: 0.4, look: 'chain', scale: 1 },
  scoop:  { job: 'pile',     name: 'Совок',            icon: '🥄', price: 0,  cap: 3,  capStep: 1,  range: 2.0, time: 0.6, look: 'scoop', scale: 1 },
  shovel: { job: 'pile',     name: 'Большой совок',    icon: '🥄', price: 15, cap: 5,  capStep: 1,  range: 2.5, time: 0.5, look: 'scoop', scale: 1.4 },
  bucket: { job: 'pile',     name: 'Ковш-лопата',      icon: '🪣', price: 45, cap: 8,  capStep: 2,  range: 3.0, time: 0.35, look: 'scoop', scale: 1.8 },
};
/* Собираем новые работы и по три инструмента к каждой. Цифры инструментов берутся по типу работы, цена растёт с главой. */
{
  const SWEEP = [{ cap: 20, capStep: 8, reach: 1.4, rate: 0.06, n: 3 }, { cap: 30, capStep: 10, reach: 2.0, rate: 0.07, n: 6 }, { cap: 45, capStep: 12, reach: 2.8, rate: 0.06, n: 9 }];
  const HOLD = [{ cap: 3, capStep: 1, range: 2.0, time: 0.6 }, { cap: 5, capStep: 1, range: 2.5, time: 0.5 }, { cap: 8, capStep: 2, range: 3.0, time: 0.35 }];
  for (const [id, name, icon, unlock, mech, drop, col, item, boss, doing, tl] of NEW_JOBS) {
    const ch = Math.ceil(unlock / 10), ids = [];
    tl.forEach(([tn, ti, look, scale], k) => {
      const tid = `${id}${k + 1}`; ids.push(tid);
      TOOLS[tid] = { job: id, name: tn, icon: ti, price: [0, 15, 45][k] * (1 + 0.5 * (ch - 1)) | 0, ...(mech === 'sweep' ? SWEEP : HOLD)[k], look, scale, tint: col };
    });
    JOBS[id] = { name, icon, tools: ids, drop, boss, unlock, mech, col, item, spiders: true, fly: true, help: mech === 'sweep' ? { cap: 25, time: 0.25 } : { cap: 2, time: 1.4 }, word: 'Полная ноша',
                 hint: `Ты ${doing}: держи ПРОБЕЛ ${mech === 'sweep' ? 'и води инструментом по двору' : 'у предмета'}, потом неси ${DROP_NAME[drop]}. Shift: бег` };
  }
}
const MODS = [{ rm: 0.25 }, { sm: 0.25 }, { cap: 1 }, { da: 0.5 }, { mm: 0.12 }];
const MOD_DESC = ['Больше охват +25%', 'Работает быстрее +25%', 'Несёт больше', 'Сильнее бьёт босса +0.5', 'Быстрее ходит с ношей +12%'];
const EFFECT_NAMES = {
  leaves: ['Густые зубья', 'Лёгкая ручка', 'Большой мешок', 'Жёсткая щетина', 'Удобный ремень'],
  branches: ['Длинное полотно', 'Острые зубья', 'Вторая рука', 'Закалённая сталь', 'Лёгкая пила'],
  pile: ['Широкий край', 'Ловкий захват', 'Глубокий кузов', 'Железный край', 'Лёгкая ручка'],
};
const EFFECTS = {};
const effNames = job => EFFECT_NAMES[job] || EFFECT_NAMES[JOBS[job].mech === 'sweep' ? 'leaves' : 'pile'];
for (const [t, T] of Object.entries(TOOLS)) EFFECTS[t] = effNames(T.job).map((name, i) => ({ name, desc: MOD_DESC[i], mod: MODS[i] }));

/* Оружие против босса: у каждой работы своё. Появляется у дерева, когда выходит босс; рабочий инструмент приходится оставить.
   Бьёт на среднюю дистанцию: босс может достать, но редко (дальше обычных инструментов, но не издалека). */
const BOSS_RANGE = 2.8, BOSS_DMG = 2, BOSS_CD = 0.5;
const BOSS_W = {};
{
  const T = {
    leaves: ['Боевая метла', '🧹', 'spear'], branches: ['Секира лесоруба', '🪓', 'axe'], pile: ['Совок-булава', '🔨', 'club'],
    grass: ['Боевая коса', '🌾', 'axe'], apples: ['Яблочная булава', '🍎', 'club'], weeds: ['Тяпка-алебарда', '🪴', 'spear'],
    acorns: ['Жёлудёвая палица', '🌰', 'club'], mush: ['Грибной посох', '🍄', 'spear'], stones: ['Кувалда', '🔨', 'club'],
    pumpkins: ['Тыквенная палица', '🎃', 'club'], trash: ['Мусорное копьё', '🗑️', 'spear'], webs: ['Паутинная пика', '🕸️', 'spear'],
    snow: ['Ледяной топор', '❄️', 'axe'], potato: ['Картофельная булава', '🥔', 'club'], sunflower: ['Подсолнуховый посох', '🌻', 'spear'],
    berries: ['Ягодная булава', '🫐', 'club'], carrots: ['Морковное копьё', '🥕', 'spear'], hay: ['Сенная секира', '🌾', 'axe'],
  };
  for (const id of Object.keys(JOBS)) { const [name, icon, look] = T[id] || ['Боевая палка', '🪵', 'club']; BOSS_W['bw_' + id] = { job: id, name, icon, look, scale: 1, tint: JOBS[id].col, boss: true }; }
}

const ABIL = {
  walk:   { name: 'Быстрая ходьба',    icon: '🚶', desc: '+8% к скорости ходьбы',    max: 5 },
  run:    { name: 'Быстрый бег',       icon: '🏃', desc: '+10% к скорости бега',     max: 5 },
  dmg:    { name: 'Сила удара',        icon: '💪', desc: '+0.5 урона боссу',         max: 5 },
  hearts: { name: 'Выносливость',      icon: '❤️', desc: '+1 сердце',                max: 3 },
  work:   { name: 'Ловкие руки',       icon: '⚡', desc: '+10% к скорости работы',   max: 5 },
  carry:  { name: 'Сильная спина',     icon: '🎒', desc: '+15% к тому, сколько несёшь', max: 5 },
};
const EFFECT_COST = 3, TREE_COST = [15, 25], WORKSHOP_COST = 40, ABIL_UNLOCK = 10;
const abilCost = lv => 6 + 3 * lv;
const COIN = '🍂';

/* Уровни бесконечные. Сезон = 10 уровней. Босс на 20, 30, 40... 10-й уровень: большая уборка без боя. */
const SEASON = 10;
const SPIDER_SEASON = 3;   // с какой главы (сезона) под листьями прячутся паучки
function levelDef(n) {
  const finale = n % SEASON === 0;
  return {
    n, season: Math.ceil(n / SEASON), finale, boss: finale && n >= 20,
    jobs: Object.keys(JOBS).filter(id => JOBS[id].unlock <= n),   // работы открываются по уровням: 1, 2, 3, а потом по три новых в каждой главе (с её 4-го уровня)
    hp: 16 + Math.round(n * 0.9), speed: Math.min(4, 1.9 + n * 0.05), shoots: true,
  };
}
const totalFor = (job, n) => {
  const m = Math.min(n, 40), k = n % SEASON === 0 ? 1.15 : 1;
  const base = { leaves: 70 + 8 * m, branches: 3 + Math.ceil(m / 2), pile: 8 + Math.ceil(m / 2) }[job] ?? (JOBS[job].mech === 'sweep' ? 60 + 6 * m : 7 + Math.ceil(m / 2));
  return Math.round(k * base);
};

/* ================= Сохранение ================= */
const DEF = { maxLevel: 1, coins: 0, tools: ['broom', 'saw', 'scoop'], placed: [], owned: {}, on: {}, treeLvl: 0, workshop: false, abil: {}, helpers: 0 };
let save = JSON.parse(JSON.stringify(DEF));
/* Профили: на одном устройстве можно держать несколько сохранений. Перенос между устройствами: код или ссылка. */
const PKEY = 'na-dache-profiles';
const saveKey = id => id === 'p1' ? 'na-dache-save' : 'na-dache-save-' + id;   // первый профиль живёт в старом ключе, прогресс не теряется
let profiles = { cur: 'p1', list: [{ id: 'p1', name: 'Игрок 1' }] };
try { const p = JSON.parse(localStorage.getItem(PKEY)); if (p && Array.isArray(p.list) && p.list.length) profiles = p; } catch (e) {}
if (!profiles.list.some(p => p.id === profiles.cur)) profiles.cur = profiles.list[0].id;
const saveProfiles = () => { try { localStorage.setItem(PKEY, JSON.stringify(profiles)); } catch (e) {} };
const encodeSave = (name, s) => 'ND1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ name, s })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function decodeSave(text) {
  try {
    const i = String(text).indexOf('ND1.'); if (i < 0) return null;
    let b = text.slice(i + 4).replace(/[^A-Za-z0-9_-]/g, '').replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    const o = JSON.parse(decodeURIComponent(escape(atob(b))));
    return o && o.s && +o.s.maxLevel > 0 ? o : null;
  } catch (e) { return null; }
}
function addProfile(name, s) {
  const id = 'p' + Date.now().toString(36);
  let nm = String(name || 'Игрок').slice(0, 13), k = 1; const base = nm;
  while (profiles.list.some(p => p.name === nm)) nm = `${base} (${++k})`;
  profiles.list.push({ id, name: nm }); profiles.cur = id;
  if (s) try { localStorage.setItem(saveKey(id), JSON.stringify(s)); } catch (e) {}
  saveProfiles(); return id;
}
{   // ссылка переноса: открыли на другом устройстве, и сохранение само предлагает добавиться
  const o = decodeSave(location.hash.slice(1));
  if (o) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (confirm(`Загрузить сохранение «${o.name || 'Игрок'}» (уровень ${o.s.maxLevel}) как новый профиль?`)) addProfile(o.name, o.s);
  }
}
try {
  const s = JSON.parse(localStorage.getItem(saveKey(profiles.cur)));
  if (s && s.maxLevel) {
    save = { ...save, ...s };
    if (s.points && s.coins === undefined) save.coins = s.points * 5;   // старое сохранение
    delete save.points;
    save.placed = (save.placed || []).filter(t => TOOLS[t]);            // убрать несуществующие инструменты
  }
} catch (e) {}
const persist = () => { try { localStorage.setItem(saveKey(profiles.cur), JSON.stringify(save)); } catch (e) {} };
/* Первый (бесплатный) инструмент каждой открытой работы выдаётся сам */
function grantFreeTools() {
  for (const [t, T] of Object.entries(TOOLS)) if (T.price === 0 && JOBS[T.job].unlock <= save.maxLevel && !save.tools.includes(t)) save.tools.push(t);
}
grantFreeTools();

const toolActive = t => save.placed.includes(t) || save.workshop;
const slots = () => 3 + save.treeLvl;
const ownedTotal = () => Object.values(save.owned).reduce((a, l) => a + l.length, 0);
function stats(t) {
  const T = t ? TOOLS[t] : { cap: 0, capStep: 0 }, s = { rm: 1, sm: 1, cap: T.cap, mm: 1, da: 0 };   // t = null: голые руки
  if (toolActive(t)) for (const i of save.owned[t] || []) {
    if ((save.on[t] || {})[i] === false) continue;
    const m = EFFECTS[t][i].mod;
    s.rm += m.rm || 0; s.sm += m.sm || 0; s.mm += m.mm || 0; s.da += m.da || 0; s.cap += (m.cap || 0) * T.capStep;
  }
  const A = save.abil;
  s.sm *= 1 + 0.1 * (A.work || 0); s.cap = Math.round(s.cap * (1 + 0.15 * (A.carry || 0))); s.da += 0.5 * (A.dmg || 0);
  return s;
}

/* ================= Сцена ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3f3);
scene.fog = new THREE.Fog(0xbfe3f3, 38, 80);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a5b, 1.5));
const sun = new THREE.DirectionalLight(0xfff1d0, 2.2);
sun.position.set(14, 26, 10);
sun.castShadow = true;
const TOUCH_AT_START = matchMedia('(pointer: coarse)').matches;
sun.shadow.mapSize.set(TOUCH_AT_START ? 1024 : 2048, TOUCH_AT_START ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 70 });
sun.shadow.bias = -0.0005;
scene.add(sun);

let RNG = Math.random;   // на время раскладки уровня подменяется на предсказуемый (от seed), чтобы у всех в комнате двор был одинаковый
const seeded = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd = (a, b) => a + RNG() * (b - a);
const pick = a => a[Math.floor(RNG() * a.length)];
const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...extra });
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function mesh(geo, m, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; return o;
}
const logMat = mat(0x8a5a30), logEnd = mat(0xd9b27a);
const leafCols = [0xd9822b, 0xc0392b, 0xe8b923, 0x9b5d2e, 0xcf6a1f];
function makeLog(len = 1.2, r = 0.2) {
  const g = new THREE.Group();
  const c = mesh(new THREE.CylinderGeometry(r, r, len, 8), logMat); c.rotation.z = Math.PI / 2; g.add(c);
  for (const s of [-1, 1]) { const e = mesh(new THREE.CircleGeometry(r * 0.95, 8), logEnd, s * (len / 2 + 0.005), 0, 0, false); e.rotation.y = s * Math.PI / 2; g.add(e); }
  return g;
}

/* Двор */
const world = new THREE.Group(); scene.add(world);
let boxFill, treeGroup, dropRing;
const dropFill = {}, dropGroups = {};   // «наполнение» мест сдачи и их модели
{
  const ground = mesh(new THREE.PlaneGeometry(200, 200), mat(0x8fbf5a), 0, 0, 0, false);
  ground.rotation.x = -Math.PI / 2; world.add(ground);
  for (let i = -9; i < 9; i++) for (let j = -9; j < 9; j++) if ((i + j) % 2 === 0) {
    const t = mesh(new THREE.PlaneGeometry(2.2, 2.2), mat(0x84b552), i * 2.2 + 1.1, 0.005, j * 2.2 + 1.1, false);
    t.rotation.x = -Math.PI / 2; world.add(t);
  }
  const path = mesh(new THREE.PlaneGeometry(3, 22), mat(0xd8c49a), 0, 0.01, 8, false);
  path.rotation.x = -Math.PI / 2; world.add(path);
  const fm = mat(0xb98a5a);
  for (let i = -20; i <= 20; i += 1.2) for (const [x, z] of [[i, -20.5], [i, 20.5], [-20.5, i], [20.5, i]]) {
    if (Math.abs(i) < 2 && z === 20.5) continue;
    world.add(mesh(new THREE.BoxGeometry(0.5, 1.4, 0.2), fm, x, 0.7, z));
  }
  const house = new THREE.Group();
  house.add(mesh(new THREE.BoxGeometry(14, 6, 8), mat(0xe9d5a8), 0, 3, 0));
  const roof = mesh(new THREE.ConeGeometry(11, 4, 4), mat(0xb5523b), 0, 8, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.8; house.add(roof);
  house.add(mesh(new THREE.BoxGeometry(1.6, 3, 0.2), mat(0x7a4a2a), 0, 1.5, 4.05));
  for (const x of [-4, 4]) house.add(mesh(new THREE.BoxGeometry(2, 2, 0.2), mat(0x9fd3ea), x, 3.4, 4.05));
  house.position.set(0, 0, -28); world.add(house);
  const tm = mat(0x6b4a2b), cols = [0xd9822b, 0xc65a2b, 0xe8b923, 0x7fae4a];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, x = Math.cos(a) * rnd(26, 33), z = Math.sin(a) * rnd(26, 33);
    if (z < -22 && Math.abs(x) < 10) continue;
    const t = new THREE.Group();
    t.add(mesh(new THREE.CylinderGeometry(0.4, 0.6, 4, 7), tm, 0, 2, 0));
    const c = mat(pick(cols));
    for (let k = 0; k < 3; k++) t.add(mesh(new THREE.IcosahedronGeometry(rnd(2, 3), 1), c, rnd(-1, 1), 4.5 + k * 0.6, rnd(-1, 1)));
    t.position.set(x, 0, z); world.add(t);
  }
  // поленница (настил)
  const wp = new THREE.Group(); wp.position.copy(WOOD);
  wp.add(mesh(new THREE.BoxGeometry(5, 0.1, 5), mat(0xa88a5e), 0, 0.05, 0, false));
  const post = mat(0x7a4a2a);
  for (const x of [-2.6, 2.6]) wp.add(mesh(new THREE.BoxGeometry(0.25, 2.2, 0.25), post, x, 1.1, -1.8));
  world.add(wp);
  // деревянная коробка для листьев
  const bx = new THREE.Group(); bx.position.copy(BOX);
  const wood = mat(0xb9824a);
  bx.add(mesh(new THREE.BoxGeometry(4.4, 0.2, 3.4), mat(0x8a5a30), 0, 0.1, 0));
  bx.add(mesh(new THREE.BoxGeometry(4.4, 1.3, 0.2), wood, 0, 0.75, 1.6));
  bx.add(mesh(new THREE.BoxGeometry(4.4, 1.3, 0.2), wood, 0, 0.75, -1.6));
  bx.add(mesh(new THREE.BoxGeometry(0.2, 1.3, 3.4), wood, 2.1, 0.75, 0));
  bx.add(mesh(new THREE.BoxGeometry(0.2, 1.3, 3.4), wood, -2.1, 0.75, 0));
  boxFill = mesh(new THREE.SphereGeometry(1.7, 12, 8), mat(0xd9822b), 0, 0.3, 0, false); boxFill.scale.set(1.2, 0.01, 0.95);
  bx.add(boxFill); world.add(bx);
  dropFill.box = boxFill;
  // новые места сдачи: компостная куча, ящик, бочка. Показываются только когда нужны работе.
  const mkDrop = (kind, build, fillGeo, fillScale) => {
    const g = new THREE.Group(); g.position.copy(DROPS[kind].pos); build(g);
    const f = mesh(fillGeo, mat(0xffffff), 0, 0.3, 0, false); f.scale.set(fillScale[0], 0.01, fillScale[1]); g.add(f);
    g.visible = false; world.add(g); dropGroups[kind] = g; dropFill[kind] = f;
  };
  mkDrop('compost', g => {
    const w = mat(0x6b4a2b);
    g.add(mesh(new THREE.BoxGeometry(4.4, 0.2, 3.4), mat(0x4a3a24), 0, 0.1, 0));
    for (const [sx, sz, x, z] of [[4.4, 0.25, 0, 1.6], [4.4, 0.25, 0, -1.6], [0.25, 3.4, 2.1, 0], [0.25, 3.4, -2.1, 0]]) g.add(mesh(new THREE.BoxGeometry(sx, 0.9, sz), w, x, 0.55, z));
  }, new THREE.SphereGeometry(1.7, 12, 8), [1.2, 0.95]);
  mkDrop('crate', g => {
    const w = mat(0xc99a5b);
    g.add(mesh(new THREE.BoxGeometry(4, 0.2, 3), mat(0x8a5a30), 0, 0.1, 0));
    for (const [sx, sz, x, z] of [[4, 0.2, 0, 1.4], [4, 0.2, 0, -1.4], [0.2, 3, 1.9, 0], [0.2, 3, -1.9, 0]]) g.add(mesh(new THREE.BoxGeometry(sx, 1.2, sz), w, x, 0.7, z));
    for (const x of [-1.9, 1.9]) for (const z of [-1.4, 1.4]) g.add(mesh(new THREE.BoxGeometry(0.3, 1.35, 0.3), mat(0x7a4a2a), x, 0.68, z));
  }, new THREE.SphereGeometry(1.5, 12, 8), [1.15, 0.9]);
  mkDrop('barrel', g => {
    g.add(mesh(new THREE.CylinderGeometry(1.5, 1.35, 1.7, 16, 1, true), mat(0x7a5a3a, { side: THREE.DoubleSide }), 0, 0.85, 0));
    g.add(mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.1, 16), mat(0x5a432c), 0, 0.05, 0));
    for (const y of [0.35, 1.35]) { const r = mesh(new THREE.TorusGeometry(1.46, 0.07, 6, 20), mat(0x4a4f55), 0, y, 0); r.rotation.x = Math.PI / 2; g.add(r); }
  }, new THREE.SphereGeometry(1.3, 12, 8), [1, 1]);
  // дерево силы (в центре, открывается на 4 уровне)
  treeGroup = new THREE.Group(); treeGroup.position.copy(TREE);
  treeGroup.add(mesh(new THREE.CylinderGeometry(0.8, 1.2, 5, 10), mat(0x7a5230), 0, 2.5, 0));
  for (let k = 0; k < 6; k++) { const a = k * 1.05; treeGroup.add(mesh(new THREE.IcosahedronGeometry(rnd(1.6, 2.2), 1), mat(pick([0xffd24a, 0xffb830, 0xffe27a]), { emissive: 0x7a5200, emissiveIntensity: 0.5 }), Math.cos(a) * 1.6, 5.6 + Math.sin(k * 2) * 0.5, Math.sin(a) * 1.6)); }
  treeGroup.add(mesh(new THREE.IcosahedronGeometry(2.2, 1), mat(0xffe27a, { emissive: 0x9a6a00, emissiveIntensity: 0.6 }), 0, 7, 0));
  treeGroup.userData.canopy = treeGroup.children.slice(1).map(c => { c.material.transparent = true; c.castShadow = false; return c.material; });
  const ring = mesh(new THREE.RingGeometry(2.4, 2.8, 40), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0, 0.04, 0, false);
  ring.rotation.x = -Math.PI / 2; treeGroup.add(ring);
  treeGroup.visible = false; world.add(treeGroup);
  // кольцо-указатель, куда нести
  dropRing = mesh(new THREE.RingGeometry(3.1, 3.5, 40), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), 0, 0.06, 0, false);
  dropRing.rotation.x = -Math.PI / 2; dropRing.visible = false; world.add(dropRing);
}
let pileCount = 0;
const pileGroup = new THREE.Group(); scene.add(pileGroup);
function addToPile() {
  const i = pileCount++, col = i % 4, row = Math.floor(i / 4) % 3, layer = Math.floor(i / 12);
  const l = makeLog(); l.position.set(WOOD.x - 1.6 + col * 0.85 + (layer % 2) * 0.1, 0.3 + row * 0.4 + layer * 1.3, WOOD.z + rnd(-1.2, 1.2)); l.rotation.y = rnd(-0.15, 0.15);
  pileGroup.add(l);
}

/* ================= Персонаж и инструменты ================= */
const player = {
  group: new THREE.Group(), model: new THREE.Group(), tool: new THREE.Group(),
  pos: new THREE.Vector3(0, 0, 14), dir: new THREE.Vector3(0, 0, -1),
  hp: 5, maxHp: 5, inv: 0, swing: 0, bag: 0, carry: null, walkT: 0, vel: new THREE.Vector3(),
};
player.group.add(player.model); scene.add(player.group);

/* Рюкзак на спине: чем больше набрал, тем он полнее, краснеет (становится цвета того, что собираешь) и из него торчит добыча */
const PACK_EMPTY = new THREE.Color(0x8a6a4a);
const pack = { g: new THREE.Group(), body: null, mat: mat(0x8a6a4a), stuff: new THREE.Group() };
{
  const g = pack.g, flap = mat(0x6e5238), strap = mat(0x4f3b28);
  pack.body = new THREE.Group();
  pack.body.add(mesh(new THREE.BoxGeometry(0.5, 0.58, 0.26), pack.mat, 0, 0, 0));
  pack.body.add(mesh(new THREE.BoxGeometry(0.54, 0.14, 0.3), flap, 0, 0.27, 0));
  pack.body.add(mesh(new THREE.BoxGeometry(0.34, 0.2, 0.08), flap, 0, -0.1, -0.16));
  g.add(pack.body);
  for (const x of [-0.28, 0.28]) g.add(mesh(new THREE.BoxGeometry(0.05, 0.46, 0.22), strap, x, 0.02, 0.0));
  pack.stuff.position.set(0, 0.36, 0); g.add(pack.stuff);
  g.position.set(0, 1.42, -0.34); player.model.add(g);   // герой идёт лицом в +Z, значит спина на -Z
}
function updatePack() {
  const J = JOBS[G.job], k = G.held ? Math.min(1, player.bag / Math.max(1, G.st.cap)) : 0, col = new THREE.Color(J.col);
  pack.mat.color.copy(PACK_EMPTY).lerp(col, 0.8 * Math.pow(k, 0.7));   // цвет меняется по мере наполнения
  pack.body.scale.set(1 + 0.12 * k, 1 + 0.08 * k, 1 + 0.45 * k);        // раздувается
  pack.stuff.clear();
  const n = player.bag > 0 ? Math.min(7, 1 + Math.ceil(k * 6)) : 0;
  for (let i = 0; i < n; i++) {
    const a = (i / 7) * 6.28 + 0.7, r = 0.05 + 0.2 * ((i * 37) % 10) / 10;
    let o;
    if (G.job === 'branches') { o = makeLog(0.9, 0.07); o.rotation.set(0, i * 1.1, Math.PI / 2 + (i % 3 - 1) * 0.25); o.position.set(Math.cos(a) * r, 0.15 + (i % 2) * 0.1, Math.sin(a) * r * 0.5); }
    else { o = mesh(new THREE.IcosahedronGeometry(0.11 + (i % 3) * 0.03, 0), mat(i % 2 ? col : col.clone().offsetHSL(0.02, 0, -0.08)), Math.cos(a) * r * 1.2, 0.05 + 0.1 * (i % 3), Math.sin(a) * r * 0.6); }
    pack.stuff.add(o);
  }
}
let charTemplate = null;
new GLTFLoader().load(asset('character'), gltf => {
  const m = gltf.scene;
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(m); const size = box.getSize(new THREE.Vector3());
  m.scale.setScalar(CHAR_HEIGHT / size.y);
  const b2 = new THREE.Box3().setFromObject(m); const c = b2.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -b2.min.y, -c.z);
  const wrap = new THREE.Group(); wrap.add(m); wrap.rotation.y = FACE_OFFSET; player.model.add(wrap);
  charTemplate = wrap;
}, undefined, e => {
  console.warn('Не удалось загрузить персонажа, ставлю заглушку', e);
  player.model.add(mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 8), mat(0x3b82c4), 0, 0.9, 0));
});
player.tool.position.set(0.45, 1.2, 0.3); player.model.add(player.tool);

/* Модель инструмента по id (TOOLS[id].look и .scale). Начало координат группы = рука. Ручка идёт вперёд-вниз,
   рабочая часть сидит ровно на её конце. */
function buildTool(id, grp) {
  grp.clear(); grp.scale.setScalar(1);
  const T = TOOLS[id] || BOSS_W[id], kind = T.look;
  const wood = mat(0x9a6b3c), metal = mat(0xb8c0c8, { metalness: .5, roughness: .4 }), orange = mat(0xe0702a);
  const straw = mat(T.tint ? new THREE.Color(T.tint).lerp(new THREE.Color(0xd8b45a), 0.55) : 0xd8b45a);
  const grip = new THREE.Vector3(0, 0.3, 0.2);
  // ручка: возвращает направление и конец
  const shaft = (len, a) => {
    const d = new THREE.Vector3(0, -Math.sin(a), Math.cos(a));
    const c = grip.clone().addScaledVector(d, len / 2);
    const m = mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), wood, c.x, c.y, c.z); m.rotation.x = Math.PI / 2 + a; grp.add(m);
    return { d, end: grip.clone().addScaledVector(d, len), a };
  };
  if (kind === 'rake') {
    const { end } = shaft(2, 0.6);
    grp.add(mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), metal, end.x, end.y, end.z));
    for (let i = -4; i <= 4; i++) grp.add(mesh(new THREE.BoxGeometry(0.04, 0.26, 0.04), metal, end.x + i * 0.1, end.y - 0.13, end.z));
  } else if (kind === 'broom') {
    const { end, d, a } = shaft(1.9, 0.6);
    const b = mesh(new THREE.CylinderGeometry(0.3, 0.08, 0.6, 8), straw, end.x + d.x * 0.25, end.y + d.y * 0.25, end.z + d.z * 0.25); b.rotation.x = Math.PI / 2 + a; grp.add(b);
  } else if (kind === 'scoop') {
    const { end } = shaft(1.5, 0.75);
    const s = mesh(new THREE.BoxGeometry(0.7, 0.05, 0.6), metal, end.x, end.y - 0.03, end.z + 0.2); grp.add(s);
    grp.add(mesh(new THREE.BoxGeometry(0.7, 0.3, 0.05), metal, end.x, end.y + 0.1, end.z - 0.08));
    for (const x of [-0.33, 0.33]) grp.add(mesh(new THREE.BoxGeometry(0.04, 0.2, 0.6), metal, end.x + x, end.y + 0.05, end.z + 0.2));
  } else if (kind === 'blade') {   // серп / коса / ножницы: ручка и изогнутое лезвие
    const { end } = shaft(1.6, 0.7);
    const b = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.8), metal, end.x, end.y, end.z + 0.3); b.rotation.x = 0.35; grp.add(b);
    const tip = mesh(new THREE.ConeGeometry(0.05, 0.3, 4), metal, end.x, end.y - 0.08, end.z + 0.8); tip.rotation.x = Math.PI / 2 + 0.6; grp.add(tip);
  } else if (kind === 'hoe') {   // тяпка / культиватор
    const { end } = shaft(1.8, 0.6);
    grp.add(mesh(new THREE.BoxGeometry(0.45, 0.05, 0.05), metal, end.x, end.y, end.z));
    const h = mesh(new THREE.BoxGeometry(0.45, 0.3, 0.04), metal, end.x, end.y - 0.15, end.z + 0.05); h.rotation.x = -0.4; grp.add(h);
  } else if (kind === 'hook') {   // крюк / лом / кирка / вилы: ручка и загнутый конец
    const { end } = shaft(1.7, 0.65);
    grp.add(mesh(new THREE.BoxGeometry(0.7, 0.07, 0.07), metal, end.x, end.y, end.z));
    for (const s of [-1, 1]) { const t = mesh(new THREE.ConeGeometry(0.06, 0.4, 5), metal, end.x + s * 0.33, end.y - 0.18, end.z); grp.add(t); }
  } else if (kind === 'basket') {   // корзина / тележка / короб
    grp.add(mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.34, 10, 1, true), mat(0xc79a52, { side: THREE.DoubleSide }), 0, 0, 0.45));
    grp.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 10), mat(0xa57a3a), 0, -0.17, 0.45));
    const hd = mesh(new THREE.TorusGeometry(0.3, 0.03, 5, 12, Math.PI), mat(0x8a5a30), 0, 0.17, 0.45); hd.rotation.y = Math.PI / 2; grp.add(hd);
  } else if (kind === 'mower') {   // газонокосилка / снегоуборщик / пылесос: коробка на колёсах с ручкой
    grp.add(mesh(new THREE.BoxGeometry(0.5, 0.26, 0.6), mat(T.tint ? new THREE.Color(T.tint).lerp(new THREE.Color(0xe0702a), 0.6) : 0xe0702a), 0, -0.1, 0.7));
    for (const s of [-1, 1]) grp.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 10), mat(0x222222), s * 0.3, -0.18, 0.9));
    const hd = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), mat(0x444444), 0, 0.2, 0.3); hd.rotation.x = 0.9; grp.add(hd);
  } else if (kind === 'spear' || kind === 'axe' || kind === 'club') {   // оружие против босса: длинная ручка и боевой конец цвета добычи
    const col = mat(new THREE.Color(T.tint || 0xe0702a), { emissive: new THREE.Color(T.tint || 0xe0702a), emissiveIntensity: 0.25 });
    const { end, d, a } = shaft(2.1, 0.55);
    if (kind === 'spear') {
      const tip = mesh(new THREE.ConeGeometry(0.11, 0.55, 6), metal, end.x + d.x * 0.25, end.y + d.y * 0.25, end.z + d.z * 0.25); tip.rotation.x = Math.PI / 2 + a; grp.add(tip);
      const tassel = mesh(new THREE.SphereGeometry(0.09, 6, 5), col, end.x - d.x * 0.15, end.y - d.y * 0.15, end.z - d.z * 0.15); grp.add(tassel);
    } else if (kind === 'axe') {
      grp.add(mesh(new THREE.BoxGeometry(0.08, 0.4, 0.5), metal, end.x, end.y, end.z + 0.15));
      grp.add(mesh(new THREE.BoxGeometry(0.1, 0.16, 0.16), col, end.x, end.y + 0.02, end.z - 0.12));
    } else {
      const m = mesh(new THREE.SphereGeometry(0.26, 8, 7), col, end.x + d.x * 0.1, end.y + d.y * 0.1, end.z + d.z * 0.1); grp.add(m);
      for (let k = 0; k < 6; k++) { const s = mesh(new THREE.ConeGeometry(0.05, 0.14, 4), metal, end.x + Math.cos(k * 1.05) * 0.26, end.y + Math.sin(k * 1.05) * 0.26, end.z + d.z * 0.1); s.rotation.z = k * 1.05 - Math.PI / 2; grp.add(s); }
    }
  } else if (kind === 'chain') {
    grp.add(mesh(new THREE.BoxGeometry(0.22, 0.28, 0.5), orange, 0, 0, 0.25));
    grp.add(mesh(new THREE.BoxGeometry(0.06, 0.14, 0.9), mat(0x222222), 0, 0, 0.9));
    grp.add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.5), mat(0x555555), 0, 0.17, 0.2));
  } else { // пила
    grp.add(mesh(new THREE.BoxGeometry(0.1, 0.14, 0.3), wood, 0, 0, 0.1));
    grp.add(mesh(new THREE.BoxGeometry(0.03, 0.2, 0.9), metal, 0, -0.05, 0.7));
    for (let i = 0; i < 9; i++) grp.add(mesh(new THREE.ConeGeometry(0.03, 0.06, 3), metal, 0, -0.17, 0.3 + i * 0.1));
  }
  grp.scale.setScalar(T.scale > 1 ? 1 + (T.scale - 1) * 0.6 : 1);
}

/* ================= Состояние игры ================= */
const G = { state: 'menu', paused: false, held: true, level: levelDef(1), job: 'leaves', tool: 'rake', st: stats('rake'), items: [], total: 0, done: 0, boss: null, shots: [], fx: [], target: null, actionT: 0, sweepT: 0, attackCd: 0, spiders: [], spiderLeft: 0, spiderSeen: false };
let helpers = [];
const keys = {};
let mouseDown = false, tAll = 0, lastFull = -9, lastNoTool = -9;

/* ---------- Телефон: сенсорное управление ---------- */
let touchMode = TOUCH_AT_START, touchWork = false, runOn = false;
const joy = { x: 0, y: 0, id: null };
function setTouchMode(on) { touchMode = on; document.body.classList.toggle('touch', on); }
setTouchMode(touchMode);
addEventListener('touchstart', () => { if (!touchMode) setTouchMode(true); }, { passive: true });
// подсказки с названиями клавиш превращаем в подсказки про кнопки на экране
const TT = [[/Бей босса: ПРОБЕЛ или мышь/g, 'Бей босса кнопкой «Работа»'], [/ПРОБЕЛ или мышь/g, 'кнопку «Работа»'], [/ПРОБЕЛ/g, 'кнопку «Работа»'],
  [/Shift: бег/g, 'Бег: кнопка 🏃'], [/нажми Q: взять/g, 'нажми «Взять»'], [/\(Q\)/g, '(кнопка «Взять»)'], [/Q у дерева/g, '«Взять» у дерева'],
  [/\bQ: /g, '«Взять»: '], [/\bQ\b/g, '«Взять»'], [/\s*\(Esc\)/g, '']];
const tt = s => touchMode ? TT.reduce((a, [r, v]) => a.replace(r, v), s) : s;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space' && !G.paused) e.preventDefault();
  if (e.code === 'Escape') { if (!$('leave').classList.contains('hidden')) closeLeave(); else if (G.paused) closeTree(); else if (G.state !== 'menu') askLeave(); }
  if (e.code === 'KeyE' && G.state === 'play' && !G.paused && nearTree()) openTree();
  if (e.code === 'KeyQ' && (G.state === 'play' || G.state === 'boss') && !G.paused && nearTree()) toggleTreeTool();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousedown', e => { if (G.state !== 'menu' && !G.paused && !e.target.closest('button, #touch')) mouseDown = true; });
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('blur', () => { mouseDown = false; for (const k in keys) keys[k] = false; });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
addEventListener('contextmenu', e => { if (touchMode) e.preventDefault(); });

const $ = id => document.getElementById(id);
function toast(t, ms = 1800) { const el = $('toast'); el.textContent = tt(t); el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms); }
let hintTimer = 0;
const hint = t => {   // на телефоне подсказка сверху мешает: показываем пару секунд и убираем
  const h = $('hint'); h.textContent = tt(t); h.classList.remove('hidden'); clearTimeout(hintTimer);
  if (touchMode) hintTimer = setTimeout(() => h.classList.add('hidden'), 4000);
};

/* экранные кнопки и джойстик (показываются только на телефоне) */
{
  const zone = $('joyzone'), base = $('joybase'), knob = $('joyknob'), R = 56; let ox = 0, oy = 0;
  const resetJoy = () => { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; base.classList.remove('on'); base.style.left = base.style.top = ''; };
  zone.addEventListener('pointerdown', e => {
    if (joy.id !== null) return; joy.id = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch (err) {} ox = e.clientX; oy = e.clientY;
    base.classList.add('on'); base.style.left = (ox - 65) + 'px'; base.style.top = (oy - 65) + 'px';
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    joy.x = dx / R; joy.y = dy / R;
  });
  for (const ev of ['pointerup', 'pointercancel']) zone.addEventListener(ev, e => { if (e.pointerId === joy.id) resetJoy(); });
  const work = $('twork');
  work.addEventListener('pointerdown', e => { e.preventDefault(); touchWork = true; work.classList.add('on'); try { work.setPointerCapture(e.pointerId); } catch (err) {} });
  for (const ev of ['pointerup', 'pointercancel']) work.addEventListener(ev, () => { touchWork = false; work.classList.remove('on'); });
  $('trun').onclick = () => { runOn = !runOn; $('trun').classList.toggle('on', runOn); };
  $('ttree').onclick = () => { if (G.state === 'play' && !G.paused && nearTree()) openTree(); };
  $('ttake').onclick = () => { if ((G.state === 'play' || G.state === 'boss') && !G.paused && nearTree()) toggleTreeTool(); };
  $('tmenu').onclick = () => { if (!$('leave').classList.contains('hidden')) closeLeave(); else if (G.paused) closeTree(); else if (G.state !== 'menu') askLeave(); };
  window.__resetTouch = () => { touchWork = false; resetJoy(); work.classList.remove('on'); };
}
function renderHearts() { $('hearts').textContent = '❤️'.repeat(player.hp) + '🤍'.repeat(Math.max(0, player.maxHp - player.hp)); }
const nearTree = () => save.maxLevel >= 4 && dist2(player.pos, TREE) < 5;
/* Выход с уровня: сначала спрашиваем, игра на паузе */
function askLeave() {
  if (G.state === 'win') { toMenu(); return; }
  G.paused = true; mouseDown = false; if (window.__resetTouch) window.__resetTouch();
  $('leave').classList.remove('hidden');
}
function closeLeave() { $('leave').classList.add('hidden'); G.paused = false; mouseDown = false; }
$('leavestay').onclick = closeLeave;
$('leavego').onclick = () => { $('leave').classList.add('hidden'); toMenu(); };
const working = () => !G.paused && (keys.Space || mouseDown || touchWork);
const dropPos = job => DROPS[JOBS[job].drop].pos;

const leafGeo = new THREE.CircleGeometry(0.2, 5);
const leafMats = leafCols.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide }));
function makeHeap() {
  const g = new THREE.Group();
  for (let k = 0; k < 7; k++) g.add(mesh(new THREE.IcosahedronGeometry(rnd(.28, .45), 0), mat(pick(leafCols)), rnd(-.4, .4), rnd(.15, .6), rnd(-.4, .4)));
  return g;
}

function clearLevel() {
  for (const it of G.items) scene.remove(it.obj);
  G.items = [];
  if (G.boss) { scene.remove(G.boss.obj); G.boss = null; }
  if (G.bwObj) { treeGroup.remove(G.bwObj); G.bwObj = null; }
  if (G.bw) { G.bw = false; buildTool(G.tool, player.tool); }
  for (const s of G.shots) scene.remove(s.obj); G.shots = [];
  killSpiders(false); G.spiderLeft = 0; G.spiderSeen = false;
  for (const f of G.fx) scene.remove(f.obj); G.fx = [];
  for (const h of helpers) scene.remove(h.obj); helpers = [];
  pileGroup.clear(); pileCount = 0; for (const f of Object.values(dropFill)) f.scale.y = 0.01;
  for (const g of Object.values(dropGroups)) g.visible = false;
  player.bag = 0; updateCarry(); dropRing.visible = false;
}
const farFromDrops = (x, z) => Math.hypot(x - TREE.x, z - TREE.z) > 4 && Object.values(DROPS).every(d => Math.hypot(x - d.pos.x, z - d.pos.z) > 5);

/* Предметы, которые убирают. kind = job.item. Каждый раз одинаковое число случайных чисел RNG, чтобы двор совпадал у всех в комнате. */
const itemMat = {};
const im = c => itemMat[c] || (itemMat[c] = mat(c));
const grassGeo = new THREE.ConeGeometry(0.1, 0.55, 4), acornGeo = new THREE.IcosahedronGeometry(0.13, 0), trashGeo = new THREE.BoxGeometry(0.28, 0.12, 0.2);
const webGeo = new THREE.CircleGeometry(0.34, 7), snowGeo = new THREE.SphereGeometry(0.3, 7, 5), stoneGeo = new THREE.DodecahedronGeometry(0.4, 0), potatoGeo = new THREE.SphereGeometry(0.3, 8, 6);
const webMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f8, roughness: 1, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
function makeItem(kind, x, z, i) {
  let o;
  if (kind === 'leaf') {
    o = mesh(leafGeo, pick(leafMats), x, 0.03 + RNG() * 0.03, z, false); o.rotation.set(-Math.PI / 2, 0, rnd(0, 6.28)); o.scale.setScalar(rnd(0.8, 1.5));
  } else if (kind === 'log') {
    o = makeLog(rnd(2.2, 3), 0.14); o.position.set(x, 0.15, z); o.rotation.y = rnd(0, 6.28);
    const twig = mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 5), logMat, rnd(-.6, .6), 0.25, 0.2); twig.rotation.z = 0.8; o.add(twig);
  } else if (kind === 'heap') {
    o = makeHeap(); o.position.set(x, 0, z);
  } else if (kind === 'grass') {
    o = new THREE.Group(); for (let k = 0; k < 3; k++) o.add(mesh(grassGeo, im(k % 2 ? 0x5fae3a : 0x74c24a), rnd(-.12, .12), 0.27, rnd(-.12, .12), false));
    o.position.set(x, 0, z); o.rotation.y = rnd(0, 6.28); o.scale.setScalar(rnd(0.9, 1.5));
  } else if (kind === 'acorn') {
    o = mesh(acornGeo, im(pick([0x8a5a2b, 0x9c6a35, 0x6e4624])), x, 0.1, z, false); o.scale.set(1, 1.3, 1); o.rotation.y = rnd(0, 6.28);
  } else if (kind === 'trash') {
    o = mesh(trashGeo, im(pick([0x7d8a95, 0xc0504d, 0x4f81bd, 0xd9d9d9, 0x9bbb59])), x, 0.07, z, false); o.rotation.y = rnd(0, 6.28); o.scale.setScalar(rnd(0.8, 1.5));
  } else if (kind === 'web') {
    o = mesh(webGeo, webMat, x, 0.04 + RNG() * 0.02, z, false); o.rotation.set(-Math.PI / 2, 0, rnd(0, 6.28)); o.scale.setScalar(rnd(0.8, 1.5));
  } else if (kind === 'snow') {
    o = mesh(snowGeo, im(0xf4f9ff), x, 0.08, z, false); o.scale.set(rnd(1, 1.8), 0.45, rnd(1, 1.8));
  } else if (kind === 'apple') {
    o = new THREE.Group(); o.add(mesh(new THREE.SphereGeometry(0.28, 10, 8), im(0xd63a2f), 0, 0.28, 0)); o.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 4), im(0x5a3a1a), 0, 0.58, 0, false));
    o.add(mesh(new THREE.CircleGeometry(0.1, 5), leafMats[3], 0.1, 0.6, 0, false)); o.position.set(x, 0, z);
  } else if (kind === 'weed') {
    o = new THREE.Group(); for (let k = 0; k < 5; k++) { const c = mesh(grassGeo, im(k % 2 ? 0x4e8f2e : 0x3a7a22), rnd(-.2, .2), 0.35, rnd(-.2, .2), false); c.rotation.set(rnd(-.4, .4), 0, rnd(-.4, .4)); c.scale.set(1.3, 1.3, 1.3); o.add(c); }
    o.position.set(x, 0, z);
  } else if (kind === 'mushroom') {
    o = new THREE.Group(); o.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 6), im(0xf1e8d6), 0, 0.15, 0, false));
    const cap = mesh(new THREE.SphereGeometry(0.24, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), im(pick([0xc0392b, 0xb5651d, 0xe0b87a])), 0, 0.3, 0, false); o.add(cap); o.position.set(x, 0, z);
  } else if (kind === 'stone') {
    o = mesh(stoneGeo, im(pick([0x8c8f94, 0x777b80, 0xa0a3a8])), x, 0.3, z); o.scale.set(rnd(0.9, 1.4), rnd(0.7, 1.1), rnd(0.9, 1.4)); o.rotation.set(rnd(0, 3), rnd(0, 3), 0);
  } else if (kind === 'pumpkin') {
    o = new THREE.Group(); const b = mesh(new THREE.SphereGeometry(0.55, 12, 9), im(0xf08a1c), 0, 0.42, 0); b.scale.y = 0.8; o.add(b);
    o.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 5), im(0x4e7a2a), 0, 0.88, 0, false)); o.position.set(x, 0, z);
  } else if (kind === 'potato') {
    o = new THREE.Group(); const mound = mesh(new THREE.SphereGeometry(0.5, 9, 6), im(0x7a5a38), 0, 0.1, 0, false); mound.scale.y = 0.4; o.add(mound);
    for (let k = 0; k < 2; k++) { const p = mesh(potatoGeo, im(0xc9a45c), rnd(-.2, .2), 0.28, rnd(-.2, .2)); p.scale.set(1.2, 0.8, 0.9); o.add(p); } o.position.set(x, 0, z);
  } else if (kind === 'berry') {
    o = new THREE.Group(); const b = mesh(new THREE.SphereGeometry(0.4, 8, 6), im(0x2f6b2a), 0, 0.2, 0, false); b.scale.y = 0.6; o.add(b);
    for (let k = 0; k < 5; k++) o.add(mesh(new THREE.SphereGeometry(0.1, 7, 5), im(pick([0x5b4ac7, 0x3d3aa8, 0x7a5ad0])), rnd(-.28, .28), rnd(0.25, 0.4), rnd(-.28, .28), false)); o.position.set(x, 0, z);
  } else if (kind === 'carrot') {
    o = new THREE.Group(); for (let k = 0; k < 3; k++) o.add(mesh(grassGeo, im(0x3f9a2e), (k - 1) * 0.08, 0.4, 0, false));
    const c = mesh(new THREE.ConeGeometry(0.12, 0.5, 7), im(0xef7d1a), 0, 0.12, 0, false); c.rotation.z = Math.PI; o.add(c); o.position.set(x, 0, z); o.rotation.y = rnd(0, 6.28);
  } else if (kind === 'hay') {
    o = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), im(pick([0xe3c35a, 0xd1ab3e, 0xf0d77a])), 0, 0.08 + k * 0.03, 0, false); s.rotation.set(Math.PI / 2, 0, rnd(0, 3)); o.add(s); }
    o.position.set(x, 0, z);
  } else {   // sunflower
    o = new THREE.Group(); o.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 5), im(0x4e7a2a), 0, 0.7, 0));
    const h = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 12), im(0xf2c21b), 0, 1.45, 0.08); h.rotation.x = Math.PI / 2 - 0.3; o.add(h);
    const c = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.13, 10), im(0x5a3a1a), 0, 1.45, 0.1, false); c.rotation.x = Math.PI / 2 - 0.3; o.add(c); o.position.set(x, 0, z);
  }
  return o;
}
function randSpot(margin = 2) {
  for (;;) { const x = rnd(-YARD + margin, YARD - margin), z = rnd(-YARD + margin, YARD - margin); if (farFromDrops(x, z) && Math.hypot(x - player.pos.x, z - player.pos.z) > 3) return [x, z]; }
}

function startLevel(level, job, tool, seed = (Math.random() * 1e9) | 0) {
  clearLevel(); G.seed = seed;
  G.level = level; G.job = job; G.state = 'play'; G.done = 0; G.total = totalFor(job, level.n); G.paused = false;
  const J = JOBS[job];
  G.spiderLeft = level.season >= SPIDER_SEASON && J.spiders ? 3 + Math.min(4, Math.floor((level.n - 21) / 4)) : 0;   // сколько паучков спрячется на уровне (под листьями)
  G.tool = tool && JOBS[job].tools.includes(tool) && save.tools.includes(tool) ? tool : JOBS[job].tools[0];
  G.st = stats(G.tool);
  player.model.rotation.y = 0;   // в меню герой крутится, на уровне должен смотреть по ходу движения
  player.pos.set(0, 0, 15); player.dir.set(0, 0, -1); player.maxHp = 5 + (save.abil.hearts || 0); player.hp = player.maxHp; player.inv = 0; player.swing = 0;
  buildTool(G.tool, player.tool);
  treeGroup.visible = save.maxLevel >= 4;
  G.held = !treeGroup.visible;   // когда есть дерево, уровень начинается с пустыми руками: инструмент лежит у дерева
  player.tool.visible = G.held; refreshTreeTools();
  dropRing.position.copy(dropPos(job)); dropRing.visible = true;
  for (const [k, g] of Object.entries(dropGroups)) g.visible = k === J.drop;
  if (dropFill[J.drop] && J.drop !== 'box') dropFill[J.drop].material.color.setHex(J.col);   // наполнение того же цвета, что и добыча
  boxFill.material.color.setHex(J.drop === 'box' ? J.col : 0xd9822b);
  RNG = seeded(seed);
  for (let i = 0; i < G.total; i++) {
    const [x, z] = randSpot();
    const o = makeItem(J.item, x, z, i);
    if (J.mech === 'sweep' && i > 20 && RNG() < .5) {   // мелочь собирается кучками
      const p = pick(G.items).obj.position, nx = THREE.MathUtils.clamp(p.x + rnd(-2, 2), -YARD, YARD), nz = THREE.MathUtils.clamp(p.z + rnd(-2, 2), -YARD, YARD);
      if (farFromDrops(nx, nz)) { o.position.x = nx; o.position.z = nz; }
    }
    scene.add(o); G.items.push({ obj: o, kind: job, id: i });
  }
  RNG = Math.random;
  $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); $('bossbar').classList.add('hidden'); $('season').classList.add('hidden');
  renderHearts(); updateProgress(); spawnHelpers();
  toast(level.finale ? `Уровень ${level.n}: большая уборка!` : `Уровень ${level.n}`);
  if (!G.held) { hint('Инструмент лежит у дерева в центре двора. Подойди и нажми Q: взять. Потом работай (ПРОБЕЛ). Shift: бег'); toast(`Уровень ${level.n}: возьми инструмент у дерева (Q)`, 2600); return; }
  hint(J.hint);
}

function updateProgress() {
  const j = JOBS[G.job];
  $('jobname').textContent = `${j.icon} ${j.name}: ${G.done} / ${G.total}`;
  $('jobfill').style.width = (100 * G.done / Math.max(1, G.total)) + '%';
  $('bag').textContent = G.bw ? `${BOSS_W['bw_' + G.job].icon} ${BOSS_W['bw_' + G.job].name}   ·   оружие против босса` : (G.held ?`${TOOLS[G.tool].icon} ${TOOLS[G.tool].name}   ·   ${G.job === 'branches' ? '🪵' : '🎒'} ${player.bag} / ${G.st.cap}` : `✋ Руки пустые (${TOOLS[G.tool].name} у дерева)`);
  // полоска рюкзака: заливается цветом добычи по мере наполнения
  const k = G.held ? Math.min(1, player.bag / Math.max(1, G.st.cap)) : 0;
  $('bag').style.setProperty('--fill', (100 * k) + '%'); $('bag').style.setProperty('--bagcol', '#' + new THREE.Color(j.col).getHexString());
}

/* ---------- Эффекты ---------- */
function puff(pos, color, n = 8, speed = 3) {
  for (let i = 0; i < n; i++) {
    const o = mesh(new THREE.IcosahedronGeometry(rnd(.08, .18), 0), mat(color), pos.x, pos.y, pos.z, false);
    scene.add(o);
    G.fx.push({ obj: o, v: new THREE.Vector3(rnd(-1, 1) * speed, rnd(1, 4), rnd(-1, 1) * speed), life: rnd(.5, .9), t: 0 });
  }
}
function updateFx(dt) {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i]; f.t += dt;
    if (f.fly) { f.obj.position.lerp(f.fly, Math.min(1, dt * 14)); f.obj.scale.multiplyScalar(1 - dt * 5); }
    else { f.v.y -= 9 * dt; f.obj.position.addScaledVector(f.v, dt); f.obj.scale.multiplyScalar(1 - dt * 1.5); }
    if (f.t > f.life) { scene.remove(f.obj); G.fx.splice(i, 1); }
  }
}
function removeItem(it, flyTo) {
  const idx = G.items.indexOf(it); if (idx < 0) return false;
  G.items.splice(idx, 1);
  const p = it.obj.position.clone();
  if (!net.applying) netSend({ t: 'rm', id: it.id, seed: G.seed });
  if (flyTo) G.fx.push({ obj: it.obj, fly: flyTo, life: .25, t: 0 }); else scene.remove(it.obj);
  // с 3-й главы под листиком может сидеть паучок
  if (G.state === 'play' && !net.applying && JOBS[it.kind].spiders && G.spiderLeft > 0 && Math.random() < Math.min(0.5, 1.3 * G.spiderLeft / (G.items.length + 1))) { G.spiderLeft--; spawnSpider(p); }
  return true;
}

/* ================= Паучки ================= */
let spiderTemplate = null;
new GLTFLoader().load(asset('spider'), gltf => {
  const m = gltf.scene;
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  m.scale.setScalar(1.25 / Math.max(size.x, size.z));
  const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -b.min.y, -c.z);
  const wrap = new THREE.Group(); wrap.add(m); wrap.rotation.y = Math.PI / 2;   // в модели морда смотрит в -X, поворачиваем вперёд (+Z)
  spiderTemplate = wrap;
}, undefined, e => console.warn('Не удалось загрузить паучка', e));
function spawnSpider(from) {
  const g = new THREE.Group(), body = new THREE.Group();
  body.add(spiderTemplate ? spiderTemplate.clone(true) : mesh(new THREE.SphereGeometry(0.5, 12, 10), mat(0x111111), 0, 0.5, 0));
  g.add(body);
  const a = rnd(0, 6.28), to = from.clone(); to.x += Math.cos(a) * 1.4; to.z += Math.sin(a) * 1.4;
  to.x = THREE.MathUtils.clamp(to.x, -YARD, YARD); to.z = THREE.MathUtils.clamp(to.z, -YARD, YARD);
  g.position.copy(from); g.position.y = 0; scene.add(g);
  const hp = 2 + Math.floor(Math.random() * 2);   // 2 или 3 удара
  G.spiders.push({ obj: g, body, hp, max: hp, from: from.clone().setY(0), to, t: 0, state: 'pop', hurt: 0, bite: 0.8, dir: new THREE.Vector3(0, 0, 1) });
  puff(from.clone().setY(0.5), 0xd9822b, 8);
  toast(G.spiderSeen ? 'Паучок!' : 'Ой! Выскочил паучок! Бей его!', G.spiderSeen ? 900 : 2200); G.spiderSeen = true;
}
function killSpiders(fx = true) {
  for (const s of G.spiders) { if (fx) puff(s.obj.position.clone().setY(0.5), 0x222222, 6); scene.remove(s.obj); }
  G.spiders = [];
}
function updateSpiders(dt) {
  for (let i = G.spiders.length - 1; i >= 0; i--) {
    const s = G.spiders[i]; s.t += dt; s.hurt = Math.max(0, s.hurt - dt); s.bite -= dt;
    const o = s.obj;
    if (s.state === 'pop') {   // выпрыгивает из листьев дугой
      const k = Math.min(1, s.t / 0.5);
      o.position.set(THREE.MathUtils.lerp(s.from.x, s.to.x, k), Math.sin(k * Math.PI) * 1.4, THREE.MathUtils.lerp(s.from.z, s.to.z, k));
      o.rotation.y += dt * 12;
      if (k >= 1) { s.state = 'chase'; o.position.y = 0; }
      continue;
    }
    if (s.state === 'dead') {
      o.scale.multiplyScalar(1 - dt * 5); o.rotation.y += dt * 14;
      if (s.t > 0.35) { scene.remove(o); G.spiders.splice(i, 1); }
      continue;
    }
    const d = new THREE.Vector3(player.pos.x - o.position.x, 0, player.pos.z - o.position.z), dist = d.length(); if (dist > 0.01) d.divideScalar(dist);
    const sp = (3.4 + Math.min(1.2, (G.level.n - 21) * 0.05)) * (s.bite > 0.8 ? 0 : 1) * (s.hurt > 0 ? 0.2 : 1);
    if (dist > 0.9) o.position.addScaledVector(d, sp * dt);
    s.dir.lerp(d, Math.min(1, dt * 12)); o.rotation.y = Math.atan2(s.dir.x, s.dir.z);
    o.position.x = THREE.MathUtils.clamp(o.position.x, -YARD, YARD); o.position.z = THREE.MathUtils.clamp(o.position.z, -YARD, YARD);
    s.body.position.y = Math.abs(Math.sin(s.t * 16)) * 0.14; s.body.rotation.z = Math.sin(s.t * 16) * 0.12;
    const sq = s.hurt > 0 ? 0.75 : 1; s.body.scale.set(1 + (1 - sq), sq, 1 + (1 - sq));
    if (dist < 1.3 && s.bite <= 0) { s.bite = 1.1; hurtPlayer(o.position, 2); }
  }
}
function attackSpiders(dt) {
  G.attackCd -= dt;
  if (!G.spiders.length || !working() || G.attackCd > 0) return;
  let best = null, bd = 1e9;
  for (const s of G.spiders) { if (s.state !== 'chase') continue; const d = dist2(s.obj.position, player.pos); if (d < bd) { bd = d; best = s; } }
  const st = G.held ? G.st : stats(null);   // без инструмента бьёшь кулаками
  if (!best || bd > 2.6 * Math.max(1, st.rm * 0.9)) return;
  G.attackCd = 0.4 / st.sm; player.swing = 1;
  best.hp -= 1 + st.da; best.hurt = 0.25;
  const away = new THREE.Vector3(best.obj.position.x - player.pos.x, 0, best.obj.position.z - player.pos.z).normalize();
  best.obj.position.addScaledVector(away, 0.8);
  puff(best.obj.position.clone().setY(0.6), 0x333333, 5);
  if (best.hp <= 0) { best.state = 'dead'; best.t = 0; puff(best.obj.position.clone().setY(0.6), 0xffe08a, 14, 4); toast('Паучок побеждён!', 900); }
}

/* ---------- Ноша игрока ---------- */
function updateCarry() {   // то, что несёшь, лежит в рюкзаке на спине
  updatePack();
  updateProgress();
}
function depositUnits(n, drop) {
  if (!net.applying) netSend({ t: 'dep', n, seed: G.seed });
  G.done += n;
  const J = JOBS[G.job];
  if (J.drop === 'wood') for (let i = 0; i < n; i++) addToPile();
  else dropFill[J.drop].scale.y = Math.max(0.01, 0.9 * G.done / G.total);
  puff(new THREE.Vector3(drop.x, 1.4, drop.z), J.drop === 'wood' ? 0xd9b27a : J.col, 8);
  updateProgress();
  if (G.done >= G.total) jobComplete();
}

/* ---------- Работа игрока ---------- */
const nagNoTool = () => { if (tAll - lastNoTool > 2.5) { lastNoTool = tAll; toast('Руки пустые! Подойди к дереву и нажми Q: взять инструмент', 2200); } };
function tryDeposit() {
  const drop = dropPos(G.job);
  if (player.bag > 0 && dist2(player.pos, drop) < DROP_R) { const n = player.bag; player.bag = 0; updateCarry(); depositUnits(n, drop); }
}
function doWork(dt) {
  if (!G.held) {   // инструмент лежит у дерева: работать нельзя
    if (working()) nagNoTool();
    $('actionbar').classList.add('hidden'); G.target = null; G.actionT = 0; player.swing = Math.max(0, player.swing - dt * 5);
    tryDeposit(); return;
  }
  const job = G.job, J = JOBS[job], T = TOOLS[G.tool], st = G.st, bar = $('actionbar');
  const full = player.bag >= st.cap, pcol = J.drop === 'wood' ? 0xd9b27a : J.col;
  const nagFull = () => { if (tAll - lastFull > 2.5) { lastFull = tAll; toast(`Полно! Неси ${DROP_NAME[J.drop]}`, 1400); } };
  let target = null;
  if (J.mech === 'sweep') {
    G.sweepT -= dt;
    if (working()) {
      player.swing = Math.min(1, player.swing + dt * 6);
      if (G.sweepT <= 0) {
        G.sweepT = T.rate / st.sm;
        if (full) nagFull();
        else {
          const c = player.pos.clone().addScaledVector(player.dir, T.reach * st.rm * 0.8), r = T.reach * st.rm; let n = 0;
          for (const it of [...G.items]) {
            if (Math.hypot(it.obj.position.x - c.x, it.obj.position.z - c.z) < r) {
              if (removeItem(it, player.pos.clone().setY(1.2))) { player.bag++; }
              if (++n >= T.n || player.bag >= st.cap) break;
            }
          }
          if (n) updateCarry();
        }
      }
    }
  } else {
    const range = T.range * st.rm; let best = Infinity;
    for (const it of G.items) { const d = dist2(it.obj.position, player.pos); if (d < range && d < best) { best = d; target = it; } }
    if (target && working()) {
      if (full) { nagFull(); G.target = null; G.actionT = 0; bar.classList.add('hidden'); }
      else {
        if (G.target !== target) { G.target = target; G.actionT = 0; }
        player.swing = Math.min(1, player.swing + dt * 6);
        G.actionT += dt;
        const need = T.time / st.sm;
        const p = target.obj.position.clone(); p.y = 1.2; p.project(camera);
        bar.classList.remove('hidden'); bar.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; bar.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
        $('actionfill').style.width = Math.min(100, G.actionT / need * 100) + '%';
        if (Math.random() < dt * 14) puff(target.obj.position.clone().setY(.4), pcol, 1, 1.5);
        if (G.actionT >= need) {
          G.actionT = 0; G.target = null; bar.classList.add('hidden');
          removeItem(target, J.fly ? player.pos.clone().setY(1.5) : null);
          puff(target.obj.position.clone().setY(.4), pcol, 10);
          player.bag++; updateCarry();
          if (player.bag >= st.cap) toast(`${J.word}! Неси ${DROP_NAME[J.drop]}`, 1500);
        }
      }
    } else { G.target = null; G.actionT = 0; bar.classList.add('hidden'); }
  }
  if (!working()) player.swing = Math.max(0, player.swing - dt * 5);
  tryDeposit();
}

/* ---------- Помощники (NPC) ---------- */
function spawnHelpers() {
  for (const h of helpers) scene.remove(h.obj); helpers = [];
  if (!charTemplate) return;
  const tints = [0x8ab4ff, 0xff9ad0];
  for (let i = 0; i < save.helpers; i++) {
    const g = new THREE.Group(), body = new THREE.Group(), m = charTemplate.clone(true);
    m.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (o.material.color) o.material.color.multiply(new THREE.Color(tints[i])); } });
    body.add(m); g.add(body);
    const tg = new THREE.Group(); tg.position.set(0.45, 1.2, 0.3); body.add(tg);
    buildTool(G.tool, tg);
    g.position.set(-3 + i * 6, 0, 17); scene.add(g);
    helpers.push({ obj: g, body, tool: tg, bag: 0, target: null, t: 0, walkT: 0, dir: new THREE.Vector3(0, 0, -1) });
  }
}
function updateHelpers(dt) {
  const job = G.job, J = JOBS[job], cap = J.help.cap, drop = dropPos(job);
  for (const h of helpers) {
    let goal = null, busy = false;
    const noneLeft = !G.items.some(it => !it.by || it.by === h);
    if (h.bag > 0 && (h.bag >= cap || noneLeft)) {
      goal = drop;
      if (dist2(h.obj.position, drop) < 2.6) { const n = h.bag; h.bag = 0; depositUnits(n, drop); goal = null; }
    } else {
      if (h.target && !G.items.includes(h.target)) h.target = null;
      if (!h.target) {
        let best = 1e9;
        for (const it of G.items) { if (it.by && it.by !== h) continue; const d = dist2(it.obj.position, h.obj.position); if (d < best) { best = d; h.target = it; } }
        if (h.target) h.target.by = h;
      }
      if (h.target) {
        const p = h.target.obj.position;
        if (dist2(h.obj.position, p) > 1.0) goal = p;
        else {
          busy = true; h.t += dt;
          if (h.t >= J.help.time) {
            h.t = 0;
            if (J.mech === 'sweep') {
              let n = 0;
              for (const it of [...G.items]) { if (dist2(it.obj.position, p) < 1.3 && h.bag < cap && (!it.by || it.by === h)) { removeItem(it, h.obj.position.clone().setY(1.2)); h.bag++; n++; } }
            } else { removeItem(h.target, null); puff(p.clone().setY(.4), J.drop === 'wood' ? 0xd9b27a : J.col, 6); h.bag++; }
            h.target = null;
          }
        }
      } else if (dist2(h.obj.position, player.pos) > 6) goal = player.pos;
    }
    let moving = false;
    if (goal) {
      const d = new THREE.Vector3(goal.x - h.obj.position.x, 0, goal.z - h.obj.position.z); const len = d.length();
      if (len > 0.05) { d.normalize(); h.obj.position.addScaledVector(d, Math.min(len, 4.0 * dt)); h.dir.lerp(d, Math.min(1, dt * 10)); moving = true; }
    }
    h.obj.rotation.y = Math.atan2(h.dir.x, h.dir.z);
    if (moving) h.walkT += dt * 10;
    h.body.position.y = moving ? Math.abs(Math.sin(h.walkT)) * 0.1 : 0;
    h.tool.rotation.x = busy ? -0.5 + Math.sin(tAll * 18) * 0.5 : 0;
  }
}

/* ================= Босс ================= */
function eyes(parent, y, z, s = 1) {
  for (const x of [-0.5, 0.5]) {
    const e = mesh(new THREE.SphereGeometry(0.34 * s, 12, 10), mat(0xffffff), x * s, y, z, false);
    e.add(mesh(new THREE.SphereGeometry(0.16 * s, 10, 8), mat(0x111111), 0, 0, 0.22 * s, false));
    const brow = mesh(new THREE.BoxGeometry(0.6 * s, 0.1 * s, 0.1 * s), mat(0x2a1a10), 0, 0.42 * s, 0.15 * s, false); brow.rotation.z = -x * 0.8;
    e.add(brow); parent.add(e);
  }
}
function buildBoss(job) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  if (job === 'leaves') {
    for (let i = 0; i < 22; i++) { const s = mesh(new THREE.IcosahedronGeometry(rnd(.5, .9), 1), mat(pick(leafCols)), rnd(-.9, .9), rnd(.5, 2.4), rnd(-.9, .9)); s.scale.y = .8; body.add(s); }
    for (const x of [-1.3, 1.3]) body.add(mesh(new THREE.IcosahedronGeometry(.6, 1), mat(pick(leafCols)), x, 1.4, 0));
    eyes(body, 1.9, 1.0, 1.2);
  } else if (job === 'branches') {
    body.add(mesh(new THREE.CylinderGeometry(.8, 1, 3, 8), logMat, 0, 1.5, 0));
    for (const s of [-1, 1]) { const arm = mesh(new THREE.CylinderGeometry(.18, .25, 2.2, 6), logMat, s * 1.4, 2, 0); arm.rotation.z = -s * 0.9; body.add(arm); const tw = mesh(new THREE.CylinderGeometry(.08, .12, 1, 5), logMat, s * 2.2, 3, 0); tw.rotation.z = s * 0.4; body.add(tw); }
    eyes(body, 2.2, .85, 1.1);
  } else if (job !== 'pile') {
    // босс новой работы: большая куча того, что убирали, с глазами и короной из кусочков
    const J = JOBS[job], c = new THREE.Color(J.col);
    body.add(mesh(new THREE.SphereGeometry(1.5, 14, 12), mat(c), 0, 1.5, 0));
    for (let i = 0; i < 14; i++) { const a = rnd(0, 6.28), e = rnd(-.2, 1.2); body.add(mesh(new THREE.IcosahedronGeometry(rnd(.35, .6), 0), mat(c.clone().offsetHSL(rnd(-.03, .03), 0, rnd(-.1, .1))), Math.cos(a) * 1.4, 1.5 + Math.sin(e) * 1.3, Math.sin(a) * 1.4)); }
    for (const s of [-1, 1]) body.add(mesh(new THREE.CylinderGeometry(.2, .26, 1.8, 6), mat(c.clone().offsetHSL(0, 0, -.12)), s * 1.7, 1.3, 0));
    eyes(body, 1.8, 1.3, 1.2);
  } else {
    // Куча-Великан: большая куча листьев в коробке-короне
    body.add(mesh(new THREE.SphereGeometry(1.5, 14, 12), mat(0xc0592b), 0, 1.5, 0));
    for (let i = 0; i < 16; i++) { const a = rnd(0, 6.28), e = rnd(-.2, 1.2); const c = mesh(new THREE.IcosahedronGeometry(rnd(.35, .6), 0), mat(pick(leafCols)), Math.cos(a) * 1.4, 1.5 + Math.sin(e) * 1.3, Math.sin(a) * 1.4); body.add(c); }
    body.add(mesh(new THREE.BoxGeometry(2.2, .8, 2.2), mat(0xb9824a), 0, 3.2, 0));
    eyes(body, 1.8, 1.3, 1.2);
  }
  g.userData.body = body; return g;
}
function spawnBoss() {
  G.state = 'boss';
  for (const h of helpers) h.obj.visible = false;
  dropRing.visible = false;
  const lv = G.level, obj = buildBoss(G.job); obj.position.set(0, 0, -6); scene.add(obj);
  G.boss = { obj, hp: lv.hp, max: lv.hp, speed: lv.speed, hurt: 0, shootT: 3, t: 0, state: 'spawn', dashT: 5 };
  obj.scale.setScalar(0.01);
  player.hp = player.maxHp; renderHearts(); player.inv = 1;
  $('bossbar').classList.remove('hidden'); $('bossname').textContent = '👹 ' + JOBS[G.job].boss; $('bossfill').style.width = '100%';
  $('actionbar').classList.add('hidden');
  // оружие против босса появляется у дерева
  G.bw = false;
  if (G.bwObj) treeGroup.remove(G.bwObj);
  const W = BOSS_W['bw_' + G.job], disp = new THREE.Group(), wg = new THREE.Group(); buildTool('bw_' + G.job, wg); wg.rotation.set(-1.3, 0, 0); wg.scale.setScalar(1.3); disp.add(wg);
  disp.add(mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 24), mat(0xffe27a, { emissive: 0xffc830, emissiveIntensity: 1 }), 0, 0, 0, false));
  disp.children[1].rotation.x = Math.PI / 2; disp.position.set(0, 2.6, 2.2); treeGroup.add(disp); G.bwObj = disp;
  player.tool.visible = G.held;
  toast('Всё вокруг ожило! БОСС! Оружие против него лежит у дерева', 3200);
  hint(`Подойди к дереву и нажми Q: оставишь свой инструмент и возьмёшь «${W.name}». Босса бьют только им! Уворачивайся!`);
}
function hurtPlayer(from, push = 4) {
  if (player.inv > 0) return;
  player.hp--; player.inv = 1.4; renderHearts();
  const d = player.pos.clone().sub(from).setY(0).normalize(); player.vel.copy(d.multiplyScalar(push * 2.2));
  puff(player.pos.clone().setY(1), 0xffd36b, 6);
  if (player.hp <= 0) {
    player.hp = player.maxHp; renderHearts(); player.inv = 2;
    if (G.boss) { toast('Устал! Отдышись: босс чуть отдохнул тоже', 2200); G.boss.hp = Math.min(G.boss.max, G.boss.hp + 2); updateBossBar(); }
    else toast('Устал! Отдышись, паучки отстали', 2000);
  }
}
const updateBossBar = () => { $('bossfill').style.width = (100 * Math.max(0, G.boss.hp) / G.boss.max) + '%'; };
function updateBoss(dt) {
  const b = G.boss; if (!b) return;
  b.t += dt; b.hurt = Math.max(0, b.hurt - dt);
  const body = b.obj.userData.body;
  if (b.state === 'spawn') {
    const k = Math.min(1, b.t / 1.2); b.obj.scale.setScalar(Math.max(.01, (0.5 + .5 * k + Math.sin(k * Math.PI) * .25) * k));
    if (b.t > 1.2) { b.state = 'fight'; b.obj.scale.setScalar(1); }
    return;
  }
  if (b.state === 'dead') {
    b.obj.scale.multiplyScalar(1 - dt * 2.2); b.obj.rotation.y += dt * 8;
    if (b.t > 1.3) { scene.remove(b.obj); b.state = 'gone'; levelWin(); }
    return;
  }
  if (b.state === 'gone') return;
  const d = player.pos.clone().sub(b.obj.position).setY(0); const dist = d.length(); d.normalize();
  const rage = b.hp < b.max * 0.5;   // вторая половина боя: босс злится, быстрее бегает, чаще рвётся и стреляет
  if (rage && !b.raged) { b.raged = true; toast('Босс разозлился!', 1500); puff(b.obj.position.clone().setY(1.5), 0xff5a3a, 20, 5); }
  let sp = b.speed * (rage ? 1.3 : 1);
  if (b.dashing) { sp *= 3; b.dashing -= dt; if (b.dashing <= 0) { b.dashing = 0; b.dashT = rage ? rnd(2.5, 3.8) : rnd(3.5, 5); } }
  else { b.dashT -= dt; if (b.dashT < 0.6) body.position.x = Math.sin(b.t * 50) * 0.08; if (b.dashT <= 0) { b.dashing = 0.6; b.dir = d.clone(); } }
  const mv = b.dashing && b.dir ? b.dir : d;
  b.obj.position.addScaledVector(mv, sp * dt * (dist > 1.6 || b.dashing ? 1 : 0));
  b.obj.position.x = THREE.MathUtils.clamp(b.obj.position.x, -YARD, YARD); b.obj.position.z = THREE.MathUtils.clamp(b.obj.position.z, -YARD, YARD);
  b.obj.rotation.y = Math.atan2(d.x, d.z);
  const s = 1 + Math.sin(b.t * 6) * 0.04 + (b.hurt > 0 ? -0.12 : 0);
  body.scale.set(s, 2 - s, s);
  if (!b.dashing && b.dashT > .6) body.position.x = 0;
  if (dist < 2.1) hurtPlayer(b.obj.position, b.dashing ? 5 : 3);
  if (G.level.shoots) {
    b.shootT -= dt;
    if (b.shootT <= 0) {
      b.shootT = rage ? rnd(1.8, 2.6) : rnd(2.4, 3.4);
      const col = JOBS[G.job].col;
      for (const a of (rage ? [-0.6, -0.3, 0, 0.3, 0.6] : [-0.4, 0, 0.4])) {
        const v = d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a).multiplyScalar(rage ? 6.5 : 5.5);
        const o = mesh(new THREE.IcosahedronGeometry(.3, 0), mat(col), b.obj.position.x, 1.3, b.obj.position.z); scene.add(o); G.shots.push({ obj: o, v, life: 4 });
      }
    }
  }
  G.attackCd -= dt;
  if (working() && G.attackCd <= 0) {
    if (!G.bw) {   // босса берёт только его оружие
      G.attackCd = 0.6; player.swing = 1;
      if (tAll - lastNoTool > 2.5) { lastNoTool = tAll; toast('Обычным инструментом босса не взять! Оружие у дерева (Q)', 2200); }
    } else {
    G.attackCd = BOSS_CD; player.swing = 1;
    if (dist < BOSS_RANGE) {
      b.hp -= BOSS_DMG; b.hurt = .2; updateBossBar();
      puff(b.obj.position.clone().setY(1.5), JOBS[G.job].drop === 'wood' ? 0xd9b27a : JOBS[G.job].col, 8);
      b.obj.position.addScaledVector(d, -0.7);
      if (b.hp <= 0) { b.state = 'dead'; b.t = 0; puff(b.obj.position.clone().setY(1.5), 0xffe08a, 30, 6); toast('Победа!', 1500); }
    }
    }
  }
}
function updateShots(dt) {
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i]; s.life -= dt; s.obj.position.addScaledVector(s.v, dt); s.obj.rotation.x += dt * 5;
    const hit = Math.hypot(s.obj.position.x - player.pos.x, s.obj.position.z - player.pos.z) < 0.9;
    if (hit) hurtPlayer(s.obj.position, 2);
    if (hit || s.life <= 0) { scene.remove(s.obj); G.shots.splice(i, 1); }
  }
}

/* ================= Прогресс по уровням ================= */
function jobComplete() {
  if (G.state !== 'play') return;
  $('actionbar').classList.add('hidden'); dropRing.visible = false; killSpiders(); G.spiderLeft = 0;
  if (!G.level.boss) { levelWin(); return; }
  toast('Двор чистый! …но что это?', 1800);
  G.state = 'pre-boss';
  setTimeout(() => { if (G.state === 'pre-boss') spawnBoss(); }, 1600);
}
function levelWin() {
  const n = G.level.n, next = n + 1, first = n >= save.maxLevel;
  const gain = first ? 8 + (G.level.finale ? 5 : 0) + (G.level.boss ? 15 : 0) : 3;
  save.coins += gain;
  if (save.maxLevel < next) save.maxLevel = next;
  persist();
  G.state = 'win'; $('actionbar').classList.add('hidden');
  for (const h of helpers) h.obj.visible = false;
  if (G.level.finale) {
    const s = G.level.season;
    $('seasontitle').textContent = `🏁 Конец сезона ${s}`;
    $('seasontext').textContent = (G.level.boss ? `Босс побеждён, дача сияет! Пройдено уровней: ${n}.` : `Дача сияет! Пройдено уровней: ${n}. Впереди ещё 10 уровней, и в конце тебя ждёт босс.`) + ` Листочки: +${gain} ${COIN}`;
    $('seasonnext').textContent = `Сезон ${s + 1}: уровни ${n + 1}–${n + SEASON}`;
    setTimeout(() => { if (G.state === 'win') { $('season').classList.remove('hidden'); mouseDown = false; } }, 1200);
    toast('Сезон окончен!', 1500);
    return;
  }
  grantFreeTools(); persist();
  const fresh = first ? Object.values(JOBS).filter(j => j.unlock === next).map(j => j.name.toUpperCase()) : [];
  toast(`Уровень ${n} пройден! +${gain} ${COIN}` + (first && next === 4 ? ' В центре двора выросло ДЕРЕВО СИЛЫ.' : '') + (fresh.length ? ` Открылись работы: ${fresh.join(', ')}` : ''), fresh.length > 1 ? 4800 : 3400);
  setTimeout(() => { if (G.state === 'win') toMenu(next); }, fresh.length > 1 ? 5000 : 3600);
}
$('seasonnext').onclick = () => { $('season').classList.add('hidden'); toMenu(G.level.n + 1); };

/* ================= Дерево силы (меню улучшений) ================= */
let treeTab = 'shop', treeJob = 'leaves';
function openTree() { G.paused = true; mouseDown = false; if (window.__resetTouch) window.__resetTouch(); treeTab = 'shop'; if (G.state === 'play') treeJob = G.job; renderTree(); $('tree').classList.remove('hidden'); }
function closeTree() {
  $('tree').classList.add('hidden'); G.paused = false; mouseDown = false; persist();
  if (G.state !== 'menu') { G.st = stats(G.tool); player.maxHp = 5 + (save.abil.hearts || 0); player.hp = Math.min(player.hp, player.maxHp); renderHearts(); updateCarry(); }
  else buildMenu();
}
function toolStatLine(t) {
  const T = TOOLS[t];
  return JOBS[T.job].mech === 'sweep'
    ? `охват ${T.reach}, за взмах до ${T.n} листьев, несёт ${T.cap}`
    : `дальность ${T.range}, ${T.time} сек на работу, несёт ${T.cap}`;
}
function renderTree() {
  const tabs = [['shop', '🛒 Инструменты'], ['tools', '🔧 Улучшения'], ['tree', '🌳 Дерево'], ['abil', '✨ Способности']];
  let h = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h2 style="margin:0">🌳 Дерево силы</h2><b style="font-size:20px">Листочки: ${save.coins} ${COIN}</b></div>
    <div class="row" style="margin:12px 0">${tabs.map(([id, t]) => `<button data-act="tab:${id}" class="${treeTab === id ? 'sel' : ''}">${t}</button>`).join('')}<button data-act="close" style="margin-left:auto">Закрыть (Esc)</button></div>`;
  const openJobs = Object.entries(JOBS).filter(([, J]) => J.unlock <= save.maxLevel);
  if (!openJobs.some(([id]) => id === treeJob)) treeJob = G.state === 'play' && JOBS[G.job] ? G.job : 'leaves';
  const jobChips = (treeTab === 'shop' || treeTab === 'tools') ? `<div class="row" style="margin:0 0 10px">${openJobs.map(([id, J]) => `<button data-act="tjob:${id}" class="${id === treeJob ? 'sel' : ''}" title="${J.name}">${J.icon} ${J.name}</button>`).join('')}</div>` : '';
  h += jobChips;
  if (treeTab === 'shop') {
    h += `<p style="font-size:14px">Здесь за листочки покупаются новые инструменты для каждой работы. Купленный инструмент выбирается в главном меню перед уровнем. Листочки дают за пройденные уровни.</p>`;
    for (const [jid, J] of openJobs.filter(([id]) => id === treeJob)) {
      h += `<h2>${J.icon} ${J.name}</h2>`;
      for (const t of J.tools) {
        const T = TOOLS[t], has = save.tools.includes(t);
        h += `<div class="tcard"><div class="eff" style="border:0;padding:0"><span><b>${T.icon} ${T.name}</b><br><small style="margin:0">${toolStatLine(t)}</small></span>` +
          (has ? `<b>Есть ✅</b>` : `<button data-act="buytool:${t}" ${save.coins < T.price ? 'disabled' : ''}>Купить ${T.price} ${COIN}</button>`) + `</div></div>`;
      }
    }
  } else if (treeTab === 'tools') {
    h += `<p style="font-size:14px">Инструмент либо у тебя в руках, либо лежит у дерева (<b>Q</b> у дерева: взять / положить). Работать можно только тем, что в руках. Улучшения работают у инструментов, закреплённых в <b>слотах дерева: ${save.placed.length} / ${slots()}</b>${save.workshop ? ' (у тебя есть Мастерская: слоты не нужны, улучшения работают у всех)' : ''}. Улучшение стоит ${EFFECT_COST} ${COIN}, потом его можно включать и выключать.</p>`;
    const mine = Object.keys(TOOLS).filter(t => save.tools.includes(t) && TOOLS[t].job === treeJob);
    if (!mine.length) h += `<p>В этой работе у тебя пока нет инструментов.</p>`;
    for (const t of mine) {
      const on = save.placed.includes(t), act = toolActive(t), owned = save.owned[t] || [];
      const inHand = G.state === 'play' && G.held && G.tool === t, sameJob = G.state === 'play' && TOOLS[t].job === G.job;
      const handBtn = G.state !== 'play' ? '' : inHand ? `<button data-act="putback">Положить у дерева</button>` : `<button data-act="take:${t}" ${sameJob ? '' : 'disabled'}>${sameJob ? 'Взять в руки' : 'Другая работа'}</button>`;
      h += `<div class="tcard${act ? '' : ' dim'}"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b>${TOOLS[t].icon} ${TOOLS[t].name} <small>${inHand ? '✋ в руках' : '🌳 лежит у дерева'}</small></b>
        <span style="display:flex;gap:6px">${handBtn}${save.workshop ? '<span>🔨 Мастерская</span>' : `<button data-act="slot:${t}" class="${on ? 'sel' : ''}" ${!on && save.placed.length >= slots() ? 'disabled' : ''}>${on ? 'В слоте ✔' : 'В слот'}</button>`}</span></div>`;
      EFFECTS[t].forEach((e, i) => {
        const has = owned.includes(i), enabled = (save.on[t] || {})[i] !== false;
        h += `<div class="eff"><span><b>${e.name}</b> <small>${e.desc}</small></span>` + (has
          ? `<button data-act="tog:${t}:${i}" class="${enabled ? 'sel' : ''}">${enabled ? 'ВКЛ' : 'ВЫКЛ'}</button>`
          : `<button data-act="buy:${t}:${i}" ${(!act || save.coins < EFFECT_COST) ? 'disabled' : ''}>Купить ${EFFECT_COST} ${COIN}</button>`) + `</div>`;
      });
      h += `</div>`;
    }
  } else if (treeTab === 'tree') {
    h += `<p>Уровень дерева: <b>${save.treeLvl} / 2</b>. Сейчас на дереве помещается инструментов: <b>${slots()}</b> (максимум 5).</p>`;
    if (save.treeLvl < 2) h += `<button data-act="treeup" ${save.coins < TREE_COST[save.treeLvl] ? 'disabled' : ''}>Прокачать дерево до ${save.treeLvl + 4} мест: ${TREE_COST[save.treeLvl]} ${COIN}</button>`;
    else h += `<p>Дерево прокачано полностью! 🌟</p>`;
    h += `<h2>🔨 Мастерская</h2><p style="font-size:14px">Когда дерево прокачано полностью, можно купить Мастерскую: тогда улучшать и использовать эффекты можно у <b>любых</b> инструментов, даже тех, что не лежат на дереве.</p>`;
    h += save.workshop ? `<p><b>Мастерская куплена ✅</b></p>` : `<button data-act="workshop" ${(save.treeLvl < 2 || save.coins < WORKSHOP_COST) ? 'disabled' : ''}>Купить Мастерскую: ${WORKSHOP_COST} ${COIN}${save.treeLvl < 2 ? ' (сначала прокачай дерево)' : ''}</button>`;
  } else {
    const open = ownedTotal() >= ABIL_UNLOCK;
    if (!open) h += `<p>🔒 Откроется, когда купишь ${ABIL_UNLOCK} улучшений инструментов (любых, например 5 у одного и 5 у другого). Сейчас: <b>${ownedTotal()} / ${ABIL_UNLOCK}</b></p>`;
    else {
      h += `<p style="font-size:14px">Способности героя. Каждый следующий уровень дороже.</p>`;
      for (const [id, a] of Object.entries(ABIL)) {
        const lv = save.abil[id] || 0, cost = abilCost(lv);
        h += `<div class="eff"><span><b>${a.icon} ${a.name}</b> <small>${a.desc}</small> <b>${'●'.repeat(lv)}${'○'.repeat(a.max - lv)}</b></span>${lv >= a.max ? '<b>МАКС</b>' : `<button data-act="abil:${id}" ${save.coins < cost ? 'disabled' : ''}>${cost} ${COIN}</button>`}</div>`;
      }
    }
  }
  $('treebody').innerHTML = tt(h);
}
$('treebody').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const [a, x, y] = b.dataset.act.split(':');
  if (a === 'close') return closeTree();
  if (a === 'tab') treeTab = x;
  else if (a === 'tjob') treeJob = x;
  else if (a === 'buytool') { const T = TOOLS[x]; if (!save.tools.includes(x) && save.coins >= T.price) { save.coins -= T.price; save.tools.push(x); toast(`Куплено: ${T.name}!`, 1400); refreshTreeTools(); } }
  else if (a === 'take') { if (G.state === 'play') takeTool(x); }
  else if (a === 'putback') { if (G.state === 'play') putToolBack(); }
  else if (a === 'slot') { const i = save.placed.indexOf(x); if (i >= 0) save.placed.splice(i, 1); else if (save.placed.length < slots()) save.placed.push(x); }
  else if (a === 'buy') { if (save.coins >= EFFECT_COST && save.tools.includes(x) && toolActive(x)) { save.coins -= EFFECT_COST; (save.owned[x] = save.owned[x] || []).push(+y); } }
  else if (a === 'tog') { const o = (save.on[x] = save.on[x] || {}); o[y] = o[y] === false; }
  else if (a === 'treeup') { const c = TREE_COST[save.treeLvl]; if (save.treeLvl < 2 && save.coins >= c) { save.coins -= c; save.treeLvl++; } }
  else if (a === 'workshop') { if (save.treeLvl >= 2 && !save.workshop && save.coins >= WORKSHOP_COST) { save.coins -= WORKSHOP_COST; save.workshop = true; } }
  else if (a === 'abil') { const lv = save.abil[x] || 0, c = abilCost(lv); if (ownedTotal() >= ABIL_UNLOCK && lv < ABIL[x].max && save.coins >= c) { save.coins -= c; save.abil[x] = lv + 1; } }
  persist(); renderTree();
});

/* Инструмент либо в руках, либо лежит у дерева. Работать можно только тем, что в руках. */
function applyHeld() {
  player.tool.visible = G.held; G.st = stats(G.tool); updateCarry(); refreshTreeTools();
  puff(new THREE.Vector3(TREE.x, 2.5, TREE.z), 0xffe27a, 10);
}
function putToolBack() {
  if (player.bag > 0) { toast('Сначала сдай то, что несёшь', 1500); return false; }
  G.held = false; applyHeld(); toast(`${TOOLS[G.tool].name} положен у дерева`, 1300); return true;
}
function takeTool(t) {
  if (TOOLS[t].job !== G.job) { toast('Это инструмент для другой работы', 1600); return false; }
  if (G.held && G.tool !== t && !putToolBack()) return false;
  if (G.tool !== t) { G.tool = t; buildTool(t, player.tool); }
  G.held = true; applyHeld(); toast(`Взят: ${TOOLS[t].name}`, 1300); hint('Работай: держи ПРОБЕЛ. Положить инструмент обратно: Q у дерева'); return true;
}
/* Q у дерева: взять инструмент (тот, что выбран в меню) или положить обратно */
function toggleTreeTool() { if (G.state === 'boss') toggleBossWeapon(); else if (G.held) putToolBack(); else takeTool(G.tool); }
/* Против босса: оставляешь у дерева рабочий инструмент и берёшь оружие босса (и наоборот) */
function toggleBossWeapon() {
  const W = BOSS_W['bw_' + G.job];
  if (G.bw) { G.bw = false; G.held = false; buildTool(G.tool, player.tool); player.tool.visible = false; if (G.bwObj) G.bwObj.visible = true; toast(`${W.name} положено у дерева`, 1300); }
  else { G.bw = true; G.held = false; buildTool('bw_' + G.job, player.tool); player.tool.visible = true; if (G.bwObj) G.bwObj.visible = false; toast(`Взято: ${W.name}! Бей босса (ПРОБЕЛ)`, 1800); hint('Оружие бьёт на среднюю дистанцию: подходи близко, но следи, чтобы босс тебя не достал'); }
  puff(new THREE.Vector3(TREE.x, 2.5, TREE.z), 0xffe27a, 12); updateCarry(); refreshTreeTools();
}
const treeToolsGroup = new THREE.Group(); treeGroup.add(treeToolsGroup);
function refreshTreeTools() {
  treeToolsGroup.clear();
  const list = save.tools.filter(t => !(G.held && t === G.tool && G.state !== 'menu'));
  list.forEach((t, i) => {
    const n = list.length, a = (i / n) * Math.PI * 2 + 0.4, ring = i % 2;
    const g = new THREE.Group(), tg = new THREE.Group(); buildTool(t, tg); g.add(tg);
    tg.rotation.set(-1.3, 0, 0);
    g.scale.setScalar(0.6);
    g.position.set(Math.cos(a) * 1.25, 1.6 + ring * 1.1, Math.sin(a) * 1.25); g.rotation.y = Math.PI / 2 - a;
    treeToolsGroup.add(g);
  });
}
refreshTreeTools();
$('treebtn').onclick = () => openTree();

/* ================= Главное меню ================= */
let selLevel = 1, selJob = 'leaves', selTool = 'broom';
function buildMenu() {
  const season = Math.ceil(selLevel / SEASON), first = (season - 1) * SEASON + 1;
  $('seasonlabel').textContent = `Сезон ${season}`;
  $('seasonprev').disabled = season <= 1;
  $('seasonnextbtn').disabled = first + SEASON > save.maxLevel;
  $('seasonprev').onclick = () => { selLevel = first - SEASON; buildMenu(); };
  $('seasonnextbtn').onclick = () => { selLevel = first + SEASON; buildMenu(); };
  const lv = $('levels'); lv.innerHTML = '';
  for (let n = first; n < first + SEASON; n++) {
    const L = levelDef(n), b = document.createElement('button'); b.className = 'lvl' + (n === selLevel ? ' sel' : '');
    const locked = n > save.maxLevel; b.disabled = locked; b.style.flex = '1 1 90px';
    b.innerHTML = `${locked ? '🔒' : ''} ${n}<small>${locked ? 'закрыто' : L.boss ? '👹 босс' : L.finale ? '🏁 финал' : 'уборка'}</small>`;
    b.onclick = () => { selLevel = n; buildMenu(); };
    lv.appendChild(b);
  }
  if (!levelDef(selLevel).jobs.includes(selJob)) selJob = 'leaves';
  const L = levelDef(selLevel), jb = $('jobs'); jb.innerHTML = '';
  for (const id of Object.keys(JOBS)) {
    if (Math.ceil(JOBS[id].unlock / SEASON) > season) continue;   // работы следующих глав пока не показываем
    const j = JOBS[id], ok = L.jobs.includes(id), b = document.createElement('button'); b.className = 'lvl' + (id === selJob ? ' sel' : ''); b.disabled = !ok;
    b.innerHTML = `${ok ? j.icon : '🔒'} ${j.name}<small>${ok ? (L.boss ? 'босс: ' + j.boss : 'нужно: ' + totalFor(id, selLevel)) : 'откроется на уровне ' + j.unlock}</small>`;
    b.onclick = () => { selJob = id; buildMenu(); };
    jb.appendChild(b);
  }
  // выбор инструмента для листьев
  const tr = $('toolrow'); tr.innerHTML = '';
  const tools = JOBS[selJob].tools;
  if (!tools.includes(selTool) || !save.tools.includes(selTool)) selTool = tools[0];
  for (const t of tools) {
    const has = save.tools.includes(t), b = document.createElement('button'); b.className = 'lvl' + (t === selTool ? ' sel' : ''); b.disabled = !has;
    const bonus = save.placed.includes(t) ? '🌳 слот улучшений' : 'лежит у дерева';
    b.innerHTML = has ? `${TOOLS[t].icon} ${TOOLS[t].name}<small>${save.maxLevel >= 4 ? bonus : toolStatLine(t)}</small>` : `🔒 ${TOOLS[t].name}<small>${save.maxLevel >= 4 ? 'купи на дереве: ' + TOOLS[t].price + ' ' + COIN : 'откроется позже'}</small>`;
    b.onclick = () => { selTool = t; buildMenu(); };
    tr.appendChild(b);
  }
  // помощники
  const hp = $('helpers'); hp.innerHTML = '';
  for (let i = 0; i <= 2; i++) {
    const b = document.createElement('button'); b.className = i === save.helpers ? 'sel' : ''; b.textContent = i === 0 ? 'Без помощников' : i === 1 ? '1 помощник' : '2 помощника';
    b.onclick = () => { save.helpers = i; persist(); buildMenu(); };
    hp.appendChild(b);
  }
  $('pts').textContent = `${COIN} Листочки: ${save.coins}`;
  $('treebtn').classList.toggle('hidden', save.maxLevel < 4);
  $('joblvlinfo').textContent = (L.season >= SPIDER_SEASON && JOBS[selJob].spiders ? '🕷️ Осторожно: из-под всего, что убираешь, выскакивают паучки! Бей их 2–3 раза. ' : '') + (L.boss ? 'Закончишь работу, и всё, что ты убирал, соберётся в босса.' : L.finale ? 'Конец сезона: просто большая уборка, без боя.' : 'Просто наведи порядок во дворе. Босс ждёт на 20-м уровне.');
}
function toMenu(lvl) {
  G.state = 'menu'; G.paused = false; $('leave').classList.add('hidden'); clearLevel(); mouseDown = false; if (window.__resetTouch) window.__resetTouch(); $('tree').classList.add('hidden'); $('prompt').classList.add('hidden');
  if (lvl) selLevel = Math.min(lvl, save.maxLevel);
  treeGroup.visible = save.maxLevel >= 4;
  buildMenu(); $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); $('toast').classList.remove('show');
  player.pos.set(0, 0, 8); player.bag = 0; G.held = true; player.tool.visible = true; updateCarry(); refreshTreeTools();
}
$('start').onclick = () => {
  if (net.role === 'guest') { toast('Двор запускает хозяин комнаты. Подожди...', 1800); return; }
  const seed = (Math.random() * 1e9) | 0;
  startLevel(levelDef(selLevel), selJob, selTool, seed);
  netSend({ t: 'start', n: selLevel, job: selJob, seed });
};

/* ================= Чит-коды ================= */
function runCheat(raw) {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  let m;
  // to level N / N-level: открывает ГЛАВУ (сезон) N, то есть её первый уровень, а не отдельный уровень
  if ((m = s.match(/^(?:(?:to ?level|level|lvl|уровень|глава)[ -]?(\d+)|(\d+)[ -]?(?:level|lvl))$/))) {
    const ch = Math.max(1, Math.min(999, +(m[1] || m[2]))), first = (ch - 1) * SEASON + 1;
    save.maxLevel = Math.max(save.maxLevel, first); selLevel = first; grantFreeTools(); persist(); buildMenu();
    return `Готово: глава ${ch} открыта (уровни с ${first}). Нажми «Выйти во двор».`;
  }
  if ((m = s.match(/^(?:coins|монеты|листья)\s*(\d+)$/))) { save.coins += Math.min(99999, +m[1]); persist(); buildMenu(); return `Готово: +${m[1]} ${COIN}`; }
  if (s === 'alltools' || s === 'все инструменты') { save.tools = Object.keys(TOOLS); persist(); buildMenu(); return 'Готово: все инструменты открыты.'; }
  return 'Такого кода нет.';
}
/* ---------- Профили (окно) ---------- */
const profCur = () => profiles.list.find(p => p.id === profiles.cur);
const profLevel = id => { try { const s = JSON.parse(localStorage.getItem(saveKey(id))); return s && s.maxLevel ? s.maxLevel : 1; } catch (e) { return 1; } };
const profSwitch = id => { persist(); profiles.cur = id; saveProfiles(); location.reload(); };
function renderProfiles() {
  $('profcur').textContent = profCur().name;
  const box = $('proflist'); box.textContent = '';
  for (const p of profiles.list) {
    const row = document.createElement('div'); row.className = 'row'; row.style.cssText = 'align-items:center;margin:6px 0';
    const nm = document.createElement('b'); nm.style.flex = '1'; nm.textContent = `${p.id === profiles.cur ? '✅ ' : ''}${p.name}  ·  уровень ${p.id === profiles.cur ? save.maxLevel : profLevel(p.id)}`; row.appendChild(nm);
    const add = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'font-size:13px;padding:4px 10px'; b.onclick = fn; row.appendChild(b); };
    if (p.id !== profiles.cur) add('Выбрать', () => profSwitch(p.id));
    add('✏️', () => { const n = prompt('Новое имя профиля', p.name); if (n && n.trim()) { p.name = n.trim().slice(0, 16); saveProfiles(); renderProfiles(); } });
    add('🗑', () => {
      if (!confirm(`Удалить профиль «${p.name}» вместе с прогрессом? Это нельзя отменить.`)) return;
      try { localStorage.removeItem(saveKey(p.id)); } catch (e) {}
      profiles.list = profiles.list.filter(x => x.id !== p.id);
      if (!profiles.list.length) profiles.list.push({ id: 'p1', name: 'Игрок 1' });
      if (p.id === profiles.cur) { profiles.cur = profiles.list[0].id; saveProfiles(); location.reload(); return; }
      saveProfiles(); renderProfiles();
    });
    box.appendChild(row);
  }
}
const profLink = () => location.origin.startsWith('http') ? location.origin + location.pathname + '#' + encodeSave(profCur().name, save) : null;
$('profbtn').onclick = () => { renderProfiles(); $('profmsg').textContent = ''; $('prof').classList.remove('hidden'); };
$('profclose').onclick = () => $('prof').classList.add('hidden');
$('profnew').onclick = () => {
  const n = $('profname').value.trim() || `Игрок ${profiles.list.length + 1}`;
  persist(); addProfile(n, null); location.reload();
};
$('profexp').onclick = () => { persist(); $('profcode').value = encodeSave(profCur().name, save); $('profcode').select(); $('profmsg').textContent = 'Код готов. Скопируй его и вставь на другом устройстве.'; };
const copyText = async t => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } };
$('profcopylink').onclick = async () => {
  persist(); const l = profLink() || encodeSave(profCur().name, save);
  $('profcode').value = l;
  $('profmsg').textContent = (await copyText(l)) ? 'Ссылка скопирована. Отправь её себе и открой на другом устройстве.' : 'Скопируй ссылку из поля вручную.';
};
$('profimp').onclick = () => {
  const o = decodeSave($('profcode').value);
  if (!o) { $('profmsg').textContent = 'Не получилось прочитать код. Проверь, что он скопирован целиком.'; return; }
  persist(); addProfile(o.name, o.s); location.reload();
};
for (const id of ['profname', 'profcode']) { const el = $(id); el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') $('profclose').click(); }); el.addEventListener('keyup', e => e.stopPropagation()); }
$('profcur').textContent = profCur().name;
$('cheatbtn').onclick =() => { $('cheat').classList.remove('hidden'); $('cheatmsg').textContent = ''; $('cheatin').focus(); };
$('cheatclose').onclick = () => $('cheat').classList.add('hidden');
$('cheatgo').onclick = () => { $('cheatmsg').textContent = runCheat($('cheatin').value); $('cheatin').select(); };
$('cheatin').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('cheatgo').click(); if (e.key === 'Escape') $('cheatclose').click(); });
document.querySelectorAll('#cheat [data-code]').forEach(b => b.onclick = () => { $('cheatin').value = b.dataset.code; $('cheatgo').click(); });

/* ================= Мультиплеер: WebRTC через PeerJS (свой сервер не нужен) =================
   Хозяин создаёт комнату с кодом, остальные входят по коду. Общие: двор (одинаковые листья по seed),
   какие листья уже убраны и сколько сдано. Остальное (паучки, босс) у каждого своё. */
const net = { role: null, peer: null, conns: [], remote: new Map(), code: '', id: '', name: 'Игрок' + (10 + Math.floor(Math.random() * 90)), applying: false, sendT: 0 };
const newId = () => Math.random().toString(36).slice(2, 8);
function netSend(msg) {
  if (!net.role) return; msg.from = net.id;
  for (const c of net.conns) if (c.open) { try { c.send(msg); } catch (e) {} }
}
const loadPeer = () => window.Peer ? Promise.resolve() : new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = res; s.onerror = () => rej(new Error('peerjs')); document.head.appendChild(s);
});
const setNetMsg = t => { $('netmsg').textContent = t; };
function updateNetUI() {
  const n = net.conns.filter(c => c.open).length + (net.role ? 1 : 0);
  $('netbtn').textContent = net.role ? `🌐 Комната ${net.code} · игроков: ${n}` : '🌐 Играть вместе';
  $('start').textContent = net.role === 'guest' ? 'Ждём, пока хозяин выйдет во двор…' : 'Выйти во двор';
  $('netpill').classList.toggle('hidden', !net.role); $('netpill').textContent = `🌐 ${net.code} · 👥 ${n}`;
  if (net.role) setNetMsg(net.role === 'host' ? `Ты хозяин. Код комнаты: ${net.code}. Скажи его друзьям. Игроков: ${n}` : `Ты в комнате ${net.code}. Игроков: ${n}. Двор запустит хозяин.`);
}
function netLeave() {
  for (const c of net.conns) { try { c.close(); } catch (e) {} }
  if (net.peer) { try { net.peer.destroy(); } catch (e) {} }
  net.conns = []; net.peer = null; net.role = null; net.code = '';
  for (const r of net.remote.values()) remoteGroup.remove(r.g); net.remote.clear();
  updateNetUI();
}
function netDropConn(conn) {
  net.conns = net.conns.filter(c => c !== conn);
  if (conn.pid) { removeRemote(conn.pid); for (const c of net.conns) if (c.open) c.send({ t: 'bye', id: conn.pid }); }
  if (net.role === 'guest') { netLeave(); setNetMsg('Связь с комнатой потеряна.'); toast('Комната закрыта', 1800); } else updateNetUI();
}
async function netHost() {
  netLeave(); setNetMsg('Создаю комнату…');
  try { await loadPeer(); } catch (e) { return setNetMsg('Нет интернета: не загрузилась сетевая библиотека.'); }
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const tryCode = () => new Promise((resolve, reject) => {
    const code = Array.from({ length: 5 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
    const peer = new Peer('nadache-' + code);
    const to = setTimeout(() => { try { peer.destroy(); } catch (e) {} reject({ type: 'timeout' }); }, 9000);
    peer.on('open', () => { clearTimeout(to); resolve({ peer, code }); });
    peer.on('error', e => { clearTimeout(to); reject(e); });
  });
  let r = null;
  for (let i = 0; i < 3 && !r; i++) { try { r = await tryCode(); } catch (e) { if (!e || e.type !== 'unavailable-id') break; } }
  if (!r) return setNetMsg('Не получилось создать комнату (нет связи с сервером). Попробуй ещё раз.');
  net.peer = r.peer; net.code = r.code; net.id = newId(); net.role = 'host';
  r.peer.on('connection', conn => {
    conn.on('open', () => { net.conns.push(conn); updateNetUI(); toast('К комнате подключился игрок!', 1600); });
    conn.on('data', msg => { if (msg && msg.from) conn.pid = msg.from; netHandle(msg); for (const c of net.conns) if (c !== conn && c.open) { try { c.send(msg); } catch (e) {} } });   // получили от гостя: применяем и пересылаем остальным
    conn.on('close', () => netDropConn(conn)); conn.on('error', () => netDropConn(conn));
  });
  r.peer.on('disconnected', () => { try { r.peer.reconnect(); } catch (e) {} });
  updateNetUI();
}
async function netJoin(code) {
  code = code.trim().toUpperCase(); if (code.length < 4) return setNetMsg('Введи код комнаты (5 символов).');
  netLeave(); setNetMsg('Подключаюсь…');
  try { await loadPeer(); } catch (e) { return setNetMsg('Нет интернета: не загрузилась сетевая библиотека.'); }
  const peer = new Peer(); net.peer = peer;
  const fail = t => { if (net.role !== 'guest') { netLeave(); setNetMsg(t); } };
  const to = setTimeout(() => fail('Не получилось подключиться: комната не отвечает.'), 12000);
  peer.on('error', e => { clearTimeout(to); fail(e && e.type === 'peer-unavailable' ? 'Комната с таким кодом не найдена.' : 'Ошибка связи. Попробуй ещё раз.'); });
  peer.on('open', () => {
    const conn = peer.connect('nadache-' + code, { reliable: true });
    conn.on('open', () => { clearTimeout(to); net.conns = [conn]; net.role = 'guest'; net.code = code; net.id = newId(); updateNetUI(); toast('Ты в комнате!', 1500); });
    conn.on('data', msg => { if (msg && msg.from) conn.pid = msg.from; netHandle(msg); });
    conn.on('close', () => netDropConn(conn)); conn.on('error', () => netDropConn(conn));
  });
}
function netHandle(m) {
  if (!m || !m.t) return;
  if (m.t === 'p') updateRemote(m);
  else if (m.t === 'bye') removeRemote(m.id);
  else if (m.t === 'start') {
    if (net.role !== 'guest') return;
    const tool = JOBS[m.job] && JOBS[m.job].tools.includes(selTool) && save.tools.includes(selTool) ? selTool : null;
    $('net').classList.add('hidden'); $('cheat').classList.add('hidden'); $('prof').classList.add('hidden');
    startLevel(levelDef(m.n), m.job, tool, m.seed);
  } else if (m.t === 'rm') {
    if (G.state !== 'play' || m.seed !== G.seed) return;
    const it = G.items.find(i => i.id === m.id);
    if (it) { net.applying = true; removeItem(it, null); net.applying = false; }
  } else if (m.t === 'dep') {
    if (G.state !== 'play' || m.seed !== G.seed) return;
    net.applying = true; depositUnits(m.n, dropPos(G.job)); net.applying = false;
  }
}
/* другие игроки на экране */
const remoteGroup = new THREE.Group(); scene.add(remoteGroup);
const TINTS = [0x8ab4ff, 0xff9ad0, 0xa8e08a, 0xffd27a];
function nameSprite(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.lineWidth = 7; x.strokeStyle = '#3b2f22'; x.strokeText(text, 128, 44); x.fillStyle = '#fff'; x.fillText(text, 128, 44);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(2.6, 0.65, 1); s.position.y = 3.4; s.renderOrder = 10; return s;
}
function updateRemote(m) {
  if (!charTemplate) return;
  let r = net.remote.get(m.from);
  if (!r) {
    const g = new THREE.Group(), body = new THREE.Group(), mm = charTemplate.clone(true), tint = new THREE.Color(TINTS[net.remote.size % TINTS.length]);
    mm.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (o.material.color) o.material.color.multiply(tint); } });
    body.add(mm); g.add(body); g.add(nameSprite(m.name || 'Игрок'));
    const tg = new THREE.Group(); tg.position.set(0.45, 1.2, 0.3); body.add(tg);
    g.position.set(m.x, 0, m.z); remoteGroup.add(g);
    r = { g, body, tool: tg, toolId: null, tx: m.x, tz: m.z, dir: new THREE.Vector3(0, 0, 1), walkT: 0, mv: false, sw: 0 }; net.remote.set(m.from, r);
    toast(`${m.name || 'Игрок'} рядом!`, 1400);
  }
  r.tx = m.x; r.tz = m.z; r.dir.set(m.dx, 0, m.dz); r.mv = m.mv; r.sw = m.sw;
  if (m.tl && (TOOLS[m.tl] || BOSS_W[m.tl]) && r.toolId !== m.tl) { buildTool(m.tl, r.tool); r.toolId = m.tl; }
  r.tool.visible = !!m.held;
}
function removeRemote(id) { const r = net.remote.get(id); if (r) { remoteGroup.remove(r.g); net.remote.delete(id); } }
function updateRemotes(dt) {
  for (const r of net.remote.values()) {
    const k = Math.min(1, dt * 10);
    r.g.position.x += (r.tx - r.g.position.x) * k; r.g.position.z += (r.tz - r.g.position.z) * k;
    r.g.rotation.y = Math.atan2(r.dir.x, r.dir.z);
    if (r.mv) r.walkT += dt * 11;
    r.body.position.y = r.mv ? Math.abs(Math.sin(r.walkT)) * 0.12 : 0;
    r.tool.rotation.x = -r.sw * 0.9 + Math.sin(tAll * 22) * r.sw * 0.35;
  }
}
function netTick(dt, live) {
  remoteGroup.visible = live;
  if (!net.role) return;
  updateRemotes(dt);
  net.sendT += dt;
  if (live && net.sendT > 0.08) {
    net.sendT = 0;
    netSend({ t: 'p', name: net.name, x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), dx: +player.dir.x.toFixed(2), dz: +player.dir.z.toFixed(2), mv: !!player.moving, tl: G.bw ? 'bw_' + G.job : G.tool, held: G.held || G.bw, sw: +player.swing.toFixed(2) });
  }
}
$('netbtn').onclick = () => { $('net').classList.remove('hidden'); updateNetUI(); if (!net.role) setNetMsg(''); };
$('netclose').onclick = () => $('net').classList.add('hidden');
$('nethost').onclick = () => netHost();
$('netjoin').onclick = () => netJoin($('netcode').value);
$('netleave').onclick = () => { netLeave(); setNetMsg('Ты вышел из комнаты.'); };
$('netcode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('netjoin').click(); });
$('netcode').addEventListener('keyup', e => e.stopPropagation());
$('cheatin').addEventListener('keyup', e => e.stopPropagation());
addEventListener('beforeunload', () => { try { netSend({ t: 'bye', id: net.id }); } catch (e) {} });

/* ================= Главный цикл ================= */
const clock = new THREE.Clock(); const camPos = new THREE.Vector3(0, 16, 24);
function movePlayer(dt) {
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  if (Math.hypot(joy.x, joy.y) > 0.18) { ix += joy.x; iz += joy.y; }   // джойстик на телефоне
  const inp = new THREE.Vector3(ix, 0, iz); const moving = inp.lengthSq() > 0; if (moving) inp.normalize();
  const run = (keys.ShiftLeft || keys.ShiftRight || runOn) && moving;
  const A = save.abil, mm = G.state === 'menu' ? 1 : G.st.mm;
  let speed = run ? 9 * (1 + 0.1 * (A.run || 0)) : 5.5 * (1 + 0.08 * (A.walk || 0));
  if (player.bag > 0) speed *= (1 - 0.25 * Math.min(1, player.bag / Math.max(1, G.st.cap))) * mm;
  if (working() && JOBS[G.job].mech === 'sweep' && G.state === 'play') speed *= .8;
  player.pos.addScaledVector(inp, speed * dt);
  player.pos.addScaledVector(player.vel, dt); player.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -YARD, YARD); player.pos.z = THREE.MathUtils.clamp(player.pos.z, -YARD, YARD);
  if (moving) { player.dir.lerp(inp, Math.min(1, dt * 14)).normalize(); player.walkT += dt * (run ? 15 : 10); } else player.walkT *= 0.9;
  player.inv = Math.max(0, player.inv - dt); player.moving = moving;
  player.group.position.copy(player.pos);
  player.group.rotation.y = Math.atan2(player.dir.x, player.dir.z);
  const w = moving ? 1 : 0;
  player.model.position.y = Math.abs(Math.sin(player.walkT)) * (run ? 0.18 : 0.12) * w;
  player.model.rotation.z = Math.sin(player.walkT) * 0.07 * w;
  player.model.rotation.x = (run ? 0.22 : 0.1) * w + player.swing * 0.25;
  player.tool.rotation.x = -player.swing * 0.9 + Math.sin(tAll * 22) * player.swing * 0.35;
  player.model.visible = player.inv > 0 ? Math.floor(tAll * 20) % 2 === 0 : true;
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); tAll += dt;
  const live = G.state === 'play' || G.state === 'boss' || G.state === 'pre-boss' || G.state === 'win';
  if (live && !G.paused) {
    movePlayer(dt);
    if (G.state === 'play') { doWork(dt); updateHelpers(dt); attackSpiders(dt); updateSpiders(dt); }
    if (G.state === 'boss') { updateBoss(dt); updateShots(dt); if (!working()) player.swing = Math.max(0, player.swing - dt * 5); }
    if (G.state === 'pre-boss' || G.state === 'win') player.swing = Math.max(0, player.swing - dt * 5);
    updateFx(dt);
  } else if (!live) { player.model.rotation.y += dt * 0.8; player.model.position.y = 0; player.model.visible = true; player.tool.rotation.x = 0; }
  netTick(dt, live);
  // подсказки и кольцо
  if (G.bwObj && G.bwObj.visible) { G.bwObj.rotation.y += dt * 1.5; G.bwObj.position.y = 2.6 + Math.sin(tAll * 3) * 0.15; }
  const showPrompt = (G.state === 'play' || G.state === 'boss') && !G.paused && nearTree();
  $('prompt').classList.toggle('hidden', !showPrompt);
  if (showPrompt) $('treestate').textContent = G.state === 'boss' ? (G.bw ? `(в руках: ${BOSS_W['bw_' + G.job].name}, Q: положить)` : `(Q: оставить инструмент и взять ${BOSS_W['bw_' + G.job].name})`) : tt(G.held ? `(в руках: ${TOOLS[G.tool].name}, Q: положить)` : `(руки пустые, Q: взять ${TOOLS[G.tool].name})`);
  if (touchMode) {
    $('touch').classList.toggle('hidden', !(live && !G.paused));
    $('ttree').classList.toggle('hidden', !showPrompt); $('ttake').classList.toggle('hidden', !showPrompt);
    if (showPrompt) $('ttakelbl').textContent = (G.state === 'boss' ? G.bw : G.held) ? 'Положить' : 'Взять';
  } else $('touch').classList.add('hidden');
  if (treeGroup.visible) {
    const near = dist2(player.pos, TREE) < 10 || (G.boss && dist2(G.boss.obj.position, TREE) < 6) ? 0.25 : 1;
    for (const m of treeGroup.userData.canopy) m.opacity += (near - m.opacity) * Math.min(1, dt * 6);
  }
  if (dropRing.visible) { const s = 1 + Math.sin(tAll * 4) * 0.08; dropRing.scale.set(s, s, 1); dropRing.material.opacity = (player.bag > 0 ? 0.9 : 0.35); }
  const f = new THREE.Vector3(player.pos.x * .85, 0, player.pos.z * .85);
  const zoom = camera.aspect < 1.2 ? 1 + (1.2 - camera.aspect) * 0.9 : 1;   // узкий (вертикальный) экран: камера дальше
  const tgt = G.state === 'menu' ? new THREE.Vector3(0, 14, 24) : new THREE.Vector3(f.x, 11 * zoom, f.z + 9.5 * zoom);
  camPos.lerp(tgt, Math.min(1, dt * 4)); camera.position.copy(camPos);
  camera.lookAt(G.state === 'menu' ? new THREE.Vector3(0, 0, 8) : new THREE.Vector3(f.x, 0, f.z));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
selLevel = save.maxLevel; toMenu();
frame();
window.__game = { toggleBossWeapon, BOSS_W, G, player, spawnSpider, joy, setTouchMode, startLevel, levelDef, camera, scene, spawnBoss, save, helpers: () => helpers, openTree, closeTree, stats, depositUnits, updateCarry, JOBS, TOOLS };
