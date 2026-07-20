const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeAllCompanies() {
  console.log('Fetching main page...');
  const res = await axios.get('https://corp-ratings.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 30000
  });

  const $ = cheerio.load(res.data);

  // スコアを高い方優先で記録するヘルパー
  const raw = {};
  const upsert = (name, score) => {
    const n = name.trim();
    if (n && n.length >= 2 && n.length <= 40) {
      if (raw[n] === undefined || raw[n] < score) raw[n] = score;
    }
  };

  let currentScore = null;
  let rankingEnded = false;

  $('*').each((i, el) => {
    const tag = el.name;
    const text = $(el).text().trim();

    // ランキング外セクション（変更点の解説など）に入ったら収集を終了
    if ($(el).attr('id') === 'evaluation-points') {
      rankingEnded = true;
    }
    if (rankingEnded) return;

    // Look for headings like 【67】
    if (['h1','h2','h3','h4','h5','h6','p','strong','b'].includes(tag)) {
      const scoreMatch = text.match(/[【\[「](\d{2})[】\]」]/);
      if (scoreMatch) currentScore = parseInt(scoreMatch[1]);
    }

    // アンカーリンクの企業名（信頼度高）
    if (tag === 'a' && currentScore !== null) {
      const href = $(el).attr('href') || '';
      const name = text.trim();
      if (name && href.includes('corp-ratings.com')) upsert(name, currentScore);
    }

    // リンクなしのプレーンテキスト企業名
    if (tag === 'p' && currentScore !== null) {
      const clone = $(el).clone();
      clone.find('a').each((_, a) => $(a).replaceWith('|||'));
      const rawText = clone.text();
      // 半角スペース・全角スペース・nbsp・改行・区切り文字で分割
      rawText.split(/[ 　 \n\r,、，|]+/).forEach(part => {
        const name = part.replace(/【\d+】.*/, '').trim();
        if (name.length >= 2 && name.length <= 40 && !/^\d+$/.test(name) && !name.includes('【')) {
          upsert(name, currentScore);
        }
      });
    }
  });

  return raw;
}

scrapeAllCompanies()
  .then(companies => {
    const count = Object.keys(companies).length;
    console.log(`Found ${count} companies`);
    if (count > 0) {
      console.log('Sample:', Object.entries(companies).slice(0, 5));
    }
    fs.writeFileSync('companies.json', JSON.stringify(companies, null, 2));
    console.log('Saved to companies.json');
  })
  .catch(err => console.error('Error:', err.message));
