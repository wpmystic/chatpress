(function () {
  if (window.ChatPressWidget && window.ChatPressWidget.initialized) {
    return;
  }

  var VERSION = '1.0.0';

  var defaultConfig = {
    brandColor: '#2563eb',
    textColor: '#0f172a',
    backgroundColor: '#ffffff',
    position: 'bottom-right',
    defaultOpen: false,
    greeting: 'Hi there! Ask me anything about this site.',
    maxResults: 3,
    searchEndpoint: null,
    searchMethod: 'GET',
    searchHeaders: null,
    searchBodyTemplate: null,
    searchResultsPath: '',
    searchTitlePath: 'title',
    searchUrlPath: 'url',
    searchSnippetPath: 'snippet',
    searchLabel: 'site search',
    observeDom: true,
    indexSelectors: null,
    minSectionLength: 80
  };

  var currentScript = document.currentScript;
  if (!currentScript) {
    var scripts = document.getElementsByTagName('script');
    currentScript = scripts[scripts.length - 1];
  }

  function parseBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value === 'true' || value === '1';
    }
    return undefined;
  }

  function deepMerge(target, source) {
    if (!source) {
      return target;
    }
    for (var key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        continue;
      }
      var value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key]) {
          target[key] = {};
        }
        deepMerge(target[key], value);
      } else {
        target[key] = value;
      }
    }
    return target;
  }

  function parseConfigFromScript(script) {
    if (!script) {
      return {};
    }
    var config = {};
    var configAttr = script.getAttribute('data-chatpress-config');
    if (configAttr) {
      try {
        var parsed = JSON.parse(configAttr);
        if (parsed && typeof parsed === 'object') {
          config = deepMerge(config, parsed);
        }
      } catch (err) {
        console.warn('[ChatPress] Failed to parse data-chatpress-config JSON', err);
      }
    }

    var dataset = script.dataset || {};
    if (dataset.brandColor) config.brandColor = dataset.brandColor;
    if (dataset.textColor) config.textColor = dataset.textColor;
    if (dataset.backgroundColor) config.backgroundColor = dataset.backgroundColor;
    if (dataset.position) config.position = dataset.position;
    if (dataset.greeting) config.greeting = dataset.greeting;
    if (dataset.maxResults) config.maxResults = parseInt(dataset.maxResults, 10) || defaultConfig.maxResults;
    if (dataset.searchEndpoint) config.searchEndpoint = dataset.searchEndpoint;
    if (dataset.searchMethod) config.searchMethod = dataset.searchMethod;
    if (dataset.searchResultsPath) config.searchResultsPath = dataset.searchResultsPath;
    if (dataset.searchTitlePath) config.searchTitlePath = dataset.searchTitlePath;
    if (dataset.searchUrlPath) config.searchUrlPath = dataset.searchUrlPath;
    if (dataset.searchSnippetPath) config.searchSnippetPath = dataset.searchSnippetPath;
    if (dataset.searchLabel) config.searchLabel = dataset.searchLabel;

    var defaultOpen = parseBoolean(dataset.defaultOpen);
    if (typeof defaultOpen !== 'undefined') {
      config.defaultOpen = defaultOpen;
    }

    var observeDom = parseBoolean(dataset.observeDom);
    if (typeof observeDom !== 'undefined') {
      config.observeDom = observeDom;
    }

    return config;
  }

  function createConfig() {
    var config = deepMerge({}, defaultConfig);
    if (window.ChatPressConfig && typeof window.ChatPressConfig === 'object') {
      deepMerge(config, window.ChatPressConfig);
    }
    var scriptConfig = parseConfigFromScript(currentScript);
    deepMerge(config, scriptConfig);
    config.maxResults = Math.max(1, parseInt(config.maxResults, 10) || defaultConfig.maxResults);
    return config;
  }

  var config = createConfig();

  var parserDiv = document.createElement('div');

  function stripHTML(html) {
    if (html === undefined || html === null) {
      return '';
    }
    parserDiv.innerHTML = '';
    parserDiv.innerHTML = String(html);
    return (parserDiv.textContent || parserDiv.innerText || '').trim();
  }

  function escapeHtml(text) {
    if (text === undefined || text === null) {
      return '';
    }
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanWhitespace(text) {
    if (!text) {
      return '';
    }
    return text.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
  }

  function resolvePath(obj, path) {
    if (!obj || !path) {
      return obj;
    }
    var segments = path.split('.');
    var current = obj;
    for (var i = 0; i < segments.length; i += 1) {
      var part = segments[i];
      if (!part) continue;
      var match = part.match(/(.+)\[(\d+)\]$/);
      if (match) {
        var prop = match[1];
        var index = parseInt(match[2], 10);
        current = current ? current[prop] : undefined;
        if (!current || !Array.isArray(current)) {
          return undefined;
        }
        current = current[index];
      } else {
        current = current ? current[part] : undefined;
      }
      if (current === undefined || current === null) {
        return undefined;
      }
    }
    return current;
  }

  function isWordPressSite() {
    if (window.ChatPressConfig && window.ChatPressConfig.forceWordPress === true) {
      return true;
    }
    if (typeof window.wp !== 'undefined') {
      return true;
    }
    if (document.querySelector('meta[name="generator"][content*="WordPress"]')) {
      return true;
    }
    if (document.querySelector('link[href*="wp-content/"]')) {
      return true;
    }
    if (document.body && document.body.classList) {
      for (var i = 0; i < document.body.classList.length; i += 1) {
        var cls = document.body.classList[i];
        if (cls.indexOf('wp-') === 0) {
          return true;
        }
      }
    }
    return false;
  }

  function buildUrlWithQuery(template, query) {
    if (!template) {
      return '';
    }
    var replaced = template.indexOf('{{query}}') >= 0
      ? template.replace(/\{\{query\}\}/g, encodeURIComponent(query))
      : template;
    if (template.indexOf('{{query}}') === -1 && template.indexOf('=') === -1) {
      var sep = replaced.indexOf('?') >= 0 ? '&' : '?';
      replaced += sep + 'query=' + encodeURIComponent(query);
    }
    return replaced;
  }

  function addScriptStyle() {
    if (document.getElementById('chatpress-widget-styles')) {
      return;
    }
    var style = document.createElement('style');
    style.id = 'chatpress-widget-styles';
    style.textContent = `
      .chatpress-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: var(--chatpress-text-color, ${config.textColor});
        --chatpress-brand-color: ${config.brandColor};
        --chatpress-text-color: ${config.textColor};
        --chatpress-background-color: ${config.backgroundColor};
        --chatpress-border-color: rgba(15, 23, 42, 0.12);
        --chatpress-shadow: 0 20px 48px -28px rgba(15, 23, 42, 0.5);
        --chatpress-bot-bubble: #f8fafc;
        --chatpress-user-bubble: var(--chatpress-brand-color);
        --chatpress-user-text: #ffffff;
      }
      .chatpress-widget.chatpress-position-bottom-left { right: auto; left: 20px; }
      .chatpress-widget *, .chatpress-widget *::before, .chatpress-widget *::after { box-sizing: border-box; }
      .chatpress-widget .chatpress-toggle {
        width: 56px;
        height: 56px;
        border-radius: 999px;
        background: var(--chatpress-brand-color);
        color: #ffffff;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 12px 30px -18px var(--chatpress-brand-color);
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .chatpress-widget .chatpress-toggle:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
      .chatpress-widget.chatpress-open .chatpress-toggle { transform: scale(0.92); }
      .chatpress-widget .chatpress-panel {
        width: min(360px, calc(100vw - 40px));
        max-height: min(560px, calc(100vh - 100px));
        position: absolute;
        bottom: 72px;
        right: 0;
        background: var(--chatpress-background-color);
        border-radius: 20px;
        border: 1px solid var(--chatpress-border-color);
        box-shadow: var(--chatpress-shadow);
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      .chatpress-widget.chatpress-position-bottom-left .chatpress-panel { left: 0; right: auto; }
      .chatpress-widget.chatpress-open .chatpress-panel { display: flex; }
      .chatpress-widget .chatpress-header {
        background: var(--chatpress-brand-color);
        color: #fff;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .chatpress-widget .chatpress-header h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .chatpress-widget .chatpress-header button {
        border: none;
        background: rgba(255, 255, 255, 0.16);
        color: #fff;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        cursor: pointer;
      }
      .chatpress-widget .chatpress-messages {
        padding: 16px;
        overflow-y: auto;
        background: linear-gradient(180deg, rgba(248, 250, 252, 0.6), transparent);
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .chatpress-widget .chatpress-message {
        display: flex;
        flex-direction: column;
      }
      .chatpress-widget .chatpress-message-user { align-items: flex-end; }
      .chatpress-widget .chatpress-bubble {
        padding: 12px 14px;
        border-radius: 14px;
        max-width: 100%;
        font-size: 14px;
        line-height: 1.45;
        word-break: break-word;
      }
      .chatpress-widget .chatpress-message-bot .chatpress-bubble {
        background: var(--chatpress-bot-bubble);
        color: var(--chatpress-text-color);
        border: 1px solid rgba(15, 23, 42, 0.08);
      }
      .chatpress-widget .chatpress-message-user .chatpress-bubble {
        background: var(--chatpress-user-bubble);
        color: var(--chatpress-user-text);
      }
      .chatpress-widget .chatpress-message small {
        margin-top: 4px;
        font-size: 11px;
        color: rgba(15, 23, 42, 0.45);
      }
      .chatpress-widget .chatpress-form {
        border-top: 1px solid rgba(15, 23, 42, 0.08);
        padding: 12px;
        background: #fff;
        display: flex;
        gap: 8px;
      }
      .chatpress-widget .chatpress-form textarea {
        flex: 1;
        resize: none;
        border-radius: 12px;
        border: 1px solid rgba(15, 23, 42, 0.14);
        padding: 10px 12px;
        min-height: 48px;
        max-height: 120px;
        font-size: 14px;
        line-height: 1.4;
      }
      .chatpress-widget .chatpress-form textarea:focus-visible {
        outline: 2px solid var(--chatpress-brand-color);
      }
      .chatpress-widget .chatpress-form button {
        background: var(--chatpress-brand-color);
        color: #fff;
        border: none;
        border-radius: 12px;
        padding: 0 16px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .chatpress-widget .chatpress-result-list {
        list-style: none;
        padding: 0;
        margin: 8px 0 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .chatpress-widget .chatpress-answer-intro {
        margin: 0 0 6px 0;
        font-weight: 600;
      }
      .chatpress-widget .chatpress-result-title {
        color: var(--chatpress-brand-color);
        text-decoration: none;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .chatpress-widget .chatpress-result-title:hover,
      .chatpress-widget .chatpress-result-title:focus {
        text-decoration: underline;
      }
      .chatpress-widget .chatpress-result-snippet {
        margin: 4px 0 0 0;
        font-size: 13px;
        color: rgba(15, 23, 42, 0.8);
      }
      .chatpress-widget .chatpress-empty-state {
        margin: 0;
      }
      @media (max-width: 600px) {
        .chatpress-widget { bottom: 16px; right: 16px; }
        .chatpress-widget.chatpress-position-bottom-left { left: 16px; }
        .chatpress-widget .chatpress-panel {
          width: calc(100vw - 32px);
          max-height: calc(100vh - 120px);
          right: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ChatPressWidgetApp(configuration) {
    this.config = configuration;
    this.container = null;
    this.panel = null;
    this.messagesContainer = null;
    this.input = null;
    this.sendButton = null;
    this.toggleButton = null;
    this.indexer = null;
    this.searchManager = null;
    this.initialized = false;
  }

  ChatPressWidgetApp.prototype.init = function () {
    if (this.initialized) {
      return;
    }
    addScriptStyle();
    this.createUI();
    this.indexer = new LocalIndexer(this.config);
    this.indexer.start();
    this.searchManager = new SearchManager(this.config, this.indexer);
    this.initialized = true;
    if (this.config.greeting) {
      this.addBotMessage(this.config.greeting);
    }
    if (this.config.defaultOpen) {
      this.open();
    }
  };

  ChatPressWidgetApp.prototype.createUI = function () {
    var container = document.createElement('div');
    container.className = 'chatpress-widget chatpress-position-' + (this.config.position || 'bottom-right');
    container.setAttribute('id', 'chatpress-widget');
    container.setAttribute('aria-live', 'polite');
    container.style.setProperty('--chatpress-brand-color', this.config.brandColor);
    container.style.setProperty('--chatpress-text-color', this.config.textColor);
    container.style.setProperty('--chatpress-background-color', this.config.backgroundColor);

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'chatpress-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'chatpress-panel');
    toggle.innerHTML = '<span aria-hidden="true">💬</span>';
    container.appendChild(toggle);
    this.toggleButton = toggle;

    var panel = document.createElement('div');
    panel.className = 'chatpress-panel';
    panel.id = 'chatpress-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');

    var header = document.createElement('div');
    header.className = 'chatpress-header';
    var title = document.createElement('h2');
    title.textContent = 'Site assistant';
    header.appendChild(title);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.textContent = '×';
    header.appendChild(closeBtn);
    panel.appendChild(header);

    var messages = document.createElement('div');
    messages.className = 'chatpress-messages';
    panel.appendChild(messages);

    var form = document.createElement('form');
    form.className = 'chatpress-form';
    form.setAttribute('autocomplete', 'off');

    var textarea = document.createElement('textarea');
    textarea.setAttribute('placeholder', 'Ask about this site…');
    textarea.setAttribute('rows', '2');
    textarea.setAttribute('aria-label', 'Message');
    form.appendChild(textarea);

    var sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.textContent = 'Send';
    form.appendChild(sendBtn);

    panel.appendChild(form);
    container.appendChild(panel);

    document.body.appendChild(container);

    this.container = container;
    this.panel = panel;
    this.messagesContainer = messages;
    this.input = textarea;
    this.sendButton = sendBtn;

    var self = this;

    toggle.addEventListener('click', function () {
      if (self.container.classList.contains('chatpress-open')) {
        self.close();
      } else {
        self.open();
      }
    });

    closeBtn.addEventListener('click', function () {
      self.close();
      self.toggleButton.focus();
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      self.handleSubmit();
    });

    textarea.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        self.handleSubmit();
      }
    });
  };

  ChatPressWidgetApp.prototype.open = function () {
    this.container.classList.add('chatpress-open');
    this.toggleButton.setAttribute('aria-expanded', 'true');
    this.input.focus();
  };

  ChatPressWidgetApp.prototype.close = function () {
    this.container.classList.remove('chatpress-open');
    this.toggleButton.setAttribute('aria-expanded', 'false');
  };

  ChatPressWidgetApp.prototype.handleSubmit = function () {
    var value = (this.input.value || '').trim();
    if (!value) {
      return;
    }
    this.addUserMessage(value);
    this.input.value = '';
    this.input.style.height = 'auto';
    this.handleQuery(value);
  };

  ChatPressWidgetApp.prototype.addUserMessage = function (text) {
    this.appendMessage('user', text, false);
  };

  ChatPressWidgetApp.prototype.addBotMessage = function (text, isHtml) {
    return this.appendMessage('bot', text, !!isHtml);
  };

  ChatPressWidgetApp.prototype.appendMessage = function (type, content, isHtml) {
    var message = document.createElement('div');
    message.className = 'chatpress-message chatpress-message-' + type;
    var bubble = document.createElement('div');
    bubble.className = 'chatpress-bubble';
    if (isHtml) {
      bubble.innerHTML = content;
    } else {
      bubble.textContent = content;
    }
    message.appendChild(bubble);
    this.messagesContainer.appendChild(message);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    return { message: message, bubble: bubble };
  };

  ChatPressWidgetApp.prototype.updateMessage = function (messageRef, options) {
    if (!messageRef || !messageRef.bubble) {
      return;
    }
    var bubble = messageRef.bubble;
    if (options.html) {
      bubble.innerHTML = '';
      if (options.fragment) {
        bubble.appendChild(options.fragment);
      } else {
        bubble.innerHTML = options.content;
      }
    } else {
      bubble.textContent = options.content;
    }
    messageRef.message.classList.remove('chatpress-message-loading');
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  };

  ChatPressWidgetApp.prototype.handleQuery = function (query) {
    var waitingMessage = this.addBotMessage('Looking for relevant information…');
    waitingMessage.message.classList.add('chatpress-message-loading');
    var self = this;
    this.searchManager.search(query).then(function (result) {
      if (result && result.results && result.results.length) {
        var fragment = self.renderResults(result.results, result.provider, result.providerName);
        self.updateMessage(waitingMessage, { html: true, fragment: fragment });
      } else {
        self.updateMessage(waitingMessage, {
          html: false,
          content: 'I could not find information related to that query on this site.'
        });
      }
    }).catch(function (error) {
      console.warn('[ChatPress] Search failed', error);
      self.updateMessage(waitingMessage, {
        html: false,
        content: 'Something went wrong while searching. Please try again.'
      });
    });
  };

  ChatPressWidgetApp.prototype.renderResults = function (results, providerLabel, providerName) {
    var fragment = document.createDocumentFragment();
    var intro = document.createElement('p');
    intro.className = 'chatpress-answer-intro';
    var isLocal = !providerLabel || providerName === 'local content';
    intro.textContent = isLocal
      ? "Here's what I found on this site:"
      : "Here's what I found using " + providerLabel + ': ';
    fragment.appendChild(intro);

    var list = document.createElement('ul');
    list.className = 'chatpress-result-list';

    for (var i = 0; i < results.length; i += 1) {
      var item = results[i];
      var listItem = document.createElement('li');
      listItem.className = 'chatpress-answer-item';

      var titleEl;
      if (item.url) {
        titleEl = document.createElement('a');
        titleEl.href = item.url;
        titleEl.target = '_blank';
        titleEl.rel = 'noopener noreferrer';
      } else {
        titleEl = document.createElement('span');
      }
      titleEl.className = 'chatpress-result-title';
      titleEl.textContent = item.title || ('Result ' + (i + 1));
      listItem.appendChild(titleEl);

      if (item.snippet) {
        var snippet = document.createElement('p');
        snippet.className = 'chatpress-result-snippet';
        snippet.innerHTML = item.snippet;
        listItem.appendChild(snippet);
      }

      list.appendChild(listItem);
    }

    fragment.appendChild(list);
    return fragment;
  };

  function SearchManager(configuration, indexer) {
    this.config = configuration;
    this.indexer = indexer;
    this.maxResults = configuration.maxResults || 3;
    this.providers = this.createProviders();
  }

  SearchManager.prototype.createProviders = function () {
    var providers = [];
    var config = this.config;
    var indexer = this.indexer;
    var maxResults = this.maxResults;

    var customProvider = createCustomAjaxProvider(config, maxResults);
    if (customProvider) {
      providers.push(customProvider);
    }

    var wordpressProvider = createWordPressProvider(config, maxResults);
    if (wordpressProvider) {
      providers.push(wordpressProvider);
    }

    var searchWpProvider = createSearchWpProvider(config, maxResults);
    if (searchWpProvider) {
      providers.push(searchWpProvider);
    }

    var localProvider = createLocalProvider(indexer, maxResults);
    providers.push(localProvider);

    return providers;
  };

  SearchManager.prototype.normalizeResults = function (items, providerName) {
    if (!items || !items.length) {
      return [];
    }
    var normalized = [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] || {};
      var title = stripHTML(item.title || '');
      if (!title) {
        title = 'View result';
      }
      var url = item.url ? String(item.url) : '';
      var snippetText = stripHTML(item.snippet || '');
      var snippet = snippetText ? escapeHtml(cleanWhitespace(snippetText)) : '';
      normalized.push({
        title: title,
        url: url,
        snippet: snippet,
        provider: providerName
      });
    }
    var seen = {};
    var deduped = [];
    for (var j = 0; j < normalized.length; j += 1) {
      var result = normalized[j];
      var key = result.title + '|' + result.url + '|' + result.snippet;
      if (!seen[key]) {
        seen[key] = true;
        deduped.push(result);
      }
    }
    return deduped.slice(0, this.maxResults);
  };

  SearchManager.prototype.search = function (query) {
    var trimmed = (query || '').trim();
    if (!trimmed) {
      return Promise.resolve({ results: [], provider: '', providerName: 'local content' });
    }
    var providers = this.providers;
    var self = this;

    var index = 0;
    function tryNext() {
      if (index >= providers.length) {
        return Promise.resolve({ results: [], provider: '', providerName: 'local content' });
      }
      var provider = providers[index];
      index += 1;
      if (provider.disabled) {
        return tryNext();
      }
      var enabled = true;
      try {
        if (typeof provider.enabled === 'function') {
          enabled = provider.enabled();
        } else if (provider.enabled === false) {
          enabled = false;
        }
      } catch (err) {
        enabled = false;
      }
      if (!enabled) {
        return tryNext();
      }
      return Promise.resolve()
        .then(function () {
          return provider.execute(trimmed, self.maxResults);
        })
        .then(function (results) {
          var normalized = self.normalizeResults(results, provider.name);
          if (normalized.length) {
            return {
              results: normalized,
              provider: provider.label || provider.name,
              providerName: provider.name
            };
          }
          return tryNext();
        })
        .catch(function (error) {
          console.warn('[ChatPress] Provider failed', provider.name, error);
          provider.disabled = true;
          return tryNext();
        });
    }

    return tryNext();
  };

  function createCustomAjaxProvider(configuration, maxResults) {
    if (!configuration.searchEndpoint) {
      return null;
    }
    var headers = configuration.searchHeaders || {};
    var method = (configuration.searchMethod || 'GET').toUpperCase();
    var bodyTemplate = configuration.searchBodyTemplate || null;
    return {
      name: 'custom search',
      label: configuration.searchLabel || 'site search',
      enabled: function () {
        return true;
      },
      execute: function (query) {
        var endpoint = buildUrlWithQuery(configuration.searchEndpoint, query);
        var options = {
          method: method,
          credentials: 'same-origin'
        };
        if (method === 'GET') {
          options.headers = headers;
        } else {
          options.headers = headers;
          var contentType = headers['Content-Type'] || headers['content-type'];
          var body;
          if (bodyTemplate) {
            body = bodyTemplate.replace(/\{\{query\}\}/g, encodeURIComponent(query));
          } else if (contentType && contentType.indexOf('application/json') !== -1) {
            body = JSON.stringify({ query: query });
          } else {
            body = 'query=' + encodeURIComponent(query);
            if (!contentType) {
              options.headers = deepMerge({}, headers);
              options.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
            }
          }
          options.body = body;
        }
        return fetch(endpoint, options).then(function (response) {
          if (!response.ok) {
            throw new Error('Search endpoint returned ' + response.status);
          }
          var contentType = response.headers.get('content-type') || '';
          if (contentType.indexOf('application/json') !== -1 || contentType.indexOf('text/json') !== -1) {
            return response.json();
          }
          return response.text().then(function (text) {
            try {
              return JSON.parse(text);
            } catch (err) {
              return [];
            }
          });
        }).then(function (data) {
          var resultsData = configuration.searchResultsPath
            ? resolvePath(data, configuration.searchResultsPath)
            : data;
          if (!resultsData || !resultsData.length) {
            return [];
          }
          var parsed = [];
          for (var i = 0; i < resultsData.length && parsed.length < maxResults; i += 1) {
            var item = resultsData[i];
            if (!item) continue;
            parsed.push({
              title: resolvePath(item, configuration.searchTitlePath) || resolvePath(item, 'title') || '',
              url: resolvePath(item, configuration.searchUrlPath) || resolvePath(item, 'url') || '',
              snippet: resolvePath(item, configuration.searchSnippetPath) || resolvePath(item, 'snippet') || resolvePath(item, 'excerpt') || ''
            });
          }
          return parsed;
        });
      }
    };
  }

  function createWordPressProvider(configuration, maxResults) {
    if (!isWordPressSite() && !configuration.wordPressEndpoint) {
      return null;
    }
    var base = configuration.wordPressEndpoint
      || (window.wpApiSettings && window.wpApiSettings.root)
      || (window.location.origin + '/wp-json/');
    function normalizeBase(url) {
      if (!url) {
        return '';
      }
      return url.replace(/\/$/, '');
    }
    var normalizedBase = normalizeBase(base);
    return {
      name: 'WordPress search',
      label: 'WordPress search',
      enabled: function () {
        return true;
      },
      execute: function (query) {
        var searchUrl = normalizedBase + '/wp/v2/search?search=' + encodeURIComponent(query) + '&per_page=' + maxResults;
        return fetch(searchUrl, { credentials: 'same-origin' })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('WordPress search failed: ' + response.status);
            }
            return response.json();
          })
          .then(function (results) {
            if (!Array.isArray(results) || !results.length) {
              return [];
            }
            var limited = results.slice(0, maxResults);
            var detailPromises = limited.map(function (item) {
              var subtype = item.subtype || 'posts';
              var id = item.id;
              var url = item.url || '';
              var title = item.title || '';
              var snippet = '';
              if (!id || !subtype) {
                return Promise.resolve({ title: title, url: url, snippet: snippet });
              }
              var detailUrl = normalizedBase + '/' + subtype + '/' + id + '?_fields=link,title.rendered,excerpt.rendered';
              return fetch(detailUrl, { credentials: 'same-origin' })
                .then(function (response) {
                  if (!response.ok) {
                    return { title: title, url: url, snippet: snippet };
                  }
                  return response.json().then(function (detail) {
                    var resolvedTitle = detail && detail.title && detail.title.rendered
                      ? stripHTML(detail.title.rendered)
                      : stripHTML(title);
                    var resolvedUrl = detail && detail.link ? detail.link : url;
                    var resolvedSnippet = detail && detail.excerpt && detail.excerpt.rendered
                      ? stripHTML(detail.excerpt.rendered)
                      : '';
                    if (!resolvedSnippet) {
                      resolvedSnippet = resolvedTitle;
                    }
                    return {
                      title: resolvedTitle,
                      url: resolvedUrl,
                      snippet: resolvedSnippet
                    };
                  });
                })
                .catch(function () {
                  return { title: stripHTML(title), url: url, snippet: stripHTML(title) };
                });
            });
            return Promise.all(detailPromises);
          });
      }
    };
  }

  function createSearchWpProvider(configuration, maxResults) {
    var endpoint = (configuration.searchWP && configuration.searchWP.endpoint)
      || (window.location.origin + '/wp-json/searchwp/v1/search');
    return {
      name: 'SearchWP',
      label: 'SearchWP',
      enabled: function () {
        return true;
      },
      execute: function (query) {
        var url = endpoint + '?per_page=' + maxResults + '&s=' + encodeURIComponent(query);
        return fetch(url, { credentials: 'same-origin' })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('SearchWP request failed: ' + response.status);
            }
            return response.json();
          })
          .then(function (data) {
            var results = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
            var parsed = [];
            for (var i = 0; i < results.length && parsed.length < maxResults; i += 1) {
              var item = results[i] || {};
              parsed.push({
                title: item.title || item.post_title || '',
                url: item.url || item.permalink || '',
                snippet: item.excerpt || item.content || ''
              });
            }
            return parsed;
          });
      }
    };
  }

  function createLocalProvider(indexer, maxResults) {
    return {
      name: 'local content',
      label: 'this page',
      enabled: function () {
        return true;
      },
      execute: function (query) {
        return Promise.resolve(indexer.search(query, maxResults));
      }
    };
  }

  function LocalIndexer(configuration) {
    this.config = configuration;
    this.entries = [];
    this.observer = null;
    this.rebuildTimer = null;
  }

  LocalIndexer.prototype.start = function () {
    var self = this;
    this.buildIndex();
    if (this.config.observeDom !== false && typeof MutationObserver !== 'undefined') {
      this.observer = new MutationObserver(function (mutations) {
        var shouldRebuild = false;
        for (var i = 0; i < mutations.length; i += 1) {
          var mutation = mutations[i];
          if (mutation.addedNodes && mutation.addedNodes.length) {
            shouldRebuild = true;
            break;
          }
          if (mutation.removedNodes && mutation.removedNodes.length) {
            shouldRebuild = true;
            break;
          }
        }
        if (shouldRebuild) {
          self.scheduleRebuild();
        }
      });
      this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  };

  LocalIndexer.prototype.stop = function () {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  };

  LocalIndexer.prototype.scheduleRebuild = function () {
    var self = this;
    if (this.rebuildTimer) {
      return;
    }
    this.rebuildTimer = setTimeout(function () {
      self.rebuildTimer = null;
      self.buildIndex();
    }, 800);
  };

  LocalIndexer.prototype.buildIndex = function () {
    var selectors = this.config.indexSelectors;
    if (!selectors || !selectors.length) {
      selectors = [
        'main',
        'article',
        'section',
        '[role="main"]',
        '.entry-content',
        '.post',
        '.page',
        '.product',
        '.content',
        '.site-main'
      ];
    }
    var nodes = [];
    try {
      nodes = Array.prototype.slice.call(document.querySelectorAll(selectors.join(',')));
    } catch (err) {
      console.warn('[ChatPress] Failed to query index selectors', err);
    }
    if (!nodes.length) {
      nodes = [document.body];
    }
    var entries = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node) continue;
      var text = node.innerText || node.textContent || '';
      var cleaned = cleanWhitespace(text);
      if (!cleaned || cleaned.length < this.config.minSectionLength) {
        continue;
      }
      var heading = findHeading(node);
      var anchor = ensureAnchor(node, i);
      var entry = {
        title: heading || document.title,
        url: anchor ? buildSectionUrl(anchor) : window.location.href,
        text: cleaned,
        textLower: cleaned.toLowerCase()
      };
      entries.push(entry);
    }
    this.entries = dedupeEntries(entries);
  };

  LocalIndexer.prototype.search = function (query, maxResults) {
    var tokens = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      return [];
    }
    var matches = [];
    for (var i = 0; i < this.entries.length; i += 1) {
      var entry = this.entries[i];
      var score = 0;
      for (var t = 0; t < tokens.length; t += 1) {
        var token = tokens[t];
        var occurrences = countOccurrences(entry.textLower, token);
        if (occurrences > 0) {
          score += occurrences * (token.length + 1);
        }
      }
      if (score > 0) {
        matches.push({ entry: entry, score: score });
      }
    }
    matches.sort(function (a, b) { return b.score - a.score; });
    var limited = matches.slice(0, maxResults);
    var results = [];
    for (var j = 0; j < limited.length; j += 1) {
      var match = limited[j];
      results.push({
        title: match.entry.title,
        url: match.entry.url,
        snippet: this.createSnippet(match.entry.text, tokens),
        score: match.score
      });
    }
    return results;
  };

  LocalIndexer.prototype.createSnippet = function (text, tokens) {
    if (!text) {
      return '';
    }
    var lower = text.toLowerCase();
    var firstIndex = -1;
    for (var i = 0; i < tokens.length; i += 1) {
      var idx = lower.indexOf(tokens[i]);
      if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
        firstIndex = idx;
      }
    }
    if (firstIndex === -1) {
      firstIndex = 0;
    }
    var start = Math.max(0, firstIndex - 80);
    var end = Math.min(text.length, firstIndex + 220);
    var snippet = text.slice(start, end);
    snippet = cleanWhitespace(snippet);
    if (start > 0) {
      snippet = '…' + snippet;
    }
    if (end < text.length) {
      snippet = snippet + '…';
    }
    return snippet;
  };

  function countOccurrences(haystack, needle) {
    if (!haystack || !needle) {
      return 0;
    }
    var count = 0;
    var position = 0;
    while (true) {
      var foundIndex = haystack.indexOf(needle, position);
      if (foundIndex === -1) {
        break;
      }
      count += 1;
      position = foundIndex + needle.length;
    }
    return count;
  }

  function findHeading(node) {
    var heading = node.querySelector && node.querySelector('h1, h2, h3, [data-title]');
    if (heading) {
      return cleanWhitespace(heading.textContent || heading.innerText || '');
    }
    var current = node;
    while (current && current !== document.body) {
      if (current.previousElementSibling) {
        var siblingHeading = current.previousElementSibling.querySelector && current.previousElementSibling.querySelector('h1, h2, h3, [data-title]');
        if (siblingHeading) {
          return cleanWhitespace(siblingHeading.textContent || siblingHeading.innerText || '');
        }
      }
      current = current.parentElement;
    }
    return '';
  }

  function ensureAnchor(node, index) {
    if (!node) {
      return '';
    }
    if (node.id) {
      return node.id;
    }
    var anchor = node.getAttribute('data-chatpress-anchor');
    if (anchor) {
      return anchor;
    }
    anchor = 'chatpress-section-' + index;
    node.setAttribute('data-chatpress-anchor', anchor);
    if (!document.getElementById(anchor)) {
      try {
        node.id = anchor;
      } catch (err) {
        /* ignore */
      }
    }
    return anchor;
  }

  function buildSectionUrl(anchor) {
    var base = window.location.href.split('#')[0];
    return anchor ? base + '#' + anchor : base;
  }

  function dedupeEntries(entries) {
    if (!entries || !entries.length) {
      return [];
    }
    var seen = {};
    var deduped = [];
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      var key = entry.text.slice(0, 200);
      if (seen[key]) {
        continue;
      }
      seen[key] = true;
      deduped.push(entry);
    }
    return deduped;
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function bootstrap() {
    if (window.ChatPressWidget && window.ChatPressWidget.initialized) {
      return;
    }
    var app = new ChatPressWidgetApp(config);
    app.init();
    var api = window.ChatPressWidget || {};
    api.version = VERSION;
    api.initialized = true;
    api.open = function () { app.open(); };
    api.close = function () { app.close(); };
    api.refreshIndex = function () {
      if (app.indexer) {
        app.indexer.buildIndex();
      }
    };
    api.updateConfig = function (partial) {
      if (!partial || typeof partial !== 'object') {
        return;
      }
      deepMerge(config, partial);
      if (app.container) {
        app.container.style.setProperty('--chatpress-brand-color', config.brandColor);
        app.container.style.setProperty('--chatpress-text-color', config.textColor);
        app.container.style.setProperty('--chatpress-background-color', config.backgroundColor);
      }
    };
    api.getConfig = function () {
      return deepMerge({}, config);
    };
    api.instance = app;
    window.ChatPressWidget = api;
  }

  onReady(bootstrap);
})();
