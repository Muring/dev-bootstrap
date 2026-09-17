// Browser-only font environment. No host CSS or font bytes enter PDP artifacts.
export const descriptionSelector='[id$="__pdp-description"] .section-gen-base__inner';
export async function readHost(page,url,selector=descriptionSelector){
 if(!url)throw Error('A verified Shopify --url (or verification_url) is required to measure global Pretendard.');
 selector ||= descriptionSelector;
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator(selector).waitFor({state:'attached',timeout:20000});
 const host=await page.locator(selector).evaluate(el=>({family:getComputedStyle(el).fontFamily,styles:[...document.querySelectorAll('link[rel="stylesheet"]')].map(e=>e.href).filter(h=>/pretendard/i.test(h))}));
 if(!/pretendard/i.test(host.family)||!host.styles.length)throw Error('The description host must supply global Pretendard and its stylesheet.');
 await page.evaluate(async family=>{await document.fonts.load(`400 24px ${family}`,'Product');await document.fonts.ready;},host.family);
 return host;
}
export async function applyHost(page,host){
 for(const url of host.styles)await page.addStyleTag({url});
 await page.evaluate(family=>{document.body.style.fontFamily=family;},host.family);
 await page.evaluate(async family=>{await document.fonts.load(`400 24px ${family}`,'Product');await document.fonts.ready;},host.family);
}
