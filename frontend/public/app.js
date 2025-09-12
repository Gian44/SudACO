async function loadInstances() {
  const res = await fetch('/api/instances?type=general');
  const files = await res.json();
  const sel = document.getElementById('instance-select');
  files.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    sel.appendChild(opt);
  });
}

function renderBoard(str) {
  const grid = document.getElementById('grid');
  const size = Math.sqrt(str.length);
  grid.style.gridTemplateColumns = `repeat(${size}, 30px)`;
  grid.innerHTML = '';
  for (const ch of str) {
    const d = document.createElement('div');
    d.className = 'cell';
    d.textContent = ch === '.' ? '' : ch;
    grid.appendChild(d);
  }
}

let currentPath = null;

document.getElementById('load-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('file-input');
  const sel = document.getElementById('instance-select');
  if (fileInput.files.length > 0) {
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    const up = await fetch('/api/upload', { method: 'POST', body: fd });
    const j = await up.json();
    currentPath = j.path;
    const txt = await fileInput.files[0].text();
    renderBoard(txt.replace(/\s+/g, ''));
  } else {
    const name = sel.value;
    currentPath = name;
    const res = await fetch(`/api/puzzle?name=${encodeURIComponent(name)}&type=general`);
    const txt = await res.text();
    renderBoard(txt.replace(/\s+/g, ''));
  }
});

document.getElementById('solve-btn').addEventListener('click', () => {
  if (!currentPath) return;
  const url = currentPath.startsWith('/') ? `/api/solve?path=${encodeURIComponent(currentPath)}` : `/api/solve?name=${encodeURIComponent(currentPath)}&type=general`;
  const evt = new EventSource(url);
  evt.addEventListener('progress', e => {
    renderBoard(e.data);
  });
  evt.addEventListener('done', () => {
    evt.close();
  });
});

document.getElementById('run-exp').addEventListener('click', async () => {
  const size = document.getElementById('size-select').value;
  const fill = document.getElementById('fill-select').value;
  const res = await fetch('/api/experiment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'general', size, fill })
  });
  const data = await res.json();
  document.getElementById('exp-result').textContent = JSON.stringify(data, null, 2);
});

loadInstances();

