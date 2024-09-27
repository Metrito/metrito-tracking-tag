(async()=>{function s(e){var t=new Uint32Array(4),t=(crypto.getRandomValues(t),Array.from(t,e=>e.toString(36)).join(""));return e+"_"+t}console.log("Tracking initialized with container:",window.location.host);class c{static error(...e){console.error("[ERROR] Tracking:",...e)}static info(...e){console.log("[INFO] Tracking:",...e)}}class d{static setItem(e,t){localStorage.setItem(e,t)}static getItem(e){return localStorage.getItem(e)}static setJsonItem(e,t){localStorage.setItem(e,JSON.stringify(t))}static getJsonItem(e){e=localStorage.getItem(e);return e?JSON.parse(e):null}}class l{constructor(e){this.leadId=e,this.utmParams=this.extractUTMs()}extractUTMs(){var e=new URLSearchParams(window.location.search);let a={};return e.forEach((e,t)=>{"src"!==t||e.includes("lead_")?a[t]=e:a[t]=e+"__"+this.leadId}),c.info("Extracted and modified URL parameters:",a),a}addUTMsAndLeadIdToUrl(e){var t,a,n=new URLSearchParams(window.location.search);n.has("lead_id")||n.set("lead_id",this.leadId);for([t,a]of Object.entries(this.utmParams))n.set(t,a);return e.split("?")[0]+"?"+n.toString()}updateUrl(){var e=this.addUTMsAndLeadIdToUrl(window.location.href);window.history.replaceState({path:e},"",e),c.info("Updated URL with UTM parameters and lead_id:",e)}}class e{constructor(e=30,t=100){this.maxRetries=e,this.retryInterval=t,this.retries=0}async checkPixel(){return new Promise((e,t)=>{let a=()=>{window.fbq&&window.fbq.loaded?(console.log("Facebook Pixel has loaded"),e(!0)):this.retries>=this.maxRetries?(console.warn("Facebook Pixel not loaded after maximum retries"),e(!1)):(this.retries++,setTimeout(a,this.retryInterval))};a()})}}class t{constructor(){this.containerDomain=window.location.host,this.backendUrl="https://tracking.metrito.com",this.ipInfoToken="BB9F053F0108613A9CCD7D8DF0B21A47",this.fbPixelChecker=new e}async init(){await this.fbPixelChecker.checkPixel(),this.leadId=await this.getOrCreateLeadId(),this.utmHandler=new l(this.leadId),this.utmHandler.updateUrl(),this.trackPageView(),this.injectLeadIdOnHiddenInput("form_fields[lead_id]"),document.addEventListener("submit",e=>this.handleFormSubmit(e))}injectLeadIdOnHiddenInput(e){e=document.querySelector(`input[type='hidden'][name='${e}']`);this.leadId&&e&&!e.value&&(e.value=this.leadId,c.info(`Set value ${e.value} to input `+e.name))}async createTrackingLead(e){var t=navigator.userAgent,a=await this.getGeolocation(),{fbc:n,fbp:o}=this.getFacebookCookies(),i=this.getPageContent(),e=(this.utmHandler=new l(e),{domain:window.location.hostname,createdInUrl:window.location.href,leadId:e,metadata:{userAgent:t,...this.utmHandler.utmParams},pageContent:i,metaAds:{cookies:{fbc:n,fbp:o}},geolocation:{...a,state:a.region}});try{var r=await fetch(this.backendUrl+"/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!r.ok)throw new Error("Failed to create lead: "+r.statusText);c.info("Lead successfully created",e),d.setJsonItem("geolocation",a)}catch(e){c.error("Error creating lead:",e)}}async getOrCreateLeadId(){let e=d.getItem("lead_id");return e?c.info("Existing lead ID retrieved:",e):(e=s("lead"),d.setItem("lead_id",e),c.info("New lead ID generated:",e),await this.createTrackingLead(e)),e}getFacebookCookies(){var e=document.cookie.split("; ").reduce((e,t)=>{var[t,a]=t.split("=");return e[t]=a,e},{});return{fbc:e._fbc||null,fbp:e._fbp||null}}async getGeolocation(){let e=d.getJsonItem("geolocation");if(e)c.info("Geolocation retrieved from localStorage:",e);else try{var t=await fetch("https://ipinfo.io/json?key="+this.ipInfoToken);e=await t.json(),c.info("Geolocation retrieved:",e)}catch(e){return c.error("Error retrieving geolocation:",e),{}}return e}async trackEvent(e,t={}){var a=navigator.userAgent,{fbc:n,fbp:o}=this.getFacebookCookies(),i=await this.getGeolocation(),r=this.getPageContent(),t={domain:this.containerDomain,leadId:this.leadId,eventId:s("event"),eventType:e,eventName:e,eventTime:(new Date).getTime(),timestamp:(new Date).toISOString(),eventData:t,page:window.location.href,metadata:{userAgent:a,...this.utmHandler.utmParams},pageContent:r,metaAds:{cookies:{fbc:n,fbp:o}},geolocation:{...i,state:i.region}};c.info("Tracking event: "+e,t),await this.sendEventToBackend(t)}async sendEventToBackend(e){try{var t=await fetch(this.backendUrl+"/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok)throw new Error("Failed to send event data: "+t.statusText);c.info("Event data successfully sent to backend",e)}catch(e){c.error("Error sending event data to backend:",e)}}trackPageView(){this.trackEvent("PageView",{url:window.location.href})}getPageContent(){var e=document.querySelectorAll("meta[name='description']"),e=0<e.length?e[0].getAttribute("content"):"";return{title:document.title,description:e,url:window.location.href,referrer:document.referrer,language:navigator.language,favicon:(e=document.querySelector("link[rel~='icon']"))?e.href:(console.warn("Favicon not found."),null)}}handleFormSubmit(e){let t=["name","email","phone"];e=Array.from(e?.target?.elements||[]).reduce((a,n)=>(n.name&&n.value&&t.forEach(e=>{var t;t=n.name,new RegExp(`(^|\\[)['"]?${e}['"]?($|\\])`).test(t)&&(a[e]=n.value)}),a),{});0<Object.keys(e).length&&this.trackEvent("Lead",e)}}let a=new t;window.onload=async()=>a.init(),window.metrito={event:async(e,t)=>{await a.trackEvent(e,t)}}})();