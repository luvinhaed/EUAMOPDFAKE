const { PDFDocument } = PDFLib;

const state = {
  mergeFiles: [],
  splitFile: null,
  compressFile: null,
};

const els = {
  tabButtons: [...document.querySelectorAll('.tab-btn')],
  tabPanels: [...document.querySelectorAll('.tab-panel')],

  mergeInput: document.getElementById('mergeFiles'),
  mergeDropzone: document.getElementById('mergeDropzone'),
  mergeList: document.getElementById('mergeList'),
  mergeRun: document.getElementById('mergeRun'),
  mergeClear: document.getElementById('mergeClear'),
  mergeStatus: document.getElementById('mergeStatus'),

  splitInput: document.getElementById('splitFile'),
  splitDropzone: document.getElementById('splitDropzone'),
  splitInfo: document.getElementById('splitFileInfo'),
  splitPrefix: document.getElementById('splitPrefix'),
  splitRun: document.getElementById('splitRun'),
  splitStatus: document.getElementById('splitStatus'),

  compressInput: document.getElementById('compressFile'),
  compressDropzone: document.getElementById('compressDropzone'),
  compressInfo: document.getElementById('compressFileInfo'),
  compressDpi: document.getElementById('compressDpi'),
  compressQuality: document.getElementById('compressQuality'),
  compressTargetMb: document.getElementById('compressTargetMb'),
  compressGray: document.getElementById('compressGray'),
  compressRun: document.getElementById('compressRun'),
  compressStatus: document.getElementById('compressStatus'),
};

function initTabs() {
  els.tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      els.tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
      els.tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tab}`));
    });
  });
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(2)} ${units[i]}`;
}

function setStatus(el, message, type = '') {
  el.textContent = message;
  el.className = 'status';
  if (type) el.classList.add(type);
}

function setInfo(el, message) {
  el.textContent = message || 'Nenhum arquivo selecionado.';
}

function safeName(name) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').replace(/\s+/g, ' ').trim() || 'arquivo';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function bindDropzone(dropzone, input, onFiles) {
  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (evt === 'drop') {
        const files = [...e.dataTransfer.files];
        onFiles(files);
      }
      dropzone.classList.remove('dragover');
    });
  });

  input.addEventListener('change', (e) => {
    const files = [...e.target.files];
    onFiles(files);
    input.value = '';
  });
}

function addMergeFiles(files) {
  const allowed = files.filter((file) => file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.pdf'));
  state.mergeFiles.push(...allowed);
  renderMergeList();
  setStatus(els.mergeStatus, `${state.mergeFiles.length} arquivo(s) na fila. Arraste os itens para reordenar.`);
}

function renderMergeList() {
  els.mergeList.innerHTML = '';
  if (!state.mergeFiles.length) {
    els.mergeList.innerHTML = '<div class="single-file-info">Nenhum arquivo adicionado ainda.</div>';
    return;
  }

  state.mergeFiles.forEach((file, index) => {
    const row = document.createElement('div');
    row.className = 'file-item';
    row.draggable = true;
    row.dataset.index = index;
    row.innerHTML = `
      <div class="file-handle" title="Arrastar">☰</div>
      <div>
        <div class="file-name">${file.name}</div>
        <div class="file-meta">${file.type || 'arquivo'} • ${formatBytes(file.size)}</div>
      </div>
      <div class="order-badge">#${index + 1}</div>
      <button class="remove-btn" type="button">Remover</button>
    `;

    row.querySelector('.remove-btn').addEventListener('click', () => {
      state.mergeFiles.splice(index, 1);
      renderMergeList();
    });

    row.addEventListener('dragstart', () => {
      row.classList.add('dragging');
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      [...els.mergeList.querySelectorAll('.file-item')].forEach((item) => item.classList.remove('drag-target'));
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('drag-target');
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-target');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const dragging = els.mergeList.querySelector('.dragging');
      if (!dragging || dragging === row) return;
      const from = Number(dragging.dataset.index);
      const to = Number(row.dataset.index);
      const [moved] = state.mergeFiles.splice(from, 1);
      state.mergeFiles.splice(to, 0, moved);
      renderMergeList();
    });

    els.mergeList.appendChild(row);
  });
}

async function fileToPdfDoc(file) {
  const bytes = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith('.pdf')) {
    return PDFDocument.load(bytes);
  }

  const pdf = await PDFDocument.create();
  let embedded;
  const mime = file.type;

  if (mime.includes('png')) embedded = await pdf.embedPng(bytes);
  else embedded = await pdf.embedJpg(bytes);

  const dims = embedded.scale(1);
  const page = pdf.addPage([dims.width, dims.height]);
  page.drawImage(embedded, { x: 0, y: 0, width: dims.width, height: dims.height });
  return pdf;
}

