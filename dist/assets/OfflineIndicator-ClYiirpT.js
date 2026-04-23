import{m as d,v as u,r as s,j as t,c as h}from"./index-R_Scj5SM.js";/**
 * @license lucide-react v0.500.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]],m=d("wifi-off",p);/**
 * @license lucide-react v0.500.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]],y=d("wifi",x);function k({forceState:n="auto"}){const{isOnline:e,wasOffline:r}=u(),[a,c]=s.useState(!1),i=s.useRef(e);s.useEffect(()=>{if(n==="auto"){if(i.current===!1&&e&&r){c(!0);const l=window.setTimeout(()=>{c(!1)},3e3);return i.current=e,()=>window.clearTimeout(l)}i.current=e}},[n,e,r]);const o=s.useMemo(()=>n==="offline"?"offline":n==="recovered"?"recovered":e?a?"recovered":"hidden":"offline",[n,e,a]),f=o!=="hidden";return t.jsxs("div",{className:h("sticky top-0 z-50 overflow-hidden transition-all duration-300 ease-in-out",f?"max-h-12":"max-h-0"),"aria-live":"polite",children:[o==="offline"?t.jsxs("div",{className:"bg-amber-500 text-white text-sm font-medium py-2 px-4 flex items-center gap-2",children:[t.jsx(m,{className:"h-4 w-4"}),t.jsx("span",{children:"Hors ligne — vos actions sont sauvegardées localement"})]}):null,o==="recovered"?t.jsxs("div",{className:"bg-green-600 text-white text-sm font-medium py-2 px-4 flex items-center gap-2",children:[t.jsx(y,{className:"h-4 w-4"}),t.jsx("span",{children:"Connexion rétablie — synchronisation en cours..."})]}):null]})}export{k as O};
