// Shared product-independent role scale. Values are cqi, not font resources.
export const roles={
 point:{size:6,weight:700,lineHeight:1,tracking:0},
 title:{size:8,weight:700,lineHeight:1.1,tracking:-.2},
 'title-compact':{size:6.5,weight:700,lineHeight:1.1,tracking:-.1},
 lead:{size:5.5,weight:400,lineHeight:1.3,tracking:-.1},
 body:{size:3.2,weight:400,lineHeight:1.4,tracking:0},
 notes:{size:3.2,weight:400,lineHeight:1.4,tracking:0},
 'edge-label':{size:2.1,weight:700,lineHeight:1,tracking:0},
 footnote:{size:1.7,weight:400,lineHeight:1.3,tracking:0}
};
function applyFit(result,t,section,model){
 if(!t.typography_fit)return quantize(result,section,model);
 const fit=t.typography_fit;if(!fit.reason?.trim())throw Error(`Typography fit needs reference evidence: ${t.id}`);
 const changes={};for(const key of ['size','tracking','weight'])if(fit[key]!==undefined){if(!Number.isFinite(fit[key]))throw Error(`Invalid typography fit: ${t.id}`);changes[key]=fit[key];}
 return quantize({...result,...changes},section,model);
}
function quantize(result,section,model){
 // Keep source metadata untouched; measurement must use the values actually emitted as cqi.
 const unit=section.width*section.scale/1000;
 return {...result,size:Math.round(result.size/unit)*unit,tracking:Math.round((result.tracking||0)/unit)*unit,render_ratio:model.design_width/(section.width*section.scale)};
}
export function resolveTypography(t,section,model){
 const ratio=model.design_width/(section.width*section.scale),key=t.typography_variant?`${t.css_role}-${t.typography_variant}`:t.css_role;
 const profile=roles[key];
 if(t.typography_exception){if(!t.typography_exception.reason?.trim())throw Error(`Typography exception needs a reason: ${t.id}`);return applyFit({...t,line_height:1,typography_key:null},t,section,model);}
 if(!profile)throw Error(`Assign a supported typography role or justified exception: ${t.id}`);
 const weight=t.emphasis==='strong'?700:t.emphasis==='medium'?500:profile.weight;
 return applyFit({...t,size:profile.size*model.design_width/100/ratio,weight,tracking:profile.tracking*model.design_width/100/ratio,line_height:profile.lineHeight,typography_key:key},t,section,model);
}
