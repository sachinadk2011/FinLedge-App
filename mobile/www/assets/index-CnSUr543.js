(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e;(function(e){e.Unimplemented=`UNIMPLEMENTED`,e.Unavailable=`UNAVAILABLE`})(e||={});var t=class extends Error{constructor(e,t,n){super(e),this.message=e,this.code=t,this.data=n}},n=e=>e?.androidBridge?`android`:e?.webkit?.messageHandlers?.bridge?`ios`:`web`,r=r=>{let i=r.CapacitorCustomPlatform||null,a=r.Capacitor||{},o=a.Plugins=a.Plugins||{},s=()=>i===null?n(r):i.name,c=()=>s()!==`web`,l=e=>!!(f.get(e)?.platforms.has(s())||u(e)),u=e=>a.PluginHeaders?.find(t=>t.name===e),d=e=>r.console.error(e),f=new Map;return a.convertFileSrc||=e=>e,a.getPlatform=s,a.handleError=d,a.isNativePlatform=c,a.isPluginAvailable=l,a.registerPlugin=(n,r={})=>{let c=f.get(n);if(c)return console.warn(`Capacitor plugin "${n}" already registered. Cannot register plugins twice.`),c.proxy;let l=s(),d=u(n),p,m=async()=>(!p&&l in r?p=p=typeof r[l]==`function`?await r[l]():r[l]:i!==null&&!p&&`web`in r&&(p=p=typeof r.web==`function`?await r.web():r.web),p),h=(r,i)=>{if(d){let e=d?.methods.find(e=>i===e.name);if(e)return e.rtype===`promise`?e=>a.nativePromise(n,i.toString(),e):(e,t)=>a.nativeCallback(n,i.toString(),e,t);if(r)return r[i]?.bind(r)}else if(r)return r[i]?.bind(r);else throw new t(`"${n}" plugin is not implemented on ${l}`,e.Unimplemented)},g=r=>{let i,a=(...a)=>{let o=m().then(o=>{let s=h(o,r);if(s){let e=s(...a);return i=e?.remove,e}throw new t(`"${n}.${r}()" is not implemented on ${l}`,e.Unimplemented)});return r===`addListener`&&(o.remove=async()=>i()),o};return a.toString=()=>`${r.toString()}() { [capacitor code] }`,Object.defineProperty(a,"name",{value:r,writable:!1,configurable:!1}),a},_=g(`addListener`),v=g(`removeListener`),y=(e,t)=>{let n=_({eventName:e},t),r=async()=>{let r=await n;v({eventName:e,callbackId:r},t)},i=new Promise(e=>n.then(()=>e({remove:r})));return i.remove=async()=>{console.warn(`Using addListener() without 'await' is deprecated.`),await r()},i},b=new Proxy({},{get(e,t){switch(t){case`$$typeof`:return;case`toJSON`:return()=>({});case`addListener`:return d?y:_;case`removeListener`:return v;default:return g(t)}}});return o[n]=b,f.set(n,{name:n,proxy:b,platforms:new Set([...Object.keys(r),...d?[l]:[]])}),b},a.Exception=t,a.DEBUG=!!a.DEBUG,a.isLoggingEnabled=!!a.isLoggingEnabled,a},i=(e=>e.Capacitor=r(e))(typeof globalThis<`u`?globalThis:typeof self<`u`?self:typeof window<`u`?window:typeof global<`u`?global:{}),a=i.registerPlugin,o=class{constructor(){this.listeners={},this.retainedEventArguments={},this.windowListeners={}}addListener(e,t){let n=!1;this.listeners[e]||(this.listeners[e]=[],n=!0),this.listeners[e].push(t);let r=this.windowListeners[e];return r&&!r.registered&&this.addWindowListener(r),n&&this.sendRetainedArgumentsForEvent(e),Promise.resolve({remove:async()=>this.removeListener(e,t)})}async removeAllListeners(){this.listeners={};for(let e in this.windowListeners)this.removeWindowListener(this.windowListeners[e]);this.windowListeners={}}notifyListeners(e,t,n){let r=this.listeners[e];if(!r){if(n){let n=this.retainedEventArguments[e];n||=[],n.push(t),this.retainedEventArguments[e]=n}return}r.forEach(e=>e(t))}hasListeners(e){return!!this.listeners[e]?.length}registerWindowListener(e,t){this.windowListeners[t]={registered:!1,windowEventName:e,pluginEventName:t,handler:e=>{this.notifyListeners(t,e)}}}unimplemented(t=`not implemented`){return new i.Exception(t,e.Unimplemented)}unavailable(t=`not available`){return new i.Exception(t,e.Unavailable)}async removeListener(e,t){let n=this.listeners[e];if(!n)return;let r=n.indexOf(t);this.listeners[e].splice(r,1),this.listeners[e].length||this.removeWindowListener(this.windowListeners[e])}addWindowListener(e){window.addEventListener(e.windowEventName,e.handler),e.registered=!0}removeWindowListener(e){e&&(window.removeEventListener(e.windowEventName,e.handler),e.registered=!1)}sendRetainedArgumentsForEvent(e){let t=this.retainedEventArguments[e];t&&(delete this.retainedEventArguments[e],t.forEach(t=>{this.notifyListeners(e,t)}))}},s=e=>encodeURIComponent(e).replace(/%(2[346B]|5E|60|7C)/g,decodeURIComponent).replace(/[()]/g,escape),c=e=>e.replace(/(%[\dA-F]{2})+/gi,decodeURIComponent),l=class extends o{async getCookies(){let e=document.cookie,t={};return e.split(`;`).forEach(e=>{if(e.length<=0)return;let[n,r]=e.replace(/=/,`CAP_COOKIE`).split(`CAP_COOKIE`);n=c(n).trim(),r=c(r).trim(),t[n]=r}),t}async setCookie(e){try{let t=s(e.key),n=s(e.value),r=e.expires?`; expires=${e.expires.replace(`expires=`,``)}`:``,i=(e.path||`/`).replace(`path=`,``),a=e.url!=null&&e.url.length>0?`domain=${e.url}`:``;document.cookie=`${t}=${n||``}${r}; path=${i}; ${a};`}catch(e){return Promise.reject(e)}}async deleteCookie(e){try{document.cookie=`${e.key}=; Max-Age=0`}catch(e){return Promise.reject(e)}}async clearCookies(){try{let e=document.cookie.split(`;`)||[];for(let t of e)document.cookie=t.replace(/^ +/,``).replace(/=.*/,`=;expires=${new Date().toUTCString()};path=/`)}catch(e){return Promise.reject(e)}}async clearAllCookies(){try{await this.clearCookies()}catch(e){return Promise.reject(e)}}};a(`CapacitorCookies`,{web:()=>new l});var u=async e=>new Promise((t,n)=>{let r=new FileReader;r.onload=()=>{let e=r.result;t(e.indexOf(`,`)>=0?e.split(`,`)[1]:e)},r.onerror=e=>n(e),r.readAsDataURL(e)}),d=(e={})=>{let t=Object.keys(e);return Object.keys(e).map(e=>e.toLocaleLowerCase()).reduce((n,r,i)=>(n[r]=e[t[i]],n),{})},f=(e,t=!0)=>e?Object.entries(e).reduce((e,n)=>{let[r,i]=n,a,o;return Array.isArray(i)?(o=``,i.forEach(e=>{a=t?encodeURIComponent(e):e,o+=`${r}=${a}&`}),o.slice(0,-1)):(a=t?encodeURIComponent(i):i,o=`${r}=${a}`),`${e}&${o}`},``).substr(1):null,p=(e,t={})=>{let n=Object.assign({method:e.method||`GET`,headers:e.headers},t),r=d(e.headers)[`content-type`]||``;if(typeof e.data==`string`)n.body=e.data;else if(r.includes(`application/x-www-form-urlencoded`)){let t=new URLSearchParams;for(let[n,r]of Object.entries(e.data||{}))t.set(n,r);n.body=t.toString()}else if(r.includes(`multipart/form-data`)||e.data instanceof FormData){let t=new FormData;if(e.data instanceof FormData)e.data.forEach((e,n)=>{t.append(n,e)});else for(let n of Object.keys(e.data))t.append(n,e.data[n]);n.body=t;let r=new Headers(n.headers);r.delete(`content-type`),n.headers=r}else(r.includes(`application/json`)||typeof e.data==`object`)&&(n.body=JSON.stringify(e.data));return n},m=class extends o{async request(e){let t=p(e,e.webFetchExtra),n=f(e.params,e.shouldEncodeUrlParams),r=n?`${e.url}?${n}`:e.url,i=await fetch(r,t),a=i.headers.get(`content-type`)||``,{responseType:o=`text`}=i.ok?e:{};a.includes(`application/json`)&&(o=`json`);let s,c;switch(o){case`arraybuffer`:case`blob`:c=await i.blob(),s=await u(c);break;case`json`:s=await i.json();break;default:s=await i.text()}let l={};return i.headers.forEach((e,t)=>{l[t]=e}),{data:s,headers:l,status:i.status,url:i.url}}async get(e){return this.request(Object.assign(Object.assign({},e),{method:`GET`}))}async post(e){return this.request(Object.assign(Object.assign({},e),{method:`POST`}))}async put(e){return this.request(Object.assign(Object.assign({},e),{method:`PUT`}))}async patch(e){return this.request(Object.assign(Object.assign({},e),{method:`PATCH`}))}async delete(e){return this.request(Object.assign(Object.assign({},e),{method:`DELETE`}))}};a(`CapacitorHttp`,{web:()=>new m});var h=`modulepreload`,g=function(e){return`/`+e},_={},v=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=g(t,n),t=s(t),t in _)return;_[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:h,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},y=a(`App`,{web:()=>v(()=>import(`./web-BuZfgLlK.js`).then(e=>new e.AppWeb),[])});function b(){return new Date}function x(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}`}function S(e){let[t,n,r]=e.split(`-`).map(Number);return new Date(t,n-1,r)}function C(e,t){let n=new Date(e);return n.setDate(n.getDate()+t),n}function ee(e,t){let n=S(e).getTime(),r=S(t).getTime();return Math.floor((r-n)/864e5)+1}function te(e){return x(e).slice(0,7)}function w(e){return e.toLocaleString(`en-US`,{month:`long`})}var ne=`mobile-local`,T=`mobile-v1.0.0`,E=`finledge.mobile.profileName`,D=`finledge.mobile.profilePromptDismissed`,O={activeScreen:`home`,screenHistory:[`home`],lastHomeBackPress:0,homeMode:`expense`,homeRange:`week`,selectedHomeCategories:new Set,categorySelectionTouched:!1,customStart:x(new Date(b().getFullYear(),b().getMonth(),1)),customEnd:x(b())};function re(){let e=new Date().getHours();return e<12?`Good morning`:e<17?`Good afternoon`:`Good evening`}function k(){return window.localStorage.getItem(E)?.trim()||``}function ie(){return(k()||`F`).slice(0,1).toUpperCase()}function ae(){return!k()&&!window.localStorage.getItem(D)}function oe(e){let t=e.trim();t&&(window.localStorage.setItem(E,t),window.localStorage.setItem(D,`1`))}function se(){window.localStorage.setItem(D,`1`)}function ce(e){document.querySelector(`.toast`)?.remove();let t=document.createElement(`div`);t.className=`toast`,t.textContent=e,document.body.appendChild(t),window.setTimeout(()=>t.remove(),1600)}function le(){y.exitApp()}var ue=[`Interest Earned`,`Interest Tax`,`Mobile Banking Charge`,`Debit Card Charge`,`Cheque Book`,`Locker`,`Demat Renewal`,`Demat & MeroShare Renewal`,`Broker Renewal`,`MeroShare Renewal`,`Other Charges`],de=[`ipo`,`sip`,`buy`,`sell`,`dividend`],fe={ipo:`IPO entry`,sip:`SIP investment`,buy:`Secondary buy`,sell:`Sell shares`,dividend:`Dividend`},pe=[{value:`bank`,label:`Bank Flow`},{value:`cash`,label:`Cash Flow`}],me=[{value:`expense`,label:`Expense`},{value:`income`,label:`Income`}],he=[`Food`,`Transportation`,`Entertainment`,`Shopping`,`Health`,`Education`,`Bills`,`Rent`,`Travel`,`Insurance`,`Investment`,`SIP`,`Share Market`,`Other`],ge=[`Salary`,`Freelance`,`Business`,`Prize/Lottery`,`Gift`,`Refund`,`Investment Income`,`Investment Return`,`Dividend`,`Share Sell Proceeds`,`Other Income`];function A(e,t={}){let n=Math.abs(e).toLocaleString(`en-US`,{maximumFractionDigits:2});return t.sign?`${e>=0?`+`:`-`}Rs ${n}`:`Rs ${n}`}function j(e){let t=e<0?`-`:``,n=Math.abs(e);return n>=1e5?`${t}${(n/1e5).toFixed(n%1e5==0?0:1)}L`:n>=1e3?`${t}${(n/1e3).toFixed(n%1e3==0?0:1)}k`:`${t}${n.toLocaleString(`en-US`,{maximumFractionDigits:0})}`}function M(e,t){return`<main class="screen ${O.activeScreen===e?`active`:``}" data-screen="${e}">${t}</main>`}function _e(){let e=k();return`
    <header class="topbar">
      <button class="icon-btn" data-open-drawer aria-label="Open navigation"><span class="hamburger-lines"></span></button>
      <div class="brand brand-centered brand-logo"><img class="brand-logo-img" src="./icon.png" alt="FinLedge logo"><div class="brand-text"><b>FinLedge</b><span>${re()}${e?`, ${e}`:``}</span></div></div>
      <button class="avatar" data-nav="settings" aria-label="Open profile">${ie()}</button>
    </header>
  `}function ve(){return`
    <div class="drawer-overlay" data-close-drawer></div>
    <nav class="drawer" aria-label="Mobile navigation">
      <div class="drawer-head"><img class="mark mark-img" src="./icon.png" alt="FinLedge logo"><div class="brand-text"><b>FinLedge</b><span>${T} / ${ne}</span></div></div>
      ${[[`home`,`Home`,`🏠`,[`home`]],[`bank-add`,`Bank Services`,`🏦`,[`bank-add`,`bank-dash`]],[`shares-add`,`Share Portfolio`,`📈`,[`shares-add`,`shares-dash`]],[`expenses-add`,`Personal Expenses`,`💳`,[`expenses-add`,`expenses-dash`,`transfer`]],[`summary`,`Financial Summary`,`📊`,[`summary`]],[`settings`,`Settings`,`⚙`,[`settings`,`settings-profile`,`settings-import-export`,`settings-investment`,`settings-backup-sync`,`settings-privacy`,`settings-about`,`settings-how-to-use`,`settings-version`]]].map(([e,t,n,r])=>`<button class="drawer-item ${r.includes(O.activeScreen)?`active`:``}" data-nav="${e}"><span>${n}</span>${t}</button>`).join(``)}
    </nav>
  `}function N(e,t){return`<div class="btn-row"><button class="btn-secondary" data-back="${e}">Back</button><button class="btn-secondary" data-nav="home">Home</button><button class="btn-secondary active" data-nav="${t}">${t.endsWith(`dash`)?`View dashboard`:`Add entry`}</button></div>`}function ye(e,t,n,r,i){return`<p class="eyebrow">${e}</p><h1 class="pagehead">${t}</h1><p class="sub">Stored locally on this device.</p>${P(n,r)}${N(`home`,i)}`}function P(e,t){return`<section class="card">${e.map(([e,t,n])=>F(e,t,n)).join(``)}<button class="btn-primary">${t}</button></section>`}function F(e,t,n){return`<div class="field"><label>${e}</label>${t===`select`?`<select>${be(e,n)}</select>`:`<input type="${t}" ${t===`number`?`inputmode="decimal"`:``}>`}</div>`}function be(e,t=`Other`){return({Category:ue.includes(t)?ue:[...he,...ge],"Entry type":de,Flow:pe.map(e=>e.label),Type:me.map(e=>e.label),"Dividend Type":[`cash`,`bonus`],"SIP type":[`installment`,`redeem`]}[e]||[t,`Other`]).map(e=>`<option value="${e}">${fe[e]||e}</option>`).join(``)}function I(e,t,n,r,i){return`<p class="eyebrow">${e}</p><h1 class="pagehead">${t}</h1><div class="stat-grid card">${n.map(([e,t,n])=>`<div class="stat-box"><div class="label">${e}</div><div class="value money ${n}">${A(t,{sign:n===`pos`||n===`neg`})}</div></div>`).join(``)}</div>${r}${N(`home`,i)}`}function L(e,t=!0){let n=e.length?e.map(e=>{let t=Number(e.amount??0)>=0?`income`:`expense`,n=String(e.direction??t),r=Number(e.amount??0);return`<div class="history-row"><div><b>${String(e.description??e.category??`Entry`)}</b><span>${String(e.category??``)} / ${String(e.flow_type??``)} / ${String(e.date??``)}</span></div><div class="money ${n===`income`?`pos`:`neg`}">${A(r,{sign:!0})}</div></div>`}).join(``):`<p class="sub">No entries match this view yet.</p>`;return t?`<section class="card">${n}</section>`:n}function R(e,t={wrap:!0}){let n=`
      <h3>Mobile period view</h3>
      <div class="segmented graph-tabs">
        ${e.map(e=>`<button class="${O.homeRange===e?`active`:``}" data-home-range="${e}">${e[0].toUpperCase()}${e.slice(1)}</button>`).join(``)}
      </div>
      ${O.homeRange===`custom`?`<div class="custom-range"><label>From<input type="date" value="${O.customStart}" data-custom-start></label><label>To<input type="date" value="${O.customEnd}" data-custom-end></label></div>`:``}
  `;return t.wrap===!1?`<div class="period-controls compact-card">${n}</div>`:`<section class="card compact-card">${n}</section>`}function xe(e){let t=we(e);if(typeof t==`string`)return`<p class="sub range-warning">${t}</p>`;let n=Math.max(...t.flatMap(e=>[e.income,e.expense,Math.abs(e.net)]),1),r=Math.max(320,t.length*78);return`
    <div class="chart-scroll">
      <div class="period-bars" style="grid-template-columns:repeat(${t.length}, 68px);min-width:${r}px;">
        ${t.map(e=>Ce(e,n)).join(``)}
      </div>
    </div>
    <div class="chart-legend"><span><i class="legend-income"></i>Income</span><span><i class="legend-expense"></i>Expense</span><span><i class="legend-net"></i>Net balance</span></div>
  `}function Se(e){let t=new Map;for(let n of e){let e=String(n.category??`Other`);t.set(e,(t.get(e)??0)+Number(n.amount??0))}let n=[...t.entries()].sort((e,t)=>t[1]-e[1]).slice(0,5);if(!n.length)return`<p class="sub">Nothing to show for the selected ${O.homeMode} categories yet.</p>`;let r=Math.max(...n.map(([,e])=>e),1),i=O.homeMode===`income`?`pos`:`neg`,a=O.homeMode===`income`?`var(--accent-green)`:`var(--accent-red)`;return n.map(([e,t])=>`<div class="history-row"><b>${e}</b><span class="money ${i}">${j(t)}</span></div><div class="category-meter"><i style="width:${Math.max(8,t/r*100)}%;background:${a};"></i></div>`).join(``)}function Ce(e,t){let n=e.net>=0?`pos`:`neg`;return`
    <div class="period-group">
      <div class="period-sticks">
        ${z(e.income,t,`income`)}
        ${z(e.expense,t,`expense`)}
        ${z(Math.abs(e.net),t,e.net>=0?`net-pos`:`net-neg`,j(e.net),n)}
      </div>
      <span>${e.label}</span>
    </div>
  `}function z(e,t,n,r=j(e),i=e>=0?`pos`:`neg`){return`<div class="mini-bar ${n}"><em class="${i}">${r}</em><i style="height:${Math.max(10,e/t*78)}%;"></i></div>`}function we(e){let t=b();if(O.homeRange===`week`)return B(e,C(t,-6),t);if(O.homeRange===`month`)return B(e,new Date(t.getFullYear(),t.getMonth(),1),t);if(O.homeRange===`year`){let n=Array.from({length:12},(e,n)=>V(new Date(t.getFullYear(),n,1).toLocaleString(`en-US`,{month:`short`}),`${t.getFullYear()}-${String(n+1).padStart(2,`0`)}`));for(let t of e){let e=n.find(e=>e.key===String(t.date).slice(0,7));e&&H(e,t)}return n}let n=ee(O.customStart,O.customEnd);return n<1?`Choose an end date after the start date.`:n>120?`Custom graph range supports up to 120 days.`:B(e,S(O.customStart),S(O.customEnd))}function B(e,t,n){let r=[];for(let e=new Date(t);e<=n;e=C(e,1)){let t=x(e);r.push(V(String(e.getDate()),t))}for(let t of e){let e=r.find(e=>e.key===String(t.date));e&&H(e,t)}return r}function V(e,t){return{label:e,key:t,income:0,expense:0,net:0}}function H(e,t){let n=Number(t.amount||0);t.direction===`income`?(e.income+=n,e.net+=n):(e.expense+=n,e.net-=n)}var Te=[`Interest Earned`,`Interest Tax`,`Mobile Banking Charge`,`Debit Card Charge`,`Cheque Book`,`Locker`,`Demat Renewal`,`Demat & MeroShare Renewal`,`Broker Renewal`,`MeroShare Renewal`,`Other Charges`],Ee=new Set([`interest earned`,`income`]);function U(e){if(e==null||e===``)return 0;let t=Number(e);return Number.isFinite(t)?t:0}function De(e){return Ee.has(e.trim().toLowerCase())}function W(e){let t=0,n=0,r=Object.fromEntries(Te.map(e=>[e,0]));for(let i of e){let e=String(i.category??``).trim(),a=U(i.amount);if(De(e))t+=a,e in r?r[e]+=a:e&&(r[e]=(r[e]??0)+a);else{let t=Math.abs(a);n+=t,e&&(r[e]=(r[e]??0)+t)}}return{total_income:t,total_expenses:n,net_balance:t-n,category_totals:r}}function Oe(e,t){let n=U(t);return e===`income`?n:-n}function ke(e){let t=String(e.category??``).trim().toLowerCase(),n=String(e.buy_sell??``).trim().toLowerCase();return t===`ipo`||t===`buy`?[`expense`,`Investment Expense`]:t===`sip`&&(n===`redeem`||n===`redeemed`)?[`income`,`Investment Income`]:t===`sip`?[`expense`,`Investment Expense`]:t===`sell`||t===`dividend`&&n===`cash`?[`income`,`Investment Income`]:null}function Ae(e){let t=new Map([[`ipo:ipo`,`IPO`],[`buy:buy`,`Secondary buy`],[`sell:sell`,`Share sell`],[`sip:installment`,`SIP installment`],[`sip:redeem`,`SIP redeem`],[`sip:redeemed`,`SIP redeem`],[`dividend:cash`,`Cash dividend`]]),n=[];for(let r of e){let e=ke(r),i=Math.abs(U(r.total_amount));if(!e||i<=0)continue;let[a,o]=e,s=String(r.category??``).trim().toLowerCase(),c=String(r.buy_sell??``).trim().toLowerCase(),l=Number(r.id??0),u=String(r.share_name??``).trim().toUpperCase(),d=t.get(`${s}:${c}`)??Pe(s);n.push({id:`share-${l}`,display_id:`S-${l}`,date:String(r.date??``),flow_type:`bank`,direction:a,category:o,amount:i,signed_amount:Oe(a,i),description:`${d}: ${u}`,source:`share-sync`,timestamp:String(r.timestamp??``),source_ref:String(r.sync_ref??`share:${l}`)})}return n}function je(e){let t=[];for(let n of e){let e=String(n.category??``).trim(),r=Math.abs(U(n.amount));if(r<=0)continue;let i=De(e)?`income`:`expense`,a=i===`income`?`Interest Earned`:`Service Cost`,o=Number(n.id??0),s=String(n.description??``).trim(),c=e||a;t.push({id:`bank-services-${o}`,display_id:`BS-${o}`,date:String(n.date??``),flow_type:`bank`,direction:i,category:a,amount:r,signed_amount:Oe(i,r),description:`${c}${s?`: ${s}`:``}`,source:`bank-services-sync`,timestamp:String(n.timestamp??``),source_ref:`bank-services:${o}`})}return t}function Me(e){let t={bank:Ne(),cash:Ne()};for(let n of e){let e=String(n.flow_type??``).trim().toLowerCase();if(e!==`bank`&&e!==`cash`)continue;let r=String(n.direction??``).trim().toLowerCase(),i=String(n.category??``).trim()||`Uncategorized`,a=Math.abs(U(n.amount)),o=String(n.source??`manual`).trim().toLowerCase(),s=i.toLowerCase(),c=t[e];r===`income`?(c.total_income+=a,c.income_breakdown[i]=(c.income_breakdown[i]??0)+a,e===`bank`&&o===`bank-services-sync`?c.interest_earned+=a:e===`bank`&&s===`investment income`?c.investment_income+=a:c.income+=a):(c.total_expenses+=a,c.expense_breakdown[i]=(c.expense_breakdown[i]??0)+a,e===`bank`&&o===`bank-services-sync`?c.service_cost+=a:e===`bank`&&[`investment expense`,`investment`,`sip`,`share market`].includes(s)?c.investment_expense+=a:c.expenses+=a)}for(let e of Object.values(t))e.net=e.total_income-e.total_expenses;let n={overall_income:t.bank.total_income+t.cash.total_income,overall_expenses:t.bank.total_expenses+t.cash.total_expenses,overall_net:0,bank:t.bank,cash:t.cash};return n.overall_net=n.overall_income-n.overall_expenses,{bank:t.bank,cash:t.cash,combined:n}}function Ne(){return{income:0,expenses:0,investment_expense:0,investment_income:0,interest_earned:0,service_cost:0,total_income:0,total_expenses:0,net:0,income_breakdown:{},expense_breakdown:{}}}function Pe(e){return e&&`${e.charAt(0).toUpperCase()}${e.slice(1)}`}function Fe(e){let t=Number(e??0);return Number.isFinite(t)?Math.trunc(t):0}function Ie(e,t){let n=t,r=0;for(let t of e){if(n<=0)break;let e=t.qty,i=Math.min(e,n);if(r+=i*t.price,e>0&&t.asba!==0){let n=t.asba*(i/e);r+=n,t.asba-=n}t.qty=e-i,n-=i}if(n>0)throw Error(`Not enough available quantity to sell for this share.`);return r}function Le(e){let t=0,n=new Map,r=new Map;return e.map(e=>{let i=String(e.share_name??``).trim(),a=i.toLowerCase(),o=String(e.category??``).trim().toLowerCase(),s=U(e.per_unit_price),c=Fe(e.allotted),l=String(e.buy_sell??``).trim().toLowerCase(),u=o===`ipo`?5:0,d=0,f=0;if(o===`dividend`)l===`cash`&&(d=s,f=d);else if(o===`sip`){let t=l===`sip`?`installment`:l,n=U(e.total_amount);if(d=n>0?n:c>0?s*c:s,t===`redeem`){let e=r.get(a)??0;f=d-e,r.set(a,0),s=d,l=`redeem`}else r.set(a,(r.get(a)??0)+d),l=`installment`,s=c>0?d/c:d}else d=s*c+u;if(o===`ipo`||o===`buy`||o===`dividend`&&l===`bonus`){if(a){let e=n.get(a)??[];e.push({qty:c,price:o===`dividend`?0:s,asba:o===`ipo`?u:0}),n.set(a,e)}}else if(o===`sell`&&c>0){let e=Ie(n.get(a)??[],c);f=d-e}return t+=f,{id:e.id,date:String(e.date??``),share_name:i,category:o,per_unit_price:s,asba_charge:u,allotted:c,buy_sell:l,total_amount:d,profit_loss:f,cumulative_profit:t,timestamp:e.timestamp,sync_ref:e.sync_ref}})}function Re(e){let t=0,n=0,r=0,i=0,a=0,o=0,s=0,c=0;for(let l of e){let e=String(l.category??``).trim().toLowerCase(),u=String(l.buy_sell??``).trim().toLowerCase(),d=U(l.total_amount),f=U(l.profit_loss);e===`ipo`?t+=d:e===`sip`&&(u===`redeem`||u===`redeemed`)?(r+=d,i+=f):e===`sip`?n+=d:e===`buy`?a+=d:e===`sell`?(o+=d,s+=f):e===`dividend`&&u===`cash`&&(c+=d)}let l=t+a,u=s+c-l,d=l+n;return{total_ipo_investment:t,total_sip_investment:n,total_sip_redeemed:r,sip_profit_loss:i,total_buy_amount:a,overall_investment:l,total_sell_amount:o,total_dividend:c,total_profit:s,overall_profit_loss:u,grand_total_investment:d,grand_profit_loss:u+i}}var G=[{id:1,date:`2026-08-01`,category:`Interest Earned`,amount:820,description:`Savings`,timestamp:`2026-08-01T09:00:00`},{id:2,date:`2026-08-04`,category:`Mobile Banking Charge`,amount:-25,description:`Monthly`,timestamp:`2026-08-04T09:00:00`},{id:3,date:`2026-08-10`,category:`Demat Renewal`,amount:-150,description:`Renewal`,timestamp:`2026-08-10T09:00:00`}],K=Le([{id:1,date:`2026-08-03`,share_name:`NABIL`,category:`ipo`,per_unit_price:100,allotted:10,buy_sell:`ipo`,timestamp:`2026-08-03T10:00:00`},{id:2,date:`2026-08-06`,share_name:`NABIL`,category:`sell`,per_unit_price:160,allotted:4,buy_sell:`sell`,timestamp:`2026-08-06T10:00:00`},{id:3,date:`2026-08-07`,share_name:`NIBL`,category:`sip`,per_unit_price:1e3,total_amount:1e3,allotted:20,buy_sell:`installment`,timestamp:`2026-08-07T10:00:00`}]),ze=[{id:1,display_id:`C-1`,date:`2026-08-20`,flow_type:`cash`,direction:`expense`,category:`Food`,amount:560,signed_amount:-560,description:`Grocery top-up`,source:`manual`,timestamp:`2026-08-20T18:00:00`},{id:2,display_id:`B-2`,date:`2026-08-01`,flow_type:`bank`,direction:`income`,category:`Salary`,amount:45e3,signed_amount:45e3,description:`Salary`,source:`manual`,timestamp:`2026-08-01T08:00:00`},{id:3,display_id:`C-3`,date:`2026-08-18`,flow_type:`cash`,direction:`expense`,category:`Entertainment`,amount:900,signed_amount:-900,description:`Movie night`,source:`manual`,timestamp:`2026-08-18T20:00:00`}],Be=[{id:1,date:`2026-08-22`,from_flow:`cash`,to_flow:`bank`,amount:2e3,description:`Deposit`}];function q(){return[...ze,...Ae(K),...je(G)]}function J(){let e=te(b());return q().filter(t=>t.source===`manual`&&String(t.date).startsWith(e))}function Ve(e){let t=e.filter(e=>e.direction===`income`).reduce((e,t)=>e+Number(t.amount||0),0),n=e.filter(e=>e.direction===`expense`).reduce((e,t)=>e+Number(t.amount||0),0);return{income:t,expense:n,net:t-n}}function He(){return Ve(J())}function Ue(){return Ve(q().filter(e=>e.source===`manual`&&e.date===x(b())))}function We(e){return e.reduce((e,t)=>e+Number(t.amount||0),0)}function Ge(){let e=He(),t=Ue(),n=Ke(),r=qe(),i=We(n),a=[...n].sort((e,t)=>String(t.date).localeCompare(String(e.date))).slice(0,4),o=w(b());return`
    ${Je()}
    <section class="card balance-card">
      <div class="segmented">
        <button class="${O.homeMode===`expense`?`active`:``}" data-home-mode="expense">Expense</button>
        <button class="${O.homeMode===`income`?`active`:``}" data-home-mode="income">Income</button>
      </div>
      <div class="metric-row"><div><div class="metric-label">${o} net balance</div><div class="money big ${e.net>=0?`pos`:`neg`}">${A(e.net,{sign:!0})}</div></div></div>
      <div class="split split-3"><div><span>Total income</span><b class="money pos">${A(e.income)}</b></div><div><span>Total expense</span><b class="money neg">${A(e.expense)}</b></div><div><span>Selected ${O.homeMode}</span><b class="money ${O.homeMode===`income`?`pos`:`neg`}">${A(i)}</b></div></div>
    </section>
    <section class="today-strip">
      <div><span>Today income</span><b class="money pos">${A(t.income)}</b></div>
      <div><span>Today expense</span><b class="money neg">${A(t.expense)}</b></div>
      <div><span>Today net</span><b class="money ${t.net>=0?`pos`:`neg`}">${A(t.net,{sign:!0})}</b></div>
    </section>
    <button class="btn-primary" data-nav="expenses-add">Quick add</button>
    <section class="card">
      <div class="section-title"><h3>${o} categories</h3><button data-nav="expenses-dash">View dashboard</button></div>
      ${Ye()}
      ${Se(n)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Money flow</h3><button data-nav="expenses-dash">View dashboard</button></div>
      ${R([`week`,`month`,`year`,`custom`],{wrap:!1})}
      ${xe(r)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Recent day-to-day</h3><button data-nav="expenses-dash">See all</button></div>
      ${L(a,!1)}
    </section>
  `}function Y(){let e=new Set;for(let t of J())e.add(String(t.category||`Other`));return[...e].sort((e,t)=>e.localeCompare(t))}function X(){let e=Y();return O.categorySelectionTouched||(O.selectedHomeCategories=new Set(e)),e.filter(e=>O.selectedHomeCategories.has(e))}function Ke(){let e=new Set(X());return J().filter(t=>t.direction===O.homeMode&&e.has(String(t.category||`Other`)))}function qe(){let e=new Set(X());return J().filter(t=>e.has(String(t.category||`Other`)))}function Je(){return ae()?`
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
  `:``}function Ye(){let e=Y(),t=new Set(X());return e.length?`
    <details class="category-dropdown">
      <summary><span>Categories shown</span><b>${t.size===e.length?`All with entries`:`${t.size} selected`}</b></summary>
      <label><input type="checkbox" value="__all__" data-category-check ${t.size===e.length?`checked`:``}> All categories with entries</label>
      ${e.map(e=>`<label><input type="checkbox" value="${e}" data-category-check ${t.has(e)?`checked`:``}> ${e}</label>`).join(``)}
    </details>
  `:`<p class="sub">No categories have entries for ${w(b())} yet.</p>`}function Xe(){return ye(`Bank Services`,`Add bank service entry`,[[`Date`,`date`],[`Category`,`select`,`Interest Earned`],[`Amount`,`number`],[`Description (optional)`,`text`]],`Add Bank Service Entry`,`bank-dash`)}function Ze(){let e=W(G),t=G.map(e=>({...e,amount:Math.abs(Number(e.amount)),direction:Number(e.amount)>=0?`income`:`expense`,flow_type:`bank`}));return I(`Bank Services`,`Bank services dashboard`,[[`Interest earned`,e.total_income,`pos`],[`Total charges`,e.total_expenses,`neg`],[`Net balance`,e.net_balance,e.net_balance>=0?`pos`:`neg`]],`${R([`month`,`year`,`custom`])}${L(t)}`,`bank-add`)}function Qe(){return`
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Add expense entry</h1>
    <p class="sub">Log day-to-day bank-flow or cash-flow income and expenses.</p>
    <button class="btn-secondary" data-nav="transfer" style="margin-bottom:14px;">Record transfer</button>
    ${P([[`Date`,`date`],[`Flow`,`select`,`Bank Flow`],[`Type`,`select`,`Expense`],[`Category`,`select`,`Food`],[`Amount`,`number`],[`Description (optional)`,`text`]],`Add Personal Expenses Entry`)}
    ${N(`home`,`expenses-dash`)}
  `}function $e(){let e=q(),t=Me(e);return I(`Personal Expenses`,`Personal expenses dashboard`,[[`Overall income`,t.combined.overall_income,`pos`],[`Overall expenses`,t.combined.overall_expenses,`neg`],[`Overall net/savings`,t.combined.overall_net,t.combined.overall_net>=0?`pos`:`neg`],[`Bank net`,t.bank.net,t.bank.net>=0?`pos`:`neg`],[`Cash net`,t.cash.net,t.cash.net>=0?`pos`:`neg`],[`Bank income`,t.bank.income,`pos`],[`Bank expense`,t.bank.expenses,`neg`],[`Bank investment expense`,t.bank.investment_expense,`neg`],[`Bank investment income`,t.bank.investment_income,`pos`],[`Bank interest earned`,t.bank.interest_earned,`pos`],[`Bank service cost`,t.bank.service_cost,`neg`],[`Bank total income`,t.bank.total_income,`pos`],[`Bank total expense`,t.bank.total_expenses,`neg`],[`Cash income`,t.cash.total_income,`pos`],[`Cash expense`,t.cash.total_expenses,`neg`],[`Cash net profit/loss`,t.cash.net,t.cash.net>=0?`pos`:`neg`]],`${R([`week`,`month`,`year`,`custom`])}${et()}${L(e)}`,`expenses-add`)}function et(){let e=Be[0];return`<div class="notice"><b>Cash to bank transfer</b><br><span>${A(e.amount)} / excluded from income and expense totals</span></div>`}function tt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">About FinLedge Mobile</h1>
    <section class="card settings-panel">
      <p class="sub">FinLedge Mobile is a Capacitor-wrapped Android app backed by on-device SQLite. It keeps day-to-day Bank Flow and Cash Flow tracking on the phone, with module dashboards matching desktop calculations where those modules overlap.</p>
      <p class="sub">The desktop app stores local Excel workbooks; the mobile app stores SQLite rows and will export/import compatible Excel files in its own phase.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function nt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Backup & sync</h1>
    <section class="card">
      <h3>Local first</h3>
      <p class="sub">Mobile data is stored in on-device SQLite. Drive sync ships only in its own future phase.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function rt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">How To Use</h1>
    <section class="card">
      <h3>Mobile flow</h3>
      <p class="sub">Use Home for day-to-day Personal Expenses, the drawer for each module pair, and Import / Export for Keep Notes, Excel, and transfer actions.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}var it=[`CREATE TABLE IF NOT EXISTS bank_transactions (
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
  );`];function at(){return`
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
    <section class="card"><h3>SQLite schema</h3><p class="sub">${it.length} local tables ready for mobile storage.</p></section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function ot(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Investment</h1>
    <section class="card">
      <h3>Portfolio rules</h3>
      <p class="sub">Share Portfolio uses the on-device FIFO lot-matching service and SIP calculations. The interest engine remains deferred.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function st(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Privacy</h1>
    <section class="card">
      <h3>Device storage</h3>
      <p class="sub">FinLedge Mobile keeps records in local SQLite on this device. No live bank-flow sync is enabled in mobile-v1.0.0.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}function ct(){let e=k();return`
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
  `}function lt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Version</h1>
    <section class="card settings-panel">
      <div class="settings-version-row"><span>Mobile version</span><b>${T}</b></div>
      <div class="settings-version-row"><span>Mobile release tags</span><b>mobile-vX.Y.Z</b></div>
      <div class="settings-version-row"><span>Desktop release tags</span><b>desktop-vX.Y.Z</b></div>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `}var ut=[[`settings-profile`,`Profile`,`Edit your name and profile initials.`,`👤`],[`settings-import-export`,`Import / Export`,`Paste import, Excel import, and Excel export.`,`📥`],[`settings-investment`,`Investment`,`Share portfolio rules and SIP notes.`,`📈`],[`settings-backup-sync`,`Backup & sync`,`Local backup status and future sync entry point.`,`☁`],[`settings-privacy`,`Privacy`,`On-device SQLite storage and data controls.`,`🔒`],[`settings-about`,`About`,`Mobile runtime and desktop/mobile differences.`,`ℹ`],[`settings-how-to-use`,`How To Use`,`Mobile navigation and entry guidance.`,`?`],[`settings-version`,`Version`,`Mobile and desktop release tag details.`,`#`]];function dt(){return`
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">General</h1>
    <section class="card settings-menu">
      ${ut.map(([e,t,n,r])=>ft(e,t,n,r)).join(``)}
    </section>
  `}function ft(e,t,n,r){return`
    <button class="settings-row settings-nav-row" data-nav="${e}">
      <span class="settings-row-left"><span class="settings-icon">${r}</span><span><b>${t}</b><span>${n}</span></span></span>
      <span class="chevron">›</span>
    </button>
  `}function pt(){return`
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Add share entry</h1>
    <p class="sub">Matches desktop share inputs. Conditional fields will be enabled when the form is wired to SQLite writes.</p>
    <section class="card">
      ${F(`Date`,`date`)}
      ${F(`Share name`,`text`)}
      ${F(`Entry type`,`select`,`ipo`)}
      ${F(`Dividend Type`,`select`,`cash`)}
      ${F(`SIP type`,`select`,`installment`)}
      ${F(`Amount`,`number`)}
      ${F(`Number of Shares`,`number`)}
      ${F(`Total Amount`,`number`)}
      ${F(`Quantity`,`number`)}
      ${F(`Allotted`,`number`)}
      ${F(`Per unit price`,`number`)}
      <button class="btn-primary">Add Share Portfolio Entry</button>
    </section>
    ${N(`home`,`shares-dash`)}
  `}function mt(){let e=Re(K),t=K.map(e=>({description:`${e.share_name} ${e.category}`,category:e.buy_sell,amount:Number(e.total_amount),direction:Number(e.profit_loss??0)>=0?`income`:`expense`,flow_type:`shares`,date:e.date}));return I(`Share Portfolio`,`Share portfolio dashboard`,[[`Total IPO investment`,e.total_ipo_investment,`neg`],[`Secondary buy amount`,e.total_buy_amount,`neg`],[`IPO + secondary investment`,e.overall_investment,`neg`],[`Total sell amount`,e.total_sell_amount,`pos`],[`Total dividend`,e.total_dividend,`pos`],[`Realized trading profit`,e.total_profit,e.total_profit>=0?`pos`:`neg`],[`IPO/secondary profit/loss`,e.overall_profit_loss,e.overall_profit_loss>=0?`pos`:`neg`],[`SIP investment`,e.total_sip_investment,`neg`],[`SIP redeemed`,e.total_sip_redeemed,`pos`],[`SIP profit/loss`,e.sip_profit_loss,e.sip_profit_loss>=0?`pos`:`neg`],[`Grand total investment`,e.grand_total_investment,`neg`],[`Grand total profit/loss`,e.grand_profit_loss,e.grand_profit_loss>=0?`pos`:`neg`]],`${R([`month`,`year`,`custom`])}${L(t)}${ht()}`,`shares-add`)}function ht(){return`
    <section class="card">
      <h3>Update IPO allotment</h3>
      <p class="sub">Desktop parity placeholder for searching an IPO share and updating its allotted quantity after SQLite writes are enabled.</p>
      ${F(`Search share (IPO only)`,`text`)}
      ${F(`New allotment`,`number`)}
      <button class="btn-secondary">Update</button>
    </section>
    <section class="card">
      <h3>Update SIP shares</h3>
      <p class="sub">Desktop parity placeholder for searching a SIP share and updating the total SIP share quantity after SQLite writes are enabled.</p>
      ${F(`Search share (SIP only)`,`text`)}
      ${F(`Total SIP shares`,`number`)}
      <button class="btn-secondary">Update SIP</button>
    </section>
  `}function gt(){let e=W(G),t=Re(K),n=Me(q()),r=e.net_balance+t.grand_profit_loss+n.combined.overall_net;return I(`Financial Summary`,`Overall position`,[[`Bank net`,e.net_balance,e.net_balance>=0?`pos`:`neg`],[`Share P/L`,t.grand_profit_loss,t.grand_profit_loss>=0?`pos`:`neg`],[`Expenses net`,n.combined.overall_net,n.combined.overall_net>=0?`pos`:`neg`],[`Overall`,r,r>=0?`pos`:`neg`]],`<section class="card"><h3>Net worth trend</h3><p class="sub">Read-only analytics across Bank Services, Share Portfolio, and Personal Expenses.</p></section>`,`home`)}function _t(){return`
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
  `}function vt(e,t={}){e!==O.activeScreen&&(t.replace?O.screenHistory[O.screenHistory.length-1]=e:O.screenHistory.push(e)),O.activeScreen=e,Q(),window.scrollTo({top:0})}function Z(e=`home`){if(O.activeScreen===`home`){let e=Date.now();if(e-O.lastHomeBackPress<1800){le();return}O.lastHomeBackPress=e,ce(`Press back again to exit`);return}O.screenHistory.pop(),vt(O.screenHistory[O.screenHistory.length-1]||e,{replace:!0})}function Q(){let e=document.querySelector(`#app`);e&&(e.innerHTML=`
    <div class="app-shell">
      ${_e()}
      ${ve()}
      ${M(`home`,Ge())}
      ${M(`bank-add`,Xe())}
      ${M(`bank-dash`,Ze())}
      ${M(`shares-add`,pt())}
      ${M(`shares-dash`,mt())}
      ${M(`expenses-add`,Qe())}
      ${M(`expenses-dash`,$e())}
      ${M(`transfer`,_t())}
      ${M(`summary`,gt())}
      ${M(`settings`,dt())}
      ${M(`settings-profile`,ct())}
      ${M(`settings-import-export`,at())}
      ${M(`settings-investment`,ot())}
      ${M(`settings-backup-sync`,nt())}
      ${M(`settings-privacy`,st())}
      ${M(`settings-about`,tt())}
      ${M(`settings-how-to-use`,rt())}
      ${M(`settings-version`,lt())}
    </div>
  `,yt())}function yt(){document.querySelector(`[data-open-drawer]`)?.addEventListener(`click`,()=>{document.querySelector(`.drawer`)?.classList.add(`open`),document.querySelector(`.drawer-overlay`)?.classList.add(`open`)}),document.querySelector(`[data-close-drawer]`)?.addEventListener(`click`,$),document.querySelectorAll(`[data-nav]`).forEach(e=>{e.addEventListener(`click`,()=>vt(e.dataset.nav))}),document.querySelectorAll(`[data-back]`).forEach(e=>{e.addEventListener(`click`,()=>Z(e.dataset.back||`home`))}),document.querySelectorAll(`[data-home-mode]`).forEach(e=>{e.addEventListener(`click`,()=>{O.homeMode=e.dataset.homeMode,O.categorySelectionTouched=!1,Q()})}),document.querySelectorAll(`[data-home-range]`).forEach(e=>{e.addEventListener(`click`,()=>{O.homeRange=e.dataset.homeRange,Q()})}),document.querySelectorAll(`[data-category-check]`).forEach(e=>{e.addEventListener(`change`,bt)}),document.querySelector(`[data-custom-start]`)?.addEventListener(`change`,e=>{O.customStart=e.target.value||O.customStart,Q()}),document.querySelector(`[data-custom-end]`)?.addEventListener(`change`,e=>{O.customEnd=e.target.value||O.customEnd,Q()}),document.querySelectorAll(`[data-profile-form]`).forEach(e=>{e.addEventListener(`submit`,t=>{t.preventDefault(),oe(String(new FormData(e).get(`profileName`)||``)),Q()})}),document.querySelector(`[data-dismiss-profile]`)?.addEventListener(`click`,()=>{se(),Q()})}function bt(e){let t=e.target.value,n=Array.from(document.querySelectorAll(`[data-category-check]`));if(t===`__all__`&&e.target.checked){O.categorySelectionTouched=!1,O.selectedHomeCategories=new Set(Y()),Q();return}let r=n.filter(e=>e.value!==`__all__`&&e.checked).map(e=>e.value);r.length?(O.categorySelectionTouched=!0,O.selectedHomeCategories=new Set(r)):(O.categorySelectionTouched=!1,O.selectedHomeCategories=new Set(X())),Q()}function $(){document.querySelector(`.drawer`)?.classList.remove(`open`),document.querySelector(`.drawer-overlay`)?.classList.remove(`open`)}function xt(){y.addListener(`backButton`,()=>{if(document.querySelector(`.drawer.open`)){$();return}Z()}).catch(()=>{window.addEventListener(`popstate`,()=>Z())})}Q(),xt();export{o as t};