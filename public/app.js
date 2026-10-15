const form = document.querySelector('#camera-form');
const status = document.querySelector('#status');
const statusText = document.querySelector('#status-text');
const frame = document.querySelector('#camera-frame');
const placeholder = document.querySelector('#placeholder');
const formError = document.querySelector('#form-error');
const connectButton = document.querySelector('#connect-button');
const disconnectButton = document.querySelector('#disconnect-button');
const retryButton = document.querySelector('#retry-button');
let sessionConfig = null;
let requestPending = false;
let bridgeStatus = { state: 'disconnected' };
let playerPlaying = false;
let playerError = false;
let playerStartedAt = 0;
let lastProgressAt = 0;
let lastVideoTime = -1;
let playerObserver = null;

const labels = {
  disconnected: 'Desconectada', connecting: 'Conectando', live: 'Ao vivo', error: 'Sem imagem'
};

function render(next) {
  status.dataset.state = next.state;
  statusText.textContent = labels[next.state] ?? 'Aguardando';
  retryButton.hidden = next.state !== 'error';
  disconnectButton.hidden = next.state === 'disconnected';
  connectButton.disabled = requestPending;
  connectButton.textContent = requestPending ? 'Conectando…' : 'Iniciar transmissão';
  if (next.state === 'disconnected') {
    frame.hidden = true;
    frame.removeAttribute('src');
    placeholder.hidden = false;
  }
  if (next.state === 'error' && next.message) {
    formError.textContent = next.message;
    formError.hidden = false;
  } else {
    formError.hidden = true;
  }
}

function renderPlayback() {
  if (!sessionConfig) return render(bridgeStatus);
  if (bridgeStatus.state === 'error' || bridgeStatus.state === 'disconnected') return render(bridgeStatus);
  const now = Date.now();
  if (playerError || (!playerPlaying && now - playerStartedAt > 15_000) ||
      (playerPlaying && !document.hidden && now - lastProgressAt > 8_000)) {
    render({ state: 'error', message: 'O vídeo não está sendo reproduzido. Confira a conexão e tente novamente.' });
  } else if (playerPlaying) {
    render({ state: 'live' });
  } else {
    render({ state: 'connecting' });
  }
}

function watchPlayer() {
  playerObserver?.disconnect();
  const player = frame.contentDocument?.querySelector('video-stream');
  const video = player?.querySelector('video');
  const details = player?.querySelector('.status');
  if (details) details.hidden = true;
  if (!video) {
    playerError = true;
    renderPlayback();
    return;
  }
  const activeDocument = frame.contentDocument;
  const onPlayback = () => {
    if (frame.contentDocument !== activeDocument) return;
    playerPlaying = true;
    playerError = false;
    lastProgressAt = Date.now();
    renderPlayback();
  };
  video.addEventListener('playing', onPlayback);
  video.addEventListener('timeupdate', () => {
    if (frame.contentDocument !== activeDocument) return;
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      lastProgressAt = Date.now();
    }
  });
  video.addEventListener('error', () => {
    if (frame.contentDocument !== activeDocument) return;
    playerError = true;
    renderPlayback();
  });
  playerObserver = new MutationObserver(() => {
    if (frame.contentDocument !== activeDocument) return;
    if (player.querySelector('.mode')?.textContent === 'error') {
      playerError = true;
      renderPlayback();
    }
  });
  playerObserver.observe(player, { childList: true, subtree: true, characterData: true });
}

frame.addEventListener('load', watchPlayer);

async function post(path, data) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível conectar.');
  return result;
}

async function connect(config) {
  if (requestPending) return;
  requestPending = true;
  render({ state: 'connecting' });
  try {
    const result = await post('/api/connect', config);
    sessionConfig = config;
    document.querySelector('#camera-password').value = '';
    bridgeStatus = result;
    playerPlaying = false;
    playerError = false;
    playerStartedAt = Date.now();
    lastProgressAt = 0;
    lastVideoTime = -1;
    frame.hidden = false;
    placeholder.hidden = true;
    frame.src = '/player/stream.html?src=tapo-c500';
    renderPlayback();
  } catch (error) {
    render({ state: 'error', message: error.message });
  } finally {
    requestPending = false;
    connectButton.disabled = false;
    connectButton.textContent = 'Iniciar transmissão';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  void connect({
    ip: String(data.get('ip') ?? ''),
    username: String(data.get('username') ?? ''),
    password: String(data.get('password') ?? '')
  });
});

retryButton.addEventListener('click', () => {
  if (sessionConfig) void connect(sessionConfig);
  else document.querySelector('#camera-ip').focus();
});

disconnectButton.addEventListener('click', async () => {
  try {
    const result = await post('/api/disconnect', {});
    sessionConfig = null;
    bridgeStatus = result;
    playerObserver?.disconnect();
    render(result);
  } catch (error) {
    render({ state: 'error', message: error.message });
  }
});

async function pollStatus() {
  if (requestPending || !sessionConfig) return;
  try {
    const response = await fetch('/api/status');
    if (!response.ok) return;
    bridgeStatus = await response.json();
    renderPlayback();
  } catch {
    render({ state: 'error', message: 'Não foi possível consultar o serviço local.' });
  }
}

render({ state: 'disconnected' });
setInterval(() => { void pollStatus(); renderPlayback(); }, 2000);
