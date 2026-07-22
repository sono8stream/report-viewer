// Cloud Functions エントリポイント
// ローカル開発は server.js を使用。本番はこちら。
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const express = require('express');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// Firestore
admin.initializeApp();
const db = admin.firestore();
const SAVES_COL = 'saves';

// シークレット定義（firebase functions:secrets:set で設定）
const adminUser = defineSecret('ADMIN_USER');
const adminPass = defineSecret('ADMIN_PASS');

const companies = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'companies.json'), 'utf8')
);

// ---- Firestore CRUD ----
async function loadSaves() {
  const snap = await db.collection(SAVES_COL).get();
  const saves = {};
  snap.forEach(doc => { saves[doc.id] = doc.data(); });
  return saves;
}

async function getSave(id) {
  const doc = await db.collection(SAVES_COL).doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function setSave(id, data) {
  await db.collection(SAVES_COL).doc(id).set(data);
}

async function updateSave(id, data) {
  await db.collection(SAVES_COL).doc(id).update(data);
}

async function deleteSave(id) {
  await db.collection(SAVES_COL).doc(id).delete();
}

// ---- Express app ----
function createApp(ADMIN_USER, ADMIN_PASS) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  function isAdmin(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) return false;
    const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    return u === ADMIN_USER && p === ADMIN_PASS;
  }

  function basicAuth(req, res, next) {
    if (isAdmin(req)) return next();
    res.setHeader('WWW-Authenticate', 'Basic realm="Analyzer"');
    res.status(401).send('認証が必要です');
  }

  app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'reports.html')));
  app.get('/reports', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'reports.html')));
  app.get('/reports/:id', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'report.html')));
  app.get('/admin', basicAuth, (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'analyzer.html')));

  app.get('/api/admin/check', basicAuth, (req, res) => res.json({ ok: true }));

  app.get('/api/companies', (req, res) => res.json(companies));

  // 公開一覧（published のみ）
  app.get('/api/saves', async (req, res) => {
    const snap = await db.collection(SAVES_COL).where('published', '==', true).get();
    const list = [];
    snap.forEach(doc => {
      const s = doc.data();
      list.push({
        id: doc.id, name: s.name, savedAt: s.savedAt,
        companyCount: (s.results || []).length,
        avg: s.stats?.avg, median: s.stats?.median,
      });
    });
    list.sort((a, b) => b.savedAt - a.savedAt);
    res.json(list);
  });

  // 管理者用全件
  app.get('/api/admin/saves', basicAuth, async (req, res) => {
    const snap = await db.collection(SAVES_COL).orderBy('savedAt', 'desc').get();
    const list = [];
    snap.forEach(doc => {
      const s = doc.data();
      const results = s.results || [];
      const found = results.filter(r => r.score !== null);
      const allPersons = results.reduce((sum, r) => sum + (r.count || 1), 0);
      const foundPersons = found.reduce((sum, r) => sum + (r.count || 1), 0);
      const coverage = allPersons > 0 ? Math.round(foundPersons / allPersons * 100) : null;
      list.push({
        id: doc.id, name: s.name, savedAt: s.savedAt,
        companyCount: results.length,
        avg: s.stats?.avg, median: s.stats?.median,
        published: s.published ?? false,
        coverage, sources: s.sources || [],
        sourceCount: (s.sources || []).length,
        comment: s.comment || '',
        sections: s.sections || [],
      });
    });
    res.json(list);
  });

  // 保存
  app.post('/api/saves', basicAuth, async (req, res) => {
    const { name, inputText, results, stats, sources, sections } = req.body;
    if (!name || !results) return res.status(400).json({ error: 'name and results required' });
    const id = Date.now().toString();
    await setSave(id, {
      name, inputText, results, stats,
      sources: sources || [], sections: sections || [],
      savedAt: Date.now(), published: false,
    });
    res.json({ id });
  });

  // 上書き保存
  app.put('/api/saves/:id', basicAuth, async (req, res) => {
    const s = await getSave(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    const { name, inputText, results, stats, sources, sections, comment } = req.body;
    await updateSave(req.params.id, {
      ...(name !== undefined && { name }),
      ...(inputText !== undefined && { inputText }),
      ...(results !== undefined && { results }),
      ...(stats !== undefined && { stats }),
      ...(sources !== undefined && { sources }),
      ...(sections !== undefined && { sections }),
      ...(comment !== undefined && { comment }),
      updatedAt: Date.now(),
    });
    res.json({ ok: true });
  });

  // 公開切り替え
  app.patch('/api/saves/:id/publish', basicAuth, async (req, res) => {
    const s = await getSave(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    const published = !(s.published ?? false);
    await updateSave(req.params.id, { published });
    res.json({ published });
  });

  // 1件取得
  app.get('/api/saves/:id', async (req, res) => {
    const s = await getSave(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    if (!s.published && !isAdmin(req)) return res.status(404).json({ error: 'not found' });
    res.json(s);
  });

  // 削除
  app.delete('/api/saves/:id', basicAuth, async (req, res) => {
    if (!(await getSave(req.params.id))) return res.status(404).json({ error: 'not found' });
    await deleteSave(req.params.id);
    res.json({ ok: true });
  });

  return app;
}

// Cloud Functions エクスポート
exports.api = onRequest(
  { secrets: [adminUser, adminPass], region: 'asia-northeast1' },
  (req, res) => {
    const app = createApp(adminUser.value(), adminPass.value());
    return app(req, res);
  }
);
