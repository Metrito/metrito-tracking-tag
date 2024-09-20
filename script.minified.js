// v0.0.2
!async function(){function t(t){const e=new Uint32Array(4);crypto.getRandomValues(e);return`${t}_${Array.from(e,(t=>t.toString(36))).join("")}`}function e(){const t=document.querySelector("link[rel~='icon']");return t?t.href:(console.warn("Favicon not found."),null)}console.log("Tracking initialized with container:",window.location.host);class a{static error(...t){console.error("[ERROR] Tracking:",...t)}static info(...t){console.log("[INFO] Tracking:",...t)}}class n{static setItem(t,e){localStorage.setItem(t,e)}static getItem(t){return localStorage.getItem(t)}static setJsonItem(t,e){localStorage.setItem(t,JSON.stringify(e))}static getJsonItem(t){const e=localStorage.getItem(t);return e?JSON.parse(e):null}}class o{constructor(t){this.leadId=t,this.utmParams=this.extractUTMs()}extractUTMs(){const t=new URLSearchParams(window.location.search),e={};return t.forEach(((t,a)=>{"src"!==a||t.includes("lead_")?e[a]=t:e[a]=`${t}__${this.leadId}`})),a.info("Extracted and modified URL parameters:",e),e}addUTMsAndLeadIdToUrl(t){const e=new URLSearchParams(window.location.search);e.has("lead_id")||e.set("lead_id",this.leadId);for(const[t,a]of Object.entries(this.utmParams))e.set(t,a);return`${t.split("?")[0]}?${e.toString()}`}updateUrl(){const t=this.addUTMsAndLeadIdToUrl(window.location.href);window.history.replaceState({path:t},"",t),a.info("Updated URL with UTM parameters and lead_id:",t)}}const i=new class{constructor(){this.containerDomain=window.location.host,this.backendUrl="https://tracking.metrito.com",this.ipInfoToken="BB9F053F0108613A9CCD7D8DF0B21A47"}async init(){this.leadId=await this.getOrCreateLeadId(),this.utmHandler=new o(this.leadId),this.utmHandler.updateUrl(),this.trackPageView()}async createTrackingLead(t){const e=navigator.userAgent,i=await this.getGeolocation(),{fbc:r,fbp:s}=this.getFacebookCookies(),c=this.getPageContent();this.utmHandler=new o(t);const d={domain:window.location.hostname,createdInUrl:window.location.href,leadId:t,metadata:{userAgent:e,...this.utmHandler.utmParams},pageContent:c,metaAds:{cookies:{fbc:r,fbp:s}},geolocation:{...i,state:i.region}};try{const t=await fetch(`${this.backendUrl}/leads`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});if(!t.ok)throw new Error(`Failed to create lead: ${t.statusText}`);a.info("Lead successfully created",d),n.setJsonItem("geolocation",i)}catch(t){a.error("Error creating lead:",t)}}async getOrCreateLeadId(){let e=n.getItem("lead_id");return e?a.info("Existing lead ID retrieved:",e):(e=t("lead"),n.setItem("lead_id",e),a.info("New lead ID generated:",e),await this.createTrackingLead(e)),e}getFacebookCookies(){const t=document.cookie.split("; ").reduce(((t,e)=>{const[a,n]=e.split("=");return t[a]=n,t}),{});return{fbc:t._fbc||null,fbp:t._fbp||null}}async getGeolocation(){let t=n.getJsonItem("geolocation");if(t)a.info("Geolocation retrieved from localStorage:",t);else try{const e=await fetch(`https://ipinfo.io/json?key=${this.ipInfoToken}`);t=await e.json(),a.info("Geolocation retrieved:",t)}catch(t){return a.error("Error retrieving geolocation:",t),{}}return t}async trackEvent(e,n={}){const o=navigator.userAgent,{fbc:i,fbp:r}=this.getFacebookCookies(),s=await this.getGeolocation(),c=this.getPageContent(),d={domain:this.containerDomain,leadId:this.leadId,eventId:t("event"),eventType:e,eventName:e,eventTime:(new Date).getTime(),timestamp:(new Date).toISOString(),eventData:n,page:window.location.href,metadata:{userAgent:o,...this.utmHandler.utmParams},pageContent:c,metaAds:{cookies:{fbc:i,fbp:r}},geolocation:{...s,state:s.region}};a.info(`Tracking event: ${e}`,d),await this.sendEventToBackend(d)}async sendEventToBackend(t){try{const e=await fetch(`${this.backendUrl}/events`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!e.ok)throw new Error(`Failed to send event data: ${e.statusText}`);a.info("Event data successfully sent to backend",t)}catch(t){a.error("Error sending event data to backend:",t)}}trackPageView(){this.trackEvent("PageView",{url:window.location.href})}getPageContent(){const t=document.querySelectorAll("meta[name='description']"),a=t.length>0?t[0].getAttribute("content"):"";return{title:document.title,description:a,url:window.location.href,referrer:document.referrer,language:navigator.language,favicon:e()}}};window.onload=async()=>await i.init(),window.metrito={event:async(t,e)=>{await i.trackEvent(t,e)}}}();