async function mergeFiles() {
  if (!state.mergeFiles.length) {
    setStatus(els.mergeStatus, 'Adicione pelo menos um arquivo.', 'error');
    return;
  }

  try {
    setStatus(els.mergeStatus, 'Montando PDF...');
    const merged = await PDFDocument.create();

    for (const file of state.mergeFiles) {
      const src = await fileToPdfDoc(file);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }

    const out = await merged.save();
    downloadBlob(new Blob([out], { type: 'application/pdf' }), 'unido.pdf');
    setStatus(els.mergeStatus, `PDF gerado com sucesso. Tamanho: ${formatBytes(out.byteLength)}.`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus(els.mergeStatus, 'Falha ao juntar os arquivos.', 'error');
  }
}

async function splitPdf() {
  if (!state.splitFile) {
    setStatus(els.splitStatus, 'Selecione um PDF.', 'error');
    return;
  }

  try {
    setStatus(els.splitStatus, 'Dividindo PDF e gerando ZIP...');
    const bytes = await state.splitFile.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const zip = new JSZip();
    const prefix = safeName(els.splitPrefix.value || state.splitFile.name.replace(/\.pdf$/i, '') || 'documento');
    const total = pdf.getPageCount();
    const pad = Math.max(3, String(total).length);

    for (let i = 0; i < total; i += 1) {
      const outPdf = await PDFDocument.create();
      const [page] = await outPdf.copyPages(pdf, [i]);
      outPdf.addPage(page);
      const outBytes = await outPdf.save();
      zip.file(`${prefix}_${String(i + 1).padStart(pad, '0')}.pdf`, outBytes);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `${prefix}_dividido.zip`);
    setStatus(els.splitStatus, `${total} página(s) exportadas em ZIP.`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus(els.splitStatus, 'Falha ao dividir o PDF.', 'error');
  }
}

async function renderPageToJpeg(page, scale, quality, grayscale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  if (grayscale) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(img, 0, 0);
  }

  return canvas.toDataURL('image/jpeg', quality);
}

async function compressPdf() {
  if (!state.compressFile) {
    setStatus(els.compressStatus, 'Selecione um PDF.', 'error');
    return;
  }

  try {
    const originalBytes = await state.compressFile.arrayBuffer();
    const originalSize = originalBytes.byteLength;
    const targetMb = Number(els.compressTargetMb.value) || 5;
    const targetBytes = targetMb * 1024 * 1024;
    let dpi = Number(els.compressDpi.value) || 90;
    let quality = Number(els.compressQuality.value) || 0.55;
    let grayscale = !!els.compressGray.checked;

    setStatus(els.compressStatus, 'Comprimindo PDF...');

    const tries = [
      { dpi, quality, grayscale },
      { dpi: Math.max(72, dpi - 10), quality: Math.max(0.45, quality - 0.05), grayscale },
      { dpi: Math.max(60, dpi - 20), quality: Math.max(0.35, quality - 0.12), grayscale: true },
      { dpi: Math.max(50, dpi - 30), quality: Math.max(0.25, quality - 0.2), grayscale: true },
    ];

    let bestBlob = null;
    let bestSize = Number.POSITIVE_INFINITY;

    for (const attempt of tries) {
      const loadingTask = pdfjsLib.getDocument({ data: originalBytes });
      const pdf = await loadingTask.promise;
      const outPdf = await PDFDocument.create();
      const scale = attempt.dpi / 72;

      for (let i = 1; i <= pdf.numPages; i += 1) {
        setStatus(els.compressStatus, `Comprimindo página ${i}/${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const jpgUrl = await renderPageToJpeg(page, scale, attempt.quality, attempt.grayscale);
        const jpgBytes = await fetch(jpgUrl).then((r) => r.arrayBuffer());
        const image = await outPdf.embedJpg(jpgBytes);
        const pdfPage = outPdf.addPage([image.width, image.height]);
        pdfPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }

      const outBytes = await outPdf.save();
      const outBlob = new Blob([outBytes], { type: 'application/pdf' });
      if (outBlob.size < bestSize) {
        bestSize = outBlob.size;
        bestBlob = outBlob;
      }
      if (outBlob.size <= targetBytes) break;
    }

    if (!bestBlob) throw new Error('Não foi possível gerar o PDF comprimido.');

    downloadBlob(bestBlob, `${safeName(state.compressFile.name.replace(/\.pdf$/i, ''))}_comprimido.pdf`);

    const ratio = ((1 - bestBlob.size / originalSize) * 100).toFixed(1);
    const type = bestBlob.size <= targetBytes ? 'ok' : 'warn';
    const message = bestBlob.size <= targetBytes
      ? `PDF comprimido com sucesso. Antes: ${formatBytes(originalSize)} | Depois: ${formatBytes(bestBlob.size)} | Redução: ${ratio}%`
      : `Melhor tentativa concluída. Antes: ${formatBytes(originalSize)} | Depois: ${formatBytes(bestBlob.size)} | Meta: ${targetMb} MB | Redução: ${ratio}%`;

    setStatus(els.compressStatus, message, type);
  } catch (err) {
    console.error(err);
    setStatus(els.compressStatus, 'Falha ao comprimir o PDF.', 'error');
  }
}

function initSingleFileHandlers() {
  bindDropzone(els.splitDropzone, els.splitInput, (files) => {
    state.splitFile = files.find((f) => f.name.toLowerCase().endsWith('.pdf')) || null;
    setInfo(els.splitInfo, state.splitFile ? `${state.splitFile.name} • ${formatBytes(state.splitFile.size)}` : 'Nenhum arquivo selecionado.');
  });

  bindDropzone(els.compressDropzone, els.compressInput, (files) => {
    state.compressFile = files.find((f) => f.name.toLowerCase().endsWith('.pdf')) || null;
    setInfo(els.compressInfo, state.compressFile ? `${state.compressFile.name} • ${formatBytes(state.compressFile.size)}` : 'Nenhum arquivo selecionado.');
  });
}

function initMergeHandlers() {
  bindDropzone(els.mergeDropzone, els.mergeInput, addMergeFiles);
  els.mergeRun.addEventListener('click', mergeFiles);
  els.mergeClear.addEventListener('click', () => {
    state.mergeFiles = [];
    renderMergeList();
    setStatus(els.mergeStatus, 'Fila limpa.');
  });
}

function initActions() {
  els.splitRun.addEventListener('click', splitPdf);
  els.compressRun.addEventListener('click', compressPdf);
}

function exposePdfJs() {
  if (!window.pdfjsLib && window['pdfjs-dist/build/pdf']) {
    window.pdfjsLib = window['pdfjs-dist/build/pdf'];
  }
}

window.addEventListener('DOMContentLoaded', () => {
  exposePdfJs();
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs';
  }
  initTabs();
  initMergeHandlers();
  initSingleFileHandlers();
  initActions();
  renderMergeList();
  setInfo(els.splitInfo, 'Nenhum arquivo selecionado.');
  setInfo(els.compressInfo, 'Nenhum arquivo selecionado.');
});
