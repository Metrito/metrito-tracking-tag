// https://gist.github.com/matheusb-comp/040183787c587fb9b65bd6853c9afe28

/**
 * Reads the entire response body and process based in the Content-Type header
 * https://developer.mozilla.org/en-US/docs/Web/API/Body
 * 
 * @param {object}  response    A response from a fetch request
 * @param {boolean} arrayBuffer When body can't be processed to `text`,
 * `json`, or `form-data`, process it to an ArrayBuffer or a Blob (default)
 * 
 * @return {Promise} A promise that resolves after the entire body is processed
 */
function processBody(response, arrayBuffer = false) {
  const mime = (response.headers.get('Content-Type') || '').split(',')[0]
  if (mime.includes('text')) return response.text()
  else if (mime.includes('json')) return response.json()
  else if (mime.includes('form-data')) return response.formData()
  else return (arrayBuffer) ? response.arrayBuffer() : response.blob()
}

/**
 * Requests a resource using fetch, and process the response body by default
 * 
 * @param {string}  resource     URL of a network resource
 * @param {object}  options      Fetch request options object
 * @param {boolean} readBody     Read and process the entire response body
 * @param {boolean} arrayBuffer  When body can't be processed to `text`,
 * `json`, or `form-data`, process it to an ArrayBuffer or a Blob (default)
 * 
 * @return {Promise} A promise that resolves when the request is successful
 * (HTTP status code between 200 and 299) and rejects otherwise.
 * Errors are similar to the Axios library, with `error.response` (HTTP errors)
 * and `error.message` (failed to fetch / cancelled requests)
 */
function request(resource, options, readBody = true, arrayBuffer = false) {
  return new Promise((resolve, reject) => {
    const config = { resource, ...options }
    fetch(resource, options)
      // Reject if not ok (HTTP status not in the range 200-299)
      .then((response) => {
        const message = 'Request failed'
        const res = { response, config }
        // If requested, read and process the entire response body
        if (readBody) processBody(response, arrayBuffer).then((data) => {
          return (response.ok)
            ? resolve({ ...res, data })
            : reject({ ...res, data, message })
        })
        else (response.ok) ? resolve(res) : reject({ ...res, message })
      })
      // Network/Cancel errors, similar to the error handling in Axios
      .catch((error) => reject({ message: error.message, config }))
  })
}

// Inicializa o tracking quando a página for carregada

