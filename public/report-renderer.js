// 共通レポート描画モジュール
// renderReport(container, data) でどこからでも呼べる

function renderReport(container, data) {
  const results = data.results || [];
  const found = results.filter(r => r.score !== null);
  const allPersons = results.reduce((sum, r) => sum + (r.count || 1), 0);
  const foundPersons = found.reduce((sum, r) => sum + (r.count || 1), 0);
  const hasCount = results.some(r => r.count > 1);
  const weighted = found.flatMap(r => Array(r.count || 1).fill(r.score)).sort((a, b) => a - b);
  const coverage = allPersons > 0 ? Math.round(foundPersons / allPersons * 100) : null;

  const avg = data.stats?.avg ?? (weighted.length ? weighted.reduce((a, b) => a + b, 0) / weighted.length : null);
  const median = data.stats?.median ?? (weighted.length
    ? (weighted.length % 2 === 0
        ? (weighted[weighted.length / 2 - 1] + weighted[weighted.length / 2]) / 2
        : weighted[Math.floor(weighted.length / 2)])
    : null);

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function scoreBadge(score) {
    if (score === null) return `<span class="rr-badge rr-none">未収録</span>`;
    const cls = score >= 75 ? 'rr-high' : score >= 70 ? 'rr-mid-high' : score >= 65 ? 'rr-mid' : score >= 60 ? 'rr-low-mid' : 'rr-low';
    return `<span class="rr-badge ${cls}">${score}</span>`;
  }

  function rankLabel(score) {
    if (score === null) return '-';
    return score >= 75 ? '最難関' : score >= 70 ? '難関' : score >= 65 ? '上位' : score >= 60 ? '中上位' : score >= 55 ? '中堅' : '一般';
  }

  container.innerHTML = `
    <style>
      .rr-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:20px}
      .rr-stat{background:white;border-radius:12px;padding:18px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.07);border-top:4px solid}
      .rr-stat.c-blue{border-color:#667eea}.rr-stat.c-green{border-color:#48bb78}.rr-stat.c-orange{border-color:#ed8936}
      .rr-stat.c-red{border-color:#fc8181}.rr-stat.c-purple{border-color:#9f7aea}.rr-stat.c-teal{border-color:#38b2ac}
      .rr-stat-label{font-size:.75rem;color:#a0aec0;margin-bottom:6px}
      .rr-stat-value{font-size:1.8rem;font-weight:700;color:#2d3748;line-height:1}
      .rr-stat-unit{font-size:.8rem;color:#a0aec0;margin-top:4px}
      .rr-chart-row{display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px}
      @media(max-width:640px){.rr-chart-row{grid-template-columns:1fr}}
      .rr-card{background:white;border-radius:12px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:20px}
      .rr-card h2{font-size:.85rem;font-weight:600;color:#718096;margin-bottom:16px;text-transform:uppercase;letter-spacing:.05em}
      .rr-chart-wrap{position:relative;height:260px}
      .rr-table{width:100%;border-collapse:collapse;font-size:.875rem}
      .rr-table th{background:#f7fafc;padding:9px 14px;text-align:left;font-weight:600;color:#718096;border-bottom:2px solid #e2e8f0;position:sticky;top:0}
      .rr-table td{padding:8px 14px;border-bottom:1px solid #f0f4f8}
      .rr-table tr:hover td{background:#f7fafc}
      .rr-scroll{max-height:400px;overflow-y:auto}
      .rr-badge{display:inline-block;padding:2px 10px;border-radius:20px;font-weight:700;font-size:.85rem}
      .rr-high{background:#fed7d7;color:#c53030}.rr-mid-high{background:#feebc8;color:#c05621}
      .rr-mid{background:#fefcbf;color:#744210}.rr-low-mid{background:#c6f6d5;color:#276749}
      .rr-low{background:#bee3f8;color:#2b6cb0}.rr-none{background:#e2e8f0;color:#718096}
      .rr-tag{display:inline-block;background:#f0f4f8;border-radius:4px;padding:2px 8px;margin:2px;font-size:.78rem;color:#718096}
      .rr-note{font-size:.78rem;color:#a0aec0;margin-top:12px}
    </style>

    <div class="rr-stats-grid">
      <div class="rr-stat c-blue">
        <div class="rr-stat-label">就職先数</div>
        <div class="rr-stat-value">${results.length}</div>
        <div class="rr-stat-unit">社</div>
      </div>
      <div class="rr-stat c-green">
        <div class="rr-stat-label">偏差値評価対象</div>
        <div class="rr-stat-value" style="font-size:1.4rem">${found.length}</div>
        <div class="rr-stat-unit">${hasCount ? `社 / ${foundPersons}名` : '社'}${coverage !== null ? `（収録率 ${coverage}%）` : ''}</div>
      </div>
      <div class="rr-stat c-orange">
        <div class="rr-stat-label">平均偏差値</div>
        <div class="rr-stat-value">${avg !== null ? Number(avg).toFixed(1) : '-'}</div>
        <div class="rr-stat-unit">人数加重</div>
      </div>
      <div class="rr-stat c-red">
        <div class="rr-stat-label">中央値</div>
        <div class="rr-stat-value">${median !== null ? Number(median).toFixed(1) : '-'}</div>
        <div class="rr-stat-unit">人数加重</div>
      </div>
      <div class="rr-stat c-purple">
        <div class="rr-stat-label">最高 / 最低</div>
        <div class="rr-stat-value" style="font-size:1.2rem">${weighted.length ? `${Math.max(...weighted)} / ${Math.min(...weighted)}` : '-'}</div>
        <div class="rr-stat-unit"></div>
      </div>
    </div>

    <div class="rr-chart-row">
      <div class="rr-card">
        <h2>偏差値分布</h2>
        <div class="rr-chart-wrap"><canvas id="rr-hist"></canvas></div>
      </div>
      <div class="rr-card">
        <h2>ランク別割合</h2>
        <div class="rr-chart-wrap"><canvas id="rr-pie"></canvas></div>
      </div>
    </div>

    <div class="rr-card">
      <h2>企業別スコア</h2>
      <div class="rr-scroll">
        <table class="rr-table">
          <thead>
            <tr>
              <th>#</th><th>企業名</th>${hasCount ? '<th>人数</th>' : ''}<th>就職偏差値</th><th>ランク</th>
            </tr>
          </thead>
          <tbody>
            ${[...results].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((r, i) => `
              <tr>
                <td style="color:#a0aec0">${i + 1}</td>
                <td>${esc(r.name)}${r.method && r.method !== 'exact' && r.method !== 'none'
                  ? `<span style="font-size:.7rem;color:#a0aec0;margin-left:4px">(${({normalized:'正規化',alias:'エイリアス',partial:'部分一致'})[r.method]||''})</span>`
                  : ''}</td>
                ${hasCount ? `<td style="color:#718096">${r.count || 1}名</td>` : ''}
                <td>${scoreBadge(r.score)}</td>
                <td style="font-size:.8rem;color:#718096">${rankLabel(r.score)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="rr-note">データ出典: corp-ratings.com　※偏差値は就職難易度の目安です</div>
    </div>

    ${results.filter(r => r.score === null).length ? `
    <div class="rr-card">
      <h2>未収録企業</h2>
      <div>${results.filter(r => r.score === null).map(r => `<span class="rr-tag">${esc(r.name)}</span>`).join('')}</div>
    </div>` : ''}

    ${(data.sources || []).length ? `
    <div class="rr-card">
      <h2>参考情報</h2>
      <ul style="list-style:none;display:flex;flex-direction:column;gap:8px">
        ${(data.sources || []).map(line => {
          // 「ラベル https://...」形式を解析
          const urlMatch = line.match(/(https?:\/\/\S+)$/);
          if (urlMatch) {
            const url = urlMatch[1];
            const label = line.slice(0, urlMatch.index).trim();
            return `<li style="font-size:.875rem">
              ${label ? `<span style="color:#4a5568;margin-right:6px">${esc(label)}</span>` : ''}
              <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="color:#667eea;word-break:break-all">${esc(url)}</a>
            </li>`;
          }
          return `<li style="font-size:.875rem"><span style="color:#4a5568">${esc(line)}</span></li>`;
        }).join('')}
      </ul>
    </div>` : ''}
  `;

  // ヒストグラム
  const bins = [];
  for (let s = 50; s <= 80; s += 5) {
    const cnt = weighted.filter(v => s === 80 ? v >= 80 : v >= s && v < s + 5).length;
    bins.push({ label: s === 80 ? '80' : `${s}-${s+4}`, cnt, s });
  }
  new Chart(document.getElementById('rr-hist'), {
    type: 'bar',
    data: {
      labels: bins.map(b => b.label),
      datasets: [{
        label: hasCount ? '人数' : '企業数',
        data: bins.map(b => b.cnt),
        backgroundColor: bins.map(b =>
          b.s >= 75 ? 'rgba(252,129,129,.8)' : b.s >= 70 ? 'rgba(246,173,85,.8)' :
          b.s >= 65 ? 'rgba(246,224,94,.8)' : b.s >= 60 ? 'rgba(104,211,145,.8)' : 'rgba(99,179,237,.8)'),
        borderWidth: 0, borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f0f4f8' } },
        x: { grid: { display: false } },
      }
    }
  });

  // ドーナツ
  const ranks = [
    { label: '最難関(75+)', cnt: weighted.filter(v => v >= 75).length, color: 'rgba(252,129,129,.85)' },
    { label: '難関(70-74)', cnt: weighted.filter(v => v >= 70 && v < 75).length, color: 'rgba(246,173,85,.85)' },
    { label: '上位(65-69)', cnt: weighted.filter(v => v >= 65 && v < 70).length, color: 'rgba(246,224,94,.85)' },
    { label: '中上位(60-64)', cnt: weighted.filter(v => v >= 60 && v < 65).length, color: 'rgba(104,211,145,.85)' },
    { label: '一般(50-59)', cnt: weighted.filter(v => v < 60).length, color: 'rgba(99,179,237,.85)' },
  ].filter(r => r.cnt > 0);
  new Chart(document.getElementById('rr-pie'), {
    type: 'doughnut',
    data: {
      labels: ranks.map(r => r.label),
      datasets: [{ data: ranks.map(r => r.cnt), backgroundColor: ranks.map(r => r.color), borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } }
    }
  });
}
