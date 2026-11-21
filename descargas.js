/* Descargas verificadas: nunca guardar una página de error como Excel o ZIP. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.MonitorDescargas=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  async function archivo(respuesta,extension){
    if(!respuesta.ok)throw new Error('No se pudo generar el archivo. Intenta de nuevo.');
    const tipo=respuesta.headers.get('Content-Type')||'';
    if(!/application\/(zip|octet-stream|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)/i.test(tipo))
      throw new Error('El servidor devolvió una página, no el archivo. Recarga el monitor e intenta de nuevo.');
    const bytes=new Uint8Array(await respuesta.arrayBuffer());
    if(bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4)throw new Error('El archivo recibido está incompleto. Intenta de nuevo.');
    const cab=respuesta.headers.get('Content-Disposition')||'';
    const nombre=(cab.match(/filename="?([^";]+)"?/i)?.[1]||'descarga.'+extension).replace(/[/\\]/g,'_');
    return {bytes,nombre:nombre.endsWith('.'+extension)?nombre:'descarga.'+extension,tipo};
  }
  async function descargar(url,extension){
    const d=await archivo(await fetch(url,{cache:'no-store'}),extension);
    const enlace=document.createElement('a'),obj=URL.createObjectURL(new Blob([d.bytes],{type:d.tipo}));
    enlace.href=obj;enlace.download=d.nombre;document.body.appendChild(enlace);enlace.click();enlace.remove();
    setTimeout(()=>URL.revokeObjectURL(obj),60000);return d.nombre;
  }
  return {archivo,descargar};
});
