// v0.0.4
!async function(){function e(e){const t=new Uint32Array(4);crypto.getRandomValues(t);return`${e}_${Array.from(t,(e=>e.toString(36))).join("")}`}function t(){const e=document.querySelector("link[rel~='icon']");return e?e.href:(console.warn("Favicon not found."),null)}console.log("Tracking initialized with container:",window.location.host);class n{static error(...e){console.error("[ERROR] Tracking:",...e)}static info(...e){console.log("[INFO] Tracking:",...e)}}class a{static setItem(e,t){localStorage.setItem(e,t)}static getItem(e){return localStorage.getItem(e)}static setJsonItem(e,t){localStorage.setItem(e,JSON.stringify(t))}static getJsonItem(e){const t=localStorage.getItem(e);return t?JSON.parse(t):null}}class o{constructor(e){this.leadId=e,this.utmParams=this.extractUTMs()}extractUTMs(){const e=new URLSearchParams(window.location.search),t={};return e.forEach(((e,n)=>{"src"!==n||e.includes("lead_")?t[n]=e:t[n]=`${e}__${this.leadId}`})),n.info("Extracted and modified URL parameters:",t),t}addUTMsAndLeadIdToUrl(e){const t=new URLSearchParams(window.location.search);t.has("lead_id")||t.set("lead_id",this.leadId);for(const[e,n]of Object.entries(this.utmParams))t.set(e,n);return`${e.split("?")[0]}?${t.toString()}`}updateUrl(){const e=this.addUTMsAndLeadIdToUrl(window.location.href);window.history.replaceState({path:e},"",e),n.info("Updated URL with UTM parameters and lead_id:",e)}}class i{constructor(e=30,t=100){this.maxRetries=e,this.retryInterval=t,this.retries=0}async checkPixel(){return new Promise(((e,t)=>{const n=()=>{window.fbq&&window.fbq.loaded?(console.log("Facebook Pixel has loaded"),e(!0)):this.retries>=this.maxRetries?(console.warn("Facebook Pixel not loaded after maximum retries"),e(!1)):(this.retries++,setTimeout(n,this.retryInterval))};n()}))}}const r=new class{constructor(){this.containerDomain=window.location.host,this.backendUrl="https://tracking.metrito.com",this.ipInfoToken="BB9F053F0108613A9CCD7D8DF0B21A47",this.fbPixelChecker=new i}async init(){await this.fbPixelChecker.checkPixel(),this.leadId=await this.getOrCreateLeadId(),this.utmHandler=new o(this.leadId),this.utmHandler.updateUrl(),this.trackPageView(),this.injectLeadIdOnHiddenInput("form_fields[lead_id]")}injectLeadIdOnHiddenInput(e){const t=document.querySelector(`input[type='hidden'][name='${e}']`);this.leadId&&t&&!t.value&&(t.value=this.leadId,n.info(`Set value ${t.value} to input ${t.name}`))}async createTrackingLead(e){const t=navigator.userAgent,i=await this.getGeolocation(),{fbc:r,fbp:s}=this.getFacebookCookies(),c=this.getPageContent();this.utmHandler=new o(e);const d={domain:window.location.hostname,createdInUrl:window.location.href,leadId:e,metadata:{userAgent:t,...this.utmHandler.utmParams},pageContent:c,metaAds:{cookies:{fbc:r,fbp:s}},geolocation:{...i,state:i.region}};try{const e=await fetch(`${this.backendUrl}/leads`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});if(!e.ok)throw new Error(`Failed to create lead: ${e.statusText}`);n.info("Lead successfully created",d),a.setJsonItem("geolocation",i)}catch(e){n.error("Error creating lead:",e)}}async getOrCreateLeadId(){let t=a.getItem("lead_id");return t?n.info("Existing lead ID retrieved:",t):(t=e("lead"),a.setItem("lead_id",t),n.info("New lead ID generated:",t),await this.createTrackingLead(t)),t}getFacebookCookies(){const e=document.cookie.split("; ").reduce(((e,t)=>{const[n,a]=t.split("=");return e[n]=a,e}),{});return{fbc:e._fbc||null,fbp:e._fbp||null}}async getGeolocation(){let e=a.getJsonItem("geolocation");if(e)n.info("Geolocation retrieved from localStorage:",e);else try{const t=await fetch(`https://ipinfo.io/json?key=${this.ipInfoToken}`);e=await t.json(),n.info("Geolocation retrieved:",e)}catch(e){return n.error("Error retrieving geolocation:",e),{}}return e}async trackEvent(t,a={}){const o=navigator.userAgent,{fbc:i,fbp:r}=this.getFacebookCookies(),s=await this.getGeolocation(),c=this.getPageContent(),d={domain:this.containerDomain,leadId:this.leadId,eventId:e("event"),eventType:t,eventName:t,eventTime:(new Date).getTime(),timestamp:(new Date).toISOString(),eventData:a,page:window.location.href,metadata:{userAgent:o,...this.utmHandler.utmParams},pageContent:c,metaAds:{cookies:{fbc:i,fbp:r}},geolocation:{...s,state:s.region}};n.info(`Tracking event: ${t}`,d),await this.sendEventToBackend(d)}async sendEventToBackend(e){try{const t=await fetch(`${this.backendUrl}/events`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok)throw new Error(`Failed to send event data: ${t.statusText}`);n.info("Event data successfully sent to backend",e)}catch(e){n.error("Error sending event data to backend:",e)}}trackPageView(){this.trackEvent("PageView",{url:window.location.href})}getPageContent(){const e=document.querySelectorAll("meta[name='description']"),n=e.length>0?e[0].getAttribute("content"):"";return{title:document.title,description:n,url:window.location.href,referrer:document.referrer,language:navigator.language,favicon:t()}}};window.onload=async()=>await r.init(),window.metrito={event:async(e,t)=>{await r.trackEvent(e,t)}}}();