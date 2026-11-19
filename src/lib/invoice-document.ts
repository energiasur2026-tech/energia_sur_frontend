const ASSETS='/invoice-engine';
const configuredLimit=Number(process.env.NEXT_PUBLIC_INVOICE_MAX_MB);
export const invoiceMaxMb=Number.isInteger(configuredLimit)&&configuredLimit>=1&&configuredLimit<=25?configuredLimit:10;
const maxPixels=20_000_000;

export function inspectInvoiceFile(bytes:Uint8Array):'pdf'|'png'|'jpeg' {
  if(bytes.length===0||bytes.length>invoiceMaxMb*1024*1024)throw new Error('El archivo está vacío o supera el límite permitido.');
  if(bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45)return 'pdf';
  let width=0,height=0;
  const png=[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
  if(png&&bytes.length>=24&&bytes[12]===73&&bytes[13]===72&&bytes[14]===68&&bytes[15]===82){
    const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    width=header.getUint32(16);height=header.getUint32(20);
  }else if(bytes[0]===255&&bytes[1]===216){
    for(let offset=2;offset+8<bytes.length;){
      if(bytes[offset++]!==255)break;
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++];
      if(marker===218||marker===217)break;
      const length=bytes[offset]*256+bytes[offset+1];
      if(length<2||offset+length>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8){
        height=bytes[offset+3]*256+bytes[offset+4];
        width=bytes[offset+5]*256+bytes[offset+6];
        break;
      }
      offset+=length;
    }
  }else throw new Error('Elegí un PDF, JPG o PNG válido.');
  if(!width||!height)throw new Error('La imagen está dañada o no se puede leer.');
  if(width*height>maxPixels)throw new Error('La imagen supera los 20 megapíxeles. Reducí su tamaño y volvé a intentar.');
  return png?'png':'jpeg';
}

export async function readInvoiceDocument(bytes:Uint8Array,kind:ReturnType<typeof inspectInvoiceFile>,signal:AbortSignal,onProgress:(status:string)=>void) {
  let worker:import('tesseract.js').Worker|undefined;
  let stopPdf:(()=>void)|undefined;
  const abort=()=>{void worker?.terminate();stopPdf?.();};
  signal.addEventListener('abort',abort,{once:true});
  async function recognize(image:Blob|HTMLCanvasElement) {
    signal.throwIfAborted();
    if(!worker){
      const {createWorker}=await import('tesseract.js');
      worker=await createWorker('spa',1,{
        workerPath:ASSETS+'/worker.min.js',corePath:ASSETS,langPath:ASSETS,workerBlobURL:false,cacheMethod:'none',
        errorHandler:()=>{},
      });
    }
    signal.throwIfAborted();
    return (await worker.recognize(image)).data.text;
  }
  try {
    signal.throwIfAborted();
    if(kind!=='pdf'){
      onProgress('Leyendo la imagen…');
      return {text:await recognize(new Blob([new Uint8Array(bytes)],{type:kind==='png'?'image/png':'image/jpeg'})),preview:null,method:'ocr' as const};
    }
    const pdf=await import('pdfjs-dist');
    pdf.GlobalWorkerOptions.workerSrc=ASSETS+'/pdf.worker.min.mjs';
    const loading=pdf.getDocument({data:bytes,enableXfa:false,isEvalSupported:false,disableFontFace:true,useSystemFonts:true,verbosity:0,
      standardFontDataUrl:ASSETS+'/standard_fonts/',cMapUrl:ASSETS+'/cmaps/',cMapPacked:true,maxImageSize:maxPixels,useWasm:false});
    stopPdf=()=>{void loading.destroy().catch(()=>{});};
    const doc=await loading.promise;
    if(doc.numPages>8)throw new Error('El PDF tiene más de ocho páginas. Seleccioná las páginas de una sola factura.');
    let preview:string|null=null,usedOcr=false;
    const pages:string[]=[];
    for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
      signal.throwIfAborted();
      onProgress('Leyendo página '+pageNumber+' de '+doc.numPages+'…');
      const page=await doc.getPage(pageNumber);
      const content=await page.getTextContent();
      let text='',lastY:number|undefined;
      for(const item of content.items){
        if(!('str' in item))continue;
        if(lastY!==undefined&&Math.abs(item.transform[5]-lastY)>3&&!text.endsWith('\n'))text+='\n';
        text+=item.str+(item.hasEOL?'\n':' ');
        lastY=item.transform[5];
      }
      const needsOcr=text.replace(/\s/g,'').length<60;
      if(needsOcr||pageNumber===1){
        const initial=page.getViewport({scale:1});
        const viewport=page.getViewport({scale:Math.min(needsOcr?2:1,1800/Math.max(initial.width,initial.height))});
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
        try {
          await page.render({canvas,viewport}).promise;
          if(pageNumber===1)preview=canvas.toDataURL('image/png');
          if(needsOcr){usedOcr=true;text=await recognize(canvas);}
        } finally {canvas.width=0;canvas.height=0;}
      }
      pages.push(text.slice(0,40_000));
      page.cleanup();
    }
    return {text:pages.join('\n'),preview,method:usedOcr?'ocr' as const:'text' as const};
  }finally{
    signal.removeEventListener('abort',abort);
    stopPdf?.();
    await worker?.terminate();
  }
}
