# Mini iLovePDF Web

Versão web inspirada no seu script Python local, adaptada para rodar em **GitHub Pages**.

## O que funciona

- **Juntar PDFs e imagens** em um único PDF
- **Dividir PDF por página**
- **Comprimir PDF no navegador** por rasterização

## Limitações importantes

Esta versão roda 100% no navegador, então não usa `PyPDF2`, `Pillow` nem `PyMuPDF` como no seu script original.

Por isso:

- a compressão não é idêntica à versão Python
- PDFs muito grandes podem ficar lentos
- a divisão baixa os arquivos individualmente

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub, por exemplo `mini-ilovepdf-web`
2. Envie estes arquivos para a raiz do repositório:
   - `index.html`
   - `style.css`
   - `app.js`
3. No GitHub, entre em:
   - **Settings**
   - **Pages**
4. Em **Source**, escolha:
   - **Deploy from a branch**
5. Selecione:
   - branch: `main`
   - folder: `/root`
6. Salve
7. O GitHub vai gerar uma URL no formato:
   - `https://seuusuario.github.io/mini-ilovepdf-web/`

## Estrutura

```text
mini-ilovepdf-web/
├─ index.html
├─ style.css
├─ app.js
└─ README.md
```

## Observação técnica

A ferramenta de compressão usa:

- `pdf.js` para renderizar páginas
- `jsPDF` para recriar o PDF em JPEG
- `pdf-lib` para juntar e dividir

## Próximo passo opcional

Se quiser, a próxima melhoria é eu te entregar uma **versão com arrastar e soltar, reordenação de arquivos e ZIP real no dividir**.
