(() => {
  const { PDFDocument } = window.PDFLib;
  const tabButtons = [...document.querySelectorAll('.tab-btn')];
  const panels = [...document.querySelectorAll('.tab-panel')];

  const mergeFilesInput = document.getElementById('mergeFiles');
  const mergeRun = document.getElementById('mergeRun');
  const mergeClear = document.getElementById('mergeClear');
  const mergeStatus = document.getElementById('mergeStatus');
  const mergeList = document.getElementById('mergeList');

  const splitFileInput = document.getElementById('splitFile');
  const splitRun = document.getElementById('splitRun');
  const splitPrefix = document.getElementById('splitPrefix');
  const splitStatus = document.getElementById('splitStatus');

  const compressFileInput = document.getElementById('compressFile');
  const compressRun = document.getElementById('compressRun');
  const compressStatus = document.getElementById('compressStatus');
  const compressDpi = document.getElementById('compressDpi');
  const compressQuality = document.getElementById('compressQuality');
  const compressGray = document.getElementById('compressGray');
  const compressTargetMb = document.getElementById('compressTargetMb');

  const IMG_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/gif'
  ]);

  function setStatus(el, message, type = '') {
    el.className = `status ${type}`.trim();
    el.textContent = message;
  }

  function bytesToMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2);
  }

  function safeStem(name) {
    return name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]+/g, '_') || 'arquivo';
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function fileToUint8Array(file) {
    return new Uint8Array(await file.arrayBuffer());
  }

  async function imageFileToPdfBytes(file) {
    const pdfDoc = await PDFDocument.create();
    const bytes = await fileToUint8Array(file);
    let image;

    if (file.type === 'image/png') {
      image = await pdfDoc.embedPng(bytes);
    } else {
      image = await pdfDoc.embedJpg(await fileToJpegBytes(file));
    }

    const dims = image.scale(1);
    const page = pdfDoc.addPage([dims.width, dims.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: dims.width,
      height: dims.height,
    });

    return await pdfDoc.save();
  }

  async function fileToJpegBytes(file) {
    if (file.type === 'image/jpeg') {
      return await fileToUint8Array(file);
    }

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    return new Uint8Array(await blob.arrayBuffer());
  }

  function renderMergeList() {
    mergeList.innerHTML = '';
    const files = [...mergeFilesInput.files];
    if (!files.length) return;
    files.forEach((file, idx) => {
      const div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = `<span>${idx + 1}. ${file.name}</span><strong>${bytesToMB(file.size)} MB</strong>`;
      mergeList.appendChild(div);
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabButtons.forEach(b => b.classList.toggle('active', b === btn));
      panels.forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
    });
  });

  mergeFilesInput.addEventListener('change', renderMergeList);
  mergeClear.addEventListener('click', () => {
    mergeFilesInput.value = '';
    mergeList.innerHTML = '';
    setStatus(mergeStatus, '');
  });

  mergeRun.addEventListener('click', async () => {
    const files = [...mergeFilesInput.files];
    if (!files.length) {
      setStatus(mergeStatus, 'Selecione pelo menos um arquivo.', 'warn');
      return;
    }

    try {
      setStatus(mergeStatus, 'Processando arquivos...', 'warn');
      const outPdf = await PDFDocument.create();

      for (const file of files) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const srcPdf = await PDFDocument.load(await file.arrayBuffer());
          const pageIndices = srcPdf.getPageIndices();
          const copiedPages = await outPdf.copyPages(srcPdf, pageIndices);
          copiedPages.forEach(page => outPdf.addPage(page));
        } else if (IMG_TYPES.has(file.type) || /\.(jpg|jpeg|png|bmp|tif|tiff|webp|gif)$/i.test(file.name)) {
          const imagePdfBytes = await imageFileToPdfBytes(file);
          const imagePdf = await PDFDocument.load(imagePdfBytes);
          const copiedPages = await outPdf.copyPages(imagePdf, imagePdf.getPageIndices());
          copiedPages.forEach(page => outPdf.addPage(page));
        }
      }

      const outBytes = await outPdf.save();
      downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), 'Convertido.pdf');
      setStatus(mergeStatus, `PDF gerado com sucesso. Tamanho final: ${bytesToMB(outBytes.length)} MB`, 'ok');
    } catch (err) {
      console.error(err);
      setStatus(mergeStatus, `Erro ao juntar arquivos: ${err.message}`, 'error');
    }
  });

  splitRun.addEventListener('click', async () => {
    const file = splitFileInput.files[0];
    if (!file) {
      setStatus(splitStatus, 'Selecione um PDF.', 'warn');
      return;
    }

    try {
      setStatus(splitStatus, 'Lendo PDF e gerando páginas...', 'warn');
      const srcPdf = await PDFDocument.load(await file.arrayBuffer());
      const totalPages = srcPdf.getPageCount();
      const prefix = safeStem(splitPrefix.value.trim() || safeStem(file.name));

      // ZIP sem biblioteca externa: gera vários downloads se poucas páginas, e avisa quando for grande.
      if (totalPages > 20) {
        setStatus(splitStatus, `O PDF tem ${totalPages} páginas. Para GitHub Pages puro, vou baixar cada página individualmente.`, 'warn');
      }

      for (let i = 0; i < totalPages; i += 1) {
        const outPdf = await PDFDocument.create();
        const [page] = await outPdf.copyPages(srcPdf, [i]);
        outPdf.addPage(page);
        const outBytes = await outPdf.save();
        const fileName = `${prefix}_${String(i + 1).padStart(3, '0')}.pdf`;
        downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), fileName);
        await new Promise(r => setTimeout(r, 120));
      }

      setStatus(splitStatus, `Concluído. ${totalPages} PDFs foram baixados.`, 'ok');
    } catch (err) {
      console.error(err);
      setStatus(splitStatus, `Erro ao dividir PDF: ${err.message}`, 'error');
    }
  });

  compressRun.addEventListener('click', async () => {
    const file = compressFileInput.files[0];
    if (!file) {
      setStatus(compressStatus, 'Selecione um PDF.', 'warn');
      return;
    }

    try {
      const dpi = Math.max(40, Math.min(200, Number(compressDpi.value) || 90));
      const quality = Math.max(0.1, Math.min(1, Number(compressQuality.value) || 0.55));
      const gray = compressGray.checked;
      const targetMb = Math.max(1, Number(compressTargetMb.value) || 5);

      setStatus(compressStatus, 'Carregando PDF e rasterizando páginas... isso pode demorar em arquivos grandes.', 'warn');

      const pdfjsLib = globalThis.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const { jsPDF } = window.jspdf;
      let generated = null;
      const attempts = [
        { dpi, quality, gray },
        { dpi: Math.max(72, dpi - 10), quality: Math.max(0.45, quality - 0.1), gray },
        { dpi: Math.max(60, dpi - 20), quality: Math.max(0.35, quality - 0.2), gray: true },
        { dpi: Math.max(50, dpi - 30), quality: Math.max(0.28, quality - 0.25), gray: true },
      ];

      for (const [index, cfg] of attempts.entries()) {
        setStatus(compressStatus, `Tentativa ${index + 1}/${attempts.length}: ${cfg.dpi} DPI | qualidade ${cfg.quality.toFixed(2)} | cinza ${cfg.gray ? 'sim' : 'não'}`, 'warn');
        const pdfOut = new jsPDF({ unit: 'pt', compress: true });

        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
          const page = await pdf.getPage(pageNo);
          const scale = cfg.dpi / 72;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const ctx = canvas.getContext('2d', { alpha: false });
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;

          if (cfg.gray) {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const y = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
              data[i] = y;
              data[i + 1] = y;
              data[i + 2] = y;
            }
            ctx.putImageData(imgData, 0, 0);
          }

          const imgDataUrl = canvas.toDataURL('image/jpeg', cfg.quality);
          const width = viewport.width;
          const height = viewport.height;

          if (pageNo > 1) {
            pdfOut.addPage([width, height], width > height ? 'landscape' : 'portrait');
          } else {
            pdfOut.internal.pageSize.setWidth(width);
            pdfOut.internal.pageSize.setHeight(height);
          }

          pdfOut.addImage(imgDataUrl, 'JPEG', 0, 0, width, height, undefined, 'FAST');
        }

        const blob = pdfOut.output('blob');
        generated = { blob, cfg };
        if (blob.size <= targetMb * 1024 * 1024) {
          break;
        }
      }

      if (!generated) throw new Error('Falha ao gerar PDF comprimido.');

      const sizeMb = bytesToMB(generated.blob.size);
      downloadBlob(generated.blob, 'Comprimido.pdf');

      const targetText = generated.blob.size <= targetMb * 1024 * 1024
        ? `Ficou dentro da meta de ${targetMb} MB.`
        : `Não ficou abaixo de ${targetMb} MB, mas esta foi a melhor tentativa no navegador.`;

      setStatus(
        compressStatus,
        `Concluído. Tamanho final: ${sizeMb} MB. ${targetText}\nConfig usada: ${generated.cfg.dpi} DPI | qualidade ${generated.cfg.quality.toFixed(2)} | cinza ${generated.cfg.gray ? 'sim' : 'não'}`,
        generated.blob.size <= targetMb * 1024 * 1024 ? 'ok' : 'warn'
      );
    } catch (err) {
      console.error(err);
      setStatus(compressStatus, `Erro ao comprimir PDF: ${err.message}`, 'error');
    }
  });
})();
