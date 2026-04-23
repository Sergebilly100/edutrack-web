import{m as c,j as e,v as x,r as a,c as p,aj as y,B as k}from"./index-mWhvzp9r.js";import{C as j}from"./circle-check-CGR-lb9s.js";/**
 * @license lucide-react v0.500.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]],v=c("book-open",w);/**
 * @license lucide-react v0.500.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]],l=c("search",M);/**
 * @license lucide-react v0.500.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]],N=c("wifi-off",g);/**
 * @license lucide-react v0.500.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]],z=c("wifi",b),_={xs:12,sm:16,md:20,lg:24,xl:32};function u({icon:n,size:s="md",className:t,"aria-label":o}){return e.jsx(n,{size:_[s],strokeWidth:1.75,className:t,"aria-label":o,"aria-hidden":!o})}function E({forceState:n="auto"}){const{isOnline:s,wasOffline:t}=x(),[o,i]=a.useState(!1),r=a.useRef(s);a.useEffect(()=>{if(n==="auto"){if(r.current===!1&&s&&t){i(!0);const h=window.setTimeout(()=>{i(!1)},3e3);return r.current=s,()=>window.clearTimeout(h)}r.current=s}},[n,s,t]);const d=a.useMemo(()=>n==="offline"?"offline":n==="recovered"?"recovered":s?o?"recovered":"hidden":"offline",[n,s,o]),m=d!=="hidden";return e.jsxs("div",{className:p("sticky top-0 z-50 overflow-hidden transition-all duration-300 ease-in-out",m?"max-h-12":"max-h-0"),"aria-live":"polite",children:[d==="offline"?e.jsxs("div",{className:"bg-amber-500 text-white text-sm font-medium py-2 px-4 flex items-center gap-2",children:[e.jsx(N,{className:"h-4 w-4"}),e.jsx("span",{children:"Hors ligne — vos actions sont sauvegardées localement"})]}):null,d==="recovered"?e.jsxs("div",{className:"bg-green-600 text-white text-sm font-medium py-2 px-4 flex items-center gap-2",children:[e.jsx(z,{className:"h-4 w-4"}),e.jsx("span",{children:"Connexion rétablie — synchronisation en cours..."})]}):null]})}const O={noCourses:v,noTeachers:y,allGood:j},f=(n,s="h-5 w-5 text-muted-foreground")=>{if(!n)return e.jsx(u,{icon:l,size:"md",className:s});if(a.isValidElement(n))return n;if(typeof n=="function"){const t=n;return e.jsx(t,{className:s})}return e.jsx(u,{icon:l,size:"md",className:s})};function R({icon:n,title:s,message:t,description:o,action:i}){const r=t??o;return e.jsxs("div",{className:"flex flex-col items-center gap-3 py-12 text-center",children:[e.jsx("div",{className:"flex h-12 w-12 items-center justify-center rounded-full bg-muted",children:f(n)}),e.jsx("h3",{className:"text-sm font-medium",children:s}),r?e.jsx("p",{className:"max-w-xs text-sm text-muted-foreground",children:r}):null,i?e.jsxs(k,{variant:"default",size:"sm",onClick:i.onClick,children:[i.icon?e.jsx("span",{className:"mr-2 inline-flex items-center",children:f(i.icon,"h-4 w-4")}):null,i.label]}):null]})}export{u as A,v as B,R as E,E as O,l as S,O as e};