(async function () {
  console.log("Tracking initialized with container:", window.location.host);

  /**
   * Gera um ID único com um prefixo específico
   * @param {string} prefix - Prefixo para o ID gerado
   * @returns {string} - ID único gerado
   */
  function generateId(prefix) {
    const array = new Uint32Array(4);
    crypto.getRandomValues(array);
    const uniquePart = Array.from(array, (dec) => dec.toString(36)).join("");
    return `${prefix}_${uniquePart}`;
  }

  /**
   * Recupera o link do favicon da página
   * @returns {string|null} - URL do favicon ou null se não encontrado
   */
  function getFaviconSrc() {
    const faviconElement = document.querySelector("link[rel~='icon']");
    if (faviconElement) {
      return faviconElement.href;
    } else {
      console.warn("Favicon not found.");
      return null;
    }
  }

  /**
   * Classe para facilitar logs com diferentes níveis
   */
  class Logger {
    static error(...message) {
      console.error("[ERROR] Tracking:", ...message);
    }

    static info(...message) {
      console.log("[INFO] Tracking:", ...message);
    }
  }

  /**
   * Classe para manipular armazenamento local
   */
  class Storage {
    static setItem(name, value) {
      localStorage.setItem(name, value);
    }

    static getItem(name) {
      return localStorage.getItem(name);
    }

    static setJsonItem(name, value) {
      localStorage.setItem(name, JSON.stringify(value));
    }

    static getJsonItem(name) {
      const item = localStorage.getItem(name);
      return item ? JSON.parse(item) : null;
    }
  }

  /**
   * Classe responsável por manipular UTMs e modificar URLs com lead ID
   */
  class UtmHandler {
    constructor(leadId) {
      this.leadId = leadId;
      this.utmParams = this.extractUTMs();
    }

    extractUTMs() {
      const params = new URLSearchParams(window.location.search);
      const allParams = {};

      params.forEach((value, key) => {
        if (key === "src" && !value.includes("lead_")) {
          allParams[key] = `${value}__${this.leadId}`;
        } else {
          allParams[key] = value;
        }
      });

      Logger.info("Extracted and modified URL parameters:", allParams);
      return allParams;
    }

    addUTMsAndLeadIdToUrl(url) {
      const params = new URLSearchParams(window.location.search);

      if (!params.has("lead_id")) {
        params.set("lead_id", this.leadId);
      }

      for (const [key, value] of Object.entries(this.utmParams)) {
        params.set(key, value);
      }

      return `${url.split("?")[0]}?${params.toString()}`;
    }

    updateUrl() {
      const newUrl = this.addUTMsAndLeadIdToUrl(window.location.href);
      window.history.replaceState({ path: newUrl }, "", newUrl);
      Logger.info("Updated URL with UTM parameters and lead_id:", newUrl);
    }
  }

  /**
   * Class responsible for checking Facebook Pixel loading
   */
  class FacebookPixelChecker {
    constructor(maxWaitTime = 5000) {
      this.maxWaitTime = maxWaitTime;
      this.hasFbclid = this.checkForFbclid();
      this.pixelLoaded = false;
      this.cookiesSet = false;
    }

    checkForFbclid() {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.has("fbclid");
    }

    async checkPixelAndCookies() {
      return new Promise((resolve) => {
        let timeoutId;

        const checkComplete = () => {
          if (this.pixelLoaded && this.cookiesSet) {
            clearTimeout(timeoutId);
            resolve(true);
          }
        };

        this.waitForPixel().then(() => {
          this.pixelLoaded = true;
          checkComplete();
        });

        if ("cookieStore" in window) {
          cookieStore.addEventListener("change", (event) => {
            for (const cookie of event.changed) {
              if (this.hasFbclid && (cookie.name === "_fbc" || cookie.name === "_fbp")) {
                console.log(`Facebook cookie set: ${cookie.name}`);
                this.cookiesSet = true;
                checkComplete();
                break;
              } else if (!this.hasFbclid && cookie.name === "_fbp") {
                console.log(`Facebook _fbp cookie set`);
                this.cookiesSet = true;
                checkComplete();
                break;
              }
            }
          });
        } else {
          console.warn("CookieStore API not available, falling back to periodic checks");
          this.fallbackCookieCheck(checkComplete);
        }

        timeoutId = setTimeout(() => {
          if (!this.pixelLoaded) {
            console.warn("Facebook Pixel did not load within the specified time");
          }
          if (!this.cookiesSet) {
            console.warn("Required Facebook cookies not set within the specified time");
          }
          resolve(this.pixelLoaded && this.cookiesSet);
        }, this.maxWaitTime);
      });
    }

    async waitForPixel() {
      return new Promise((resolve) => {
        if (window.fbq && typeof window.fbq === "function") {
          console.log("Facebook Pixel already loaded");
          resolve(true);
        } else {
          const pixelCheckInterval = setInterval(() => {
            if (window.fbq && typeof window.fbq === "function") {
              console.log("Facebook Pixel loaded");
              clearInterval(pixelCheckInterval);
              resolve(true);
            }
          }, 50);
        }
      });
    }

    fallbackCookieCheck(callback) {
      const checkInterval = setInterval(() => {
        const cookies = this.getFacebookCookies();
        if (this.hasFbclid && (cookies.fbc || cookies.fbp)) {
          console.log("Facebook cookies set:", cookies);
          this.cookiesSet = true;
          clearInterval(checkInterval);
          callback();
        } else if (!this.hasFbclid && cookies.fbp) {
          console.log("Facebook _fbp cookie set");
          this.cookiesSet = true;
          clearInterval(checkInterval);
          callback();
        }
      }, 50);
    }

    getFacebookCookies() {
      const cookies = document.cookie.split("; ").reduce((acc, cookie) => {
        const [name, value] = cookie.split("=");
        acc[name] = value;
        return acc;
      }, {});
      return { fbc: cookies._fbc || null, fbp: cookies._fbp || null };
    }
  }

  /**
   * Classe principal para gerenciar o tracking
   */
  class Tracking {
    constructor() {
      this.containerDomain = window.location.host;
      this.backendUrl = "https://tracking.metrito.com";
      this.ipInfoToken = "BB9F053F0108613A9CCD7D8DF0B21A47";
      this.fbPixelChecker = new FacebookPixelChecker();
      this.conversions = [];
    }

    async init() {
      // Verifica se o Facebook Pixel foi carregado antes de continuar
      await this.fbPixelChecker.checkPixelAndCookies();
      this.leadId = await this.getOrCreateLeadId();
      this.utmHandler = new UtmHandler(this.leadId);
      this.utmHandler.updateUrl();

      // Configura todos os triggers configurados para esta página
      const url = "https://api.metrito.com/v2/tracking/conversions/" + this.containerDomain;
      this.conversions = await this.getData(url) || [];
      this.conversions.forEach(this.setupTrigger);

      // Configura outros eventos
      this.trackPageView();
      this.injectLeadIdOnHiddenInput("form_fields[lead_id]");
      document.addEventListener("submit", (ev) => this.handleFormSubmit(ev));
    }

    // TODO: Trazer script com todos os dados pré-carregados (evitar GET)
    getData(url) {
      return request(url, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
      }).then((data) => {
        Logger.info("Data retrieved:", data);
        return data;
      }).catch((error) => {
        Logger.error("Error retrieving data:", error);
      });
    }

    // TODO: Substituir fetch por sendBeacon (para POST JSON)
    sendData(url, data) {
      request(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data),
      }).then(() => {
        Logger.info(`Data sent to ${url}:`, data);
      }).catch((error) => {
        Logger.error(`Error sending data to ${url}:`, error);
      });
    }

    // TODO: Buscar configurações do backend customizadas para o lead
    injectLeadIdOnHiddenInput(name) {
      const el = document.querySelector(`input[type='hidden'][name='${name}']`);
      if (this.leadId && el && !el.value) {
        el.value = this.leadId;
        Logger.info(`Set value ${el.value} to input ${el.name}`);
      }
    }

    async createTrackingLead(leadId) {
      const userAgent = navigator.userAgent;
      const geolocation = await this.getGeolocation();
      const { fbc, fbp } = this.getFacebookCookies();
      const pageContent = this.getPageContent();
      this.utmHandler = new UtmHandler(leadId);

      const leadData = {
        domain: window.location.hostname,
        createdInUrl: window.location.href,
        leadId,
        metadata: { userAgent, ...this.utmHandler.utmParams },
        pageContent,
        metaAds: { cookies: { fbc, fbp } },
        geolocation: { ...geolocation, state: geolocation.region },
      };
      this.sendData(`${this.backendUrl}/leads`, leadData);
    }

    async getOrCreateLeadId() {
      let leadId = Storage.getItem("lead_id");
      if (!leadId) {
        leadId = generateId("lead");
        Storage.setItem("lead_id", leadId);
        Logger.info("New lead ID generated:", leadId);
        await this.createTrackingLead(leadId);
      } else {
        Logger.info("Existing lead ID retrieved:", leadId);
      }
      return leadId;
    }

    getFacebookCookies() {
      const cookies = document.cookie.split("; ").reduce((acc, cookie) => {
        const [name, value] = cookie.split("=");
        acc[name] = value;
        return acc;
      }, {});
      return { fbc: cookies._fbc || null, fbp: cookies._fbp || null };
    }

    async getGeolocation() {
      let geolocation = Storage.getJsonItem("geolocation");
      if (geolocation) {
        Logger.info("Geolocation retrieved from localStorage:", geolocation);
        return geolocation;
      }
      geolocation = await this.getData(`https://ipinfo.io/json?key=${this.ipInfoToken}`);
      if (geolocation) Storage.setJsonItem("geolocation", geolocation);
      return geolocation || {};
    }

    async trackEvent(eventType, eventData = {}) {
      const userAgent = navigator.userAgent;
      const { fbc, fbp } = this.getFacebookCookies();
      const geolocation = await this.getGeolocation();
      const pageContent = this.getPageContent();

      const data = {
        domain: this.containerDomain,
        leadId: this.leadId,
        eventId: generateId("event"),
        eventType,
        eventName: eventType,
        eventTime: new Date().getTime(),
        timestamp: new Date().toISOString(),
        eventData,
        page: window.location.href,
        metadata: { userAgent, ...this.utmHandler.utmParams },
        pageContent,
        metaAds: { cookies: { fbc, fbp } },
        geolocation: { ...geolocation, state: geolocation.region },
      };
      this.sendData(`${this.backendUrl}/events`, data);
    }

    trackPageView() {
      this.trackEvent("PageView", { url: window.location.href });
    }

    getPageContent() {
      const metaTags = document.querySelectorAll("meta[name='description']");
      const description = metaTags.length > 0 ? metaTags[0].getAttribute("content") : "";
      return {
        title: document.title,
        description,
        url: window.location.href,
        referrer: document.referrer,
        language: navigator.language,
        favicon: getFaviconSrc(),
      };
    }

    handleFormSubmit(ev) {
      // Valores para <input name="x"> que estamos procurando
      const attributes = ["name", "email", "phone"];
      const check = (k, v) => new RegExp(`(^|\\[)['"]?${k}['"]?($|\\])`).test(v);

      // Procura valores na lista de elementos do <form>
      const data = Array.from(ev?.target?.elements || []).reduce((acc, el) => {
        if (el.name && el.value) {
          attributes.forEach((attr) => {
            if (check(attr, el.name)) acc[attr] = el.value;
          });
        }
        return acc;
      }, {});

      // Envia dados encontrados para o backend
      if (Object.keys(data).length > 0) this.trackEvent("Lead", data);
    }

    setupTrigger(conversion) {
      const {
        eventType,
        customEventName,
        loadOn,
        specificPages,
        triggerConfig,
        eventConfig,
      } = conversion;
      // TODO: Simplificar nome do evento (usar apenas 1 campo)
      const eventName = eventType === "CustomEvent" ? customEventName : eventType;
      
      // Verifica se o trigger deve ser ignorado para este path
      const path = window.location.pathname;
      if (!loadOn) return;
      else if (loadOn === "specific_pages") {
        if (!(specificPages?.includes(path))) return;
      } else if (loadOn === "regex") {
        const regex = new RegExp(specificPages?.[0] || '^$');
        if (!regex.test(path)) return;
      }
      Logger.info("Configuring trigger for conversion:", conversion);
      
      // Se for possível, configura o trigger
      switch (triggerConfig.triggerType) {
        case "page_view":
          return this.setupTriggerTimeout(0, eventName, eventConfig);
        case "page_view_duration":
          const delay = triggerConfig.timeThreshold || 0;
          return this.setupTriggerTimeout(delay, eventName, eventConfig);
        case "scroll_depth":
          const pct = triggerConfig.scrollPercentage || 0;
          return this.setupTriggerWindowScroll(pct, eventName, eventConfig);
        case "element_click":
          const selector = triggerConfig.elementSelector;
          return this.setupTriggerElementEvent(selector, 'click', eventName, eventConfig);
        case "element_hover":
          const selector = triggerConfig.elementSelector;
          return this.setupTriggerElementEvent(selector, 'mouseover', eventName, eventConfig);
        case "element_view":
          const selector = triggerConfig.elementSelector;
          const opt = triggerConfig.elementObserverOptions;
          return this.setupTriggerElementObserver(selector, opt, eventName, eventConfig);
      }
    }

    setupTriggerTimeout(delay, eventName, eventData = {}) {
      setTimeout(() => this.trackEvent(eventName, eventData), delay);
    }

    setupTriggerWindowScroll(pct, eventName, eventData = {}) {
      const handler = () => {
        // Usando "scrollHeight" em vez de "offsetHeight"
        // https://css-tricks.com/how-i-put-the-scroll-percentage-in-the-browser-title-bar
        // https://medium.com/@jbbpatel94/difference-between-offsetheight-clientheight-and-scrollheight-cfea5c196937
        const scrollPercentage = 100 * (
          window.scrollY / (document.body.scrollHeight - window.innerHeight)
        );
        if (scrollPercentage >= pct) {
          window.removeEventListener('scroll', handler);
          this.trackEvent(eventName, { ...eventData, scrollPercentage });
        }
      };
      window.addEventListener('scroll', handler);
    }

    setupTriggerElementEvent(selector, domEvent, eventName, eventData = {}) {
      document.querySelectorAll(selector).forEach((el) => {
        el.addEventListener(domEvent, () => this.trackEvent(eventName, eventData));
      });
    }

    setupTriggerElementObserver(selector, obsOptions, eventName, eventData = {}) {
      const obs = new IntersectionObserver((entries, obs) => {
        entries.forEach((observerEntry) => {
          if (!observerEntry.isIntersecting) return;
          obs.unobserve(observerEntry.target);
          this.trackEvent(eventName, { ...eventData, observerEntry });
        });
      }, obsOptions);
      document.querySelectorAll(selector).forEach((el) => obs.observe(el));
    }
  }

  // Instancia o tracking e expõe a função global para eventos
  const tracking = new Tracking();

  window.onload = async () => await tracking.init();

  // Expondo a função para chamar eventos como window.metrito.event('eventName', eventData)
  window.metrito = {
    // tracking,
    event: async (eventName, eventData) => {
      await tracking.trackEvent(eventName, eventData);
    },
  };
})();
