import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ExcelJS from 'exceljs';

/**
 * Genera, para un pedido concreto, un ZIP del pack con el email del
 * comprador y el número de pedido estampados en cada archivo. Se hace
 * al vuelo en cada descarga (no hay copia "limpia" que filtrar) y así
 * cualquier archivo que circule fuera lleva escrito quién lo descargó.
 */

async function listarArchivosRecursivo(dir) {
  const entradas = await readdir(dir, { withFileTypes: true });
  const listas = await Promise.all(
    entradas.map((entrada) => {
      const ruta = join(dir, entrada.name);
      return entrada.isDirectory() ? listarArchivosRecursivo(ruta) : Promise.resolve([ruta]);
    }),
  );
  return listas.flat();
}

function textoMarca({ email, numeroPedido }) {
  return `Descargado por ${email} · pedido #${numeroPedido} · uso personal, no redistribuir`;
}

async function marcarPdf(buffer, marca) {
  const documento = await PDFDocument.load(buffer, { updateMetadata: false });
  const fuente = await documento.embedFont(StandardFonts.Helvetica);
  const tamano = 6.5;
  for (const pagina of documento.getPages()) {
    const { width } = pagina.getSize();
    pagina.drawText(marca, {
      x: 16,
      y: 12,
      size: tamano,
      font: fuente,
      color: rgb(0.6, 0.6, 0.6),
      maxWidth: width - 32,
    });
  }
  return Buffer.from(await documento.save());
}

function escaparXml(texto) {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function marcarDocx(buffer, marca) {
  const zip = await JSZip.loadAsync(buffer);
  const archivoDocumento = zip.file('word/document.xml');
  if (!archivoDocumento) return buffer; // no debería pasar con nuestras plantillas

  const xml = await archivoDocumento.async('string');
  const parrafoMarca =
    '<w:p><w:pPr><w:spacing w:before="240"/><w:jc w:val="center"/></w:pPr>' +
    '<w:r><w:rPr><w:sz w:val="14"/><w:color w:val="999999"/></w:rPr>' +
    `<w:t xml:space="preserve">${escaparXml(marca)}</w:t></w:r></w:p>`;

  // <w:sectPr> de documento, si existe, debe seguir siendo el último
  // hijo de <w:body> — insertamos el párrafo justo antes.
  const nuevoXml = xml.includes('<w:sectPr')
    ? xml.replace('<w:sectPr', `${parrafoMarca}<w:sectPr`)
    : xml.replace('</w:body>', `${parrafoMarca}</w:body>`);

  zip.file('word/document.xml', nuevoXml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function marcarXlsx(buffer, marca) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.getWorksheet('LÉEME') ?? libro.worksheets[0];
  if (hoja) {
    const fila = (hoja.lastRow?.number ?? 1) + 2;
    const celda = hoja.getCell(`A${fila}`);
    celda.value = marca;
    celda.font = { italic: true, size: 8, color: { argb: 'FF999999' } };
  }
  return libro.xlsx.writeBuffer();
}

/**
 * @param {{rutaPack: string, email: string, numeroPedido: string}} datos
 * @returns {Promise<Buffer>} ZIP marcado, listo para servir
 */
export async function construirPaqueteMarcado({ rutaPack, email, numeroPedido }) {
  const marca = textoMarca({ email, numeroPedido });
  const archivos = await listarArchivosRecursivo(rutaPack);

  const zipSalida = new JSZip();
  await Promise.all(
    archivos.map(async (rutaAbsoluta) => {
      const buffer = await readFile(rutaAbsoluta);
      const extension = extname(rutaAbsoluta).toLowerCase();

      let contenido;
      if (extension === '.pdf') contenido = await marcarPdf(buffer, marca);
      else if (extension === '.docx') contenido = await marcarDocx(buffer, marca);
      else if (extension === '.xlsx') contenido = await marcarXlsx(buffer, marca);
      else contenido = buffer;

      const rutaRelativa = relative(rutaPack, rutaAbsoluta).split('\\').join('/');
      zipSalida.file(rutaRelativa, contenido);
    }),
  );

  return zipSalida.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Comprueba que la carpeta del pack existe antes de intentar leerla. */
export async function existePack(rutaPack) {
  try {
    return (await stat(rutaPack)).isDirectory();
  } catch {
    return false;
  }
}
