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
    constructor(maxRetries = 30, retryInterval = 100) {
      this.maxRetries = maxRetries;
      this.retryInterval = retryInterval;
      this.retries = 0;
    }

    async checkPixel() {
      return new Promise((resolve, reject) => {
        const check = () => {
          if (window.fbq && window.fbq.loaded) {
            console.log("Facebook Pixel has loaded");
            resolve(true);
          } else if (this.retries >= this.maxRetries) {
            console.warn("Facebook Pixel not loaded after maximum retries");
            resolve(false);
          } else {
            this.retries++;
            setTimeout(check, this.retryInterval);
          }
        };
        check();
      });
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
    }

    async init() {
      // Verifica se o Facebook Pixel foi carregado antes de continuar
      await this.fbPixelChecker.checkPixel();

      this.leadId = await this.getOrCreateLeadId();
      this.utmHandler = new UtmHandler(this.leadId);
      this.utmHandler.updateUrl();
      this.trackPageView();
      this.injectLeadIdOnHiddenInput('form_fields[lead_id]');
      document.addEventListener("submit", (ev) => this.handleFormSubmit(ev));
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

      try {
        const response = await fetch(`${this.backendUrl}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leadData),
        });
        if (!response.ok) throw new Error(`Failed to create lead: ${response.statusText}`);
        Logger.info("Lead successfully created", leadData);
        Storage.setJsonItem("geolocation", geolocation);
      } catch (error) {
        Logger.error("Error creating lead:", error);
      }
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
      if (!geolocation) {
        try {
          const response = await fetch(`https://ipinfo.io/json?key=${this.ipInfoToken}`);
          geolocation = await response.json();
          Logger.info("Geolocation retrieved:", geolocation);
        } catch (error) {
          Logger.error("Error retrieving geolocation:", error);
          return {};
        }
      } else {
        Logger.info("Geolocation retrieved from localStorage:", geolocation);
      }
      return geolocation;
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

      Logger.info(`Tracking event: ${eventType}`, data);
      await this.sendEventToBackend(data);
    }

    async sendEventToBackend(data) {
      try {
        const response = await fetch(`${this.backendUrl}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`Failed to send event data: ${response.statusText}`);
        Logger.info("Event data successfully sent to backend", data);
      } catch (error) {
        Logger.error("Error sending event data to backend:", error);
      }
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
      const attributes = ['name', 'email', 'phone'];
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
