(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e;(function(e){e.Unimplemented=`UNIMPLEMENTED`,e.Unavailable=`UNAVAILABLE`})(e||={});var t=class extends Error{constructor(e,t,n){super(e),this.message=e,this.code=t,this.data=n}},n=e=>e?.androidBridge?`android`:e?.webkit?.messageHandlers?.bridge?`ios`:`web`,r=r=>{let i=r.CapacitorCustomPlatform||null,a=r.Capacitor||{},o=a.Plugins=a.Plugins||{},s=()=>i===null?n(r):i.name,c=()=>s()!==`web`,l=e=>!!(f.get(e)?.platforms.has(s())||u(e)),u=e=>a.PluginHeaders?.find(t=>t.name===e),d=e=>r.console.error(e),f=new Map;return a.convertFileSrc||=e=>e,a.getPlatform=s,a.handleError=d,a.isNativePlatform=c,a.isPluginAvailable=l,a.registerPlugin=(n,r={})=>{let c=f.get(n);if(c)return console.warn(`Capacitor plugin "${n}" already registered. Cannot register plugins twice.`),c.proxy;let l=s(),d=u(n),p,ee=async()=>(!p&&l in r?p=p=typeof r[l]==`function`?await r[l]():r[l]:i!==null&&!p&&`web`in r&&(p=p=typeof r.web==`function`?await r.web():r.web),p),te=(r,i)=>{if(d){let e=d?.methods.find(e=>i===e.name);if(e)return e.rtype===`promise`?e=>a.nativePromise(n,i.toString(),e):(e,t)=>a.nativeCallback(n,i.toString(),e,t);if(r)return r[i]?.bind(r)}else if(r)return r[i]?.bind(r);else throw new t(`"${n}" plugin is not implemented on ${l}`,e.Unimplemented)},m=r=>{let i,a=(...a)=>{let o=ee().then(o=>{let s=te(o,r);if(s){let e=s(...a);return i=e?.remove,e}throw new t(`"${n}.${r}()" is not implemented on ${l}`,e.Unimplemented)});return r===`addListener`&&(o.remove=async()=>i()),o};return a.toString=()=>`${r.toString()}() { [capacitor code] }`,Object.defineProperty(a,"name",{value:r,writable:!1,configurable:!1}),a},h=m(`addListener`),g=m(`removeListener`),_=(e,t)=>{let n=h({eventName:e},t),r=async()=>{let r=await n;g({eventName:e,callbackId:r},t)},i=new Promise(e=>n.then(()=>e({remove:r})));return i.remove=async()=>{console.warn(`Using addListener() without 'await' is deprecated.`),await r()},i},v=new Proxy({},{get(e,t){switch(t){case`$$typeof`:return;case`toJSON`:return()=>({});case`addListener`:return d?_:h;case`removeListener`:return g;default:return m(t)}}});return o[n]=v,f.set(n,{name:n,proxy:v,platforms:new Set([...Object.keys(r),...d?[l]:[]])}),v},a.Exception=t,a.DEBUG=!!a.DEBUG,a.isLoggingEnabled=!!a.isLoggingEnabled,a},i=(e=>e.Capacitor=r(e))(typeof globalThis<`u`?globalThis:typeof self<`u`?self:typeof window<`u`?window:typeof global<`u`?global:{}),a=i.registerPlugin,o=class{constructor(){this.listeners={},this.retainedEventArguments={},this.windowListeners={}}addListener(e,t){let n=!1;this.listeners[e]||(this.listeners[e]=[],n=!0),this.listeners[e].push(t);let r=this.windowListeners[e];return r&&!r.registered&&this.addWindowListener(r),n&&this.sendRetainedArgumentsForEvent(e),Promise.resolve({remove:async()=>this.removeListener(e,t)})}async removeAllListeners(){this.listeners={};for(let e in this.windowListeners)this.removeWindowListener(this.windowListeners[e]);this.windowListeners={}}notifyListeners(e,t,n){let r=this.listeners[e];if(!r){if(n){let n=this.retainedEventArguments[e];n||=[],n.push(t),this.retainedEventArguments[e]=n}return}r.forEach(e=>e(t))}hasListeners(e){return!!this.listeners[e]?.length}registerWindowListener(e,t){this.windowListeners[t]={registered:!1,windowEventName:e,pluginEventName:t,handler:e=>{this.notifyListeners(t,e)}}}unimplemented(t=`not implemented`){return new i.Exception(t,e.Unimplemented)}unavailable(t=`not available`){return new i.Exception(t,e.Unavailable)}async removeListener(e,t){let n=this.listeners[e];if(!n)return;let r=n.indexOf(t);this.listeners[e].splice(r,1),this.listeners[e].length||this.removeWindowListener(this.windowListeners[e])}addWindowListener(e){window.addEventListener(e.windowEventName,e.handler),e.registered=!0}removeWindowListener(e){e&&(window.removeEventListener(e.windowEventName,e.handler),e.registered=!1)}sendRetainedArgumentsForEvent(e){let t=this.retainedEventArguments[e];t&&(delete this.retainedEventArguments[e],t.forEach(t=>{this.notifyListeners(e,t)}))}},s=e=>encodeURIComponent(e).replace(/%(2[346B]|5E|60|7C)/g,decodeURIComponent).replace(/[()]/g,escape),c=e=>e.replace(/(%[\dA-F]{2})+/gi,decodeURIComponent),l=class extends o{async getCookies(){let e=document.cookie,t={};return e.split(`;`).forEach(e=>{if(e.length<=0)return;let[n,r]=e.replace(/=/,`CAP_COOKIE`).split(`CAP_COOKIE`);n=c(n).trim(),r=c(r).trim(),t[n]=r}),t}async setCookie(e){try{let t=s(e.key),n=s(e.value),r=e.expires?`; expires=${e.expires.replace(`expires=`,``)}`:``,i=(e.path||`/`).replace(`path=`,``),a=e.url!=null&&e.url.length>0?`domain=${e.url}`:``;document.cookie=`${t}=${n||``}${r}; path=${i}; ${a};`}catch(e){return Promise.reject(e)}}async deleteCookie(e){try{document.cookie=`${e.key}=; Max-Age=0`}catch(e){return Promise.reject(e)}}async clearCookies(){try{let e=document.cookie.split(`;`)||[];for(let t of e)document.cookie=t.replace(/^ +/,``).replace(/=.*/,`=;expires=${new Date().toUTCString()};path=/`)}catch(e){return Promise.reject(e)}}async clearAllCookies(){try{await this.clearCookies()}catch(e){return Promise.reject(e)}}};a(`CapacitorCookies`,{web:()=>new l});var u=async e=>new Promise((t,n)=>{let r=new FileReader;r.onload=()=>{let e=r.result;t(e.indexOf(`,`)>=0?e.split(`,`)[1]:e)},r.onerror=e=>n(e),r.readAsDataURL(e)}),d=(e={})=>{let t=Object.keys(e);return Object.keys(e).map(e=>e.toLocaleLowerCase()).reduce((n,r,i)=>(n[r]=e[t[i]],n),{})},f=(e,t=!0)=>e?Object.entries(e).reduce((e,n)=>{let[r,i]=n,a,o;return Array.isArray(i)?(o=``,i.forEach(e=>{a=t?encodeURIComponent(e):e,o+=`${r}=${a}&`}),o.slice(0,-1)):(a=t?encodeURIComponent(i):i,o=`${r}=${a}`),`${e}&${o}`},``).substr(1):null,p=(e,t={})=>{let n=Object.assign({method:e.method||`GET`,headers:e.headers},t),r=d(e.headers)[`content-type`]||``;if(typeof e.data==`string`)n.body=e.data;else if(r.includes(`application/x-www-form-urlencoded`)){let t=new URLSearchParams;for(let[n,r]of Object.entries(e.data||{}))t.set(n,r);n.body=t.toString()}else if(r.includes(`multipart/form-data`)||e.data instanceof FormData){let t=new FormData;if(e.data instanceof FormData)e.data.forEach((e,n)=>{t.append(n,e)});else for(let n of Object.keys(e.data))t.append(n,e.data[n]);n.body=t;let r=new Headers(n.headers);r.delete(`content-type`),n.headers=r}else(r.includes(`application/json`)||typeof e.data==`object`)&&(n.body=JSON.stringify(e.data));return n},ee=class extends o{async request(e){let t=p(e,e.webFetchExtra),n=f(e.params,e.shouldEncodeUrlParams),r=n?`${e.url}?${n}`:e.url,i=await fetch(r,t),a=i.headers.get(`content-type`)||``,{responseType:o=`text`}=i.ok?e:{};a.includes(`application/json`)&&(o=`json`);let s,c;switch(o){case`arraybuffer`:case`blob`:c=await i.blob(),s=await u(c);break;case`json`:s=await i.json();break;default:s=await i.text()}let l={};return i.headers.forEach((e,t)=>{l[t]=e}),{data:s,headers:l,status:i.status,url:i.url}}async get(e){return this.request(Object.assign(Object.assign({},e),{method:`GET`}))}async post(e){return this.request(Object.assign(Object.assign({},e),{method:`POST`}))}async put(e){return this.request(Object.assign(Object.assign({},e),{method:`PUT`}))}async patch(e){return this.request(Object.assign(Object.assign({},e),{method:`PATCH`}))}async delete(e){return this.request(Object.assign(Object.assign({},e),{method:`DELETE`}))}};a(`CapacitorHttp`,{web:()=>new ee});var te=`modulepreload`,m=function(e){return`/`+e},h={},g=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=m(t,n),t=s(t),t in h)return;h[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:te,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},_=a(`App`,{web:()=>g(()=>import(`./web-PpP4AxwH.js`).then(e=>new e.AppWeb),[])});function v(){return new Date}function y(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}`}function b(e){let[t,n,r]=e.split(`-`).map(Number);return new Date(t,n-1,r)}function x(e,t){let n=new Date(e);return n.setDate(n.getDate()+t),n}function ne(e,t){let n=b(e).getTime(),r=b(t).getTime();return Math.floor((r-n)/864e5)+1}function S(e){return y(e).slice(0,7)}function re(e){return e.toLocaleString(`en-US`,{month:`long`})}var ie=`mobile-local`,ae=`mobile-v1.0.0`,C=`finledge.mobile.profileName`,w=`finledge.mobile.profilePromptDismissed`,T={activeScreen:`home`,screenHistory:[`home`],lastHomeBackPress:0,homeMode:`expense`,homeRange:`week`,selectedHomeCategories:new Set,categorySelectionTouched:!1,customStart:y(new Date(v().getFullYear(),v().getMonth(),1)),customEnd:y(v()),dashSearchQuery:{bank:``,shares:``,expenses:``},expensesDashTab:`combined`,sharesEntryType:`ipo`};function oe(){let e=new Date().getHours();return e<12?`Good morning`:e<17?`Good afternoon`:`Good evening`}function E(){return window.localStorage.getItem(C)?.trim()||``}function se(){return(E()||`F`).slice(0,1).toUpperCase()}function ce(){return!E()&&!window.localStorage.getItem(w)}function le(e){let t=e.trim();t&&(window.localStorage.setItem(C,t),window.localStorage.setItem(w,`1`))}function ue(){window.localStorage.setItem(w,`1`)}function de(e){document.querySelector(`.toast`)?.remove();let t=document.createElement(`div`);t.className=`toast`,t.textContent=e,document.body.appendChild(t),window.setTimeout(()=>t.remove(),1600)}function fe(){_.exitApp()}var pe=[`Interest Earned`,`Interest Tax`,`Mobile Banking Charge`,`Debit Card Charge`,`Cheque Book`,`Locker`,`Demat Renewal`,`Demat & MeroShare Renewal`,`Broker Renewal`,`MeroShare Renewal`,`Other Charges`],me=[`ipo`,`sip`,`buy`,`sell`,`dividend`],he={ipo:`IPO entry`,sip:`SIP investment`,buy:`Secondary buy`,sell:`Sell shares`,dividend:`Dividend`},ge=[{value:`bank`,label:`Bank Flow`},{value:`cash`,label:`Cash Flow`}],_e=[{value:`expense`,label:`Expense`},{value:`income`,label:`Income`}],ve=[`Food`,`Transportation`,`Entertainment`,`Shopping`,`Health`,`Education`,`Bills`,`Rent`,`Travel`,`Insurance`,`Investment`,`SIP`,`Share Market`,`Other`],ye=[`Salary`,`Freelance`,`Business`,`Prize/Lottery`,`Gift`,`Refund`,`Investment Income`,`Investment Return`,`Dividend`,`Share Sell Proceeds`,`Other Income`];function D(e,t={}){let n=Math.abs(e).toLocaleString(`en-US`,{maximumFractionDigits:2});return t.sign?`${e>=0?`+`:`-`}Rs ${n}`:`Rs ${n}`}function O(e){let t=e<0?`-`:``,n=Math.abs(e);return n>=1e5?`${t}${(n/1e5).toFixed(n%1e5==0?0:1)}L`:n>=1e3?`${t}${(n/1e3).toFixed(n%1e3==0?0:1)}k`:`${t}${n.toLocaleString(`en-US`,{maximumFractionDigits:0})}`}var be=y(v());function k(e,t){return`<main class="screen ${T.activeScreen===e?`active`:``}" data-screen="${e}">${t}</main>`}function xe(){let e=E();return`
    <header class="topbar">
      <button class="icon-btn" data-open-drawer aria-label="Open navigation"><span class="hamburger-lines"></span></button>
      <div class="brand brand-centered brand-logo" data-nav="home" style="cursor:pointer;" title="Go to Home">
        <img class="brand-logo-img" src="./icon.png" alt="FinLedge logo">
        <div class="brand-text"><b>FinLedge</b><span>${oe()}${e?`, ${e}`:``}</span></div>
      </div>
      <button class="avatar" data-nav="settings" aria-label="Open profile">${se()}</button>
    </header>
  `}function Se(){return`
    <div class="drawer-overlay" data-close-drawer></div>
    <nav class="drawer" aria-label="Mobile navigation">
      <div class="drawer-head"><img class="mark mark-img" src="./icon.png" alt="FinLedge logo"><div class="brand-text"><b>FinLedge</b><span>${ae} / ${ie}</span></div></div>
      ${[[`home`,`Home`,`🏠`,[`home`]],[`bank-add`,`Bank Services`,`🏦`,[`bank-add`,`bank-dash`]],[`shares-add`,`Share Portfolio`,`📈`,[`shares-add`,`shares-dash`]],[`expenses-add`,`Personal Expenses`,`💳`,[`expenses-add`,`expenses-dash`,`transfer`]],[`summary`,`Financial Summary`,`📊`,[`summary`]],[`settings`,`Settings`,`⚙`,[`settings`,`settings-profile`,`settings-import-export`,`settings-investment`,`settings-backup-sync`,`settings-privacy`,`settings-about`,`settings-how-to-use`,`settings-version`]]].map(([e,t,n,r])=>`<button class="drawer-item ${r.includes(T.activeScreen)?`active`:``}" data-nav="${e}"><span>${n}</span>${t}</button>`).join(``)}
    </nav>
  `}function A(e,t){return`<div class="btn-row"><button class="btn-secondary" data-back="${e}">Back</button><button class="btn-secondary" data-nav="home">Home</button><button class="btn-secondary active" data-nav="${t}">${t.endsWith(`dash`)?`View dashboard`:`Add entry`}</button></div>`}function Ce(e,t,n,r,i){return`<p class="eyebrow">${e}</p><h1 class="pagehead">${t}</h1><p class="sub">Stored locally on this device.</p>${j(n,r)}${A(`home`,i)}`}function j(e,t){return`<section class="card">${e.map(([e,t,n])=>M(e,t,n)).join(``)}<button class="btn-primary">${t}</button></section>`}function M(e,t,n){return t===`select`?`<div class="field"><label>${e}</label><select>${we(e,n)}</select></div>`:`<div class="field"><label>${e}</label><input type="${t}" ${t===`number`?`inputmode="decimal"`:``} value="${t===`date`?be:n??``}"></div>`}function we(e,t=`Other`){return({Category:pe.includes(t??``)?pe:[...ve,...ye],"Entry type":me,Flow:ge.map(e=>e.label),Type:_e.map(e=>e.label),"Dividend Type":[`cash`,`bonus`],"SIP type":[`installment`,`redeem`]}[e]||[t??`Other`,`Other`]).map(e=>`<option value="${e}">${he[e]||e}</option>`).join(``)}function N(e,t=``){return`<div class="section-title"><h3>${e}</h3>${t?`<span>${t}</span>`:``}</div>`}function P(e,t=`Search`){return`<input class="search-input" type="search" placeholder="${t}" value="${(T.dashSearchQuery[e]??``).replace(/"/g,`&quot;`)}" data-search-module="${e}" autocomplete="off">`}function F(e,t=2,n=!1){return`<div class="${t===3?`stat-grid split-3`:`stat-grid`}">${e.map(([t,r,i],a)=>{let o=a===e.length-1;return`<div class="stat-box${n&&o?` stat-box-full`:``}"><div class="label">${t}</div><div class="value money ${i}">${D(r,{sign:i===`pos`||i===`neg`})}</div></div>`}).join(``)}</div>`}function I(){let e=v(),t=T.homeRange;if(t===`week`)return Array.from({length:90},(t,n)=>{let r=x(e,n-89);return{label:String(r.getDate()),sublabel:r.toLocaleString(`en-US`,{month:`short`}),key:y(r),isDay:!0}});if(t===`month`)return Array.from({length:400},(t,n)=>{let r=x(e,n-399);return{label:String(r.getDate()),sublabel:r.toLocaleString(`en-US`,{month:`short`}),key:y(r),isDay:!0}});if(t===`year`)return Array.from({length:48},(t,n)=>{let r=new Date(e.getFullYear(),e.getMonth()-(47-n),1),i=String(r.getFullYear()).slice(2);return{label:r.toLocaleString(`en-US`,{month:`short`}),sublabel:`'${i}`,key:S(r),isDay:!1}});let n=ne(T.customStart,T.customEnd);if(n<=60)return Array.from({length:n},(e,t)=>{let n=x(b(T.customStart),t);return{label:String(n.getDate()),sublabel:n.toLocaleString(`en-US`,{month:`short`}),key:y(n),isDay:!0}});let r=[],i=new Date(b(T.customStart));i.setDate(1);let a=b(T.customEnd);for(;i<=a;){let e=String(i.getFullYear()).slice(2);r.push({label:i.toLocaleString(`en-US`,{month:`short`}),sublabel:`'${e}`,key:S(i),isDay:!1}),i=new Date(i.getFullYear(),i.getMonth()+1,1)}return r}var Te=44,Ee=148,De=14,Oe=12,ke=14,Ae=102;function je(e){if(!e.length)return`<p class='sub'>No data for this period.</p>`;let t=e.filter(e=>Math.abs(e.value)>0),n=t.length?Math.max(...t.map(e=>Math.abs(e.value))):1;e.length*50;let r=e.map(e=>{let t=Math.abs(e.value)>=.01,r=t?Math.max(6,Math.abs(e.value)/n*Ae):0;return`<div style="width:${Te}px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;height:${Ee}px;justify-content:flex-end;gap:1px;">${t?`<span style="height:${ke}px;font-size:9px;font-weight:700;color:${e.color};font-variant-numeric:tabular-nums;white-space:nowrap;">${O(e.value)}</span>`:`<span style="height:${ke}px;"></span>`}${t?`<div style="height:${r}px;width:18px;background:${e.color};border-radius:4px 4px 2px 2px;flex-shrink:0;"></div>`:`<div style="height:0;"></div>`}${`<span style="height:${De}px;font-size:9px;color:var(--text-2);font-weight:500;">${e.label}</span>`}${e.sublabel?`<span style="height:${Oe}px;font-size:8px;color:var(--text-3);">${e.sublabel}</span>`:`<span style="height:${Oe}px;"></span>`}</div>`}).join(``);return`<div class="chart-scroll" data-scroll-end style="-webkit-overflow-scrolling:touch;">
    <div style="display:flex;align-items:flex-end;gap:6px;padding:0 8px 4px;width:${Me(e)}px;">
      ${r}
    </div>
  </div>`}function Me(e){return e.length*50+16}function L(e,t,n,r=[`week`,`month`,`year`,`custom`]){let i=r.map(e=>`<button class="${T.homeRange===e?`active`:``}" data-home-range="${e}">${e[0].toUpperCase()}${e.slice(1)}</button>`).join(``),a=T.homeRange===`custom`?`<div class="custom-range"><label>From<input type="date" value="${T.customStart}" data-custom-start></label><label>To<input type="date" value="${T.customEnd}" data-custom-end></label></div>`:``,o=n.map(e=>`<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${e.color};margin-right:5px;vertical-align:middle;"></i>${e.label}</span>`).join(``);return`<section class="card">
    <div class="section-title"><h3>${e}</h3></div>
    <div class="segmented graph-tabs" style="margin-bottom:8px;">${i}</div>
    ${a}
    ${je(t)}
    ${o?`<div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">${o}</div>`:``}
  </section>`}function Ne(e,t={wrap:!0}){let n=`<div class="segmented graph-tabs">${e.map(e=>`<button class="${T.homeRange===e?`active`:``}" data-home-range="${e}">${e[0].toUpperCase()}${e.slice(1)}</button>`).join(``)}</div>
    ${T.homeRange===`custom`?`<div class="custom-range"><label>From<input type="date" value="${T.customStart}" data-custom-start></label><label>To<input type="date" value="${T.customEnd}" data-custom-end></label></div>`:``}`;return t.wrap===!1?`<div class="period-controls compact-card">${n}</div>`:`<section class="card compact-card">${n}</section>`}function R(e,t=!0,n=``){let r=n?(T.dashSearchQuery[n]??``).toLowerCase():``,i=r?e.filter(e=>[e.description,e.category,e.flow_type,e.date].map(String).join(` `).toLowerCase().includes(r)):e,a=`<p class="sub" style="margin:0 0 8px;font-size:11px;">Showing ${i.length} entr${i.length===1?`y`:`ies`}${r?` matching "${r}"`:``}</p>`,o=`<div style="max-height:300px;overflow-y:auto;-webkit-overflow-scrolling:touch;">${i.length?i.map(e=>{let t=Number(e.amount??0)>=0?`income`:`expense`,n=String(e.direction??t),r=Number(e.amount??0);return`<div class="history-row">
          <div class="meta"><b>${String(e.description??e.category??`Entry`)}</b><span>${[e.category,e.flow_type,e.date].filter(Boolean).map(String).join(` · `)}</span></div>
          <div class="money ${n===`income`?`pos`:`neg`}">${D(r,{sign:!0})}</div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" disabled title="Edit (coming soon)">✎</button>
            <button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" disabled title="Delete (coming soon)">🗑</button>
          </div>
        </div>`}).join(``):`<p class="sub">${r?`No entries match your search.`:`No entries yet.`}</p>`}</div>`;return t?`<section class="card">${a}${o}</section>`:`${a}${o}`}function Pe(e,t,n=`var(--brand-teal)`){if(!t.length)return``;let r=Math.max(...t.map(e=>Math.abs(e.value)),1);return`<section class="card"><h3>${e}</h3>${t.map(e=>{let t=Math.max(4,Math.abs(e.value)/r*100);return`<div class="history-row" style="display:block;padding:8px 0;">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-1);margin-bottom:6px;">
        <span>${e.label}</span><b class="money" style="font-variant-numeric:tabular-nums;">${O(e.value)}</b>
      </div>
      <div class="category-meter"><i style="width:${t}%;background:${n};"></i></div>
    </div>`}).join(``)}</section>`}var z=`var(--accent-green)`,B=`var(--accent-red)`,V=`var(--brand-teal)`,Fe=`var(--accent-amber)`,Ie=60,Le=148,Re=14,ze=12,H=12,Be=2,Ve=101;function He(e){let t=Ge(e);if(typeof t==`string`)return`<p class="sub range-warning">${t}</p>`;let n=Math.max(...t.flatMap(e=>[e.income,e.expense,Math.abs(e.net)]),1);return`
    <div class="chart-scroll" data-scroll-end style="-webkit-overflow-scrolling:touch;">
      <div style="display:flex;align-items:flex-end;gap:4px;padding:0 8px 4px;width:${t.length*64+16}px;">
        ${t.map(e=>Ue(e,n)).join(``)}
      </div>
    </div>
    <div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${z};margin-right:4px;vertical-align:middle;"></i>Income</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${B};margin-right:4px;vertical-align:middle;"></i>Expense</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${V};margin-right:4px;vertical-align:middle;"></i>Net ≥0</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${Fe};margin-right:4px;vertical-align:middle;"></i>Net &lt;0</span>
    </div>
  `}function Ue(e,t){let n=U(e.income,t,z,e.income>0),r=U(e.expense,t,B,e.expense>0),i=e.net>=0?V:Fe;return`<div style="width:${Ie}px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;height:${Le}px;justify-content:flex-end;gap:1px;">
    <div style="display:flex;align-items:flex-end;gap:${Be}px;margin-bottom:2px;">${n}${r}${U(Math.abs(e.net),t,i,e.net!==0,O(e.net))}</div>
    <span style="height:${Re}px;font-size:9px;color:var(--text-2);font-weight:500;">${e.label}</span>
    <span style="height:${ze}px;font-size:8px;color:var(--text-3);">${e.sublabel??``}</span>
  </div>`}function U(e,t,n,r,i){if(!r||Math.abs(e)<.01)return`<div style="width:${H}px;display:flex;flex-direction:column;align-items:center;"></div>`;let a=Math.max(6,Math.abs(e)/t*Ve);return`<div style="width:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:1px;">
    <span style="font-size:8px;font-weight:700;color:${n};font-variant-numeric:tabular-nums;white-space:nowrap;transform:rotate(-55deg);transform-origin:center bottom;display:block;margin-bottom:2px;">${i??O(e)}</span>
    <div style="height:${a}px;width:${H}px;background:${n};border-radius:3px 3px 1px 1px;"></div>
  </div>`}function We(e){let t=new Map;for(let n of e){let e=String(n.category??`Other`);t.set(e,(t.get(e)??0)+Number(n.amount??0))}let n=[...t.entries()].sort((e,t)=>t[1]-e[1]).slice(0,5);if(!n.length)return`<p class="sub">Nothing to show for the selected ${T.homeMode} categories yet.</p>`;let r=Math.max(...n.map(([,e])=>e),1),i=T.homeMode===`income`?`pos`:`neg`,a=T.homeMode===`income`?z:B;return n.map(([e,t])=>`<div class="history-row"><b>${e}</b><span class="money ${i}">${O(t)}</span></div>
     <div class="category-meter"><i style="width:${Math.max(8,t/r*100)}%;background:${a};"></i></div>`).join(``)}function Ge(e){let t=v();if(T.homeRange===`week`)return W(e,x(t,-89),t);if(T.homeRange===`month`)return W(e,x(t,-399),t);if(T.homeRange===`year`)return Ke(e,48);let n=ne(T.customStart,T.customEnd);return n<1?`Choose an end date after the start date.`:n>365?`Custom range supports up to 365 days.`:W(e,b(T.customStart),b(T.customEnd))}function W(e,t,n){let r=new Map;for(let e=new Date(t);e<=n;e=x(e,1)){let t=y(e),n=e.toLocaleString(`en-US`,{month:`short`});r.set(t,{label:String(e.getDate()),sublabel:n,key:t,income:0,expense:0,net:0})}for(let t of e){let e=r.get(String(t.date));e&&qe(e,t)}return[...r.values()]}function Ke(e,t){let n=v();return Array.from({length:t},(r,i)=>{let a=new Date(n.getFullYear(),n.getMonth()-(t-1-i),1),o=S(a),s=String(a.getFullYear()).slice(2),c={label:a.toLocaleString(`en-US`,{month:`short`}),sublabel:`'${s}`,key:o,income:0,expense:0,net:0};for(let t of e)String(t.date).startsWith(o)&&qe(c,t);return c})}function qe(e,t){let n=Number(t.amount||0);t.direction===`income`?(e.income+=n,e.net+=n):(e.expense+=n,e.net-=n)}var Je=[`Interest Earned`,`Interest Tax`,`Mobile Banking Charge`,`Debit Card Charge`,`Cheque Book`,`Locker`,`Demat Renewal`,`Demat & MeroShare Renewal`,`Broker Renewal`,`MeroShare Renewal`,`Other Charges`],Ye=new Set([`interest earned`,`income`]);function G(e){if(e==null||e===``)return 0;let t=Number(e);return Number.isFinite(t)?t:0}function Xe(e){return Ye.has(e.trim().toLowerCase())}function Ze(e){let t=0,n=0,r=Object.fromEntries(Je.map(e=>[e,0]));for(let i of e){let e=String(i.category??``).trim(),a=G(i.amount);if(Xe(e))t+=a,e in r?r[e]+=a:e&&(r[e]=(r[e]??0)+a);else{let t=Math.abs(a);n+=t,e&&(r[e]=(r[e]??0)+t)}}return{total_income:t,total_expenses:n,net_balance:t-n,category_totals:r}}function Qe(e,t){let n=G(t);return e===`income`?n:-n}function $e(e){let t=String(e.category??``).trim().toLowerCase(),n=String(e.buy_sell??``).trim().toLowerCase();return t===`ipo`||t===`buy`?[`expense`,`Investment Expense`]:t===`sip`&&(n===`redeem`||n===`redeemed`)?[`income`,`Investment Income`]:t===`sip`?[`expense`,`Investment Expense`]:t===`sell`||t===`dividend`&&n===`cash`?[`income`,`Investment Income`]:null}function et(e){let t=new Map([[`ipo:ipo`,`IPO`],[`buy:buy`,`Secondary buy`],[`sell:sell`,`Share sell`],[`sip:installment`,`SIP installment`],[`sip:redeem`,`SIP redeem`],[`sip:redeemed`,`SIP redeem`],[`dividend:cash`,`Cash dividend`]]),n=[];for(let r of e){let e=$e(r),i=Math.abs(G(r.total_amount));if(!e||i<=0)continue;let[a,o]=e,s=String(r.category??``).trim().toLowerCase(),c=String(r.buy_sell??``).trim().toLowerCase(),l=Number(r.id??0),u=String(r.share_name??``).trim().toUpperCase(),d=t.get(`${s}:${c}`)??it(s);n.push({id:`share-${l}`,display_id:`S-${l}`,date:String(r.date??``),flow_type:`bank`,direction:a,category:o,amount:i,signed_amount:Qe(a,i),description:`${d}: ${u}`,source:`share-sync`,timestamp:String(r.timestamp??``),source_ref:String(r.sync_ref??`share:${l}`)})}return n}function tt(e){let t=[];for(let n of e){let e=String(n.category??``).trim(),r=Math.abs(G(n.amount));if(r<=0)continue;let i=Xe(e)?`income`:`expense`,a=i===`income`?`Interest Earned`:`Service Cost`,o=Number(n.id??0),s=String(n.description??``).trim(),c=e||a;t.push({id:`bank-services-${o}`,display_id:`BS-${o}`,date:String(n.date??``),flow_type:`bank`,direction:i,category:a,amount:r,signed_amount:Qe(i,r),description:`${c}${s?`: ${s}`:``}`,source:`bank-services-sync`,timestamp:String(n.timestamp??``),source_ref:`bank-services:${o}`})}return t}function nt(e){let t={bank:rt(),cash:rt()};for(let n of e){let e=String(n.flow_type??``).trim().toLowerCase();if(e!==`bank`&&e!==`cash`)continue;let r=String(n.direction??``).trim().toLowerCase(),i=String(n.category??``).trim()||`Uncategorized`,a=Math.abs(G(n.amount)),o=String(n.source??`manual`).trim().toLowerCase(),s=i.toLowerCase(),c=t[e];r===`income`?(c.total_income+=a,c.income_breakdown[i]=(c.income_breakdown[i]??0)+a,e===`bank`&&o===`bank-services-sync`?c.interest_earned+=a:e===`bank`&&s===`investment income`?c.investment_income+=a:c.income+=a):(c.total_expenses+=a,c.expense_breakdown[i]=(c.expense_breakdown[i]??0)+a,e===`bank`&&o===`bank-services-sync`?c.service_cost+=a:e===`bank`&&[`investment expense`,`investment`,`sip`,`share market`].includes(s)?c.investment_expense+=a:c.expenses+=a)}for(let e of Object.values(t))e.net=e.total_income-e.total_expenses;let n={overall_income:t.bank.total_income+t.cash.total_income,overall_expenses:t.bank.total_expenses+t.cash.total_expenses,overall_net:0,bank:t.bank,cash:t.cash};return n.overall_net=n.overall_income-n.overall_expenses,{bank:t.bank,cash:t.cash,combined:n}}function rt(){return{income:0,expenses:0,investment_expense:0,investment_income:0,interest_earned:0,service_cost:0,total_income:0,total_expenses:0,net:0,income_breakdown:{},expense_breakdown:{}}}function it(e){return e&&`${e.charAt(0).toUpperCase()}${e.slice(1)}`}function at(e){let t=Number(e??0);return Number.isFinite(t)?Math.trunc(t):0}function ot(e,t){let n=t,r=0;for(let t of e){if(n<=0)break;let e=t.qty,i=Math.min(e,n);if(r+=i*t.price,e>0&&t.asba!==0){let n=t.asba*(i/e);r+=n,t.asba-=n}t.qty=e-i,n-=i}if(n>0)throw Error(`Not enough available quantity to sell for this share.`);return r}function st(e){let t=0,n=new Map,r=new Map;return e.map(e=>{let i=String(e.share_name??``).trim(),a=i.toLowerCase(),o=String(e.category??``).trim().toLowerCase(),s=G(e.per_unit_price),c=at(e.allotted),l=String(e.buy_sell??``).trim().toLowerCase(),u=o===`ipo`?5:0,d=0,f=0;if(o===`dividend`)l===`cash`&&(d=s,f=d);else if(o===`sip`){let t=l===`sip`?`installment`:l,n=G(e.total_amount);if(d=n>0?n:c>0?s*c:s,t===`redeem`){let e=r.get(a)??0;f=d-e,r.set(a,0),s=d,l=`redeem`}else r.set(a,(r.get(a)??0)+d),l=`installment`,s=c>0?d/c:d}else d=s*c+u;if(o===`ipo`||o===`buy`||o===`dividend`&&l===`bonus`){if(a){let e=n.get(a)??[];e.push({qty:c,price:o===`dividend`?0:s,asba:o===`ipo`?u:0}),n.set(a,e)}}else if(o===`sell`&&c>0){let e=ot(n.get(a)??[],c);f=d-e}return t+=f,{id:e.id,date:String(e.date??``),share_name:i,category:o,per_unit_price:s,asba_charge:u,allotted:c,buy_sell:l,total_amount:d,profit_loss:f,cumulative_profit:t,timestamp:e.timestamp,sync_ref:e.sync_ref}})}function ct(e){let t=0,n=0,r=0,i=0,a=0,o=0,s=0,c=0;for(let l of e){let e=String(l.category??``).trim().toLowerCase(),u=String(l.buy_sell??``).trim().toLowerCase(),d=G(l.total_amount),f=G(l.profit_loss);e===`ipo`?t+=d:e===`sip`&&(u===`redeem`||u===`redeemed`)?(r+=d,i+=f):e===`sip`?n+=d:e===`buy`?a+=d:e===`sell`?(o+=d,s+=f):e===`dividend`&&u===`cash`&&(c+=d)}let l=t+a,u=s+c-l,d=l+n;return{total_ipo_investment:t,total_sip_investment:n,total_sip_redeemed:r,sip_profit_loss:i,total_buy_amount:a,overall_investment:l,total_sell_amount:o,total_dividend:c,total_profit:s,overall_profit_loss:u,grand_total_investment:d,grand_profit_loss:u+i}}var K=[{id:1,date:`2026-08-01`,category:`Interest Earned`,amount:820,description:`Savings`,timestamp:`2026-08-01T09:00:00`},{id:2,date:`2026-08-04`,category:`Mobile Banking Charge`,amount:-25,description:`Monthly`,timestamp:`2026-08-04T09:00:00`},{id:3,date:`2026-08-10`,category:`Demat Renewal`,amount:-150,description:`Renewal`,timestamp:`2026-08-10T09:00:00`}],q=st([{id:1,date:`2026-08-03`,share_name:`NABIL`,category:`ipo`,per_unit_price:100,allotted:10,buy_sell:`ipo`,timestamp:`2026-08-03T10:00:00`},{id:2,date:`2026-08-06`,share_name:`NABIL`,category:`sell`,per_unit_price:160,allotted:4,buy_sell:`sell`,timestamp:`2026-08-06T10:00:00`},{id:3,date:`2026-08-07`,share_name:`NIBL`,category:`sip`,per_unit_price:1e3,total_amount:1e3,allotted:20,buy_sell:`installment`,timestamp:`2026-08-07T10:00:00`}]),lt=[{id:1,display_id:`C-1`,date:`2026-08-20`,flow_type:`cash`,direction:`expense`,category:`Food`,amount:560,signed_amount:-560,description:`Grocery top-up`,source:`manual`,timestamp:`2026-08-20T18:00:00`},{id:2,display_id:`B-2`,date:`2026-08-01`,flow_type:`bank`,direction:`income`,category:`Salary`,amount:45e3,signed_amount:45e3,description:`Salary`,source:`manual`,timestamp:`2026-08-01T08:00:00`},{id:3,display_id:`C-3`,date:`2026-08-18`,flow_type:`cash`,direction:`expense`,category:`Entertainment`,amount:900,signed_amount:-900,description:`Movie night`,source:`manual`,timestamp:`2026-08-18T20:00:00`}],ut=[{id:1,date:`2026-08-22`,from_flow:`cash`,to_flow:`bank`,amount:2e3,description:`Deposit`}];function J(){return[...lt,...et(q),...tt(K)]}function Y(){let e=S(v());return J().filter(t=>t.source===`manual`&&String(t.date).startsWith(e))}function dt(e){let t=e.filter(e=>e.direction===`income`).reduce((e,t)=>e+Number(t.amount||0),0),n=e.filter(e=>e.direction===`expense`).reduce((e,t)=>e+Number(t.amount||0),0);return{income:t,expense:n,net:t-n}}function ft(){return dt(Y())}function pt(){return dt(J().filter(e=>e.source===`manual`&&e.date===y(v())))}function mt(e){return e.reduce((e,t)=>e+Number(t.amount||0),0)}function ht(){let e=ft(),t=pt(),n=gt(),r=_t(),i=mt(n),a=[...n].sort((e,t)=>String(t.date).localeCompare(String(e.date))).slice(0,4),o=re(v());return`
    ${vt()}
    <section class="card balance-card">
      <div class="segmented">
        <button class="${T.homeMode===`expense`?`active`:``}" data-home-mode="expense">Expense</button>
        <button class="${T.homeMode===`income`?`active`:``}" data-home-mode="income">Income</button>
      </div>
      <div class="metric-row"><div><div class="metric-label">${o} net balance</div><div class="money big ${e.net>=0?`pos`:`neg`}">${D(e.net,{sign:!0})}</div></div></div>
      <div class="split split-3"><div><span>Total income</span><b class="money pos">${D(e.income)}</b></div><div><span>Total expense</span><b class="money neg">${D(e.expense)}</b></div><div><span>Selected ${T.homeMode}</span><b class="money ${T.homeMode===`income`?`pos`:`neg`}">${D(i)}</b></div></div>
    </section>
    <div class="stat-grid" style="margin:0 0 12px;">
      <div class="stat-box"><div class="label">Today income</div><div class="value money pos">${D(t.income)}</div></div>
      <div class="stat-box"><div class="label">Today expense</div><div class="value money neg">${D(t.expense)}</div></div>
      <div class="stat-box stat-box-full"><div class="label">Today net</div><div class="value money ${t.net>=0?`pos`:`neg`}">${D(t.net,{sign:!0})}</div></div>
    </div>
    <button class="btn-primary" data-nav="expenses-add">Quick add</button>
    <section class="card">
      <div class="section-title"><h3>${o} categories</h3><button data-nav="expenses-dash">View dashboard</button></div>
      ${yt()}
      ${We(n)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Money flow</h3><button data-nav="expenses-dash">View dashboard</button></div>
      ${Ne([`week`,`month`,`year`,`custom`],{wrap:!1})}
      ${He(r)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Recent day-to-day</h3><button data-nav="expenses-dash">See all</button></div>
      ${R(a,!1)}
    </section>
  `}function X(){let e=new Set;for(let t of Y())e.add(String(t.category||`Other`));return[...e].sort((e,t)=>e.localeCompare(t))}function Z(){let e=X();return T.categorySelectionTouched||(T.selectedHomeCategories=new Set(e)),e.filter(e=>T.selectedHomeCategories.has(e))}function gt(){let e=new Set(Z());return Y().filter(t=>t.direction===T.homeMode&&e.has(String(t.category||`Other`)))}function _t(){let e=new Set(Z());return Y().filter(t=>e.has(String(t.category||`Other`)))}function vt(){return ce()?`
    <section class="card profile-prompt">
      <div>
        <h3>Welcome to FinLedge</h3>
        <p class="sub">Set your name for the greeting and profile initials on this phone.</p>
      </div>
      <form class="profile-form" data-profile-form>
        <input name="profileName" type="text" placeholder="Your name" autocomplete="name">
        <button class="btn-primary" type="submit">Save</button>
        <button class="btn-secondary" type="button" data-dismiss-profile>Later</button>
      </form>
    </section>
  `:``}function yt(){let e=X(),t=new Set(Z());return e.length?`
    <details class="category-dropdown">
      <summary><span>Categories shown</span><b>${t.size===e.length?`All with entries`:`${t.size} selected`}</b></summary>
      <label><input type="checkbox" value="__all__" data-category-check ${t.size===e.length?`checked`:``}> All categories with entries</label>
      ${e.map(e=>`<label><input type="checkbox" value="${e}" data-category-check ${t.has(e)?`checked`:``}> ${e}</label>`).join(``)}
    </details>
  `:`<p class="sub">No categories have entries for ${re(v())} yet.</p>`}function bt(){return Ce(`Bank Services`,`Add bank entry`,[[`Date`,`date`],[`Category`,`select`,`Interest Earned`],[`Amount`,`number`],[`Description (optional)`,`text`]],`Add bank entry`,`bank-dash`)}function xt(){let e=Ze(K),t=Object.entries(e.category_totals??{}).filter(([e])=>e.toLowerCase()!==`interest earned`).map(([e,t])=>({label:e,value:Math.abs(Number(t))})).filter(e=>e.value>0).sort((e,t)=>t.value-e.value),n=I().map(e=>{let t=K.filter(t=>e.isDay?t.date===e.key:String(t.date).startsWith(e.key)).reduce((e,t)=>e+Number(t.amount),0),n=t>=0?`var(--brand-teal)`:`var(--accent-amber)`;return{label:e.label,sublabel:e.sublabel,value:t,color:n}}),r=K.map(e=>({...e,amount:Number(e.amount),direction:Number(e.amount)>=0?`income`:`expense`,flow_type:`bank`}));return`
    <p class="eyebrow">Bank Services</p>
    <h1 class="pagehead">Bank services dashboard</h1>
    <p class="sub">Interest, charges, and net balance across your accounts.</p>

    ${F([[`Interest earned`,e.total_income,`pos`],[`Total charges`,e.total_expenses,`neg`],[`Net balance`,e.net_balance,e.net_balance>=0?`pos`:`neg`]],2,!0)}

    ${Pe(`Charges by category`,t,`var(--brand-teal)`)}

    ${L(`Bank services trend`,n,[{label:`Net ≥ 0`,color:`var(--brand-teal)`},{label:`Net < 0`,color:`var(--accent-amber)`}])}

    <section class="card">
      ${N(`All transactions`,`Filter`)}
      ${P(`bank`,`Search by category or description`)}
      ${R(r,!1,`bank`)}
    </section>

    ${A(`home`,`bank-add`)}
  `}function St(){return`
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Add expense entry</h1>
    <p class="sub">Log day-to-day bank-flow or cash-flow income and expenses.</p>

    <div class="transfer-chip" data-nav="transfer" role="button" style="cursor:pointer;">
      <div class="tc-icon">⇄</div>
      <div class="tc-body"><b>Record a transfer instead?</b><span>Cash ⇄ Bank — kept separate from income/expense</span></div>
      <span style="color:var(--text-3);">›</span>
    </div>

    ${j([[`Date`,`date`],[`Flow`,`select`,`Bank Flow`],[`Type`,`select`,`Expense`],[`Category`,`select`,`Food`],[`Amount`,`number`],[`Description (optional)`,`text`]],`Add expense entry`)}
    ${A(`home`,`expenses-dash`)}
  `}function Ct(){let e=J(),t=nt(e),n=T.expensesDashTab,r=n===`bank`?e.filter(e=>e.flow_type===`bank`):n===`cash`?e.filter(e=>e.flow_type===`cash`):e,i=wt(e),a=ut[0];return`
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Expenses dashboard</h1>
    <p class="sub">Combines manual Personal Expenses with live Bank Flow (Bank Services + Share activity).</p>

    <!-- Combined / Bank flow / Cash flow tab -->
    <div class="segmented alt" style="margin-bottom:10px;">
      <button class="${n===`combined`?`active`:``}" data-expenses-tab="combined">Combined</button>
      <button class="${n===`bank`?`active`:``}" data-expenses-tab="bank">Bank flow</button>
      <button class="${n===`cash`?`active`:``}" data-expenses-tab="cash">Cash flow</button>
    </div>

    <!-- Stats card with transfer notice + grid -->
    <section class="card">
      <div class="transfer-chip">
        <div class="tc-icon">⇄</div>
        <div class="tc-body"><b>Cash → Bank transfer</b><span>Shown here, excluded from income/expense totals</span></div>
        <div class="money neu">${D(a?.amount??0)}</div>
      </div>
      ${n===`combined`?`${F([[`Income`,t.combined.overall_income,`pos`],[`Expenses`,t.combined.overall_expenses,`neg`],[`Bank net`,t.bank.net,t.bank.net>=0?`pos`:`neg`],[`Cash net`,t.cash.net,t.cash.net>=0?`pos`:`neg`]])}
          <div class="stat-box stat-box-full" style="margin-top:10px;text-align:center;">
            <div class="label">Overall net / savings</div>
            <div class="value money ${t.combined.overall_net>=0?`pos`:`neg`}" style="font-size:20px;">${D(t.combined.overall_net,{sign:!0})}</div>
          </div>`:F(n===`bank`?[[`Bank income`,t.bank.income,`pos`],[`Bank expense`,t.bank.expenses,`neg`],[`Investment income`,t.bank.investment_income,`pos`],[`Investment expense`,t.bank.investment_expense,`neg`],[`Interest earned`,t.bank.interest_earned,`pos`],[`Service cost`,t.bank.service_cost,`neg`],[`Total income`,t.bank.total_income,`pos`],[`Total expense`,t.bank.total_expenses,`neg`],[`Bank net`,t.bank.net,t.bank.net>=0?`pos`:`neg`]]:[[`Cash income`,t.cash.total_income,`pos`],[`Cash expense`,t.cash.total_expenses,`neg`],[`Cash net`,t.cash.net,t.cash.net>=0?`pos`:`neg`]])}
    </section>

    ${L(`Monthly trend`,i,[{label:`Net ≥ 0`,color:`var(--brand-teal)`},{label:`Net < 0`,color:`var(--accent-amber)`}])}

    <!-- All transactions -->
    <section class="card">
      ${N(`All transactions`,`Filter`)}
      ${P(`expenses`,`Search by category or description`)}
      ${R(r,!1,`expenses`)}
    </section>

    ${A(`home`,`expenses-add`)}
  `}function wt(e){return I().map(t=>{let n=0,r=0;for(let i of e)(t.isDay?i.date===t.key:String(i.date).startsWith(t.key))&&(i.direction===`income`?n+=Number(i.amount??0):r+=Number(i.amount??0));let i=n-r,a=i>=0?`var(--brand-teal)`:`var(--accent-amber)`;return{label:t.label,sublabel:t.sublabel,value:i,color:a}})}function Tt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">About FinLedge Mobile</h1>
    <section class="card settings-panel">
      <p class="sub">FinLedge Mobile is a Capacitor-wrapped Android app backed by on-device SQLite. It keeps day-to-day Bank Flow and Cash Flow tracking on the phone, with module dashboards matching desktop calculations where those modules overlap.</p>
      <p class="sub">The desktop app stores local Excel workbooks; the mobile app stores SQLite rows and will export/import compatible Excel files in its own phase.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function Et(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Backup & sync</h1>
    <section class="card">
      <h3>Local first</h3>
      <p class="sub">Mobile data is stored in on-device SQLite. Drive sync ships only in its own future phase.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function Dt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">How To Use</h1>
    <section class="card">
      <h3>Mobile flow</h3>
      <p class="sub">Use Home for day-to-day Personal Expenses, the drawer for each module pair, and Import / Export for Keep Notes, Excel, and transfer actions.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}var Ot=[`CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    cumulative_amount REAL NOT NULL,
    description TEXT,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    updated_device TEXT NOT NULL
  );`,`CREATE TABLE IF NOT EXISTS share_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    share_name TEXT NOT NULL,
    category TEXT NOT NULL,
    per_unit_price TEXT NOT NULL,
    asba_charge REAL NOT NULL,
    allotted INTEGER NOT NULL,
    buy_sell TEXT NOT NULL,
    total_amount TEXT NOT NULL,
    profit_loss TEXT NOT NULL,
    cumulative_profit REAL NOT NULL,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    updated_device TEXT NOT NULL
  );`,`CREATE TABLE IF NOT EXISTS personal_finance_bank_flow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    flow_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    signed_amount REAL NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    source_ref TEXT,
    updated_device TEXT NOT NULL
  );`,`CREATE TABLE IF NOT EXISTS personal_finance_cash_flow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    flow_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    signed_amount REAL NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    source_ref TEXT,
    updated_device TEXT NOT NULL
  );`,`CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    from_flow TEXT NOT NULL CHECK (from_flow IN ('bank', 'cash')),
    to_flow TEXT NOT NULL CHECK (to_flow IN ('bank', 'cash')),
    amount REAL NOT NULL CHECK (amount > 0),
    description TEXT,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    updated_device TEXT NOT NULL,
    CHECK (from_flow <> to_flow)
  );`];function kt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Import / Export</h1>
    <section class="card settings-menu">
      <button class="settings-row settings-nav-row">
        <span class="settings-row-left"><span class="settings-icon">📋</span><span><b>Import by pasting</b><span>Keep Notes paste flow: paste, review, confirm, commit.</span></span></span>
        <span>Phase 5</span>
      </button>
      <button class="settings-row settings-nav-row">
        <span class="settings-row-left"><span class="settings-icon">📄</span><span><b>Import from Excel</b><span>Bring desktop-compatible workbooks into local SQLite.</span></span></span>
        <span>Planned</span>
      </button>
      <button class="settings-row settings-nav-row">
        <span class="settings-row-left"><span class="settings-icon">↗</span><span><b>Export SQLite to Excel</b><span>Create desktop-compatible Bank, Share, Bank Flow, and Cash Flow workbooks.</span></span></span>
        <span>Phase 6</span>
      </button>
    </section>
    <section class="card"><h3>SQLite schema</h3><p class="sub">${Ot.length} local tables ready for mobile storage.</p></section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function At(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Investment</h1>
    <section class="card">
      <h3>Portfolio rules</h3>
      <p class="sub">Share Portfolio uses the on-device FIFO lot-matching service and SIP calculations. The interest engine remains deferred.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function jt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Privacy</h1>
    <section class="card">
      <h3>Device storage</h3>
      <p class="sub">FinLedge Mobile keeps records in local SQLite on this device. No live bank-flow sync is enabled in mobile-v1.0.0.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function Mt(){let e=E();return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Profile</h1>
    <section class="card settings-panel">
      <div class="section-title"><h3>Name on this phone</h3><span class="settings-pill">${e||`Not set`}</span></div>
      <form class="profile-form" data-profile-form>
        <input name="profileName" type="text" value="${e}" placeholder="Your name" autocomplete="name">
        <button class="btn-primary" type="submit">Save profile</button>
      </form>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function Nt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Version</h1>
    <section class="card settings-panel">
      <div class="settings-version-row"><span>Mobile version</span><b>${ae}</b></div>
      <div class="settings-version-row"><span>Mobile release tags</span><b>mobile-vX.Y.Z</b></div>
      <div class="settings-version-row"><span>Desktop release tags</span><b>desktop-vX.Y.Z</b></div>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}var Pt=[[`settings-profile`,`Profile`,`Edit your name and profile initials.`,`👤`],[`settings-import-export`,`Import / Export`,`Paste import, Excel import, and Excel export.`,`📥`],[`settings-investment`,`Investment`,`Share portfolio rules and SIP notes.`,`📈`],[`settings-backup-sync`,`Backup & sync`,`Local backup status and future sync entry point.`,`☁`],[`settings-privacy`,`Privacy`,`On-device SQLite storage and data controls.`,`🔒`],[`settings-about`,`About`,`Mobile runtime and desktop/mobile differences.`,`ℹ`],[`settings-how-to-use`,`How To Use`,`Mobile navigation and entry guidance.`,`?`],[`settings-version`,`Version`,`Mobile and desktop release tag details.`,`#`]];function Ft(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">General</h1>
    <section class="card settings-menu" style="padding:6px 16px;">
      ${Pt.map(([e,t,n,r])=>It(e,t,n,r)).join(``)}
    </section>

    <section class="card" style="border-color:var(--accent-green);background:var(--accent-green-dim);margin-bottom:30px;">
      <h3 style="color:var(--accent-green);">Import from Keep Notes</h3>
      <p class="sub">Paste unstructured notes and map them to categories before import — with smart defaults you can override per line.</p>
      <button class="btn-primary" data-nav="settings-import-export" style="margin:0;">Start import</button>
    </section>
  `}function It(e,t,n,r){return`
    <button class="settings-row settings-nav-row" data-nav="${e}">
      <span class="settings-row-left"><span class="settings-icon">${r}</span><span><b>${t}</b><span>${n}</span></span></span>
      <span class="chevron">›</span>
    </button>
  `}function Lt(){let e=T.sharesEntryType,t=zt(),n=[`ipo`,`buy`,`sell`].includes(e),r=[`ipo`,`buy`,`sell`].includes(e),i=e===`buy`,a=[`sip`,`dividend`].includes(e),o=e===`dividend`,s=e===`sip`,c=e===`sip`;return`
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Add share entry</h1>
    <p class="sub">Track IPO, secondary, SIP and dividend activity.</p>

    <section class="card">
      <h3>Current holdings</h3>
      ${P(`shares-portfolio`,`Filter by share name`)}
      ${t}
    </section>

    <section class="card">
      <div class="field">
        <label>Entry type</label>
        <select data-shares-entry-type>
          <option value="ipo"      ${e===`ipo`?`selected`:``}>IPO entry</option>
          <option value="sip"      ${e===`sip`?`selected`:``}>SIP investment</option>
          <option value="buy"      ${e===`buy`?`selected`:``}>Secondary buy</option>
          <option value="sell"     ${e===`sell`?`selected`:``}>Sell shares</option>
          <option value="dividend" ${e===`dividend`?`selected`:``}>Dividend</option>
        </select>
      </div>
      ${M(`Date`,`date`)}
      ${M(`Share name`,`text`)}
      ${n?M(`Per unit price`,`number`):``}
      ${r?M(`Quantity / Allotted`,`number`):``}
      ${i?M(`Total Amount`,`number`):``}
      ${a?M(`Amount`,`number`):``}
      ${o?M(`Dividend Type`,`select`,`cash`):``}
      ${s?M(`SIP type`,`select`,`installment`):``}
      ${c?M(`Total SIP shares`,`number`):``}
      <button class="btn-primary">Add share entry</button>
    </section>
    ${A(`home`,`shares-dash`)}
  `}function Rt(){let e=ct(q),t=zt(),n=Bt(),r=q.map(e=>({description:`${String(e.share_name).toUpperCase()} · ${e.category}`,category:String(e.buy_sell??``),amount:Number(e.total_amount),direction:Number(e.profit_loss??0)>=0?`income`:`expense`,flow_type:`shares`,date:e.date}));return`
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Share portfolio dashboard</h1>
    <p class="sub">IPO, secondary, SIP position and remaining holdings.</p>

    <section class="card">
      <h3>Portfolio (remaining)</h3>
      ${P(`shares-portfolio`,`Search by share name`)}
      ${t}
    </section>

    <section class="card">
      <h3>IPO &amp; secondary position</h3>
      ${F([[`IPO invest`,e.total_ipo_investment,`neg`],[`Secondary buy`,e.total_buy_amount,`neg`],[`Total sell`,e.total_sell_amount,`pos`],[`Dividend`,e.total_dividend,`pos`],[`Realized profit`,e.total_profit,e.total_profit>=0?`pos`:`neg`],[`Overall P/L`,e.overall_profit_loss,e.overall_profit_loss>=0?`pos`:`neg`]])}
    </section>

    <section class="card">
      <h3>SIP position</h3>
      ${F([[`Invested`,e.total_sip_investment,`neg`],[`Redeemed`,e.total_sip_redeemed,`pos`],[`SIP profit/loss`,e.sip_profit_loss,e.sip_profit_loss>=0?`pos`:`neg`]],2,!0)}
    </section>

    <section class="card stat-card-purple">
      <h3>Grand total</h3>
      ${F([[`Investment`,e.grand_total_investment,`neg`],[`Profit/Loss`,e.grand_profit_loss,e.grand_profit_loss>=0?`pos`:`neg`]])}
    </section>

    ${L(`Portfolio value trend`,n,[{label:`Share movement`,color:`var(--accent-purple)`}])}

    <section class="card">
      <h3>Update IPO allotment</h3>
      <p class="sub">Search an IPO share and update its allotted quantity after SQLite writes are enabled.</p>
      ${M(`Search share (IPO only)`,`text`)}
      ${M(`New allotment`,`number`)}
      <button class="btn-secondary">Update</button>
    </section>

    <section class="card">
      <h3>Update SIP shares</h3>
      <p class="sub">Search a SIP share and update the total SIP share quantity after SQLite writes are enabled.</p>
      ${M(`Search share (SIP only)`,`text`)}
      ${M(`Total SIP shares`,`number`)}
      <button class="btn-secondary">Update SIP</button>
    </section>

    <section class="card">
      ${N(`Transaction history`,`Filter`)}
      ${P(`shares`,`Search by share name or type`)}
      ${R(r,!1,`shares`)}
    </section>

    ${A(`home`,`shares-add`)}
  `}function zt(){let e=new Map;for(let t of q){let n=String(t.share_name??``).toUpperCase(),r=Number(t.allotted??0);e.set(n,(e.get(n)??0)+(t.buy_sell===`sell`?-r:r))}let t=(T.dashSearchQuery[`shares-portfolio`]??``).toLowerCase(),n=[...e.entries()].filter(([,e])=>e>0).filter(([e])=>!t||e.toLowerCase().includes(t)).sort((e,t)=>e[0].localeCompare(t[0]));return n.length?`<table class="mini">
    <tr><th>Share</th><th style="text-align:right;">Qty remaining</th></tr>
    ${n.map(([e,t])=>`<tr><td>${e}</td><td>${t}</td></tr>`).join(``)}
  </table>`:`<p class="sub">${t?`No shares match your search.`:`No remaining holdings.`}</p>`}function Bt(){return I().map(e=>{let t=q.filter(t=>e.isDay?t.date===e.key:String(t.date).startsWith(e.key)).reduce((e,t)=>e+Math.abs(Number(t.total_amount??0)),0);return{label:e.label,sublabel:e.sublabel,value:t,color:`var(--accent-purple)`}})}function Vt(){let e=Ze(K),t=ct(q),n=nt(J()),r=e.net_balance+t.grand_profit_loss+n.combined.overall_net,i=Ht(e.net_balance,t.grand_profit_loss,n.combined.overall_net);return`
    <p class="eyebrow">Financial Summary</p>
    <h1 class="pagehead">Overall position</h1>
    <p class="sub">Combines Bank Services, Share Portfolio, and manual Personal Expenses — the full picture Home doesn't show.</p>

    ${F([[`Bank net`,e.net_balance,e.net_balance>=0?`pos`:`neg`],[`Share P/L`,t.grand_profit_loss,t.grand_profit_loss>=0?`pos`:`neg`],[`Expenses net`,n.combined.overall_net,n.combined.overall_net>=0?`pos`:`neg`],[`Overall net`,r,r>=0?`pos`:`neg`]])}

    ${L(`Net worth trend`,i,[{label:`Net ≥ 0`,color:`var(--brand-teal)`},{label:`Net < 0`,color:`var(--accent-amber)`}])}

    <section class="card">
      <h3>Where it comes from</h3>
      <table class="mini">
        <tr><th>Source</th><th style="text-align:right;">Net</th></tr>
        ${[[`Bank Services`,e.net_balance],[`Share Portfolio`,t.grand_profit_loss],[`Personal Expenses`,n.combined.overall_net]].map(([e,t])=>{let n=Number(t);return`<tr><td>${e}</td><td style="color:${n>=0?`var(--brand-teal)`:`var(--accent-amber)`};font-variant-numeric:tabular-nums;">${D(n,{sign:!0})}</td></tr>`}).join(``)}
      </table>
    </section>

    ${A(`home`,`home`)}
  `}function Ht(e,t,n){let r=new Date().toISOString().slice(0,10),i=r.slice(0,7);return I().map(a=>{let o=(a.isDay?a.key===r:a.key===i)?e+t+n:0,s=o>=0?`var(--brand-teal)`:`var(--accent-amber)`;return{label:a.label,sublabel:a.sublabel,value:o,color:s}})}function Ut(){return`
    <p class="eyebrow">Transfer</p>
    <h1 class="pagehead">Cash to bank transfer</h1>
    <p class="sub">Moves money between tracked Cash and Bank flow without affecting income or expense totals.</p>
    <section class="card">
      <div class="field"><label>Date</label><input type="date"></div>
      <div class="chip-row"><button class="chip active">Cash to Bank</button><button class="chip">Bank to Cash</button></div>
      <div class="field"><label>Amount</label><input type="number" inputmode="decimal"></div>
      <div class="field"><label>Note</label><input type="text"></div>
      <button class="btn-primary" style="background:var(--accent-amber);">Record transfer</button>
    </section>
    <button class="btn-secondary" data-back="expenses-add">Back to add entry</button>
  `}function Wt(e,t={}){e!==T.activeScreen&&(t.replace?T.screenHistory[T.screenHistory.length-1]=e:T.screenHistory.push(e)),T.activeScreen=e,$(),window.scrollTo({top:0})}function Q(e=`home`){if(T.activeScreen===`home`){let e=Date.now();if(e-T.lastHomeBackPress<1800){fe();return}T.lastHomeBackPress=e,de(`Press back again to exit`);return}T.screenHistory.pop(),Wt(T.screenHistory[T.screenHistory.length-1]||e,{replace:!0})}function $(){let e=document.querySelector(`#app`);e&&(e.innerHTML=`
    <div class="app-shell">
      ${xe()}
      ${Se()}
      ${k(`home`,ht())}
      ${k(`bank-add`,bt())}
      ${k(`bank-dash`,xt())}
      ${k(`shares-add`,Lt())}
      ${k(`shares-dash`,Rt())}
      ${k(`expenses-add`,St())}
      ${k(`expenses-dash`,Ct())}
      ${k(`transfer`,Ut())}
      ${k(`summary`,Vt())}
      ${k(`settings`,Ft())}
      ${k(`settings-profile`,Mt())}
      ${k(`settings-import-export`,kt())}
      ${k(`settings-investment`,At())}
      ${k(`settings-backup-sync`,Et())}
      ${k(`settings-privacy`,jt())}
      ${k(`settings-about`,Tt())}
      ${k(`settings-how-to-use`,Dt())}
      ${k(`settings-version`,Nt())}
    </div>
  `,Gt(),requestAnimationFrame(()=>{document.querySelectorAll(`[data-scroll-end]`).forEach(e=>{e.scrollLeft=e.scrollWidth})}))}function Gt(){document.querySelector(`[data-open-drawer]`)?.addEventListener(`click`,()=>{document.querySelector(`.drawer`)?.classList.add(`open`),document.querySelector(`.drawer-overlay`)?.classList.add(`open`)}),document.querySelector(`[data-close-drawer]`)?.addEventListener(`click`,qt),document.querySelectorAll(`[data-nav]`).forEach(e=>{e.addEventListener(`click`,()=>Wt(e.dataset.nav))}),document.querySelectorAll(`[data-back]`).forEach(e=>{e.addEventListener(`click`,()=>Q(e.dataset.back||`home`))}),document.querySelectorAll(`[data-home-mode]`).forEach(e=>{e.addEventListener(`click`,()=>{T.homeMode=e.dataset.homeMode,T.categorySelectionTouched=!1,$()})}),document.querySelectorAll(`[data-home-range]`).forEach(e=>{e.addEventListener(`click`,()=>{T.homeRange=e.dataset.homeRange,$()})}),document.querySelectorAll(`[data-category-check]`).forEach(e=>{e.addEventListener(`change`,Kt)}),document.querySelector(`[data-custom-start]`)?.addEventListener(`change`,e=>{T.customStart=e.target.value||T.customStart,$()}),document.querySelector(`[data-custom-end]`)?.addEventListener(`change`,e=>{T.customEnd=e.target.value||T.customEnd,$()}),document.querySelectorAll(`[data-profile-form]`).forEach(e=>{e.addEventListener(`submit`,t=>{t.preventDefault(),le(String(new FormData(e).get(`profileName`)||``)),$()})}),document.querySelector(`[data-dismiss-profile]`)?.addEventListener(`click`,()=>{ue(),$()}),document.querySelectorAll(`[data-search-module]`).forEach(e=>{e.addEventListener(`input`,()=>{let t=e.dataset.searchModule??``;t&&(T.dashSearchQuery[t]=e.value.toLowerCase(),$())})}),document.querySelectorAll(`[data-expenses-tab]`).forEach(e=>{e.addEventListener(`click`,()=>{T.expensesDashTab=e.dataset.expensesTab??`combined`,$()})}),document.querySelectorAll(`[data-shares-entry-type]`).forEach(e=>{e.addEventListener(`change`,()=>{T.sharesEntryType=e.value,$()})})}function Kt(e){let t=e.target.value,n=Array.from(document.querySelectorAll(`[data-category-check]`));if(t===`__all__`&&e.target.checked){T.categorySelectionTouched=!1,T.selectedHomeCategories=new Set(X()),$();return}let r=n.filter(e=>e.value!==`__all__`&&e.checked).map(e=>e.value);r.length?(T.categorySelectionTouched=!0,T.selectedHomeCategories=new Set(r)):(T.categorySelectionTouched=!1,T.selectedHomeCategories=new Set(Z())),$()}function qt(){document.querySelector(`.drawer`)?.classList.remove(`open`),document.querySelector(`.drawer-overlay`)?.classList.remove(`open`)}function Jt(){_.addListener(`backButton`,()=>{if(document.querySelector(`.drawer.open`)){qt();return}Q()}).catch(()=>{window.addEventListener(`popstate`,()=>Q())})}$(),Jt();export{o as t};