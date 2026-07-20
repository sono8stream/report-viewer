require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;
const SAVES_FILE = path.join(__dirname, 'saves.json');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('ERROR: .env に ADMIN_USER と ADMIN_PASS を設定してください');
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const companies = JSON.parse(fs.readFileSync(path.join(__dirname, 'companies.json'), 'utf8'));

function loadSaves() {
  if (!fs.existsSync(SAVES_FILE)) return {};
  return JSON.parse(fs.readFileSync(SAVES_FILE, 'utf8'));
}

function writeSaves(data) {
  fs.writeFileSync(SAVES_FILE, JSON.stringify(data, null, 2));
}

function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="Analyzer"');
  res.status(401).send('認証が必要です');
}

function isAdmin(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) return false;
  const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  return u === ADMIN_USER && p === ADMIN_PASS;
}

// トップ → レポート一覧
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reports.html')));
app.get('/reports', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reports.html')));
app.get('/reports/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'report.html')));

// 認証チェック
app.get('/api/admin/check', basicAuth, (req, res) => res.json({ ok: true }));

// アナライザー
app.get('/admin', basicAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'analyzer.html')));

app.get('/api/companies', (req, res) => res.json(companies));

// 公開レポート一覧（published のみ）
app.get('/api/saves', (req, res) => {
  const saves = loadSaves();
  const list = Object.entries(saves)
    .filter(([, s]) => s.published)
    .map(([id, s]) => ({
      id, name: s.name, savedAt: s.savedAt,
      companyCount: s.results.length,
      avg: s.stats.avg, median: s.stats.median,
    }));
  list.sort((a, b) => b.savedAt - a.savedAt);
  res.json(list);
});

// 管理者用: 全件（公開・非公開）
app.get('/api/admin/saves', basicAuth, (req, res) => {
  const saves = loadSaves();
  const list = Object.entries(saves).map(([id, s]) => ({
    id, name: s.name, savedAt: s.savedAt,
    companyCount: s.results.length,
    avg: s.stats.avg, median: s.stats.median,
    published: s.published ?? false,
  }));
  list.sort((a, b) => b.savedAt - a.savedAt);
  res.json(list);
});

// 保存（デフォルト非公開）
app.post('/api/saves', basicAuth, (req, res) => {
  const { name, inputText, results, stats } = req.body;
  if (!name || !results) return res.status(400).json({ error: 'name and results required' });
  const saves = loadSaves();
  const id = Date.now().toString();
  saves[id] = { name, inputText, results, stats, savedAt: Date.now(), published: false };
  writeSaves(saves);
  res.json({ id });
});

// 公開状態の切り替え
app.patch('/api/saves/:id/publish', basicAuth, (req, res) => {
  const saves = loadSaves();
  const s = saves[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });
  s.published = !s.published;
  writeSaves(saves);
  res.json({ published: s.published });
});

// 1件取得（非公開は管理者のみ）
app.get('/api/saves/:id', (req, res) => {
  const saves = loadSaves();
  const s = saves[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });
  if (!s.published && !isAdmin(req)) return res.status(404).json({ error: 'not found' });
  res.json(s);
});

// 削除
app.delete('/api/saves/:id', basicAuth, (req, res) => {
  const saves = loadSaves();
  if (!saves[req.params.id]) return res.status(404).json({ error: 'not found' });
  delete saves[req.params.id];
  writeSaves(saves);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Analyzer: http://localhost:${PORT}/admin  (user: ${ADMIN_USER})`);
});
