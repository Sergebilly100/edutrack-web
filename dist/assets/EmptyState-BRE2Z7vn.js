import{m as d,j as e,aj as m,B as u,r as x}from"./index-R_Scj5SM.js";import{C as h}from"./circle-check-BWoj4o8T.js";/**
 * @license lucide-react v0.500.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]],f=d("book-open",p);/**
 * @license lucide-react v0.500.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]],c=d("search",j),y={xs:12,sm:16,md:20,lg:24,xl:32};function i({icon:s,size:t="md",className:n,"aria-label":o}){return e.jsx(s,{size:y[t],strokeWidth:1.75,className:n,"aria-label":o,"aria-hidden":!o})}const g={noCourses:f,noTeachers:m,allGood:h},l=(s,t="h-5 w-5 text-muted-foreground")=>{if(!s)return e.jsx(i,{icon:c,size:"md",className:t});if(x.isValidElement(s))return s;if(typeof s=="function"){const n=s;return e.jsx(n,{className:t})}return e.jsx(i,{icon:c,size:"md",className:t})};function E({icon:s,title:t,message:n,description:o,action:r}){const a=n??o;return e.jsxs("div",{className:"flex flex-col items-center gap-3 py-12 text-center",children:[e.jsx("div",{className:"flex h-12 w-12 items-center justify-center rounded-full bg-muted",children:l(s)}),e.jsx("h3",{className:"text-sm font-medium",children:t}),a?e.jsx("p",{className:"max-w-xs text-sm text-muted-foreground",children:a}):null,r?e.jsxs(u,{variant:"default",size:"sm",onClick:r.onClick,children:[r.icon?e.jsx("span",{className:"mr-2 inline-flex items-center",children:l(r.icon,"h-4 w-4")}):null,r.label]}):null]})}export{i as A,f as B,E,c as S,g as e};
