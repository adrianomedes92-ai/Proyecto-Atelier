// Verificar con la fábrica si corresponde 54 + 11 o 54 + 9 + 11 antes de publicar.
export const contact={display:'11-73730703',whatsappInternational:'',people:['Guillermo Barzola','Agustín Omedes']};
// Cargar aquí los códigos exactos del catálogo, nunca colores aproximados.
export const materials=[...['PANNE','MECHA','ZEPPELIN','DONN','BOUCLÉ'].map(name=>({name,type:'Tela',codes:[]})),...['TITANIUM','TALAMPAYA'].map(name=>({name,type:'Ecocuero',codes:[]}))];
export const products=[
 ['clapton-individual','Clapton Individual','Individuales','65 × 90 cm'],
 ['baby-clapton','Baby Clapton','Individuales','50 × 50 cm',[50,100]],
 ['clapton-dos','Clapton de dos cuerpos','Sillones','190 × 90 cm',[160,250]],
 ['clapton-martillo','Clapton Martillo','Sillones','190 × 90 cm',[140,200]],
 ['sillon-cama','Sillón Cama','Sillones','220 × 90 cm',null,'Cama de referencia: 180 × 140 cm.'],
 ['sillon-cine','Sillón Cine','Sillones','298 × 100 cm'],
 ['clapton-modular','Clapton Modular','Modulares','298 × 100 cm',null,'Múltiples configuraciones de armado.'],
 ['italiano','Modelo Italiano','Sillones','180 × 90 cm',[140,200]],
 ['oruga-v','Puff Oruga V','Puffs'],['oruga-h','Puff Oruga H','Puffs'],['oruga-mini','Oruga H Mini','Puffs']
].map(([id,name,category,reference,range,description])=>({id,name,category,reference,range,description:description||'',image:null,options:category==='Puffs'?['color','notes']:['material','measure','notes',...(category==='Modulares'?['layout']:[])],legs:[]}));
