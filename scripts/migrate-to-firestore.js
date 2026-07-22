// saves.json → Firestore 移行スクリプト
// 実行前に: firebase login && firebase use YOUR_PROJECT_ID
// 実行: node scripts/migrate-to-firestore.js

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SAVES_FILE = path.join(__dirname, '..', 'saves.json');

if (!fs.existsSync(SAVES_FILE)) {
  console.log('saves.json が見つかりません。移行するデータがありません。');
  process.exit(0);
}

// サービスアカウントキーのパス（引数 or 環境変数）
const keyPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (keyPath) {
  initializeApp({ credential: cert(require(path.resolve(keyPath))) });
} else {
  initializeApp();
}
const db = getFirestore();

async function migrate() {
  const saves = JSON.parse(fs.readFileSync(SAVES_FILE, 'utf8'));
  const ids = Object.keys(saves);
  console.log(`${ids.length} 件を Firestore に移行します...`);

  for (const id of ids) {
    await db.collection('saves').doc(id).set(saves[id]);
    console.log(`  移行済み: ${saves[id].name} (${id})`);
  }

  console.log('✅ 移行完了');
  process.exit(0);
}

migrate().catch(err => {
  console.error('移行エラー:', err);
  process.exit(1);
});
