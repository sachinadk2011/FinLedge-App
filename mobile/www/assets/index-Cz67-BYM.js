(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e;(function(e){e.Unimplemented=`UNIMPLEMENTED`,e.Unavailable=`UNAVAILABLE`})(e||={});var t=class extends Error{constructor(e,t,n){super(e),this.message=e,this.code=t,this.data=n}},n=e=>e?.androidBridge?`android`:e?.webkit?.messageHandlers?.bridge?`ios`:`web`,r=r=>{let i=r.CapacitorCustomPlatform||null,a=r.Capacitor||{},o=a.Plugins=a.Plugins||{},s=()=>i===null?n(r):i.name,c=()=>s()!==`web`,l=e=>!!(f.get(e)?.platforms.has(s())||u(e)),u=e=>a.PluginHeaders?.find(t=>t.name===e),d=e=>r.console.error(e),f=new Map;return a.convertFileSrc||=e=>e,a.getPlatform=s,a.handleError=d,a.isNativePlatform=c,a.isPluginAvailable=l,a.registerPlugin=(n,r={})=>{let c=f.get(n);if(c)return console.warn(`Capacitor plugin "${n}" already registered. Cannot register plugins twice.`),c.proxy;let l=s(),d=u(n),p,ee=async()=>(!p&&l in r?p=p=typeof r[l]==`function`?await r[l]():r[l]:i!==null&&!p&&`web`in r&&(p=p=typeof r.web==`function`?await r.web():r.web),p),te=(r,i)=>{if(d){let e=d?.methods.find(e=>i===e.name);if(e)return e.rtype===`promise`?e=>a.nativePromise(n,i.toString(),e):(e,t)=>a.nativeCallback(n,i.toString(),e,t);if(r)return r[i]?.bind(r)}else if(r)return r[i]?.bind(r);else throw new t(`"${n}" plugin is not implemented on ${l}`,e.Unimplemented)},ne=r=>{let i,a=(...a)=>{let o=ee().then(o=>{let s=te(o,r);if(s){let e=s(...a);return i=e?.remove,e}throw new t(`"${n}.${r}()" is not implemented on ${l}`,e.Unimplemented)});return r===`addListener`&&(o.remove=async()=>i()),o};return a.toString=()=>`${r.toString()}() { [capacitor code] }`,Object.defineProperty(a,"name",{value:r,writable:!1,configurable:!1}),a},re=ne(`addListener`),m=ne(`removeListener`),ie=(e,t)=>{let n=re({eventName:e},t),r=async()=>{let r=await n;m({eventName:e,callbackId:r},t)},i=new Promise(e=>n.then(()=>e({remove:r})));return i.remove=async()=>{console.warn(`Using addListener() without 'await' is deprecated.`),await r()},i},h=new Proxy({},{get(e,t){switch(t){case`$$typeof`:return;case`toJSON`:return()=>({});case`addListener`:return d?ie:re;case`removeListener`:return m;default:return ne(t)}}});return o[n]=h,f.set(n,{name:n,proxy:h,platforms:new Set([...Object.keys(r),...d?[l]:[]])}),h},a.Exception=t,a.DEBUG=!!a.DEBUG,a.isLoggingEnabled=!!a.isLoggingEnabled,a},i=(e=>e.Capacitor=r(e))(typeof globalThis<`u`?globalThis:typeof self<`u`?self:typeof window<`u`?window:typeof global<`u`?global:{}),a=i.registerPlugin,o=class{constructor(){this.listeners={},this.retainedEventArguments={},this.windowListeners={}}addListener(e,t){let n=!1;this.listeners[e]||(this.listeners[e]=[],n=!0),this.listeners[e].push(t);let r=this.windowListeners[e];return r&&!r.registered&&this.addWindowListener(r),n&&this.sendRetainedArgumentsForEvent(e),Promise.resolve({remove:async()=>this.removeListener(e,t)})}async removeAllListeners(){this.listeners={};for(let e in this.windowListeners)this.removeWindowListener(this.windowListeners[e]);this.windowListeners={}}notifyListeners(e,t,n){let r=this.listeners[e];if(!r){if(n){let n=this.retainedEventArguments[e];n||=[],n.push(t),this.retainedEventArguments[e]=n}return}r.forEach(e=>e(t))}hasListeners(e){return!!this.listeners[e]?.length}registerWindowListener(e,t){this.windowListeners[t]={registered:!1,windowEventName:e,pluginEventName:t,handler:e=>{this.notifyListeners(t,e)}}}unimplemented(t=`not implemented`){return new i.Exception(t,e.Unimplemented)}unavailable(t=`not available`){return new i.Exception(t,e.Unavailable)}async removeListener(e,t){let n=this.listeners[e];if(!n)return;let r=n.indexOf(t);this.listeners[e].splice(r,1),this.listeners[e].length||this.removeWindowListener(this.windowListeners[e])}addWindowListener(e){window.addEventListener(e.windowEventName,e.handler),e.registered=!0}removeWindowListener(e){e&&(window.removeEventListener(e.windowEventName,e.handler),e.registered=!1)}sendRetainedArgumentsForEvent(e){let t=this.retainedEventArguments[e];t&&(delete this.retainedEventArguments[e],t.forEach(t=>{this.notifyListeners(e,t)}))}},s=e=>encodeURIComponent(e).replace(/%(2[346B]|5E|60|7C)/g,decodeURIComponent).replace(/[()]/g,escape),c=e=>e.replace(/(%[\dA-F]{2})+/gi,decodeURIComponent),l=class extends o{async getCookies(){let e=document.cookie,t={};return e.split(`;`).forEach(e=>{if(e.length<=0)return;let[n,r]=e.replace(/=/,`CAP_COOKIE`).split(`CAP_COOKIE`);n=c(n).trim(),r=c(r).trim(),t[n]=r}),t}async setCookie(e){try{let t=s(e.key),n=s(e.value),r=e.expires?`; expires=${e.expires.replace(`expires=`,``)}`:``,i=(e.path||`/`).replace(`path=`,``),a=e.url!=null&&e.url.length>0?`domain=${e.url}`:``;document.cookie=`${t}=${n||``}${r}; path=${i}; ${a};`}catch(e){return Promise.reject(e)}}async deleteCookie(e){try{document.cookie=`${e.key}=; Max-Age=0`}catch(e){return Promise.reject(e)}}async clearCookies(){try{let e=document.cookie.split(`;`)||[];for(let t of e)document.cookie=t.replace(/^ +/,``).replace(/=.*/,`=;expires=${new Date().toUTCString()};path=/`)}catch(e){return Promise.reject(e)}}async clearAllCookies(){try{await this.clearCookies()}catch(e){return Promise.reject(e)}}};a(`CapacitorCookies`,{web:()=>new l});var u=async e=>new Promise((t,n)=>{let r=new FileReader;r.onload=()=>{let e=r.result;t(e.indexOf(`,`)>=0?e.split(`,`)[1]:e)},r.onerror=e=>n(e),r.readAsDataURL(e)}),d=(e={})=>{let t=Object.keys(e);return Object.keys(e).map(e=>e.toLocaleLowerCase()).reduce((n,r,i)=>(n[r]=e[t[i]],n),{})},f=(e,t=!0)=>e?Object.entries(e).reduce((e,n)=>{let[r,i]=n,a,o;return Array.isArray(i)?(o=``,i.forEach(e=>{a=t?encodeURIComponent(e):e,o+=`${r}=${a}&`}),o.slice(0,-1)):(a=t?encodeURIComponent(i):i,o=`${r}=${a}`),`${e}&${o}`},``).substr(1):null,p=(e,t={})=>{let n=Object.assign({method:e.method||`GET`,headers:e.headers},t),r=d(e.headers)[`content-type`]||``;if(typeof e.data==`string`)n.body=e.data;else if(r.includes(`application/x-www-form-urlencoded`)){let t=new URLSearchParams;for(let[n,r]of Object.entries(e.data||{}))t.set(n,r);n.body=t.toString()}else if(r.includes(`multipart/form-data`)||e.data instanceof FormData){let t=new FormData;if(e.data instanceof FormData)e.data.forEach((e,n)=>{t.append(n,e)});else for(let n of Object.keys(e.data))t.append(n,e.data[n]);n.body=t;let r=new Headers(n.headers);r.delete(`content-type`),n.headers=r}else(r.includes(`application/json`)||typeof e.data==`object`)&&(n.body=JSON.stringify(e.data));return n},ee=class extends o{async request(e){let t=p(e,e.webFetchExtra),n=f(e.params,e.shouldEncodeUrlParams),r=n?`${e.url}?${n}`:e.url,i=await fetch(r,t),a=i.headers.get(`content-type`)||``,{responseType:o=`text`}=i.ok?e:{};a.includes(`application/json`)&&(o=`json`);let s,c;switch(o){case`arraybuffer`:case`blob`:c=await i.blob(),s=await u(c);break;case`json`:s=await i.json();break;default:s=await i.text()}let l={};return i.headers.forEach((e,t)=>{l[t]=e}),{data:s,headers:l,status:i.status,url:i.url}}async get(e){return this.request(Object.assign(Object.assign({},e),{method:`GET`}))}async post(e){return this.request(Object.assign(Object.assign({},e),{method:`POST`}))}async put(e){return this.request(Object.assign(Object.assign({},e),{method:`PUT`}))}async patch(e){return this.request(Object.assign(Object.assign({},e),{method:`PATCH`}))}async delete(e){return this.request(Object.assign(Object.assign({},e),{method:`DELETE`}))}};a(`CapacitorHttp`,{web:()=>new ee});var te=`modulepreload`,ne=function(e){return`/`+e},re={},m=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=ne(t,n),t=s(t),t in re)return;re[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:te,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},ie=a(`App`,{web:()=>m(()=>import(`./web-CYcOE9C2.js`).then(e=>new e.AppWeb),[])});function h(){return new Date}function g(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}`}function _(e){let[t,n,r]=e.split(`-`).map(Number);return new Date(t,n-1,r)}function v(e,t){let n=new Date(e);return n.setDate(n.getDate()+t),n}function ae(e,t){let n=_(e).getTime(),r=_(t).getTime();return Math.floor((r-n)/864e5)+1}function y(e){return g(e).slice(0,7)}function oe(e){return e.toLocaleString(`en-US`,{month:`long`})}var b=`mobile-local`,se=`mobile-v1.0.0`,ce=`finledge.mobile.profileName`,le=`finledge.mobile.profilePromptDismissed`,x={activeScreen:`home`,screenHistory:[`home`],lastHomeBackPress:0,homeMode:`expense`,homeRange:`week`,bankRange:`month`,selectedHomeCategories:new Set,categorySelectionTouched:!1,customStart:g(new Date(h().getFullYear(),h().getMonth(),1)),customEnd:g(h()),dashSearchQuery:{},expensesDashTab:`combined`,sharesEntryType:`ipo`,sharesDividendType:`cash`,sharesSipType:`installment`,importPasteDraft:``,importEntries:[],importReviewQuery:``};function ue(){let e=new Date().getHours();return e<12?`Good morning`:e<17?`Good afternoon`:`Good evening`}function de(){return window.localStorage.getItem(ce)?.trim()||``}function fe(){return(de()||`F`).slice(0,1).toUpperCase()}function pe(){return!de()&&!window.localStorage.getItem(le)}function me(e){let t=e.trim();t&&(window.localStorage.setItem(ce,t),window.localStorage.setItem(le,`1`))}function he(){window.localStorage.setItem(le,`1`)}function S(e){document.querySelector(`.toast`)?.remove();let t=document.createElement(`div`);t.className=`toast`,t.textContent=e,document.body.appendChild(t),window.setTimeout(()=>t.remove(),1600)}function ge(){ie.exitApp()}function C(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}function w(e){return C(e).replace(/`/g,`&#96;`)}function T(e,t){return`<main class="screen ${x.activeScreen===e?`active`:``}" data-screen="${e}">${t}</main>`}function _e(){let e=de();return`
    <header class="topbar">
      <button class="icon-btn" data-open-drawer aria-label="Open navigation"><span class="hamburger-lines"></span></button>
      <div class="brand brand-centered brand-logo" data-nav="home" style="cursor:pointer;" title="Go to Home">
        <img class="brand-logo-img" src="./icon.png" alt="FinLedge logo">
        <div class="brand-text"><b>FinLedge</b><span>${ue()}${e?`, ${C(e)}`:``}</span></div>
      </div>
      <button class="avatar" data-nav="settings" aria-label="Open profile">${fe()}</button>
    </header>
  `}function ve(){return`
    <div class="drawer-overlay" data-close-drawer></div>
    <nav class="drawer" aria-label="Mobile navigation">
      <div class="drawer-head"><img class="mark mark-img" src="./icon.png" alt="FinLedge logo"><div class="brand-text"><b>FinLedge</b><span>${se} / ${b}</span></div></div>
      ${[[`home`,`Home`,`🏠`,[`home`]],[`bank-add`,`Bank Services`,`🏦`,[`bank-add`,`bank-dash`]],[`shares-add`,`Share Portfolio`,`📈`,[`shares-add`,`shares-dash`]],[`expenses-add`,`Personal Expenses`,`💳`,[`expenses-add`,`expenses-dash`,`transfer`]],[`summary`,`Financial Summary`,`📊`,[`summary`]],[`settings`,`Settings`,`⚙`,[`settings`,`settings-profile`,`settings-import-export`,`settings-investment`,`settings-backup-sync`,`settings-privacy`,`settings-about`,`settings-how-to-use`,`settings-version`,`import-paste`,`import-review`]]].map(([e,t,n,r])=>`<button class="drawer-item ${r.includes(x.activeScreen)?`active`:``}" data-nav="${e}"><span>${n}</span>${t}</button>`).join(``)}
    </nav>
  `}function E(e,t){let n=[`<button class="btn-secondary" type="button" data-back="${e}">Back</button>`,`<button class="btn-secondary" type="button" data-nav="home">Home</button>`];if(t){let e=t.endsWith(`dash`)?`View dashboard`:`Add entry`;n.push(`<button class="btn-secondary" type="button" data-nav="${t}">${e}</button>`)}return`<div class="btn-row ${t?`btn-row-3`:`btn-row-2`}">${n.join(``)}</div>`}function ye(e,t){let n=t.trim();if(!n)return C(e);let r=e.toLowerCase().indexOf(n.toLowerCase());return r<0?C(e):C(e.slice(0,r))+`<mark class="suggest-mark">${C(e.slice(r,r+n.length))}</mark>`+C(e.slice(r+n.length))}function be(){document.querySelectorAll(`[data-suggest-root]`).forEach(e=>{let t=e.querySelector(`[data-suggest-input]`),n=e.querySelector(`[data-suggest-list]`);if(!t||!n)return;let r=t,i=n,a=(r.dataset.suggestSource??``).split(`
`).filter(Boolean).sort((e,t)=>e.toLowerCase().localeCompare(t.toLowerCase())),o=-1,s=()=>Array.from(i.querySelectorAll(`.share-suggest-item`));function c(){let e=r.value.trim(),t=e.toLowerCase(),n=a.filter(e=>!t||e.toLowerCase().includes(t));i.innerHTML=n.map(t=>`<button type="button" class="share-suggest-item" data-suggest-value="${w(t)}">${ye(t,e)}</button>`).join(``),i.hidden=n.length===0,o=-1}function l(e){r.value=e,i.hidden=!0,r.focus()}function u(e){let t=s();t.forEach((t,n)=>t.classList.toggle(`active`,n===e)),t[e]&&t[e].scrollIntoView({block:`nearest`})}t.addEventListener(`input`,c),t.addEventListener(`focus`,()=>{i.hidden||c()}),i.addEventListener(`mousedown`,e=>{e.target instanceof Element&&e.target.closest(`.share-suggest-item`)&&e.preventDefault()}),i.addEventListener(`click`,e=>{let t=e.target.closest(`[data-suggest-value]`);t?.dataset.suggestValue&&(r.value=t.dataset.suggestValue,i.hidden=!0,r.focus())}),t.addEventListener(`blur`,()=>{window.setTimeout(()=>{i.hidden=!0},140)}),t.addEventListener(`keydown`,e=>{if(e.key===`Escape`){i.hidden=!0,o=-1;return}let t=s();if(e.key===`ArrowDown`||e.key===`ArrowUp`){if(i.hidden||t.length===0)return;e.preventDefault(),o=e.key===`ArrowDown`?Math.min(o+1,t.length-1):Math.max(o-1,0),u(o);return}if(e.key===`Enter`&&!i.hidden&&o>=0){let n=t[o]?.dataset.suggestValue;n&&(e.preventDefault(),l(n))}})})}function xe(e){let t=window.visualViewport,n=t&&t.height>0?t.height:window.innerHeight,r=document.scrollingElement||document.documentElement,i=e.getBoundingClientRect();if(i.bottom>n*.7||i.top<0){let e=t&&t.offsetTop||0,a=Math.max(12,Math.round(n*.18))+e;r.scrollTop+=i.top-a}}function Se(){document.addEventListener(`focusin`,e=>{let t=e.target;t&&(t.tagName===`INPUT`||t.tagName===`SELECT`||t.tagName===`TEXTAREA`)&&window.setTimeout(()=>xe(t),120)}),window.visualViewport?.addEventListener(`resize`,()=>{let e=document.activeElement;if(!e)return;let t=e.tagName;(t===`INPUT`||t===`SELECT`||t===`TEXTAREA`)&&xe(e)})}function Ce(e,t=`Search`){let n=x.dashSearchQuery[e]??``;return`<input class="search-input" type="search" placeholder="${w(t)}" value="${w(n)}" data-search-module="${e}" autocomplete="off">`}function we(e){return(x.dashSearchQuery[e]??``).toLowerCase()}function Te(e,t,n){let r=we(t);if(!r)return e;let i=n&&n.length?n:Object.keys(e[0]??{});return e.filter(e=>i.some(t=>String(e[t]??``).toLowerCase().includes(r)))}var Ee;function De(e){document.querySelectorAll(`[data-search-module]`).forEach(t=>{t.addEventListener(`input`,()=>{let n=t.dataset.searchModule??``;n&&(x.dashSearchQuery[n]=t.value,Oe(ke(n,e)))})})}function Oe(e){Ee!==void 0&&window.clearTimeout(Ee),Ee=window.setTimeout(()=>{Ee=void 0,e()},250)}function ke(e,t){return()=>{t();let n=document.querySelector(`[data-search-module="${e}"]`);if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length)}catch{}xe(n)}}}function D(e,t={}){let n=Math.abs(e).toLocaleString(`en-US`,{maximumFractionDigits:2});return t.sign?`${e>=0?`+`:`-`}Rs ${n}`:`Rs ${n}`}function O(e){let t=e<0?`-`:``,n=Math.abs(e);return n>=1e5?`${t}${(n/1e5).toFixed(n%1e5==0?0:1)}L`:n>=1e3?`${t}${(n/1e3).toFixed(n%1e3==0?0:1)}k`:`${t}${n.toLocaleString(`en-US`,{maximumFractionDigits:0})}`}var Ae=`var(--accent-green)`,je=`var(--accent-red)`,Me=`var(--brand-teal)`,Ne=`var(--accent-amber)`,Pe=72,Fe=88;function Ie(e){let t=He(e);return typeof t==`string`?`<p class="sub range-warning">${t}</p>`:`${Le(t)}${Re()}`}function Le(e){if(!e.length)return`<p class='sub'>No data for this period.</p>`;let t=Math.max(...e.flatMap(e=>[e.income,e.expense,Math.abs(e.net)]),1);return`
    <div class="chart-scroll chart-animate" data-scroll-end style="-webkit-overflow-scrolling:touch;">
      <div class="chart-track grouped-chart-track" style="width:${e.length*76+16}px;">
        ${e.map(e=>ze(e,t)).join(``)}
      </div>
    </div>
  `}function Re(){return`<div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${Ae};margin-right:4px;vertical-align:middle;"></i>Income</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${je};margin-right:4px;vertical-align:middle;"></i>Expense</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${Me};margin-right:4px;vertical-align:middle;"></i>Net ≥0</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${Ne};margin-right:4px;vertical-align:middle;"></i>Net &lt;0</span>
    </div>`}function ze(e,t){let n=e.net>=0?Me:Ne;return`<div class="grouped-bar-col" style="width:${Pe}px;">
    <div class="grouped-bar-sticks">${[{value:e.income,color:Ae,show:e.income>0,label:O(e.income)},{value:e.expense,color:je,show:e.expense>0,label:O(e.expense)},{value:Math.abs(e.net),color:n,show:e.net!==0,label:O(e.net)}].map(e=>Be(e,t)).join(``)}</div>
    <span class="grouped-bar-x">${e.label}</span>
    <span class="grouped-bar-sub">${e.sublabel??``}</span>
  </div>`}function Be(e,t){if(!e.show||Math.abs(e.value)<.01)return`<div class="grouped-bar-stick grouped-bar-stick-empty"></div>`;let n=Math.max(4,Math.abs(e.value)/t*Fe);return`<div class="grouped-bar-stick">
    <span class="grouped-bar-val" style="color:${e.color};" title="${e.label}">${e.label}</span>
    <div class="grouped-bar-body" style="height:${n}px;background:${e.color};"></div>
  </div>`}function Ve(e){let t=new Map;for(let n of e){let e=String(n.category??`Other`);t.set(e,(t.get(e)??0)+Number(n.amount??0))}let n=[...t.entries()].sort((e,t)=>t[1]-e[1]).slice(0,5);if(!n.length)return`<p class="sub">Nothing to show for the selected ${x.homeMode} categories yet.</p>`;let r=Math.max(...n.map(([,e])=>e),1),i=x.homeMode===`income`?`pos`:`neg`,a=x.homeMode===`income`?Ae:je;return n.map(([e,t])=>`<div class="history-row"><b>${C(e)}</b><span class="money ${i}">${O(t)}</span></div>
     <div class="category-meter"><i style="width:${Math.max(8,t/r*100)}%;background:${a};"></i></div>`).join(``)}function He(e){let t=h();if(x.homeRange===`week`)return Ue(e,v(t,-89),t);if(x.homeRange===`month`)return Ue(e,v(t,-399),t);if(x.homeRange===`year`)return We(e,48);let n=ae(x.customStart,x.customEnd);return n<1?`Choose an end date after the start date.`:n>365?`Custom range supports up to 365 days.`:Ue(e,_(x.customStart),_(x.customEnd))}function Ue(e,t,n){let r=new Map;for(let e=new Date(t);e<=n;e=v(e,1)){let t=g(e),n=e.toLocaleString(`en-US`,{month:`short`});r.set(t,{label:String(e.getDate()),sublabel:n,key:t,income:0,expense:0,net:0})}for(let t of e){let e=r.get(String(t.date));e&&Ge(e,t)}return[...r.values()]}function We(e,t){let n=h();return Array.from({length:t},(r,i)=>{let a=new Date(n.getFullYear(),n.getMonth()-(t-1-i),1),o=y(a),s=String(a.getFullYear()).slice(2),c={label:a.toLocaleString(`en-US`,{month:`short`}),sublabel:`'${s}`,key:o,income:0,expense:0,net:0};for(let t of e)String(t.date).startsWith(o)&&Ge(c,t);return c})}function Ge(e,t){let n=Number(t.amount||0);t.direction===`income`?(e.income+=n,e.net+=n):(e.expense+=n,e.net-=n)}var Ke=44,qe=88;function Je(e){if(!e.length)return`<p class='sub'>No data for this period.</p>`;let t=e.filter(e=>Math.abs(e.value)>0),n=t.length?Math.max(...t.map(e=>Math.abs(e.value))):1,r=e.map(e=>{let t=Math.abs(e.value)>=.01,r=t?Math.max(4,Math.abs(e.value)/n*qe):0,i=e.signColor?e.value>=0?`var(--accent-green)`:`var(--accent-red)`:e.color,a=t?`<div class="single-bar-stick">
          <span class="single-bar-val" style="color:${i};">${O(e.value)}</span>
          <div class="single-bar-body" style="height:${r}px;background:${i};"></div>
        </div>`:``,o=e.sublabel?`<span class="single-bar-sub">${e.sublabel}</span>`:`<span class="single-bar-sub"></span>`;return`<div class="single-bar-col" style="width:${Ke}px;">
      <div class="single-bar-plot">${a}</div>
      <span class="single-bar-x">${e.label}</span>
      ${o}
    </div>`}).join(``);return`<div class="chart-scroll chart-animate" data-scroll-end style="-webkit-overflow-scrolling:touch;">
    <div class="chart-track" style="width:${e.length*50+16}px;">
      ${r}
    </div>
  </div>`}function Ye(e){return e.map(e=>`<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${e.color};margin-right:5px;vertical-align:middle;"></i>${C(e.label)}</span>`).join(``)}function Xe({ranges:e=[`week`,`month`,`year`,`custom`],activeRange:t=x.homeRange,rangeAttr:n=`data-home-range`}={}){return`<div class="segmented graph-tabs period-tabs" style="margin-bottom:8px;">${e.map(e=>`<button class="${t===e?`active`:``}" ${n}="${e}">${e[0].toUpperCase()}${e.slice(1)}</button>`).join(``)}</div>${t===`custom`?`<div class="custom-range"><label>From<input type="date" value="${x.customStart}" data-custom-start></label><label>To<input type="date" value="${x.customEnd}" data-custom-end></label></div>`:``}`}function Ze(e,t,n,r={}){return`<section class="card">
    <div class="section-title"><h3>${e}</h3></div>
    ${Xe(r)}
    ${Je(t)}
    ${Ye(n)?`<div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">${Ye(n)}</div>`:``}
  </section>`}function Qe(e,t,n={}){return`<section class="card">
    <div class="section-title"><h3>${e}</h3></div>
    ${Xe(n)}
    ${Le(t)}
    ${Re()}
  </section>`}function $e(e,t={wrap:!0}){let n=`<div class="segmented graph-tabs period-tabs">${e.map(e=>`<button class="${x.homeRange===e?`active`:``}" data-home-range="${e}">${e[0].toUpperCase()}${e.slice(1)}</button>`).join(``)}</div>
    ${x.homeRange===`custom`?`<div class="custom-range"><label>From<input type="date" value="${x.customStart}" data-custom-start></label><label>To<input type="date" value="${x.customEnd}" data-custom-end></label></div>`:``}`;return t.wrap===!1?`<div class="period-controls compact-card">${n}</div>`:`<section class="card compact-card">${n}</section>`}function et(e,t,n=`var(--brand-teal)`){if(!t.length)return``;let r=Math.max(...t.map(e=>Math.abs(e.value)),1);return`<section class="card"><h3>${e}</h3>${t.map(e=>{let t=Math.max(4,Math.abs(e.value)/r*100);return`<div class="history-row" style="display:block;padding:8px 0;">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-1);margin-bottom:6px;">
        <span>${C(e.label)}</span><b class="money" style="font-variant-numeric:tabular-nums;">${O(e.value)}</b>
      </div>
      <div class="category-meter"><i style="width:${t}%;background:${n};"></i></div>
    </div>`}).join(``)}</section>`}var tt=[`description`,`category`,`flow_type`,`date`];function nt(e,t=!0,n=``){let r=n?Te(e,n,tt):e,i=n?we(n):``,a=`<p class="sub" style="margin:0 0 8px;font-size:11px;">Showing ${r.length} entr${r.length===1?`y`:`ies`}${i?` matching "${C(i)}"`:``}</p>`,o=`<div style="max-height:300px;overflow-y:auto;-webkit-overflow-scrolling:touch;">${r.length?r.map(e=>{let t=Number(e.amount??0)>=0?`income`:`expense`,n=String(e.direction??t),r=Number(e.amount??0),i=C(String(e.description??e.category??`Entry`)),a=[e.category,e.date].filter(Boolean).map(e=>C(String(e))).join(` · `),o=e._table?String(e._table):``,s=e._id,c=o&&s!=null&&s!==``?`<button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" data-delete data-table="${w(o)}" data-id="${w(String(s))}" title="Delete">🗑</button>`:`<button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" disabled title="Delete (coming soon)">🗑</button>`;return`<div class="history-row">
          <div class="meta"><b>${i}</b><span>${a}</span></div>
          <div class="money ${n===`income`?`pos`:`neg`}">${D(r,{sign:!0})}</div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" disabled title="Edit (coming soon)">✎</button>
            ${c}
          </div>
        </div>`}).join(``):`<p class="sub">${i?`No entries match your search.`:`No entries yet.`}</p>`}</div>`;return t?`<section class="card">${a}${o}</section>`:`${a}${o}`}var rt=[`Interest Earned`,`Interest Tax`,`Mobile Banking Charge`,`Debit Card Charge`,`Cheque Book`,`Locker`,`Demat Renewal`,`Demat & MeroShare Renewal`,`Broker Renewal`,`MeroShare Renewal`,`Other Charges`],it=new Set([`interest earned`,`income`]);function k(e){if(e==null||e===``)return 0;let t=Number(e);return Number.isFinite(t)?t:0}function at(e){return it.has(e.trim().toLowerCase())}function ot(e){let t=0,n=0,r=Object.fromEntries(rt.map(e=>[e,0]));for(let i of e){let e=String(i.category??``).trim(),a=k(i.amount);if(at(e))t+=a,e in r?r[e]+=a:e&&(r[e]=(r[e]??0)+a);else{let t=Math.abs(a);n+=t,e&&(r[e]=(r[e]??0)+t)}}return{total_income:t,total_expenses:n,net_balance:t-n,category_totals:r}}function st(e,t){let n=k(t);return e===`income`?n:-n}function ct(e){let t=String(e.category??``).trim().toLowerCase(),n=String(e.buy_sell??``).trim().toLowerCase();return t===`ipo`||t===`buy`?[`expense`,`Investment Expense`]:t===`sip`&&(n===`redeem`||n===`redeemed`)?[`income`,`Investment Income`]:t===`sip`?[`expense`,`Investment Expense`]:t===`sell`||t===`dividend`&&n===`cash`?[`income`,`Investment Income`]:null}function lt(e){let t=new Map([[`ipo:ipo`,`IPO`],[`buy:buy`,`Secondary buy`],[`sell:sell`,`Share sell`],[`sip:installment`,`SIP installment`],[`sip:redeem`,`SIP redeem`],[`sip:redeemed`,`SIP redeem`],[`dividend:cash`,`Cash dividend`]]),n=[];for(let r of e){let e=ct(r),i=Math.abs(k(r.total_amount));if(!e||i<=0)continue;let[a,o]=e,s=String(r.category??``).trim().toLowerCase(),c=String(r.buy_sell??``).trim().toLowerCase(),l=Number(r.id??0),u=String(r.share_name??``).trim().toUpperCase(),d=t.get(`${s}:${c}`)??pt(s);n.push({id:`share-${l}`,display_id:`S-${l}`,date:String(r.date??``),flow_type:`bank`,direction:a,category:o,amount:i,signed_amount:st(a,i),description:`${d}: ${u}`,source:`share-sync`,timestamp:String(r.timestamp??``),source_ref:String(r.sync_ref??`share:${l}`)})}return n}function ut(e){let t=[];for(let n of e){let e=String(n.category??``).trim(),r=Math.abs(k(n.amount));if(r<=0)continue;let i=at(e)?`income`:`expense`,a=i===`income`?`Interest Earned`:`Service Cost`,o=Number(n.id??0),s=String(n.description??``).trim(),c=e||a;t.push({id:`bank-services-${o}`,display_id:`BS-${o}`,date:String(n.date??``),flow_type:`bank`,direction:i,category:a,amount:r,signed_amount:st(i,r),description:`${c}${s?`: ${s}`:``}`,source:`bank-services-sync`,timestamp:String(n.timestamp??``),source_ref:`bank-services:${o}`})}return t}function dt(e){let t={bank:ft(),cash:ft()};for(let n of e){let e=String(n.flow_type??``).trim().toLowerCase();if(e!==`bank`&&e!==`cash`)continue;let r=String(n.direction??``).trim().toLowerCase(),i=String(n.category??``).trim()||`Uncategorized`,a=Math.abs(k(n.amount)),o=String(n.source??`manual`).trim().toLowerCase(),s=i.toLowerCase(),c=t[e];r===`income`?(c.total_income+=a,c.income_breakdown[i]=(c.income_breakdown[i]??0)+a,e===`bank`&&o===`bank-services-sync`?c.interest_earned+=a:e===`bank`&&s===`investment income`?c.investment_income+=a:c.income+=a):(c.total_expenses+=a,c.expense_breakdown[i]=(c.expense_breakdown[i]??0)+a,e===`bank`&&o===`bank-services-sync`?c.service_cost+=a:e===`bank`&&[`investment expense`,`investment`,`sip`,`share market`].includes(s)?c.investment_expense+=a:c.expenses+=a)}for(let e of Object.values(t))e.net=e.total_income-e.total_expenses;let n={overall_income:t.bank.total_income+t.cash.total_income,overall_expenses:t.bank.total_expenses+t.cash.total_expenses,overall_net:0,bank:t.bank,cash:t.cash};return n.overall_net=n.overall_income-n.overall_expenses,{bank:t.bank,cash:t.cash,combined:n}}function ft(){return{income:0,expenses:0,investment_expense:0,investment_income:0,interest_earned:0,service_cost:0,total_income:0,total_expenses:0,net:0,income_breakdown:{},expense_breakdown:{}}}function pt(e){return e&&`${e.charAt(0).toUpperCase()}${e.slice(1)}`}function mt(e){let t=Number(e??0);return Number.isFinite(t)?Math.trunc(t):0}function ht(e,t){let n=t,r=0;for(let t of e){if(n<=0)break;let e=t.qty,i=Math.min(e,n);if(r+=i*t.price,e>0&&t.asba!==0){let n=t.asba*(i/e);r+=n,t.asba-=n}t.qty=e-i,n-=i}if(n>0)throw Error(`Not enough available quantity to sell for this share.`);return r}function gt(e){let t=0,n=new Map,r=new Map;return e.map(e=>{let i=String(e.share_name??``).trim(),a=i.toLowerCase(),o=String(e.category??``).trim().toLowerCase(),s=k(e.per_unit_price),c=mt(e.allotted),l=String(e.buy_sell??``).trim().toLowerCase(),u=o===`ipo`?5:0,d=0,f=0;if(o===`dividend`)l===`cash`&&(d=s,f=d);else if(o===`sip`){let t=l===`sip`?`installment`:l,n=k(e.total_amount);if(d=n>0?n:c>0?s*c:s,t===`redeem`){let e=r.get(a)??0;f=d-e,r.set(a,0),s=d,l=`redeem`}else r.set(a,(r.get(a)??0)+d),l=`installment`,s=c>0?d/c:d}else d=s*c+u;if(o===`ipo`||o===`buy`||o===`dividend`&&l===`bonus`){if(a){let e=n.get(a)??[];e.push({qty:c,price:o===`dividend`?0:s,asba:o===`ipo`?u:0}),n.set(a,e)}}else if(o===`sell`&&c>0){let e=ht(n.get(a)??[],c);f=d-e}return t+=f,{id:e.id,date:String(e.date??``),share_name:i,category:o,per_unit_price:s,asba_charge:u,allotted:c,buy_sell:l,total_amount:d,profit_loss:f,cumulative_profit:t,timestamp:e.timestamp,sync_ref:e.sync_ref}})}function _t(e){let t=0,n=0,r=0,i=0,a=0,o=0,s=0,c=0;for(let l of e){let e=String(l.category??``).trim().toLowerCase(),u=String(l.buy_sell??``).trim().toLowerCase(),d=k(l.total_amount),f=k(l.profit_loss);e===`ipo`?t+=d:e===`sip`&&(u===`redeem`||u===`redeemed`)?(r+=d,i+=f):e===`sip`?n+=d:e===`buy`?a+=d:e===`sell`?(o+=d,s+=f):e===`dividend`&&u===`cash`&&(c+=d)}let l=t+a,u=s+c-l,d=l+n;return{total_ipo_investment:t,total_sip_investment:n,total_sip_redeemed:r,sip_profit_loss:i,total_buy_amount:a,overall_investment:l,total_sell_amount:o,total_dividend:c,total_profit:s,overall_profit_loss:u,grand_total_investment:d,grand_profit_loss:u+i}}function vt(){return String({BASE_URL:`/`,DEV:!1,MODE:`production`,PROD:!0,SSR:!1,VITE_API_BASE_URL:`http://127.0.0.1:8000`,VITE_FINLEDGE_MODE:`development`}.VITE_FINLEDGE_MODE??``).trim().toLowerCase()===`production`?`production`:`development`}var A=vt(),yt=A===`production`?`finledge_mobile`:`finledge_mobile_dev`,j=A===`production`?`FinLedge`:`FinLedgeDev`,bt=`database`,xt=`backup`,St=yt,Ct=[`bank_transactions`,`share_transactions`,`personal_finance_bank_flow`,`personal_finance_cash_flow`,`transfers`],wt=[`CREATE TABLE IF NOT EXISTS bank_transactions (
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
  );`],Tt=class{constructor(e){this.sqlite=e,this._connectionDict=new Map}async initWebStore(){try{return await this.sqlite.initWebStore(),Promise.resolve()}catch(e){return Promise.reject(e)}}async saveToStore(e){try{return await this.sqlite.saveToStore({database:e}),Promise.resolve()}catch(e){return Promise.reject(e)}}async saveToLocalDisk(e){try{return await this.sqlite.saveToLocalDisk({database:e}),Promise.resolve()}catch(e){return Promise.reject(e)}}async getFromLocalDiskToStore(e){let t=e??!0;try{return await this.sqlite.getFromLocalDiskToStore({overwrite:t}),Promise.resolve()}catch(e){return Promise.reject(e)}}async echo(e){try{let t=await this.sqlite.echo({value:e});return Promise.resolve(t)}catch(e){return Promise.reject(e)}}async isSecretStored(){try{let e=await this.sqlite.isSecretStored();return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async setEncryptionSecret(e){try{return await this.sqlite.setEncryptionSecret({passphrase:e}),Promise.resolve()}catch(e){return Promise.reject(e)}}async changeEncryptionSecret(e,t){try{return await this.sqlite.changeEncryptionSecret({passphrase:e,oldpassphrase:t}),Promise.resolve()}catch(e){return Promise.reject(e)}}async clearEncryptionSecret(){try{return await this.sqlite.clearEncryptionSecret(),Promise.resolve()}catch(e){return Promise.reject(e)}}async checkEncryptionSecret(e){try{let t=await this.sqlite.checkEncryptionSecret({passphrase:e});return Promise.resolve(t)}catch(e){return Promise.reject(e)}}async addUpgradeStatement(e,t){try{return e.endsWith(`.db`)&&(e=e.slice(0,-3)),await this.sqlite.addUpgradeStatement({database:e,upgrade:t}),Promise.resolve()}catch(e){return Promise.reject(e)}}async createConnection(e,t,n,r,i){try{e.endsWith(`.db`)&&(e=e.slice(0,-3)),await this.sqlite.createConnection({database:e,encrypted:t,mode:n,version:r,readonly:i});let a=new Et(e,i,this.sqlite),o=i?`RO_${e}`:`RW_${e}`;return this._connectionDict.set(o,a),Promise.resolve(a)}catch(e){return Promise.reject(e)}}async closeConnection(e,t){try{e.endsWith(`.db`)&&(e=e.slice(0,-3)),await this.sqlite.closeConnection({database:e,readonly:t});let n=t?`RO_${e}`:`RW_${e}`;return this._connectionDict.delete(n),Promise.resolve()}catch(e){return Promise.reject(e)}}async isConnection(e,t){let n={};e.endsWith(`.db`)&&(e=e.slice(0,-3));let r=t?`RO_${e}`:`RW_${e}`;return n.result=this._connectionDict.has(r),Promise.resolve(n)}async retrieveConnection(e,t){e.endsWith(`.db`)&&(e=e.slice(0,-3));let n=t?`RO_${e}`:`RW_${e}`;if(this._connectionDict.has(n)){let t=this._connectionDict.get(n);return t===void 0?Promise.reject(`Connection ${e} is undefined`):Promise.resolve(t)}return Promise.reject(`Connection ${e} does not exist`)}async getNCDatabasePath(e,t){try{let n=await this.sqlite.getNCDatabasePath({path:e,database:t});return Promise.resolve(n)}catch(e){return Promise.reject(e)}}async createNCConnection(e,t){try{await this.sqlite.createNCConnection({databasePath:e,version:t});let n=new Et(e,!0,this.sqlite),r=`RO_${e})`;return this._connectionDict.set(r,n),Promise.resolve(n)}catch(e){return Promise.reject(e)}}async closeNCConnection(e){try{await this.sqlite.closeNCConnection({databasePath:e});let t=`RO_${e})`;return this._connectionDict.delete(t),Promise.resolve()}catch(e){return Promise.reject(e)}}async isNCConnection(e){let t={},n=`RO_${e})`;return t.result=this._connectionDict.has(n),Promise.resolve(t)}async retrieveNCConnection(e){if(this._connectionDict.has(e)){let t=`RO_${e})`,n=this._connectionDict.get(t);return n===void 0?Promise.reject(`Connection ${e} is undefined`):Promise.resolve(n)}return Promise.reject(`Connection ${e} does not exist`)}async isNCDatabase(e){try{let t=await this.sqlite.isNCDatabase({databasePath:e});return Promise.resolve(t)}catch(e){return Promise.reject(e)}}async retrieveAllConnections(){return this._connectionDict}async closeAllConnections(){let e=new Map;try{for(let t of this._connectionDict.keys()){let n=t.substring(3),r=t.substring(0,3)===`RO_`;await this.sqlite.closeConnection({database:n,readonly:r}),e.set(t,null)}for(let t of e.keys())this._connectionDict.delete(t);return Promise.resolve()}catch(e){return Promise.reject(e)}}async checkConnectionsConsistency(){try{let e=[...this._connectionDict.keys()],t=[],n=[];for(let r of e)t.push(r.substring(0,2)),n.push(r.substring(3));let r=await this.sqlite.checkConnectionsConsistency({dbNames:n,openModes:t});return r.result||(this._connectionDict=new Map),Promise.resolve(r)}catch(e){return this._connectionDict=new Map,Promise.reject(e)}}async importFromJson(e){try{let t=await this.sqlite.importFromJson({jsonstring:e});return Promise.resolve(t)}catch(e){return Promise.reject(e)}}async isJsonValid(e){try{let t=await this.sqlite.isJsonValid({jsonstring:e});return Promise.resolve(t)}catch(e){return Promise.reject(e)}}async copyFromAssets(e){let t=e??!0;try{return await this.sqlite.copyFromAssets({overwrite:t}),Promise.resolve()}catch(e){return Promise.reject(e)}}async getFromHTTPRequest(e,t){let n=t??!0;try{return await this.sqlite.getFromHTTPRequest({url:e,overwrite:n}),Promise.resolve()}catch(e){return Promise.reject(e)}}async isDatabaseEncrypted(e){e.endsWith(`.db`)&&(e=e.slice(0,-3));try{let t=await this.sqlite.isDatabaseEncrypted({database:e});return Promise.resolve(t)}catch(e){return Promise.reject(e)}}async isInConfigEncryption(){try{let e=await this.sqlite.isInConfigEncryption();return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async isInConfigBiometricAuth(){try{let e=await this.sqlite.isInConfigBiometricAuth();return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async isDatabase(e){e.endsWith(`.db`)&&(e=e.slice(0,-3));try{let t=await this.sqlite.isDatabase({database:e});return Promise.resolve(t)}catch(e){return Promise.reject(e)}}async getDatabaseList(){try{let e=(await this.sqlite.getDatabaseList()).values;e.sort();let t={values:e};return Promise.resolve(t)}catch(e){return Promise.reject(e)}}async getMigratableDbList(e){let t=e||`default`;try{let e=await this.sqlite.getMigratableDbList({folderPath:t});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async addSQLiteSuffix(e,t){let n=e||`default`,r=t||[];try{let e=await this.sqlite.addSQLiteSuffix({folderPath:n,dbNameList:r});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async deleteOldDatabases(e,t){let n=e||`default`,r=t||[];try{let e=await this.sqlite.deleteOldDatabases({folderPath:n,dbNameList:r});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async moveDatabasesAndAddSuffix(e,t){let n=e||`default`,r=t||[];return this.sqlite.moveDatabasesAndAddSuffix({folderPath:n,dbNameList:r})}},Et=class{constructor(e,t,n){this.dbName=e,this.readonly=t,this.sqlite=n}getConnectionDBName(){return this.dbName}getConnectionReadOnly(){return this.readonly}async open(){try{return await this.sqlite.open({database:this.dbName,readonly:this.readonly}),Promise.resolve()}catch(e){return Promise.reject(e)}}async close(){try{return await this.sqlite.close({database:this.dbName,readonly:this.readonly}),Promise.resolve()}catch(e){return Promise.reject(e)}}async beginTransaction(){try{let e=await this.sqlite.beginTransaction({database:this.dbName});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async commitTransaction(){try{let e=await this.sqlite.commitTransaction({database:this.dbName});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async rollbackTransaction(){try{let e=await this.sqlite.rollbackTransaction({database:this.dbName});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async isTransactionActive(){try{let e=await this.sqlite.isTransactionActive({database:this.dbName});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async loadExtension(e){try{return await this.sqlite.loadExtension({database:this.dbName,path:e,readonly:this.readonly}),Promise.resolve()}catch(e){return Promise.reject(e)}}async enableLoadExtension(e){try{return await this.sqlite.enableLoadExtension({database:this.dbName,toggle:e,readonly:this.readonly}),Promise.resolve()}catch(e){return Promise.reject(e)}}async getUrl(){try{let e=await this.sqlite.getUrl({database:this.dbName,readonly:this.readonly});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async getVersion(){try{let e=await this.sqlite.getVersion({database:this.dbName,readonly:this.readonly});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async getTableList(){try{let e=await this.sqlite.getTableList({database:this.dbName,readonly:this.readonly});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async execute(e,t=!0,n=!0){try{if(this.readonly)return Promise.reject(`not allowed in read-only mode`);{let r=await this.sqlite.execute({database:this.dbName,statements:e,transaction:t,readonly:!1,isSQL92:n});return Promise.resolve(r)}}catch(e){return Promise.reject(e)}}async query(e,t,n=!0){let r;try{return r=t&&t.length>0?await this.sqlite.query({database:this.dbName,statement:e,values:t,readonly:this.readonly,isSQL92:!0}):await this.sqlite.query({database:this.dbName,statement:e,values:[],readonly:this.readonly,isSQL92:n}),r=await this.reorderRows(r),Promise.resolve(r)}catch(e){return Promise.reject(e)}}async run(e,t,n=!0,r=`no`,i=!0){let a;try{return this.readonly?Promise.reject(`not allowed in read-only mode`):(a=t&&t.length>0?await this.sqlite.run({database:this.dbName,statement:e,values:t,transaction:n,readonly:!1,returnMode:r,isSQL92:!0}):await this.sqlite.run({database:this.dbName,statement:e,values:[],transaction:n,readonly:!1,returnMode:r,isSQL92:i}),a.changes=await this.reorderRows(a.changes),Promise.resolve(a))}catch(e){return Promise.reject(e)}}async executeSet(e,t=!0,n=`no`,r=!0){let i;try{return this.readonly?Promise.reject(`not allowed in read-only mode`):(i=await this.sqlite.executeSet({database:this.dbName,set:e,transaction:t,readonly:!1,returnMode:n,isSQL92:r}),i.changes=await this.reorderRows(i.changes),Promise.resolve(i))}catch(e){return Promise.reject(e)}}async isExists(){try{let e=await this.sqlite.isDBExists({database:this.dbName,readonly:this.readonly});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async isTable(e){try{let t=await this.sqlite.isTableExists({database:this.dbName,table:e,readonly:this.readonly});return Promise.resolve(t)}catch(e){return Promise.reject(e)}}async isDBOpen(){try{let e=await this.sqlite.isDBOpen({database:this.dbName,readonly:this.readonly});return Promise.resolve(e)}catch(e){return Promise.reject(e)}}async delete(){try{return this.readonly?Promise.reject(`not allowed in read-only mode`):(await this.sqlite.deleteDatabase({database:this.dbName,readonly:!1}),Promise.resolve())}catch(e){return Promise.reject(e)}}async createSyncTable(){try{if(this.readonly)return Promise.reject(`not allowed in read-only mode`);{let e=await this.sqlite.createSyncTable({database:this.dbName,readonly:!1});return Promise.resolve(e)}}catch(e){return Promise.reject(e)}}async setSyncDate(e){try{return this.readonly?Promise.reject(`not allowed in read-only mode`):(await this.sqlite.setSyncDate({database:this.dbName,syncdate:e,readonly:!1}),Promise.resolve())}catch(e){return Promise.reject(e)}}async getSyncDate(){try{let e=await this.sqlite.getSyncDate({database:this.dbName,readonly:this.readonly}),t=``;return e.syncDate>0&&(t=new Date(e.syncDate*1e3).toISOString()),Promise.resolve(t)}catch(e){return Promise.reject(e)}}async exportToJson(e,t=!1){try{let n=await this.sqlite.exportToJson({database:this.dbName,jsonexportmode:e,readonly:this.readonly,encrypted:t});return Promise.resolve(n)}catch(e){return Promise.reject(e)}}async deleteExportedRows(){try{return this.readonly?Promise.reject(`not allowed in read-only mode`):(await this.sqlite.deleteExportedRows({database:this.dbName,readonly:!1}),Promise.resolve())}catch(e){return Promise.reject(e)}}async executeTransaction(e,t=!0){let n=0,r=!1;if(this.readonly)return Promise.reject(`not allowed in read-only mode`);if(await this.sqlite.beginTransaction({database:this.dbName}),r=await this.sqlite.isTransactionActive({database:this.dbName}),!r)return Promise.reject(`After Begin Transaction, no transaction active`);try{for(let r of e){if(typeof r!=`object`||!(`statement`in r))throw Error(`Error a task.statement must be provided`);if(`values`in r&&r.values&&r.values.length>0){let e=r.statement.toUpperCase().includes(`RETURNING`)?`all`:`no`,i=await this.sqlite.run({database:this.dbName,statement:r.statement,values:r.values,transaction:!1,readonly:!1,returnMode:e,isSQL92:t});if(i.changes.changes<0)throw Error(`Error in transaction method run `);n+=i.changes.changes}else{let e=await this.sqlite.execute({database:this.dbName,statements:r.statement,transaction:!1,readonly:!1});if(e.changes.changes<0)throw Error(`Error in transaction method execute `);n+=e.changes.changes}}let r=await this.sqlite.commitTransaction({database:this.dbName});n+=r.changes.changes;let i={changes:{changes:n}};return Promise.resolve(i)}catch(e){let t=e.message?e.message:e;return await this.sqlite.rollbackTransaction({database:this.dbName}),Promise.reject(t)}}async reorderRows(e){let t=e;if(e?.values&&typeof e.values[0]==`object`&&Object.keys(e.values[0]).includes(`ios_columns`)){let n=e.values[0].ios_columns,r=[];for(let t=1;t<e.values.length;t++){let i=e.values[t],a={};for(let e of n)a[e]=i[e];r.push(a)}t.values=r}return Promise.resolve(t)}},Dt=a(`CapacitorSQLite`,{web:()=>m(()=>import(`./web-CYvmLUIV.js`).then(e=>new e.CapacitorSQLiteWeb),[]),electron:()=>window.CapacitorCustomPlatform.plugins.CapacitorSQLite}),Ot=null,M=null;async function N(){return M||(Ot??=new Tt(Dt),i.getPlatform()===`web`&&await Ot.initWebStore(),M=await Ot.createConnection(St,!1,`no-encryption`,1,!1),await M.open(),await kt(M),M)}async function kt(e){for(let t of wt)await e.execute(t)}async function At(e,t){let n=await e.query(`SELECT cumulative_amount FROM bank_transactions ORDER BY id DESC LIMIT 1`),r=Number(n.values?.[0]?.cumulative_amount??0),i=I();await e.run(`INSERT INTO bank_transactions
      (date, category, amount, cumulative_amount, description, created_timestamp, last_updated_timestamp, updated_device)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[t.date,t.category,t.amount,r+t.amount,t.description?.trim()||null,i,i,t.updated_device])}async function jt(e,t){let n=gt([...F(await e.query(`SELECT * FROM share_transactions ORDER BY id ASC`)),t]),r=n[n.length-1],i=I();await e.run(`INSERT INTO share_transactions
      (date, share_name, category, per_unit_price, asba_charge, allotted, buy_sell, total_amount, profit_loss, cumulative_profit, created_timestamp, last_updated_timestamp, updated_device)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[r.date,String(r.share_name).toUpperCase(),r.category,String(r.per_unit_price),r.asba_charge,r.allotted,r.buy_sell,String(r.total_amount),String(r.profit_loss),r.cumulative_profit,i,i,t.updated_device])}async function Mt(e,t){let n=Rt(t.flow_type),r=I();await e.run(`INSERT INTO ${n}
      (date, flow_type, direction, category, amount, signed_amount, description, source, created_timestamp, last_updated_timestamp, source_ref, updated_device)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[t.date,t.flow_type,t.direction,t.category,t.amount,st(t.direction,t.amount),t.description?.trim()||null,t.source??`manual`,r,r,null,t.updated_device])}async function Nt(e,t){if(t.from_flow===t.to_flow)throw Error(`Transfer flows must differ.`);let n=I();await e.run(`INSERT INTO transfers
      (date, from_flow, to_flow, amount, description, created_timestamp, last_updated_timestamp, updated_device)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[t.date,t.from_flow,t.to_flow,Math.abs(t.amount),t.description?.trim()||null,n,n,t.updated_device])}async function P(e,t){return F(await e.query(`SELECT * FROM ${t} ORDER BY id ASC`))}async function Pt(e,t){await e.run(`DELETE FROM bank_transactions WHERE id = ?`,[t]);let n=await e.query(`SELECT id, amount FROM bank_transactions ORDER BY id ASC`),r=0;for(let t of F(n))r+=Number(t.amount??0),await e.run(`UPDATE bank_transactions SET cumulative_amount = ? WHERE id = ?`,[r,t.id])}async function Ft(e,t){await e.run(`DELETE FROM share_transactions WHERE id = ?`,[t]);let n=gt(F(await e.query(`SELECT * FROM share_transactions ORDER BY id ASC`)));for(let t of n)t.id!=null&&await e.run(`UPDATE share_transactions
        SET per_unit_price = ?, asba_charge = ?, allotted = ?, buy_sell = ?,
            total_amount = ?, profit_loss = ?, cumulative_profit = ?
        WHERE id = ?`,[String(t.per_unit_price),t.asba_charge,t.allotted,t.buy_sell,String(t.total_amount),String(t.profit_loss),t.cumulative_profit,t.id])}async function It(e,t,n){await e.run(`DELETE FROM ${Rt(n)} WHERE id = ?`,[t])}async function Lt(e,t){await e.run(`DELETE FROM transfers WHERE id = ?`,[t])}function Rt(e){return e===`bank`?`personal_finance_bank_flow`:`personal_finance_cash_flow`}function F(e){return Array.isArray(e.values)?e.values:[]}function I(){return new Date().toISOString().slice(0,19)}var L=[],R=[],zt=[],Bt=[],z=!1,B=!1;function Vt(){return{bank:[{date:`2026-08-01`,category:`Interest Earned`,amount:820,description:`Savings`},{date:`2026-08-04`,category:`Mobile Banking Charge`,amount:-25,description:`Monthly`},{date:`2026-08-10`,category:`Demat Renewal`,amount:-150,description:`Renewal`}],shares:[{date:`2026-08-03`,share_name:`NABIL`,category:`ipo`,per_unit_price:100,allotted:10,buy_sell:`ipo`,total_amount:1e3},{date:`2026-08-06`,share_name:`NABIL`,category:`sell`,per_unit_price:160,allotted:4,buy_sell:`sell`,total_amount:640},{date:`2026-08-07`,share_name:`NIBL`,category:`sip`,per_unit_price:1e3,allotted:20,buy_sell:`installment`,total_amount:1e3}],personal:[{date:`2026-08-20`,flow_type:`cash`,direction:`expense`,category:`Food`,amount:560,description:`Grocery top-up`},{date:`2026-08-01`,flow_type:`bank`,direction:`income`,category:`Salary`,amount:45e3,description:`Salary`},{date:`2026-08-18`,flow_type:`cash`,direction:`expense`,category:`Entertainment`,amount:900,description:`Movie night`}],transfers:[{date:`2026-08-22`,from_flow:`cash`,to_flow:`bank`,amount:2e3,description:`Deposit`}]}}async function Ht(e){let t=Vt();for(let n of t.bank)await At(e,{...n,updated_device:b});for(let n of t.shares)await jt(e,{...n,updated_device:b});for(let n of t.personal)await Mt(e,{...n,source:`manual`,updated_device:b});for(let n of t.transfers)await Nt(e,{...n,updated_device:b})}async function Ut(e){let t=0;for(let n of Ct){let r=await e.query(`SELECT COUNT(*) AS n FROM ${n}`);t+=Number(r.values?.[0]?.n??0)}return t}function V(e,t){e.splice(0,e.length,...t)}function Wt(e){let t=e.id;return typeof t==`string`||typeof t==`number`?t:void 0}function Gt(e){return{id:Wt(e),date:String(e.date??``),category:e.category==null?null:String(e.category),amount:k(e.amount),description:e.description==null?null:String(e.description),timestamp:e.created_timestamp==null?null:String(e.created_timestamp)}}function Kt(e){return{id:Wt(e),date:String(e.date??``),share_name:e.share_name==null?null:String(e.share_name),category:e.category==null?null:String(e.category),per_unit_price:k(e.per_unit_price),asba_charge:k(e.asba_charge),allotted:k(e.allotted),buy_sell:e.buy_sell==null?null:String(e.buy_sell),total_amount:k(e.total_amount),profit_loss:k(e.profit_loss),cumulative_profit:k(e.cumulative_profit),timestamp:e.created_timestamp==null?null:String(e.created_timestamp)}}function qt(e,t){let n=k(t.amount),r=String(t.direction??`expense`).toLowerCase();return{id:Wt(t),display_id:`${e===`bank`?`B`:`C`}-${String(t.id??``)}`,date:String(t.date??``),flow_type:e,direction:r,category:t.category==null?null:String(t.category),amount:n,signed_amount:k(t.signed_amount),description:t.description==null?null:String(t.description),source:`manual`,timestamp:t.created_timestamp==null?null:String(t.created_timestamp)}}function Jt(e){return{id:Wt(e),date:String(e.date??``),from_flow:e.from_flow==null?null:String(e.from_flow),to_flow:e.to_flow==null?null:String(e.to_flow),amount:k(e.amount),description:e.description==null?null:String(e.description)}}async function H(){let e=await N(),[t,n,r,i,a]=await Promise.all([P(e,`bank_transactions`),P(e,`share_transactions`),P(e,`personal_finance_bank_flow`),P(e,`personal_finance_cash_flow`),P(e,`transfers`)]);V(L,t.map(Gt)),V(R,n.map(Kt)),V(zt,[...r.map(e=>qt(`bank`,e)),...i.map(e=>qt(`cash`,e))]),V(Bt,a.map(Jt)),B=!0,z=!0}async function Yt(e={}){let t=await N();e.seedIfEmpty&&await Ut(t)===0&&A===`development`&&await Ht(t),await H()}async function Xt(){let e=Vt();V(L,e.bank.map(e=>({id:void 0,...e}))),V(R,gt(e.shares)),V(zt,e.personal.map(e=>({id:void 0,display_id:`${e.flow_type===`bank`?`B`:`C`}-demo`,flow_type:e.flow_type,direction:e.direction,category:e.category,amount:e.amount,signed_amount:e.direction===`income`?e.amount:-e.amount,description:e.description,source:`manual`,timestamp:`${e.date}T00:00:00`}))),V(Bt,e.transfers.map(e=>({id:void 0,...e}))),B=!1,z=!0}function Zt(){return[...zt,...lt(R),...ut(L)]}function Qt(){let e=y(h());return Zt().filter(t=>t.source===`manual`&&String(t.date).startsWith(e))}function $t(e){let t=e.filter(e=>e.direction===`income`).reduce((e,t)=>e+Number(t.amount||0),0),n=e.filter(e=>e.direction===`expense`).reduce((e,t)=>e+Number(t.amount||0),0);return{income:t,expense:n,net:t-n}}function en(){return $t(Qt())}function tn(){return $t(Zt().filter(e=>e.source===`manual`&&e.date===g(h())))}function nn(e){return e.reduce((e,t)=>e+Number(t.amount||0),0)}function rn(){let e=en(),t=tn(),n=sn(),r=cn(),i=nn(n),a=[...n].sort((e,t)=>String(t.date).localeCompare(String(e.date))).slice(0,4).map(e=>({...e,_table:e.flow_type===`bank`?`personal_finance_bank_flow`:`personal_finance_cash_flow`,_id:e.id})),o=oe(h());return`
    ${ln()}
    <section class="card balance-card">
      <div class="segmented">
        <button class="${x.homeMode===`expense`?`active`:``}" data-home-mode="expense">Expense</button>
        <button class="${x.homeMode===`income`?`active`:``}" data-home-mode="income">Income</button>
      </div>
      <div class="metric-row"><div><div class="metric-label">${o} net balance</div><div class="money big ${e.net>=0?`pos`:`neg`}">${D(e.net,{sign:!0})}</div></div></div>
      <div class="split split-3"><div><span>Total income</span><b class="money pos">${D(e.income)}</b></div><div><span>Total expense</span><b class="money neg">${D(e.expense)}</b></div><div><span>Selected ${x.homeMode}</span><b class="money ${x.homeMode===`income`?`pos`:`neg`}">${D(i)}</b></div></div>
    </section>
    <div class="stat-grid stat-grid-spaced">
      <div class="stat-box"><div class="label">Today income</div><div class="value money pos">${D(t.income)}</div></div>
      <div class="stat-box"><div class="label">Today expense</div><div class="value money neg">${D(t.expense)}</div></div>
      <div class="stat-box stat-box-full"><div class="label">Today net</div><div class="value money ${t.net>=0?`pos`:`neg`}">${D(t.net,{sign:!0})}</div></div>
    </div>
    <button class="btn-primary" data-nav="expenses-add">Quick add</button>
    <section class="card">
      <div class="section-title"><h3>${o} categories</h3><button data-nav="expenses-dash">View dashboard</button></div>
      ${un()}
      ${Ve(n)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Money flow</h3><button data-nav="expenses-dash">View dashboard</button></div>
      ${$e([`week`,`month`,`year`,`custom`],{wrap:!1})}
      ${Ie(r)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Recent day-to-day</h3><button data-nav="expenses-dash">See all</button></div>
      ${nt(a,!1)}
    </section>
  `}function an(){let e=new Set;for(let t of Qt())e.add(String(t.category||`Other`));return[...e].sort((e,t)=>e.localeCompare(t))}function on(){let e=an();return x.categorySelectionTouched||(x.selectedHomeCategories=new Set(e)),e.filter(e=>x.selectedHomeCategories.has(e))}function sn(){let e=new Set(on());return Qt().filter(t=>t.direction===x.homeMode&&e.has(String(t.category||`Other`)))}function cn(){let e=new Set(on());return Qt().filter(t=>e.has(String(t.category||`Other`)))}function ln(){return pe()?`
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
  `:``}function un(){let e=an(),t=new Set(on());return e.length?`
    <details class="category-dropdown">
      <summary><span>Categories shown</span><b>${t.size===e.length?`All with entries`:`${t.size} selected`}</b></summary>
      <label><input type="checkbox" value="__all__" data-category-check ${t.size===e.length?`checked`:``}> All categories with entries</label>
      ${e.map(e=>`<label><input type="checkbox" value="${w(e)}" data-category-check ${t.has(e)?`checked`:``}> ${C(e)}</label>`).join(``)}
    </details>
  `:`<p class="sub">No categories have entries for ${oe(h())} yet.</p>`}var U=[`Interest Earned`,`Interest Tax`,`Mobile Banking Charge`,`Debit Card Charge`,`Cheque Book`,`Locker`,`Demat Renewal`,`Demat & MeroShare Renewal`,`Broker Renewal`,`MeroShare Renewal`,`Other Charges`],dn=new Set([`interest earned`,`income`]),fn=[`ipo`,`sip`,`buy`,`sell`,`dividend`],pn={ipo:`IPO entry`,sip:`SIP investment`,buy:`Secondary buy`,sell:`Sell shares`,dividend:`Dividend`},mn=[{value:`bank`,label:`Bank Flow`},{value:`cash`,label:`Cash Flow`}],hn=[{value:`expense`,label:`Expense`},{value:`income`,label:`Income`}],gn=[`Food`,`Transportation`,`Entertainment`,`Shopping`,`Health`,`Education`,`Bills`,`Rent`,`Travel`,`Insurance`,`Investment`,`SIP`,`Share Market`,`Gift`,`Other`],_n=[`Salary`,`Freelance`,`Business`,`Prize/Lottery`,`Gift`,`Refund`,`Investment Income`,`Investment Return`,`Dividend`,`Share Sell Proceeds`,`Other Income`],vn=g(h());function yn(e,t,n,r,i,a=``){return`<p class="eyebrow">${e}</p><h1 class="pagehead">${t}</h1><p class="sub">Stored locally on this device.</p>${bn(n,r,a)}${E(`home`,i)}`}function bn(e,t,n=``){return`<section class="card"${n?` data-form="${w(n)}"`:``}>${e.map(([e,t,n,r])=>W(e,t,n,r)).join(``)}<button class="btn-primary" data-submit>${t}</button></section>`}function W(e,t,n,r){let i=t===`date`?vn:n??``,a=r?` name="${w(r)}"`:``;return t===`select`?`<div class="field"><label>${e}</label><select${a}>${xn(e,n)}</select></div>`:`<div class="field"><label>${e}</label><input type="${t}"${a} ${t===`number`?`inputmode="decimal"`:``} value="${i}"></div>`}function xn(e,t=`Other`){return({Category:U.includes(t??``)?U:[...gn,..._n],"Entry type":fn,Flow:mn.map(e=>e.label),Type:hn.map(e=>e.label),"Dividend Type":[`cash`,`bonus`],"SIP type":[`installment`,`redeem`]}[e]||[t??`Other`,`Other`]).map(e=>`<option value="${e}">${pn[e]||e}</option>`).join(``)}function Sn(e,t=``){return`<div class="section-title"><h3>${e}</h3>${t?`<span>${t}</span>`:``}</div>`}function Cn(e,t){return`<div class="value money ${t}">${D(e,{sign:t===`pos`||t===`neg`})}</div>`}function wn(e,t,n,r=``){return`<div class="stat-box${r}"><div class="label">${e}</div>${Cn(t,n)}</div>`}function G(e,t=2,n=!1){return`<div class="${t===3?`stat-grid split-3`:`stat-grid`}">${e.map(([r,i,a],o)=>{let s=o===e.length-1,c=s&&e.length%t===1;return wn(r,i,a,(n||c)&&s?` stat-box-full`:``)}).join(``)}</div>`}function Tn(e=x.homeRange,t=!1){let n=h();if(t&&e===`week`&&(e=`month`),e===`week`&&!t)return Array.from({length:90},(e,t)=>{let r=v(n,t-89);return{label:String(r.getDate()),sublabel:r.toLocaleString(`en-US`,{month:`short`}),key:g(r),isDay:!0}});if(e===`month`)return t?Array.from({length:13},(e,t)=>{let r=new Date(n.getFullYear(),n.getMonth()-(12-t),1),i=String(r.getFullYear()).slice(2);return{label:r.toLocaleString(`en-US`,{month:`short`}),sublabel:`'${i}`,key:y(r),isDay:!1}}):Array.from({length:400},(e,t)=>{let r=v(n,t-399);return{label:String(r.getDate()),sublabel:r.toLocaleString(`en-US`,{month:`short`}),key:g(r),isDay:!0}});if(e===`year`)return Array.from({length:48},(e,t)=>{let r=new Date(n.getFullYear(),n.getMonth()-(47-t),1),i=String(r.getFullYear()).slice(2);return{label:r.toLocaleString(`en-US`,{month:`short`}),sublabel:`'${i}`,key:y(r),isDay:!1}});if(e!==`custom`)return[];let r=ae(x.customStart,x.customEnd);if(r<=60)return Array.from({length:r},(e,t)=>{let n=v(_(x.customStart),t);return{label:String(n.getDate()),sublabel:n.toLocaleString(`en-US`,{month:`short`}),key:g(n),isDay:!0}});let i=[],a=new Date(_(x.customStart));a.setDate(1);let o=_(x.customEnd);for(;a<=o;){let e=String(a.getFullYear()).slice(2);i.push({label:a.toLocaleString(`en-US`,{month:`short`}),sublabel:`'${e}`,key:y(a),isDay:!1}),a=new Date(a.getFullYear(),a.getMonth()+1,1)}return i}function En(e,t){return e.isDay?String(t)===e.key:String(t).startsWith(e.key)}function Dn(){return yn(`Bank Services`,`Add bank entry`,[[`Date`,`date`,``,`date`],[`Category`,`select`,`Interest Earned`,`category`],[`Amount`,`number`,``,`amount`],[`Description (optional)`,`text`,``,`description`]],`Add bank entry`,`bank-dash`,`bank-add`)}function On(){let e=ot(L),t=Object.entries(e.category_totals??{}).filter(([e])=>e.toLowerCase()!==`interest earned`).map(([e,t])=>({label:e,value:Math.abs(Number(t))})).filter(e=>e.value>0).sort((e,t)=>t.value-e.value),n=kn(L),r=L.map(e=>({...e,amount:Number(e.amount),direction:Number(e.amount)>=0?`income`:`expense`,flow_type:`bank`,_table:`bank_transactions`,_id:e.id}));return`
    <p class="eyebrow">Bank Services</p>
    <h1 class="pagehead">Bank services dashboard</h1>
    <p class="sub">Interest, charges, and net balance across your accounts.</p>

    ${G([[`Interest earned`,e.total_income,`pos`],[`Total charges`,e.total_expenses,`neg`],[`Net balance`,e.net_balance,e.net_balance>=0?`pos`:`neg`]],2,!0)}

    ${et(`Charges by category`,t,`var(--brand-teal)`)}

    ${Qe(`Bank services trend`,n,{ranges:[`month`,`year`,`custom`],activeRange:x.bankRange,rangeAttr:`data-bank-range`})}

    <section class="card">
      ${Sn(`All transactions`,`Filter`)}
      ${Ce(`bank`,`Search by category or description`)}
      ${nt(r,!1,`bank`)}
    </section>

    ${E(`home`,`bank-add`)}
  `}function kn(e){return Tn(x.bankRange,!0).map(t=>{let n=0,r=0;for(let i of e){if(!En(t,String(i.date??``)))continue;let e=Number(i.amount??0);at(String(i.category??``))?n+=e:r+=Math.abs(e)}return{label:t.label,sublabel:t.sublabel,key:t.key,income:n,expense:r,net:n-r}})}function An(){return`
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Add expense entry</h1>
    <p class="sub">Log day-to-day bank-flow or cash-flow income and expenses.</p>

    <div class="transfer-chip" data-nav="transfer" role="button" style="cursor:pointer;">
      <div class="tc-icon">⇄</div>
      <div class="tc-body"><b>Record a transfer instead?</b><span>Cash ⇄ Bank — kept separate from income/expense</span></div>
      <span style="color:var(--text-3);">›</span>
    </div>

    ${bn([[`Date`,`date`,``,`date`],[`Flow`,`select`,`Bank Flow`,`flow`],[`Type`,`select`,`Expense`,`type`],[`Category`,`select`,`Food`,`category`],[`Amount`,`number`,``,`amount`],[`Description (optional)`,`text`,``,`description`]],`Add expense entry`,`expenses-add`)}
    ${E(`home`,`expenses-dash`)}
  `}function jn(){let e=Zt(),t=dt(e),n=x.expensesDashTab,r=n===`bank`?e.filter(e=>e.flow_type===`bank`):n===`cash`?e.filter(e=>e.flow_type===`cash`):e,i=r.map(e=>({...e,_table:e.source===`manual`?e.flow_type===`bank`?`personal_finance_bank_flow`:`personal_finance_cash_flow`:void 0,_id:e.source===`manual`?e.id:void 0})),a=Mn(r),o=Bt[0];return`
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Expenses dashboard</h1>
    <p class="sub">Combines manual Personal Expenses with live Bank Flow (Bank Services + Share activity).</p>

    <div class="segmented alt" style="margin-bottom:10px;">
      <button class="${n===`combined`?`active`:``}" data-expenses-tab="combined">Combined</button>
      <button class="${n===`bank`?`active`:``}" data-expenses-tab="bank">Bank flow</button>
      <button class="${n===`cash`?`active`:``}" data-expenses-tab="cash">Cash flow</button>
    </div>

    <section class="card">
      <div class="transfer-chip">
        <div class="tc-icon">⇄</div>
        <div class="tc-body"><b>Cash → Bank transfer</b><span>Shown here, excluded from income/expense totals</span></div>
        <div class="money neu">${D(Number(o?.amount??0))}</div>
      </div>
      ${n===`combined`?`${G([[`Income`,t.combined.overall_income,`pos`],[`Expenses`,t.combined.overall_expenses,`neg`],[`Bank net`,t.bank.net,t.bank.net>=0?`pos`:`neg`],[`Cash net`,t.cash.net,t.cash.net>=0?`pos`:`neg`]])}
          <div class="stat-box stat-box-full" style="margin-top:10px;text-align:center;">
            <div class="label">Overall net / savings</div>
            <div class="value money ${t.combined.overall_net>=0?`pos`:`neg`}" style="font-size:20px;">${D(t.combined.overall_net,{sign:!0})}</div>
          </div>`:G(n===`bank`?[[`Bank income`,t.bank.income,`pos`],[`Bank expense`,t.bank.expenses,`neg`],[`Investment income`,t.bank.investment_income,`pos`],[`Investment expense`,t.bank.investment_expense,`neg`],[`Interest earned`,t.bank.interest_earned,`pos`],[`Service cost`,t.bank.service_cost,`neg`],[`Total income`,t.bank.total_income,`pos`],[`Total expense`,t.bank.total_expenses,`neg`],[`Bank net`,t.bank.net,t.bank.net>=0?`pos`:`neg`]]:[[`Cash income`,t.cash.total_income,`pos`],[`Cash expense`,t.cash.total_expenses,`neg`],[`Cash net`,t.cash.net,t.cash.net>=0?`pos`:`neg`]])}
    </section>

    ${Qe(`Money flow trend`,a)}

    <section class="card">
      ${Sn(`All transactions`,`Filter`)}
      ${Ce(`expenses`,`Search by category or description`)}
      ${nt(i,!1,`expenses`)}
    </section>

    ${E(`home`,`expenses-add`)}
  `}function Mn(e){return Tn().map(t=>{let n=0,r=0;for(let i of e){if(!En(t,String(i.date??``)))continue;let e=Number(i.amount??0);i.direction===`income`?n+=e:r+=e}return{label:t.label,sublabel:t.sublabel,key:t.key,income:n,expense:r,net:n-r}})}var Nn=[{title:`Account`,rows:[[`settings-profile`,`Profile`,`Name and profile initials`,`👤`]]},{title:`Data & storage`,rows:[[`settings-import-export`,`Import / Export`,`Notes paste, Excel import, Excel export`,`📥`],[`settings-backup-sync`,`Backup & sync`,`Local backup status and future sync`,`☁`],[`settings-privacy`,`Privacy`,`On-device SQLite storage and data controls`,`🔒`]]},{title:`About`,rows:[[`settings-investment`,`Investment`,`Share portfolio rules and SIP notes`,`📈`],[`settings-how-to-use`,`How To Use`,`Navigation and entry guidance`,`?`],[`settings-about`,`About`,`Mobile runtime and desktop differences`,`ℹ`],[`settings-version`,`Version`,`Mobile and desktop release tags`,`#`]]}];function Pn(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">General</h1>

    ${Nn.map(e=>`
        <div class="settings-group">
          <p class="settings-group-title">${e.title}</p>
          <section class="card settings-menu">
            ${e.rows.map(([e,t,n,r])=>Fn(e,t,n,r)).join(``)}
          </section>
        </div>`).join(``)}

    <section class="card settings-cta">
      <span class="settings-cta-icon">📝</span>
      <div>
        <h3>Import from notes</h3>
        <p class="settings-cta-text">Paste unstructured notes and map them to categories — with smart defaults you can override per line.</p>
      </div>
      <button class="btn-primary" data-nav="import-paste">Start import</button>
    </section>
  `}function Fn(e,t,n,r){return`
    <button class="settings-row settings-nav-row" data-nav="${e}">
      <span class="settings-icon">${r}</span>
      <span class="settings-row-main">
        <b>${t}</b>
        <span>${n}</span>
      </span>
      <span class="settings-chevron" aria-hidden="true">›</span>
    </button>
  `}function K(e,t){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">${C(e)}</h1>
    ${t}
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function In(){return K(`About FinLedge Mobile`,`<section class="card settings-panel">
      <p class="sub">FinLedge Mobile is a Capacitor-wrapped Android app backed by on-device SQLite. It keeps day-to-day Bank Flow and Cash Flow tracking on the phone, with module dashboards matching desktop calculations where those modules overlap.</p>
      <p class="sub">The desktop app stores local Excel workbooks; the mobile app stores SQLite rows and will export/import compatible Excel files in its own phase.</p>
    </section>`)}function Ln(e){e.CapacitorUtils.Synapse=new Proxy({},{get(t,n){return new Proxy({},{get(t,r){return(t,i,a)=>{let o=e.Capacitor.Plugins[n];if(o===void 0){a(Error(`Capacitor plugin ${n} not found`));return}if(typeof o[r]!=`function`){a(Error(`Method ${r} not found in Capacitor plugin ${n}`));return}(async()=>{try{i(await o[r](t))}catch(e){a(e)}})()}}})}})}function Rn(e){e.CapacitorUtils.Synapse=new Proxy({},{get(t,n){return e.cordova.plugins[n]}})}function zn(e=!1){typeof window>`u`||(window.CapacitorUtils=window.CapacitorUtils||{},window.Capacitor!==void 0&&!e?Ln(window):window.cordova!==void 0&&Rn(window))}var Bn;(function(e){e.Documents=`DOCUMENTS`,e.Data=`DATA`,e.Library=`LIBRARY`,e.Cache=`CACHE`,e.External=`EXTERNAL`,e.ExternalStorage=`EXTERNAL_STORAGE`,e.ExternalCache=`EXTERNAL_CACHE`,e.LibraryNoCloud=`LIBRARY_NO_CLOUD`,e.Temporary=`TEMPORARY`})(Bn||={});var Vn;(function(e){e.UTF8=`utf8`,e.ASCII=`ascii`,e.UTF16=`utf16`})(Vn||={});var q=a(`Filesystem`,{web:()=>m(()=>import(`./web-D6cRE4kW.js`).then(e=>new e.FilesystemWeb),[])});zn();var J=Bn.Data,Hn=`finledge_save.json`,Un=`finledge.backup.cursors`,Wn=`finledge.backup.lastRun`;function Gn(){return new Date().toISOString().slice(0,10)}function Kn(){try{return JSON.parse(window.localStorage.getItem(Un)??`{}`)}catch{return{}}}function qn(){try{return JSON.parse(window.localStorage.getItem(Wn)??`{}`)}catch{return{date:``,at:``}}}var Jn=null;function Yn(){return Jn}async function Xn(){await q.mkdir({path:j,directory:J,recursive:!0}),await q.mkdir({path:`${j}/${bt}`,directory:J,recursive:!0}),await q.mkdir({path:`${j}/${xt}`,directory:J,recursive:!0})}async function Zn(e){await Xn();let t={generatedAt:new Date().toISOString(),database:yt};for(let n of Ct)t[n]=await P(e,n);await q.writeFile({path:`${j}/${bt}/${Hn}`,directory:J,data:JSON.stringify(t),encoding:Vn.UTF8,recursive:!0})}async function Qn(e){let t=Gn();if(qn().date===t)return{status:`skipped`,date:t,newRows:0};try{await Xn();let n=Kn(),r=new Date().toISOString().slice(0,19),i={},a=0;for(let t of Ct){let o=n[t]??{id:0,at:``},s=await e.query(`SELECT * FROM ${t} WHERE id > ? OR last_updated_timestamp > ?`,[o.id,o.at]),c=Array.isArray(s.values)?s.values:[];if(c.length){i[t]=c,a+=c.length;let e=Math.max(0,...c.map(e=>Number(e.id??0)));n[t]={id:Math.max(o.id,e),at:r}}}return Object.keys(i).length&&(await q.writeFile({path:`${j}/${xt}/${t}.json`,directory:J,data:JSON.stringify({generatedAt:new Date().toISOString(),mode:A,database:yt,backupOfDate:t,tables:i}),encoding:Vn.UTF8,recursive:!0}),window.localStorage.setItem(Un,JSON.stringify(n))),window.localStorage.setItem(Wn,JSON.stringify({date:t,at:r})),{status:`done`,date:t,newRows:a}}catch(e){return{status:`error`,date:t,newRows:0,error:e instanceof Error?e.message:String(e)}}}async function $n(e){let t=!1;try{await Zn(e),t=!0}catch(e){let t=e instanceof Error?e.message:String(e);console.warn(`[storage] full save failed`,t)}let n=await Qn(e);return await er().catch(()=>{}),{saved:t,backup:n}}async function er(){await Xn();let e=`${j}/${bt}`,t=`${j}/${xt}`,n=`${e}/${Hn}`,r=!1;try{await q.stat({path:n,directory:J}),r=!0}catch{}let i=[];try{i=((await q.readdir({path:t,directory:J})).files??[]).map(e=>e.name).filter(e=>e.endsWith(`.json`)).sort()}catch{}let a=qn();return Jn={mode:A,databaseName:yt,rootFolder:j,databaseFolder:e,backupFolder:t,fullSavePath:n,hasFullSave:r,lastBackupDate:a.date||null,lastBackupAt:a.at||null,backupFiles:i,lastError:null},Jn}function tr(){let e=Yn();return K(`Backup & sync`,`
    <section class="card">
      <h3>Local first</h3>
      <p class="sub">Mobile data lives in on-device SQLite. A daily incremental backup is written to the backup folder on first open of each day — full save, then only the new rows since the last backup.</p>
    </section>
    ${e?`<section class="card">
      <h3>Storage</h3>
      <p class="sub">Everything stays on this device — no account needed.</p>
      <div class="field"><label>Database</label><input type="text" value="${C(e.databaseName)}" readonly></div>
      <div class="field"><label>Folder (app-private)</label><input type="text" value="${C(e.rootFolder)}" readonly></div>
      <div class="field"><label>Database folder</label><input type="text" value="${C(e.databaseFolder)}" readonly></div>
      <div class="field"><label>Backup folder</label><input type="text" value="${C(e.backupFolder)}" readonly></div>
      <div class="field"><label>Aggregate save</label><input type="text" value="${C(e.fullSavePath)} (${e.hasFullSave?`written`:`pending`})" readonly></div>
      <div class="field"><label>Backup files</label><input type="text" value="${C(e.backupFiles.length?e.backupFiles.join(`, `):`none yet`)}" readonly></div>
      <div class="field"><label>Last backup</label><input type="text" value="${C(e.lastBackupDate?`${e.lastBackupDate} at ${e.lastBackupAt??`?`}`:`not run yet`)}" readonly></div>
      <button class="btn-primary" data-backup-now>Run backup now</button>
    </section>`:`<section class="card">
      <h3>Storage</h3>
      <p class="sub">Storage info will appear here once the app has opened the database.</p>
    </section>`}
    `)}function nr(){return K(`How To Use`,`<section class="card">
      <h3>Mobile flow</h3>
      <p class="sub">Use Home for day-to-day Personal Expenses, the drawer for each module pair, and Import / Export for Keep Notes, Excel, and transfer actions.</p>
    </section>`)}function rr(){return K(`Import / Export`,`<section class="card settings-menu">
      <button class="settings-row settings-nav-row" data-nav="import-paste">
        <span class="settings-icon">📋</span>
        <span class="settings-row-main"><b>Import from notes</b><span>Paste notes, review, and commit.</span></span>
      </button>
      <button class="settings-row settings-nav-row">
        <span class="settings-icon">📄</span>
        <span class="settings-row-main"><b>Import from Excel</b><span>Bring desktop-compatible workbooks into local SQLite.</span></span>
        <span class="settings-tag muted">Planned</span>
      </button>
      <button class="settings-row settings-nav-row">
        <span class="settings-icon">↗</span>
        <span class="settings-row-main"><b>Export SQLite to Excel</b><span>Create desktop-compatible Bank, Share, Bank Flow, and Cash Flow workbooks.</span></span>
        <span class="settings-tag">Phase 6</span>
      </button>
    </section>
    <section class="card"><h3>SQLite schema</h3><p class="sub">${wt.length} local tables ready for mobile storage.</p></section>`)}function ir(){return K(`Investment`,`<section class="card">
      <h3>Portfolio rules</h3>
      <p class="sub">Share Portfolio uses the on-device FIFO lot-matching service and SIP calculations. The interest engine remains deferred.</p>
    </section>`)}function ar(){return K(`Privacy`,`<section class="card">
      <h3>Device storage</h3>
      <p class="sub">FinLedge Mobile keeps records in local SQLite on this device. No live bank-flow sync is enabled in mobile-v1.0.0.</p>
    </section>`)}function or(){let e=de();return K(`Profile`,`<section class="card settings-panel">
      <div class="section-title"><h3>Name on this phone</h3><span class="settings-pill">${e||`Not set`}</span></div>
      <form class="profile-form" data-profile-form>
        <input name="profileName" type="text" value="${w(e)}" placeholder="Your name" autocomplete="name">
        <button class="btn-primary" type="submit">Save profile</button>
      </form>
    </section>`)}function sr(){return K(`Version`,`<section class="card settings-panel">
      <div class="settings-version-row"><span>Mobile version</span><b>${C(se)}</b></div>
      <div class="settings-version-row"><span>Mobile release tags</span><b>mobile-vX.Y.Z</b></div>
      <div class="settings-version-row"><span>Desktop release tags</span><b>desktop-vX.Y.Z</b></div>
    </section>`)}function cr(){return Array.from(new Set(R.map(e=>String(e.share_name??``).trim()).filter(Boolean))).sort((e,t)=>e.localeCompare(t))}function lr(e,t,n,r){return`
    <div class="field share-name-field" data-suggest-root="${e}">
      <label>Share name</label>
      <div class="share-name-wrap">
        <input type="text"${r?` name="${w(r)}"`:``} data-suggest-input="${e}" data-suggest-source="${w(n.join(`
`))}" placeholder="${t}" autocomplete="off" autocapitalize="none" spellcheck="false">
        <div class="share-suggest" data-suggest-list="${e}" hidden>
          ${n.map(e=>`<button type="button" class="share-suggest-item" data-suggest-value="${w(e)}">${C(e)}</button>`).join(``)}
        </div>
      </div>
    </div>`}function ur(){return cr().filter(e=>R.some(t=>String(t.share_name??``).trim().toUpperCase()===e&&String(t.category??``).toLowerCase()===`ipo`))}function dr(){return cr().filter(e=>R.some(t=>String(t.share_name??``).trim().toUpperCase()===e&&String(t.category??``).toLowerCase()===`sip`))}function fr(){let e=x.sharesEntryType,t=e===`sip`,n=e===`dividend`,r=e===`buy`||e===`sell`,i=x.sharesDividendType,a=lr(`mobile-share-name-suggestions`,`Share name`,cr(),`share_name`);return`
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Add share entry</h1>
    <p class="sub">Track IPO, secondary, SIP and dividend activity.</p>

    <section class="card">
      <h3>Portfolio (remaining)</h3>
      ${Ce(`shares-portfolio`,`Search by share name`)}
      ${hr()}
    </section>

    <section class="card" data-form="shares-add">
      ${W(`Date`,`date`,``,`date`)}
      ${a}
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

      ${t?`
        <div class="field">
          <label>SIP type</label>
          <select data-shares-sip-type>
            <option value="installment">Installment / Investment</option>
            <option value="redeem">Redeem</option>
          </select>
        </div>
        ${W(`SIP installment amount`,`number`,``,`sip_amount`)}
      `:``}

      ${r?`
        ${W(`Total Amount`,`number`,``,`total_amount`)}
        ${W(`Quantity`,`number`,``,`quantity`)}
        <p class="sub" style="margin:0;font-size:11px;color:var(--text-3);">Per unit price is calculated from total amount ÷ quantity.</p>
      `:``}

      ${n?`
        <div class="field">
          <label>Dividend type</label>
          <select data-shares-dividend-type>
            <option value="cash"  ${i===`cash`?`selected`:``}>Cash</option>
            <option value="bonus" ${i===`bonus`?`selected`:``}>Bonus share</option>
          </select>
        </div>
        ${i===`cash`?W(`Amount`,`number`,``,`dividend_amount`):W(`Number of shares`,`number`,``,`dividend_shares`)}
      `:``}

      ${!t&&!r&&!n?`
        ${W(`Per unit price`,`number`,``,`per_unit_price`)}
        ${W(`Allotted`,`number`,``,`allotted`)}
      `:``}

      <button class="btn-primary" data-submit>Add share entry</button>
    </section>
    ${E(`home`,`shares-dash`)}
  `}function pr(e){let t=String(e.share_name??``).trim().toUpperCase(),n=String(e.category??``).trim().toLowerCase();n===`dividend`&&(n=String(e.buy_sell??``).trim().toLowerCase()===`bonus`?`dividend (bonus)`:`dividend (cash)`),n===`sip`&&(n=String(e.buy_sell??``).trim().toLowerCase()===`redeem`?`sip (redeem)`:`sip (installment)`);let r=Number(e.allotted??0),i=r>0?` · allotted ${r}`:``;return`${t?`${t} · `:``}${n}${i}`}function mr(){let e=_t(R),t=gr(),n=R.map(e=>({description:pr(e),category:String(e.category??``),amount:Number(e.total_amount),direction:Number(e.profit_loss??0)>=0?`income`:`expense`,flow_type:`shares`,date:e.date,_table:`share_transactions`,_id:e.id}));return`
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Share portfolio dashboard</h1>
    <p class="sub">IPO, secondary, SIP position and summary.</p>

    <section class="card">
      <h3>IPO &amp; secondary position</h3>
      ${G([[`IPO invest`,e.total_ipo_investment,`neg`],[`Secondary buy`,e.total_buy_amount,`neg`],[`Total investment`,e.overall_investment,`neg`],[`Total sell`,e.total_sell_amount,`pos`],[`Dividend`,e.total_dividend,`pos`],[`Realized profit`,e.total_profit,e.total_profit>=0?`pos`:`neg`],[`Overall P/L`,e.overall_profit_loss,e.overall_profit_loss>=0?`pos`:`neg`]])}
    </section>

    <section class="card">
      <h3>SIP position</h3>
      ${G([[`Invested`,e.total_sip_investment,`neg`],[`Redeemed`,e.total_sip_redeemed,`pos`],[`SIP profit/loss`,e.sip_profit_loss,e.sip_profit_loss>=0?`pos`:`neg`]],2,!0)}
    </section>

    <section class="card stat-card-purple">
      <h3>Grand total</h3>
      ${G([[`Investment`,e.grand_total_investment,`neg`],[`Profit/Loss`,e.grand_profit_loss,e.grand_profit_loss>=0?`pos`:`neg`]])}
    </section>

    ${Ze(`Portfolio net flow trend`,t,[{label:`Money in`,color:`var(--accent-green)`},{label:`Money out`,color:`var(--accent-red)`}])}

    <section class="card">
      <h3>Update IPO allotment</h3>
      <p class="sub">Search an IPO share and update its allotted quantity after SQLite writes are enabled.</p>
      ${lr(`mobile-ipo-name-suggestions`,`Type IPO share name`,ur())}
      ${W(`New allotment`,`number`)}
      <button class="btn-secondary">Update</button>
    </section>

    <section class="card">
      <h3>Update SIP shares</h3>
      <p class="sub">Search a SIP share and update the total SIP share quantity after SQLite writes are enabled.</p>
      ${lr(`mobile-sip-name-suggestions`,`Type SIP share name`,dr())}
      ${W(`Total SIP shares`,`number`)}
      <button class="btn-secondary">Update SIP</button>
    </section>

    <section class="card">
      ${Sn(`Transaction history`,`Filter`)}
      ${Ce(`shares`,`Search by share name or type`)}
      ${nt(n,!1,`shares`)}
    </section>

    ${E(`home`,`shares-add`)}
  `}function hr(){let e=new Map;for(let t of R){let n=String(t.share_name??``).toUpperCase(),r=Number(t.allotted??0);e.set(n,(e.get(n)??0)+(t.buy_sell===`sell`?-r:r))}let t=we(`shares-portfolio`),n=[...e.entries()].filter(([,e])=>e>0).filter(([e])=>!t||e.toLowerCase().includes(t)).sort((e,t)=>e[0].localeCompare(t[0]));return n.length?`<table class="mini">
    <tr><th>Share</th><th style="text-align:right;">Qty remaining</th></tr>
    ${n.map(([e,t])=>`<tr><td>${C(e)}</td><td>${t}</td></tr>`).join(``)}
  </table>`:`<p class="sub">${t?`No shares match your search.`:`No remaining holdings.`}</p>`}function gr(){return Tn().map(e=>{let t=R.filter(t=>En(e,String(t.date??``))).reduce((e,t)=>e+Math.abs(Number(t.total_amount??0))*_r(t),0);return{label:e.label,sublabel:e.sublabel,value:t,color:`var(--accent-purple)`,signColor:!0}})}function _r(e){let t=String(e.category??``).toLowerCase(),n=String(e.buy_sell??``).toLowerCase();return t===`sip`?n===`redeem`||n===`redeemed`?1:-1:t===`sell`?1:t===`dividend`?+(n===`cash`):t===`ipo`||t===`buy`?-1:0}function vr(){let e=ot(L),t=_t(R),n=dt(Zt()),r=e.net_balance+t.grand_profit_loss+n.combined.overall_net,i=yr(e.net_balance,t.grand_profit_loss,n.combined.overall_net);return`
    <p class="eyebrow">Financial Summary</p>
    <h1 class="pagehead">Overall position</h1>
    <p class="sub">Combines Bank Services, Share Portfolio, and manual Personal Expenses — the full picture Home doesn't show.</p>

    ${G([[`Bank net`,e.net_balance,e.net_balance>=0?`pos`:`neg`],[`Share P/L`,t.grand_profit_loss,t.grand_profit_loss>=0?`pos`:`neg`],[`Expenses net`,n.combined.overall_net,n.combined.overall_net>=0?`pos`:`neg`],[`Overall net`,r,r>=0?`pos`:`neg`]])}

    ${Ze(`Net worth trend`,i,[{label:`Net ≥ 0`,color:`var(--brand-teal)`},{label:`Net < 0`,color:`var(--accent-amber)`}])}

    <section class="card">
      <h3>Where it comes from</h3>
      <table class="mini">
        <tr><th>Source</th><th style="text-align:right;">Net</th></tr>
        ${[[`Bank Services`,e.net_balance],[`Share Portfolio`,t.grand_profit_loss],[`Personal Expenses`,n.combined.overall_net]].map(([e,t])=>{let n=Number(t);return`<tr><td>${e}</td><td style="color:${n>=0?`var(--brand-teal)`:`var(--accent-amber)`};font-variant-numeric:tabular-nums;">${D(n,{sign:!0})}</td></tr>`}).join(``)}
      </table>
    </section>

    ${E(`home`)}
  `}function yr(e,t,n){let r=new Date().toISOString().slice(0,10),i=r.slice(0,7);return Tn().map(a=>{let o=(a.isDay?a.key===r:a.key===i)?e+t+n:0,s=o>=0?`var(--brand-teal)`:`var(--accent-amber)`;return{label:a.label,sublabel:a.sublabel,value:o,color:s}})}function br(){return`
    <p class="eyebrow">Transfer</p>
    <h1 class="pagehead">Cash to bank transfer</h1>
    <p class="sub">Moves money between tracked Cash and Bank flow without affecting income or expense totals.</p>
    <section class="card" data-form="transfer">
      <div class="field"><label>Date</label><input type="date" name="date"></div>
      <div class="chip-row">
        <button type="button" class="chip active" data-transfer-direction="cash-to-bank">Cash to Bank</button>
        <button type="button" class="chip" data-transfer-direction="bank-to-cash">Bank to Cash</button>
      </div>
      <div class="field"><label>Amount</label><input type="number" inputmode="decimal" name="amount"></div>
      <div class="field"><label>Note</label><input type="text" name="note"></div>
      <button class="btn-primary" data-submit style="background:var(--accent-amber);">Record transfer</button>
    </section>
    <button class="btn-secondary" data-back="expenses-add">Back to add entry</button>
  `}function xr(){return`
    <p class="eyebrow">Import / Export</p>
    <h1 class="pagehead">Import from notes</h1>
    <p class="sub">Paste any expense or income note below. Each line becomes a row for you to review before anything is saved.</p>

    <section class="card">
      <label class="field">
        <span>Raw note text</span>
        <textarea class="import-note-area" data-import-note rows="12" placeholder="Paste your expenses or income note here…" autocomplete="off" autocapitalize="sentences" spellcheck="false">${w(x.importPasteDraft)}</textarea>
      </label>
    </section>

    <div class="btn-stack">
      <button class="btn-primary btn-block" type="button" data-import-parse>Parse &amp; review</button>
      <div class="btn-row btn-row-2">
        <button class="btn-secondary" type="button" data-back>Back</button>
        <button class="btn-secondary" type="button" data-nav="home">Home</button>
      </div>
    </div>
  `}var Sr={share:`Share`,bank:`Bank`,personal:`Personal`};function Cr(){let e=x.importEntries,t=x.importReviewQuery.toLowerCase(),n=t?e.filter(e=>wr(e,t)):e,r=e.some(Tr);return`
    <p class="eyebrow">Import / Export</p>
    <h1 class="pagehead">Review parsed entries</h1>
    <p class="sub">${e.length} staged row${e.length===1?``:`s`}. Edit, split, delete, or add before committing.</p>

    <section class="card import-toolbar">
      <input class="search-input" type="search" data-import-search placeholder="Search staged entries" value="${w(x.importReviewQuery)}" autocomplete="off">
      <button class="btn-soft" type="button" data-import-add-row>+ Add row</button>
    </section>

    ${n.length===0?`<p class="sub">${t?`No staged rows match your search.`:`Nothing staged yet.`}</p>`:``}

    <div class="import-rows">
      ${n.map(e=>Er(e)).join(``)}
    </div>

    <section class="card import-summary">
      <div><span>Total</span><b class="money">${D(e.reduce((e,t)=>e+t.amount,0))}</b></div>
      <div><span>Confirmed</span><b>${e.filter(e=>!Tr(e)).length} / ${e.length}</b></div>
    </section>

    <div class="btn-stack">
      <button class="btn-primary btn-block" type="button" data-import-commit ${r?`data-disabled`:``}>Commit ${e.length} rows</button>
      <div class="btn-row btn-row-2">
        <button class="btn-secondary" type="button" data-back>Back</button>
        <button class="btn-secondary" type="button" data-nav="home">Home</button>
      </div>
    </div>
  `}function wr(e,t){return[e.label,e.description,e.category,e.date,String(e.amount),Sr[e.module]].join(` `).toLowerCase().includes(t)}function Tr(e){return e.flags.some(e=>e.kind===`ambiguous`||e.kind===`checksum`)}function Er(e){return`
    <section class="card import-row ${e.edited?`import-edited`:``}" data-import-row="${e.id}">
      <div class="import-row-head">
        <div class="import-row-title">
          <b>${C(e.label||e.description||`Untitled`)}</b>
          <span class="import-row-meta">${C(e.date)} · ${C(e.category)}</span>
        </div>
        <div class="money import-amount ${e.direction===`income`?`pos`:`neg`}">${D(e.amount,{sign:e.direction===`income`})}</div>
      </div>
      ${Dr(e.flags)}
      <div class="import-row-fields">
        <label class="field">Date<input type="date" data-import-date value="${w(e.date)}"></label>
        <label class="field">${e.module===`share`?`Share name`:`Label`}<input type="text" data-import-label value="${w(e.label)}"></label>
        <label class="field">Amount<input type="number" inputmode="decimal" value="${e.amount}"></label>
        <label class="field">Module<select data-import-module>${Or(e)}</select></label>
        <label class="field" data-import-flow-field>Flow<select data-import-flow>${kr(e)}</select></label>
        <label class="field">Type<select data-import-direction>${Ar(e)}</select></label>
        <label class="field">Category<select data-import-category>${jr(e)}</select></label>
        <label class="field full">Description<input type="text" data-import-description value="${w(e.description)}"></label>
      </div>
      <div class="import-row-actions">
        <button class="btn-soft btn-sm" type="button" data-import-confirm ${Tr(e)?``:`hidden`}>Confirm</button>
        <button class="btn-soft btn-sm" type="button" data-import-split>Split</button>
        <button class="btn-soft btn-sm" type="button" data-import-undo-split ${e.splitGroup?``:`hidden`}>Undo split</button>
        <button class="btn-soft btn-sm" type="button" data-import-delete>Delete</button>
      </div>
    </section>
  `}function Dr(e){return e.length?e.map(e=>`<span class="import-flag ${e.kind}">${C(e.message)}</span>`).join(``):``}function Or(e){return[`share`,`bank`,`personal`].map(t=>`<option value="${t}" ${e.module===t?`selected`:``}>${Sr[t]}</option>`).join(``)}function kr(e){return mn.map(t=>`<option value="${t.value}" ${e.flow===t.value?`selected`:``}>${t.label}</option>`).join(``)}function Ar(e){return hn.map(t=>`<option value="${t.value}" ${e.direction===t.value?`selected`:``}>${t.label}</option>`).join(``)}function jr(e){let t=Mr(e),n=t.includes(e.category),r=t.map(t=>`<option value="${w(t)}" ${e.category===t?`selected`:``}>${C(t)}</option>`).join(``);return(n?``:`<option value="${w(e.category)}" selected>${C(e.category||`Other`)}</option>`)+r}function Mr(e){return e.module===`bank`?U:e.module===`share`?fn:e.direction===`income`?_n:gn}var Nr=new Set(gn.map(e=>e.toLowerCase())),Pr=new Set(_n.map(e=>e.toLowerCase()));function Fr(e){let t=e.split(/\r?\n/).map(e=>e.trim()).filter(e=>e.length>0),n=[],r=[],i={dateKey:Vr(new Date),sum:0,checksum:null,label:``},a=0;for(;a<t.length;){let e=t[a],o=e.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);if(o){zr(i,n),i={dateKey:Br(+o[1],+o[2],o[3]?+o[3]:void 0),sum:0,checksum:null,label:``},r.push(e),a+=1;continue}if(e.startsWith(`=`)){let t=Hr(e.slice(1).trim());if(t!=null){i.checksum=t,r.push(e),a+=1;continue}}if(e.match(/^[\d\s]+(?:\s*[-+]\s*[\d\s]+)+\s*=\s*\d+$/)){n.push({id:Ir(),date:i.dateKey,amount:0,label:``,description:e,module:`personal`,direction:`expense`,flow:`cash`,category:`Other`,flags:[{kind:`info`,message:`Arithmetic/balance note — informational only, not imported.`}],edited:!1}),r.push(e),a+=1;continue}let s=/^([A-Za-z][\w\s.'-]*?)\s+(\d[\d,]*\.?\d*k?)((?:\s*\+\s*\d[\d,]*\.?\d*k?)*)\s*(.*)$/.exec(e);if(s&&!e.startsWith(`+`)){let t=s[1].trim(),o=[X(s[2]),...s[3].trim()===``?[]:s[3].split(`+`).map(e=>X(e.trim()))].filter(e=>e!=null&&Number.isFinite(e));if(o.length>0){let c=o.reduce((e,t)=>e+t,0),{module:l,direction:u,flow:d,category:f}=qr([t,(s[4]??``).trim()].filter(Boolean).join(` `));n.push(Y(i,c,t,t,l,u,d,f,[])),i.sum+=c,r.push(e),a+=1;continue}}if(e.includes(`+`)&&!e.startsWith(`+`)){let t=Wr(e);if(t.every(e=>e.amount!=null))for(let e of t)n.push(Y(i,e.amount,e.label,``,`personal`,`expense`,`cash`,e.label,[]));else{let r=t.reduce((e,t)=>e+(t.amount??0),0);n.push(Rr(i,e,r))}r.push(e),a+=1;continue}if(e.startsWith(`+`)){let{amount:t,rest:o}=Ur(e.replace(/^\+/,``));if(t!=null){let s=Gr(o);n.push(Y(i,t,o,``,s.module,s.direction,s.flow,s.category,[{kind:`ambiguous`,message:`Type is ambiguous — confirm the target module/type before import.`}])),r.push(e),a+=1;continue}}let{amount:c,rest:l}=Ur(e);if(c!=null){let t=/(?:^|\s)(needed|planned|to\s+buy|to\s+pay)$/i.test(l),o=l.replace(/\s*(needed|planned|to\s+buy|to\s+pay)\s*$/i,``).trim(),{module:s,direction:u,flow:d,category:f}=qr(o),p=t?[{kind:`planned`,message:`Ends with a planned/needed qualifier — intent, not actual spend.`}]:[];n.push(Y(i,c,o,o,s,u,d,f,p)),i.sum+=c,r.push(e),a+=1;continue}let u=e.match(/^([A-Za-z][\w\s.'-]*?)\s+-\s*(\d[\d.,]*k?)(?:\(([^)]*)\))?$/i);if(u){let t=u[1].trim(),o=X(u[2])??0,s=u[3]??``,{module:c,direction:l,flow:d,category:f}=qr(t);n.push(Y(i,o,t,s,c,l,d,f,[])),i.sum+=o,r.push(e),a+=1;continue}let d=/^[A-Za-z][\w\s.'-]*$/.test(e),f=t[a+1],p=f&&(f.includes(`+`)?f.split(`+`).every(e=>X(e.trim())!=null):/^\d/.test(f));if(d&&p){let t=e,o=f.split(`+`).map(e=>X(e.trim())).reduce((e,t)=>e+t,0),{module:s,direction:c,flow:l,category:u}=qr(t);n.push(Y(i,o,t,f,s,c,l,u,[])),i.sum+=o,r.push(e,f),a+=2;continue}r.push(e),a+=1}return zr(i,n),{entries:n,totalAmount:n.reduce((e,t)=>e+t.amount,0),ignoredLines:r}}function Ir(){return`keep-${Date.now().toString(36)}-${Lr+=1}`}var Lr=0;function Y(e,t,n,r,i,a,o,s,c){return{id:Ir(),date:e.dateKey,amount:t,label:n,description:r,module:i,direction:a,flow:o,category:s,flags:c,edited:!1}}function Rr(e,t,n){let r=Y(e,n,``,t,`personal`,`expense`,`cash`,`Uncategorized`,[]);return r.flags.push({kind:`lump`,message:`Couldn't reliably split this line — verify/split manually.`}),r}function zr(e,t){if(e.checksum!=null&&e.checksum!==e.sum){let n=`Checksum mismatch: parsed ₹${e.sum} vs note total ₹${e.checksum}.`;for(let r of t)r.date===e.dateKey&&r.flags.push({kind:`checksum`,message:n})}}function Br(e,t,n){let r=new Date,i=n==null?r.getFullYear():n<100?2e3+n:n,a=new Date(i,e-1,t);return n==null&&a.getTime()>r.getTime()&&a.setFullYear(i-1),Vr(a)}function Vr(e){let t=String(e.getMonth()+1).padStart(2,`0`),n=String(e.getDate()).padStart(2,`0`);return`${e.getFullYear()}-${t}-${n}`}function X(e){let t=e.trim().toLowerCase(),n=t.endsWith(`k`),r=n?t.slice(0,-1):t,i=Number(r.replace(/[,\s]/g,``));return Number.isFinite(i)?n?i*1e3:i:null}function Hr(e){return X(e.replace(/\s*[A-Za-z]+.*$/,``).trim())}function Ur(e){let t=e.match(/^(\d[\d,]*\.?\d*k?)\s*[-]?\s*(.*)$/i);if(!t)return{amount:null,rest:e};let n=X(t[1]);return n==null?{amount:null,rest:e}:{amount:n,rest:String(t[2]??``).trim()}}function Wr(e){return e.split(`+`).map(e=>{let{amount:t,rest:n}=Ur(e);return{amount:t,label:n}})}function Gr(e){let t=e.toLowerCase();return/\bsip\b|\binvestment\b|\bshare\b|\bipo\b|\bbuy\b|\bsell\b|\bdividend\b/.test(t)?{module:`share`,direction:`expense`,flow:`cash`,category:Kr(e)}:/print(ing)?/.test(t)?{module:`personal`,direction:`expense`,flow:`cash`,category:`Other`}:/registration\s*fee/.test(t)?{module:`personal`,direction:`expense`,flow:`cash`,category:`Education`}:(/\bsession\b|\bsessior\b/.test(t),{module:`personal`,direction:`expense`,flow:`cash`,category:`Other`})}function Kr(e){let t=e.toLowerCase();return/sip/.test(t)?`sip`:/sell/.test(t)?`sell`:/dividend/.test(t)?`dividend`:/buy/.test(t)?`buy`:`ipo`}function qr(e){let t=e.toLowerCase();return/registration\s*fee/.test(t)?{module:`personal`,direction:`expense`,flow:`cash`,category:`Education`}:/\bsession\b|\bsessior\b/.test(t)?{module:`personal`,direction:`expense`,flow:`cash`,category:`Other`}:/\bsip\b|\bshare\b|\bipo\b|\bbuy\b|\bsell\b|\bdividend\b|\binvestment\b/.test(t)?{module:`share`,direction:`expense`,flow:`cash`,category:Kr(e)}:U.some(e=>t.includes(e.toLowerCase()))?{module:`bank`,direction:`expense`,flow:`bank`,category:Jr(t)}:dn.has(t)||/interest\s*earned/i.test(t)?{module:`bank`,direction:`income`,flow:`bank`,category:`Interest Earned`}:/\b(travel|transport|ride|petrol|fuel|trip|vehicle)\b/.test(t)?{module:`personal`,direction:`expense`,flow:`cash`,category:`Transportation`}:/\bsalary\b/.test(t)?{module:`personal`,direction:`income`,flow:`bank`,category:`Salary`}:/earn(ed|ing)?|\bincome\b|\bbonus\b/.test(t)?{module:`personal`,direction:`income`,flow:`bank`,category:`Other Income`}:/\bgift\b/.test(t)?/\bgift\b[\s\S]*(?:lai\b|\btina\b|\btendsi\b|\bto\s+\w|\btimarau\b)/i.test(t)?{module:`personal`,direction:`expense`,flow:`cash`,category:`Gift`}:{module:`personal`,direction:`income`,flow:`bank`,category:`Gift`}:/\b(dahi|curd|fruit|milk|dudh|vegetable|veggies|sabji|tarkari|rice|bhat|chamal|dal|daal|roti|snack|cola|cake|pizza|juice|tea|coffee|egg|anda|masu|chicken|machha|noodles|biscuit|samosa|momo|paneer|puri|kheer|halwa|achaar|lassi|mithai)\b/.test(t)?{module:`personal`,direction:`expense`,flow:`cash`,category:`Food`}:Pr.has(t)?{module:`personal`,direction:`income`,flow:`bank`,category:Xr(t)}:Nr.has(t)?{module:`personal`,direction:`expense`,flow:`cash`,category:Yr(t)}:{module:`personal`,direction:`expense`,flow:`cash`,category:`Other`}}function Jr(e){return U.find(t=>e.includes(t.toLowerCase()))??`Other Charges`}function Yr(e){return Nr.has(e)?gn.find(t=>t.toLowerCase()===e):`Other`}function Xr(e){return Pr.has(e)?_n.find(t=>t.toLowerCase()===e):`Other Income`}async function Zr(e,t){let n=e=>!e.flags.some(e=>e.kind===`ambiguous`||e.kind===`checksum`),r={written:0,skipped:[]};for(let i of t){if(!n(i)){r.skipped.push(`${i.label||i.description||`(untitled)`} — needs review before commit`);continue}await Qr(e,i),r.written+=1}return r}async function Qr(e,t){let n=t.description||t.label||null;switch(t.module){case`bank`:await At(e,{date:t.date,category:t.category||`Other Charges`,amount:t.direction===`income`?t.amount:-t.amount,description:n,updated_device:b});return;case`share`:await jt(e,{date:t.date,share_name:t.label||n||`UNKNOWN`,category:`ipo`,per_unit_price:t.amount,allotted:1,buy_sell:`ipo`,total_amount:t.amount,updated_device:b});return;default:await Mt(e,{date:t.date,flow_type:t.flow,direction:t.direction,category:t.category||`Other`,amount:t.amount,description:n,source:`manual`,updated_device:b});return}}function Z(e,t={}){e!==x.activeScreen&&(t.replace?x.screenHistory[x.screenHistory.length-1]=e:x.screenHistory.push(e)),x.activeScreen=e,Q(),window.scrollTo({top:0})}function $r(e=`home`){if(x.activeScreen===`home`){let e=Date.now();if(e-x.lastHomeBackPress<1800){ge();return}x.lastHomeBackPress=e,S(`Press back again to exit`);return}x.screenHistory.pop(),Z(x.screenHistory[x.screenHistory.length-1]||e,{replace:!0})}function Q(){let e=document.querySelector(`#app`);if(!e)return;let t=x.activeScreen===`import-review`,n=t?(document.scrollingElement||document.documentElement).scrollTop:0;e.innerHTML=`
    <div class="app-shell">
      ${_e()}
      ${ve()}
      ${T(`home`,rn())}
      ${T(`bank-add`,Dn())}
      ${T(`bank-dash`,On())}
      ${T(`shares-add`,fr())}
      ${T(`shares-dash`,mr())}
      ${T(`expenses-add`,An())}
      ${T(`expenses-dash`,jn())}
      ${T(`transfer`,br())}
      ${T(`summary`,vr())}
      ${T(`settings`,Pn())}
      ${T(`settings-profile`,or())}
      ${T(`settings-import-export`,rr())}
      ${T(`settings-investment`,ir())}
      ${T(`settings-backup-sync`,tr())}
      ${T(`settings-privacy`,ar())}
      ${T(`settings-about`,In())}
      ${T(`settings-how-to-use`,nr())}
      ${T(`settings-version`,sr())}
      ${T(`import-paste`,xr())}
      ${T(`import-review`,Cr())}
    </div>
  `,ei(),requestAnimationFrame(()=>{document.querySelectorAll(`[data-scroll-end]`).forEach(e=>{e.scrollLeft=e.scrollWidth})}),t&&requestAnimationFrame(()=>{(document.scrollingElement||document.documentElement).scrollTop=n})}function ei(){Se(),document.querySelector(`[data-open-drawer]`)?.addEventListener(`click`,()=>{document.querySelector(`.drawer`)?.classList.add(`open`),document.querySelector(`.drawer-overlay`)?.classList.add(`open`)}),document.querySelector(`[data-close-drawer]`)?.addEventListener(`click`,fi),document.querySelectorAll(`[data-nav]`).forEach(e=>{e.addEventListener(`click`,()=>Z(e.dataset.nav))}),document.querySelectorAll(`[data-back]`).forEach(e=>{e.addEventListener(`click`,()=>$r(e.dataset.back||`home`))}),document.querySelectorAll(`[data-home-mode]`).forEach(e=>{e.addEventListener(`click`,()=>{x.homeMode=e.dataset.homeMode,x.categorySelectionTouched=!1,Q()})}),document.querySelectorAll(`[data-home-range]`).forEach(e=>{e.addEventListener(`click`,()=>{x.homeRange=e.dataset.homeRange,Q()})}),document.querySelectorAll(`[data-bank-range]`).forEach(e=>{e.addEventListener(`click`,()=>{x.bankRange=e.dataset.bankRange,Q()})}),document.querySelectorAll(`[data-category-check]`).forEach(e=>{e.addEventListener(`change`,di)}),document.querySelector(`[data-custom-start]`)?.addEventListener(`change`,e=>{x.customStart=e.target.value||x.customStart,Q()}),document.querySelector(`[data-custom-end]`)?.addEventListener(`change`,e=>{x.customEnd=e.target.value||x.customEnd,Q()}),document.querySelectorAll(`[data-profile-form]`).forEach(e=>{e.addEventListener(`submit`,t=>{t.preventDefault(),me(String(new FormData(e).get(`profileName`)||``)),Q()})}),document.querySelector(`[data-dismiss-profile]`)?.addEventListener(`click`,()=>{he(),Q()}),De(()=>Q()),document.querySelectorAll(`[data-expenses-tab]`).forEach(e=>{e.addEventListener(`click`,()=>{x.expensesDashTab=e.dataset.expensesTab??`combined`,Q()})}),be(),document.querySelectorAll(`[data-shares-entry-type]`).forEach(e=>{e.addEventListener(`change`,()=>{x.sharesEntryType=e.value,Q()})}),document.querySelectorAll(`[data-shares-dividend-type]`).forEach(e=>{e.addEventListener(`change`,()=>{x.sharesDividendType=e.value,Q()})}),document.querySelectorAll(`[data-shares-sip-type]`).forEach(e=>{e.addEventListener(`change`,()=>{x.sharesSipType=e.value,Q()})}),ti(),document.addEventListener(`input`,ni),mi(),_i(),yi(),document.querySelector(`[data-backup-now]`)?.addEventListener(`click`,()=>{bi()})}function ti(){document.querySelector(`[data-import-parse]`)?.addEventListener(`click`,()=>{let e=document.querySelector(`[data-import-note]`),t=e?.value.trim()??``;if(!t){ui(`Paste some note text first.`,e);return}x.importPasteDraft=t,x.importEntries=Fr(t).entries,Z(`import-review`)}),document.querySelector(`[data-import-add-row]`)?.addEventListener(`click`,()=>{x.importEntries.push(oi()),x.importReviewQuery=``,Q()}),document.querySelector(`[data-import-search]`)?.addEventListener(`input`,e=>{x.importReviewQuery=e.target.value,Q(),li()}),document.querySelector(`[data-import-commit]`)?.addEventListener(`click`,async e=>{let t=e.currentTarget;if(!t.dataset.disabled){if(x.importEntries.filter(e=>si(e)).length){S(`Confirm flagged rows before committing.`),Q();return}t.disabled=!0,t.textContent=`Committing…`;try{let e=await Zr(await N(),x.importEntries);await H(),x.importEntries=[],x.importPasteDraft=``,S(`Committed ${e.written} row${e.written===1?``:`s`}.`),Z(`settings`,{replace:!0})}catch(e){S(`Commit failed. See console.`),console.error(e),Q()}}}),document.querySelectorAll(`[data-import-row]`).forEach(e=>{let t=e.dataset.importRow??``;e.querySelector(`[data-import-confirm]`)?.addEventListener(`click`,()=>{ri(t)}),e.querySelector(`[data-import-delete]`)?.addEventListener(`click`,()=>{x.importEntries=x.importEntries.filter(e=>e.id!==t),Q()}),e.querySelector(`[data-import-split]`)?.addEventListener(`click`,()=>{ii(t)}),e.querySelector(`[data-import-undo-split]`)?.addEventListener(`click`,()=>{ai(t)})})}function ni(e){let t=e.target,n=t.closest(`[data-import-row]`);if(!n)return;let r=n.dataset.importRow??``,i=x.importEntries.find(e=>e.id===r);if(!i)return;let a=t.dataset.importDate?`date`:t.dataset.importLabel?`label`:t.dataset.importModule?`module`:t.dataset.importFlow?`flow`:t.dataset.importDirection?`direction`:t.dataset.importCategory?`category`:t.dataset.importDescription?`description`:t instanceof HTMLInputElement&&t.type===`number`?`amount`:``;if(!a)return;let o=t.value;if(a===`amount`){let e=Number(o);i.amount=Number.isFinite(e)?e:0}else a===`module`?i.module=o:a===`direction`?i.direction=o:a===`flow`?i.flow=o:a===`category`?i.category=o:a===`date`?i.date=o:a===`label`?i.label=o:a===`description`&&(i.description=o);i.edited=!0}function ri(e){let t=x.importEntries.find(t=>t.id===e);t&&(t.flags=t.flags.filter(e=>e.kind!==`ambiguous`&&e.kind!==`checksum`),Q())}function ii(e){let t=x.importEntries.find(t=>t.id===e);if(!t)return;let n=Math.floor(t.amount/2),r=t.amount-n,i=`split-${Date.now().toString(36)}`,a={...t,id:`${t.id}-s`,amount:r,splitGroup:i,flags:[],edited:!0,description:`${t.label||`Item`} (part)`};t.amount=n,t.splitGroup=i,t.flags=[],t.description=`${t.label||`Item`} (part)`,x.importEntries.splice(ci(e)+1,0,a),Q()}function ai(e){let t=x.importEntries.find(t=>t.id===e);if(!t||!t.splitGroup)return;let n=t.splitGroup,r=x.importEntries.filter(e=>e.splitGroup===n);if(r.length<2)return;let i=r.find(e=>!e.id.endsWith(`-s`))??r[0],a=r.map(e=>e.id),o=x.importEntries.findIndex(e=>e.id===a[0]),s={...i,id:i.id.endsWith(`-s`)?i.id.slice(0,-2):i.id,amount:r.reduce((e,t)=>e+t.amount,0),splitGroup:void 0,flags:[],edited:!0,description:i.label||``};x.importEntries=x.importEntries.filter(e=>e.splitGroup!==n),x.importEntries.splice(Math.max(o,0),0,s),Q()}function oi(){return{id:`manual-${Date.now().toString(36)}`,date:g(h()),amount:0,label:``,description:``,module:`personal`,direction:`expense`,flow:`cash`,category:`Other`,flags:[],edited:!0}}function si(e){return e.flags.some(e=>e.kind===`ambiguous`||e.kind===`checksum`)}function ci(e){return x.importEntries.findIndex(t=>t.id===e)}function li(){let e=document.querySelector(`[data-import-search]`);if(e){e.focus();try{e.setSelectionRange(e.value.length,e.value.length)}catch{}}}function ui(e,t){S(e),t?.classList.add(`import-error-flash`),window.setTimeout(()=>t?.classList.remove(`import-error-flash`),1200)}function di(e){let t=e.target.value,n=Array.from(document.querySelectorAll(`[data-category-check]`));if(t===`__all__`&&e.target.checked){x.categorySelectionTouched=!1,x.selectedHomeCategories=new Set(an()),Q();return}let r=n.filter(e=>e.value!==`__all__`&&e.checked).map(e=>e.value);r.length?(x.categorySelectionTouched=!0,x.selectedHomeCategories=new Set(r)):(x.categorySelectionTouched=!1,x.selectedHomeCategories=new Set(on())),Q()}function fi(){document.querySelector(`.drawer`)?.classList.remove(`open`),document.querySelector(`.drawer-overlay`)?.classList.remove(`open`)}var $=null;async function pi(){try{let e=await N();await Yt({seedIfEmpty:!0});try{await $n(e)}catch(e){console.warn(`[storage] maintenance failed`,e)}}catch(e){console.warn(`[boot] SQLite unavailable; using demo store`,e),$=`Persistence is unavailable here — showing demo data. Install on a device for real storage.`;try{await Xt()}catch(e){console.error(`[boot] demo fallback failed`,e)}}xi(),Q()}function mi(){document.querySelectorAll(`[data-form]`).forEach(e=>{e.querySelector(`[data-submit]`)?.addEventListener(`click`,t=>{t.preventDefault(),hi(e)})})}async function hi(e){if(!z||!B){S($??`Persistence is not ready yet.`);return}let t=e.dataset.form??``,n=t=>{let n=e.querySelector(`[name="${t}"]`);return n?String(n.value??``).trim():``},r=e=>{let t=Number(n(e));return Number.isFinite(t)?t:0},i=e.querySelector(`[data-submit]`);i&&(i.disabled=!0,i.textContent=`Saving…`);let a=await N();try{let i=`home`;switch(t){case`bank-add`:await At(a,{date:n(`date`),category:n(`category`)||`Other Charges`,amount:r(`amount`),description:n(`description`)||null,updated_device:b}),i=`bank-dash`;break;case`expenses-add`:await Mt(a,{date:n(`date`),flow_type:n(`flow`)===`Cash Flow`?`cash`:`bank`,direction:n(`type`)===`Income`?`income`:`expense`,category:n(`category`)||`Other`,amount:r(`amount`),description:n(`description`)||null,source:`manual`,updated_device:b}),i=`expenses-dash`;break;case`shares-add`:await gi(a,e,n,r),i=`shares-dash`;break;case`transfer`:{let t=e.querySelector(`.chip.active[data-transfer-direction]`)?.dataset.transferDirection;if(t!==`bank-to-cash`&&t!==`cash-to-bank`)throw Error(`Choose a transfer direction.`);await Nt(a,{date:n(`date`),from_flow:t===`cash-to-bank`?`cash`:`bank`,to_flow:t===`cash-to-bank`?`bank`:`cash`,amount:r(`amount`),description:n(`note`)||null,updated_device:b}),i=`expenses-dash`;break}default:throw Error(`Unknown form: ${t}`)}await H(),S(`Saved`),Z(i)}catch(e){console.error(`[submit] failed`,e),S(`Could not save: ${e instanceof Error?e.message:`unknown error`}`),Q()}}async function gi(e,t,n,r){let i=t.querySelector(`[data-shares-entry-type]`)?.value??``,a=n(`share_name`).toUpperCase();if(!a)throw Error(`Share name is required.`);let o={date:n(`date`),share_name:a,updated_device:b},s=t=>jt(e,{...o,...t});switch(i){case`ipo`:await s({category:`ipo`,buy_sell:`ipo`,per_unit_price:r(`per_unit_price`),allotted:r(`allotted`)});return;case`sip`:{let e=t.querySelector(`[data-shares-sip-type]`)?.value??`installment`,n=r(`sip_amount`);await s({category:`sip`,buy_sell:e===`redeem`?`redeem`:`installment`,per_unit_price:n,total_amount:n});return}case`buy`:case`sell`:{let e=r(`total_amount`),t=r(`quantity`);await s({category:i,buy_sell:i,per_unit_price:t>0?e/t:0,allotted:t,total_amount:e});return}case`dividend`:(t.querySelector(`[data-shares-dividend-type]`)?.value??`cash`)===`bonus`?await s({category:`dividend`,buy_sell:`bonus`,per_unit_price:0,allotted:r(`dividend_shares`)}):await s({category:`dividend`,buy_sell:`cash`,per_unit_price:r(`dividend_amount`)});return;default:throw Error(`Unknown entry type: ${i}`)}}function _i(){document.querySelectorAll(`[data-delete]`).forEach(e=>{e.addEventListener(`click`,()=>{vi(e)})})}async function vi(e){if(!z||!B){S($??`Persistence is not ready yet.`);return}let t=e.dataset.table,n=Number(e.dataset.id);if(!(!t||!Number.isFinite(n))&&window.confirm(`Delete this entry?`))try{let e=await N();switch(t){case`bank_transactions`:await Pt(e,n);break;case`share_transactions`:await Ft(e,n);break;case`personal_finance_bank_flow`:await It(e,n,`bank`);break;case`personal_finance_cash_flow`:await It(e,n,`cash`);break;case`transfers`:await Lt(e,n);break;default:throw Error(`Unknown table: ${t}`)}await H(),S(`Deleted`),Q()}catch(e){console.error(`[delete] failed`,e),S(`Delete failed. See console.`)}}function yi(){let e=document.querySelector(`[data-form='transfer']`);e&&e.querySelectorAll(`[data-transfer-direction]`).forEach(t=>{t.addEventListener(`click`,()=>{e.querySelectorAll(`.chip`).forEach(e=>e.classList.remove(`active`)),t.classList.add(`active`)})})}async function bi(){if(!z||!B){S($??`Persistence is not ready yet.`);return}try{let e=await $n(await N());await er(),S(e.backup.status===`done`?`Saved + backed up ${e.backup.newRows} new row(s) for ${e.backup.date}.`:e.backup.status===`error`?`Backup failed: ${e.backup.error??`unknown error`}`:`Already backed up for ${e.backup.date}.`),Q()}catch(e){console.error(`[backup] failed`,e),S(`Backup failed. See console.`)}}function xi(){ie.addListener(`backButton`,()=>{if(document.querySelector(`.drawer.open`)){fi();return}$r()}).catch(()=>{window.addEventListener(`popstate`,()=>$r())})}document.addEventListener(`resume`,()=>{(async()=>{if(!(!z||!B))try{await $n(await N())}catch(e){console.warn(`[storage] resume maintenance failed`,e)}})()}),pi();export{o as n,p as r,Vn as t};