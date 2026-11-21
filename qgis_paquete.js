/* Personalización local del proyecto: recibe el ZIP publicado y entrega un .qgz con sus GeoPackages editables. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.QgisPaquete=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const quote=s=>'"'+s.replaceAll('"','""')+'"';
  const filas=(db,sql,args=[])=>{const s=db.prepare(sql);try{s.bind(args);const r=[];while(s.step())r.push(s.getAsObject());return r;}finally{s.free();}};
  function envolvente(bytes){
    if(!bytes||bytes.length<40||bytes[0]!==71||bytes[1]!==80)throw Error('Geometría GeoPackage no válida.');
    const flag=bytes[3],tipo=(flag>>1)&7;
    if(flag&16)return null;
    if(![1,2,3,4].includes(tipo))throw Error('La geometría no incluye su extensión.');
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),le=!!(flag&1);
    return [v.getFloat64(8,le),v.getFloat64(24,le),v.getFloat64(16,le),v.getFloat64(32,le)];
  }
  const unir=bs=>bs.reduce((a,b)=>a?[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]:b.slice(),null);
  function recortarGpkg(bytes,codigos,SQL,omitir=[]){
    const db=new SQL.Database(bytes),extensiones={};
    try{
      db.run('BEGIN');
      for(const c of filas(db,'SELECT table_name,column_name FROM gpkg_geometry_columns')){
        const tabla=c.table_name;
        if(omitir.includes(tabla)){
          db.run('DROP TABLE '+quote(tabla));
          for(const meta of ['gpkg_geometry_columns','gpkg_contents','gpkg_ogr_contents','gpkg_extensions'])
            if(filas(db,"SELECT name FROM sqlite_master WHERE name=?",[meta]).length)db.run('DELETE FROM '+quote(meta)+' WHERE table_name=?',[tabla]);
          continue;
        }
        if(codigos)db.run('DELETE FROM '+quote(tabla)+' WHERE provincia NOT IN ('+codigos.map(()=>'?').join(',')+')',codigos);
        const geos=filas(db,'SELECT '+quote(c.column_name)+' AS geom FROM '+quote(tabla));
        const bbox=unir(geos.map(g=>envolvente(g.geom)).filter(Boolean));
        extensiones[tabla]=bbox;
        db.run('UPDATE gpkg_contents SET min_x=?,min_y=?,max_x=?,max_y=? WHERE table_name=?',[...(bbox||[null,null,null,null]),tabla]);
      }
      db.run('COMMIT');db.run('VACUUM');
      if(filas(db,'PRAGMA integrity_check')[0].integrity_check!=='ok')throw Error('No se pudo validar el GeoPackage.');
      return {bytes:db.export(),extensiones};
    }finally{db.close();}
  }
  function ajustarXml(xml,op,publicacion,extensiones){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw Error('Proyecto QGIS no válido.');
    const capas=[...doc.querySelectorAll('projectlayers > maplayer')];
    const bases=new Map(capas.filter(c=>['Provincias','Galápagos','Cantones'].includes(c.querySelector('layername').textContent)).map(c=>[c.querySelector('layername').textContent,c]));
    const quitar=[];
    for(const [nombre,c] of bases){
      if(nombre==='Cantones'?!op.cantones:!op.limites)quitar.push(c.querySelector('id').textContent);
    }
    const datos=op.provincias?publicacion.provincias.filter(p=>op.provincias.includes(p.codigo)):publicacion.provincias;
    const continental=datos.filter(p=>p.codigo!=='20'),insular=datos.some(p=>p.codigo==='20');
    if(!insular||!continental.length)doc.querySelectorAll('Layouts LayoutItem[id="islas"]').forEach(n=>n.remove());
    const bounds=unir((continental.length?continental:datos).map(p=>p.bbox));
    const ponerExtent=(el,b,ratio)=>{
      const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
      let w=(b[2]-b[0])*1.1,h=(b[3]-b[1])*1.1;
      if(ratio){if(w/h<ratio)w=h*ratio;else h=w/ratio;}
      for(const [k,v] of Object.entries({xmin:cx-w/2,ymin:cy-h/2,xmax:cx+w/2,ymax:cy+h/2}))el.setAttribute(k,String(v));
    };
    for(const c of capas){
      const id=c.querySelector('id').textContent;
      if(quitar.includes(id)){c.remove();continue;}
      const tabla=c.querySelector('datasource').textContent.split('|layername=')[1],b=extensiones[tabla];
      const ext=c.querySelector('extent');if(ext&&b)for(const [i,k] of ['xmin','ymin','xmax','ymax'].entries()){const n=ext.querySelector(k);if(n)n.textContent=String(b[i]);}
      if(op.provincias?.length===1){let d=c.querySelector('defaults');if(d&&tabla&&!['provincias','cantones','galapagos'].includes(tabla)){const n=doc.createElement('default');n.setAttribute('field','provincia');n.setAttribute('expression',"'"+op.provincias[0]+"'");n.setAttribute('applyOnUpdate','0');d.append(n);}}
    }
    for(const n of doc.querySelectorAll('layer-tree-layer')){
      if(quitar.includes(n.getAttribute('id')))n.remove();
      else if(n.getAttribute('name')==='Cantones')n.setAttribute('checked','Qt::Checked');
    }
    const canton=bases.get('Cantones');
    for(const mapa of doc.querySelectorAll('Layouts LayoutItem[type="65639"]')){
      if(mapa.getAttribute('id')==='galapagos'&&(!insular||!continental.length)){mapa.remove();continue;}
      const ls=mapa.querySelector('LayerSet');
      for(const n of ls?.querySelectorAll('Layer')||[])if(quitar.includes(n.textContent))n.remove();
      if(op.cantones&&canton&&ls){const n=doc.createElement('Layer');n.textContent=canton.querySelector('id').textContent;n.setAttribute('name','Cantones');n.setAttribute('provider','ogr');n.setAttribute('source',canton.querySelector('datasource').textContent);ls.prepend(n);}
      if(op.provincias&&mapa.getAttribute('id')!=='galapagos'){
        const size=mapa.getAttribute('size').split(',').map(Number);ponerExtent(mapa.querySelector('Extent'),bounds,size[0]/size[1]);
      }
    }
    const view=doc.querySelector('ProjectViewSettings > DefaultViewExtent');
    if(view){
      if(op.provincias)ponerExtent(view,bounds);
      // Vista inicial guardada: sin ella QGIS desplazaba el mapa al terminar de abrir.
      doc.querySelector('qgis > mapcanvas')?.remove();
      const canvas=doc.createElement('mapcanvas');canvas.setAttribute('name','theMapCanvas');canvas.setAttribute('annotationsVisible','1');
      const hijo=(padre,nombre,texto)=>{const n=doc.createElement(nombre);if(texto!==undefined)n.textContent=texto;padre.append(n);return n;};
      hijo(canvas,'units','degrees');
      const extent=hijo(canvas,'extent');for(const k of ['xmin','ymin','xmax','ymax'])hijo(extent,k,view.getAttribute(k));
      hijo(canvas,'rotation','0');
      const srs=view.querySelector('spatialrefsys');if(srs)hijo(canvas,'destinationsrs').append(srs.cloneNode(true));
      hijo(canvas,'rendermaptile','0');
      doc.documentElement.insertBefore(canvas,doc.querySelector('qgis > projectMetadata'));
    }
    return new XMLSerializer().serializeToString(doc);
  }
  async function personalizar(bytes,op,{SQL,zip,limites}){
    const archivos=zip.unzipSync(bytes),decoder=new TextDecoder(),encoder=new TextEncoder();
    const pub=JSON.parse(decoder.decode(archivos['publicacion.json']));
    if(pub.esquema!==2)throw Error('El proyecto se está actualizando. Regresa al monitor y vuelve a prepararlo.');
    if(!archivos['capas/limites.gpkg']){if(!limites)throw Error('No se pudieron cargar los límites políticos.');archivos['capas/limites.gpkg']=limites;}
    delete pub.limites_archivo;
    op={provincias:op.provincias??null,limites:op.limites!==false,cantones:op.cantones===true};
    if(op.provincias){op.provincias=[...new Set(op.provincias)].sort();if(!op.provincias.length||op.provincias.some(c=>!pub.provincias.some(p=>p.codigo===c)))throw Error('Seleccione al menos una provincia válida.');}
    let ext={};
    for(const f of ['capas/alertas.gpkg','capas/limites.gpkg']){
      const omitir=f.includes('limites')?[...(!op.cantones?['cantones']:[]),...(!op.limites?['provincias','galapagos']:[])]:[];
      const r=recortarGpkg(archivos[f],op.provincias,SQL,omitir);archivos[f]=r.bytes;Object.assign(ext,r.extensiones);
    }
    const xml=ajustarXml(decoder.decode(archivos['alertas.qgs']),op,pub,ext);
    pub.recorte=op.provincias?pub.provincias.filter(p=>op.provincias.includes(p.codigo)).map(p=>p.nombre):'Todo el país';
    pub.limites_provinciales=op.limites;pub.cantones=op.cantones;
    // Un solo .qgz con los GeoPackage adjuntos («attachment:»): se abre con doble clic.
    // Abierto desde dentro de un ZIP, Windows extraía solo alertas.qgs y QGIS quedaba sin capas.
    return zip.zipSync({'alertas.qgs':encoder.encode(xml.replaceAll('./capas/','attachment:')),
      'alertas.gpkg':archivos['capas/alertas.gpkg'],'limites.gpkg':archivos['capas/limites.gpkg'],
      'publicacion.json':encoder.encode(JSON.stringify(pub,null,2))},{level:6});
  }
  return {envolvente,recortarGpkg,ajustarXml,personalizar};
});
