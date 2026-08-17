// =====================================================
// Banco de Questões — lógica do site
// Lê questoes.json, controla o quiz, salva progresso no
// navegador (localStorage) e desenha o gráfico de acertos.
// =====================================================

const STORAGE_KEY = 'bancoQuestoes_respostas_v1';

let questoes = [];
let indiceAtual = 0;
let respostaSelecionada = null; // índice da alternativa clicada (0-4)
let jaRespondeuEstaQuestao = false;

// ---------- Carregamento ----------
async function carregarQuestoes() {
  try {
    const res = await fetch('questoes.json');
    if (!res.ok) throw new Error('Falha ao buscar questoes.json (status ' + res.status + ')');
    questoes = await res.json();
  } catch (err) {
    document.getElementById('qText').textContent =
      'Não consegui carregar as questões. Se você abriu este arquivo direto no navegador (file://), ' +
      'isso não funciona — rode um servidor local ou publique o site (veja instruções no chat).';
    console.error(err);
    return;
  }
  document.getElementById('qTotal').textContent = questoes.length;
  irParaQuestao(proximaNaoRespondida());
  atualizarEstatisticas();
}

// ---------- Armazenamento local ----------
function lerRespostas() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}
function salvarResposta(id, escolhida, correta) {
  const dados = lerRespostas();
  dados[id] = { escolhida, acertou: escolhida === correta, quando: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
}

function proximaNaoRespondida() {
  const dados = lerRespostas();
  const idx = questoes.findIndex(q => dados[q.id] === undefined);
  return idx === -1 ? 0 : idx;
}

// ---------- Renderização do quiz ----------
function irParaQuestao(idx) {
  indiceAtual = idx;
  const q = questoes[indiceAtual];
  respostaSelecionada = null;
  jaRespondeuEstaQuestao = false;

  document.getElementById('qIndex').textContent = indiceAtual + 1;
  document.getElementById('qTag').textContent = 'Q' + String(q.id).padStart(2, '0');
  document.getElementById('qSource').textContent = q.fonte || '';
  document.getElementById('qText').textContent = q.pergunta;

  const progresso = ((indiceAtual + 1) / questoes.length) * 100;
  document.getElementById('progressFill').style.width = progresso + '%';

  const lista = document.getElementById('optionsList');
  lista.innerHTML = '';
  const letras = ['A', 'B', 'C', 'D', 'E'];

  q.alternativas.forEach((texto, i) => {
    const li = document.createElement('li');
    li.className = 'option';
    li.setAttribute('role', 'option');
    li.tabIndex = 0;
    li.innerHTML = `<span class="bubble">${letras[i]}</span><span class="option-text">${escapeHtml(texto)}</span>`;
    li.addEventListener('click', () => selecionar(i));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selecionar(i); } });
    lista.appendChild(li);
  });

  document.getElementById('feedback').hidden = true;
  document.getElementById('feedback').className = 'feedback';
  document.getElementById('answerBtn').hidden = false;
  document.getElementById('answerBtn').disabled = true;
  document.getElementById('nextBtn').hidden = true;

  // Se essa questão já tinha sido respondida antes, mostra o resultado salvo
  const salvo = lerRespostas()[q.id];
  if (salvo !== undefined) {
    respostaSelecionada = salvo.escolhida;
    marcarSelecao(respostaSelecionada);
    mostrarResultado(q, respostaSelecionada, true);
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function selecionar(i) {
  if (jaRespondeuEstaQuestao) return;
  respostaSelecionada = i;
  marcarSelecao(i);
  document.getElementById('answerBtn').disabled = false;
}

function marcarSelecao(i) {
  const opcoes = document.querySelectorAll('#optionsList .option');
  opcoes.forEach((el, idx) => el.classList.toggle('selected', idx === i));
}

document.getElementById('answerBtn').addEventListener('click', () => {
  if (respostaSelecionada === null) return;
  const q = questoes[indiceAtual];
  salvarResposta(q.id, respostaSelecionada, q.correta);
  mostrarResultado(q, respostaSelecionada, false);
  atualizarEstatisticas();
});

function mostrarResultado(q, escolhida, jaSalvo) {
  jaRespondeuEstaQuestao = true;
  const opcoes = document.querySelectorAll('#optionsList .option');
  opcoes.forEach((el, idx) => {
    el.classList.add('disabled');
    el.classList.remove('selected');
    if (idx === q.correta) el.classList.add('correct');
    else if (idx === escolhida) el.classList.add('incorrect');
  });

  const acertou = escolhida === q.correta;
  const feedback = document.getElementById('feedback');
  feedback.hidden = false;
  feedback.className = 'feedback ' + (acertou ? 'ok' : 'fail');
  document.getElementById('feedbackHeadline').textContent = acertou ? 'Você acertou' : 'Você errou';
  document.getElementById('feedbackExp').textContent = q.explicacao || '';

  document.getElementById('answerBtn').hidden = true;
  document.getElementById('nextBtn').hidden = false;
}

document.getElementById('nextBtn').addEventListener('click', () => {
  const prox = indiceAtual + 1 < questoes.length ? indiceAtual + 1 : 0;
  irParaQuestao(prox);
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Isso apaga todo o seu progresso salvo neste dispositivo. Confirmar?')) {
    localStorage.removeItem(STORAGE_KEY);
    irParaQuestao(0);
    atualizarEstatisticas();
  }
});

// ---------- Estatísticas / gráfico ----------
let chartInstance = null;

function atualizarEstatisticas() {
  const dados = lerRespostas();
  const total = questoes.length;
  let acertos = 0, erros = 0;
  Object.values(dados).forEach(r => r.acertou ? acertos++ : erros++);
  const respondidas = acertos + erros;
  const pendentes = total - respondidas;
  const pct = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : 0;

  document.getElementById('chartPct').textContent = pct + '%';
  document.getElementById('legendOk').textContent = acertos;
  document.getElementById('legendFail').textContent = erros;
  document.getElementById('legendPending').textContent = pendentes;
  document.getElementById('sumAnswered').textContent = respondidas;
  document.getElementById('sumTotal').textContent = total;
  document.getElementById('sumStreak').textContent = calcularSequenciaAtual(dados);

  desenharGrafico(acertos, erros, pendentes);
}

function calcularSequenciaAtual(dados) {
  const respostas = Object.values(dados).sort((a, b) => a.quando - b.quando);
  let streak = 0;
  for (let i = respostas.length - 1; i >= 0; i--) {
    if (respostas[i].acertou) streak++; else break;
  }
  return streak;
}

function desenharGrafico(acertos, erros, pendentes) {
  const ctx = document.getElementById('resultChart');
  const dataset = {
    labels: ['Acertos', 'Erros', 'Não respondidas'],
    datasets: [{
      data: [acertos, erros, pendentes],
      backgroundColor: ['#1E7A4B', '#A8402C', '#C8CCC2'],
      borderWidth: 0,
    }]
  };
  if (chartInstance) {
    chartInstance.data = dataset;
    chartInstance.update();
    return;
  }
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: dataset,
    options: {
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      animation: { duration: 400 }
    }
  });
}

// ---------- Abas ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'estatisticas') atualizarEstatisticas();
  });
});

// ---------- Início ----------
carregarQuestoes();
