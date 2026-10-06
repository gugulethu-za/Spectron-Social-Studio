(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const labels = {'ad-text':'Ad text','ai-background':'AI backgrounds','ai-video':'AI video','veo-test':'Veo test page','veo-access-check':'Veo access check'};
  const n = value => new Intl.NumberFormat('en-ZA').format(value || 0);
  const time = value => new Intl.DateTimeFormat('en-ZA', {timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  let authorization = '', data = null, request = 0, controller;
  const text = (id, value) => { $(id).textContent = value; };
  function status(message, error = false) { text('status', message); $('status').classList.toggle('error', error); }
  function reported(g) { return g.attempts && g.totalUnknown === g.attempts && !g.totalTokens ? 'Unknown' : n(g.totalTokens); }
  function table(id, rows, columns) {
    const target = $(id); target.replaceChildren();
    if (!rows.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = columns; td.className = 'empty'; td.textContent = 'No recorded activity yet.'; tr.append(td); target.append(tr); return; }
    for (const cells of rows) { const tr = document.createElement('tr'); for (const value of cells) { const td = document.createElement('td'); td.textContent = value; tr.append(td); } target.append(tr); }
  }
  function metricRow(label, t) { return [label,n(t.gemini.attempts),reported(t.gemini),n(t.veo.attempts),n(t.veo.completed),n(t.veo.estimatedCompletedSeconds)]; }
  function periods() { if (data) table('periodRows', Object.entries(data[$('period').value]).sort(([a],[b]) => b.localeCompare(a)).map(([key,t]) => metricRow(key,t)), 6); }
  function render(result) {
    data = result;
    const g = data.totals.gemini, v = data.totals.veo;
    text('trackingSince', data.trackingSince ? `Tracking since ${time(data.trackingSince)} \u00b7 ${data.environment}` : `No activity recorded \u00b7 ${data.environment}`);
    text('updated', `Updated ${time(data.generatedAt)}`);
    text('totalTokens', reported(g)); text('inputOutput', `${g.attempts && g.inputUnknown === g.attempts ? 'Unknown' : n(g.inputTokens)} / ${g.attempts && g.outputUnknown === g.attempts ? 'Unknown' : n(g.outputTokens)}`);
    text('extraTokens', `${n(g.thinkingTokens)} thinking \u00b7 ${n(g.cachedTokens)} cached (already included in provider totals)`);
    text('geminiAttempts', n(g.attempts)); text('geminiOutcomes', `${n(g.succeeded)} successful responses \u00b7 ${n(g.failed)} failed \u00b7 ${n(g.unknown)} unknown`);
    text('veoAttempts', n(v.attempts)); text('veoSubmitted', `${n(v.submitted)} accepted operations`);
    text('veoCompleted', n(v.completed)); text('veoOutcomes', `${n(v.failed)} failed \u00b7 ${n(v.pending)} pending \u00b7 ${n(v.unknown)} unknown`);
    text('veoSeconds', n(v.estimatedCompletedSeconds)); text('veoDuration', `${n(v.videos)} returned videos \u00b7 ${n(v.requestedSeconds)} seconds requested`);
    text('veoCalls', `${n(v.statusCalls)} status calls \u00b7 ${n(v.downloadCalls)} downloads \u00b7 ${n(v.diagnosticCalls)} access checks`);
    $('quality').hidden = !g.missingMetadata && !data.incompleteRecords;
    text('quality', `${n(g.missingMetadata)} Gemini requests have incomplete token metadata; displayed token sums include only reported values. ${n(data.incompleteRecords)} API calls have no recorded result. Unknown usage is not zero.`);
    periods(); table('featureRows', Object.entries(data.features).map(([key,t]) => metricRow(labels[key] || key,t)), 6);
    table('recentRows', data.recent.map(r => [time(r.timestamp),labels[r.feature] || r.feature,r.requestType,r.state || r.operationState || r.outcome,r.provider === 'gemini' ? (r.tokens?.totalTokenCount == null ? 'Unknown' : n(r.tokens.totalTokenCount)) : 'Not reported']), 5);
    $('dashboard').hidden = false; $('login').hidden = true; $('refresh').hidden = false; $('logout').hidden = false;
  }
  function lock() {
    request++; controller?.abort(); authorization = ''; data = null; $('password').value = '';
    $('dashboard').hidden = true; $('login').hidden = false; $('refresh').hidden = true; $('logout').hidden = true;
    for (const id of ['periodRows','featureRows','recentRows']) $(id).replaceChildren();
    status('Dashboard locked.'); $('password').focus();
  }
  async function load() {
    const current = ++request; controller?.abort(); controller = new AbortController();
    $('refresh').disabled = true; $('unlock').disabled = true; status('Loading usage...');
    try {
      const response = await fetch('/.netlify/functions/usage', {headers:{Authorization:authorization}, cache:'no-store', signal:controller.signal});
      const result = await response.json(); if (current !== request) return;
      if (!response.ok) { if (response.status === 401) lock(); throw new Error(result.error || 'Usage could not be loaded.'); }
      render(result); $('password').value = ''; status('');
    } catch (error) { if (error.name !== 'AbortError' && (current === request || !authorization)) status(error.message, true); }
    finally { if (current === request || !authorization) { $('refresh').disabled = false; $('unlock').disabled = false; } }
  }
  $('loginForm').addEventListener('submit', event => { event.preventDefault(); const bytes = new TextEncoder().encode(`usage:${$('password').value}`); authorization = `Basic ${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`; load(); });
  $('refresh').addEventListener('click', load); $('logout').addEventListener('click', lock); $('period').addEventListener('change', periods);
})();
