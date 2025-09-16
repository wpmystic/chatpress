# ChatPress Widget

A lightweight, embeddable chatbot widget that answers questions using only the content available on the site where it is installed. The widget automatically indexes visible page content, optionally integrates with existing search endpoints (including WordPress REST, `wp_ajax`, SearchWP and other JSON APIs), and exposes a drop-in `<script>` embed for any platform.

## Features

- 🔍 **Site-aware answers**: Responses are composed from on-page copy, site search results, or both. No external knowledge sources are used, preventing hallucinations.
- ⚡ **Lightweight + async**: Single-file vanilla JavaScript embed (no framework, no build tools required). Loads asynchronously and defers indexing until the DOM is ready.
- ♻️ **Auto-indexing**: Automatically scans and re-indexes page sections (main, article, product listings, etc.) and listens for DOM mutations to capture dynamically injected content.
- 🔗 **Search integrations**: Built-in adapters for WordPress REST search and SearchWP. Custom AJAX/JSON search endpoints can be configured with a single attribute, including support for admin-ajax handlers or plugin APIs.
- 🧩 **Framework agnostic**: Works on WordPress, Shopify, static HTML, or any CMS that allows adding a script tag.
- 🎨 **Customisable UI**: CSS variables and runtime configuration control brand colours, greeting text, button positioning, default open state and more.

## 1. Embed the widget

Host `dist/chatpress-widget.js` on your CDN (or upload to your CMS) and include it on every page where you want the assistant to be available:

```html
<script
  src="/path/to/chatpress-widget.js"
  data-chatpress-config='{
    "brandColor": "#1d4ed8",
    "greeting": "Hi! I can help you find anything on this site.",
    "position": "bottom-right",
    "defaultOpen": false
  }'
  defer
></script>
```

The widget injects itself into the page footer. All configuration is optional.

### Runtime configuration API

Instead of (or in addition to) `data-chatpress-config`, you can define a `window.ChatPressConfig` object before loading the script. After initialisation the global `window.ChatPressWidget` API exposes helper methods:

```html
<script>
  window.ChatPressConfig = {
    brandColor: '#10b981',
    greeting: 'Ask me about our services!'
  };
</script>
<script src="/path/to/chatpress-widget.js" defer></script>
<script>
  // later, e.g. after a theme toggle
  window.ChatPressWidget.updateConfig({ brandColor: '#f97316' });
  window.ChatPressWidget.open();
</script>
```

Available widget options:

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `brandColor` | `string` | `#2563eb` | Primary accent colour (buttons, highlights). |
| `textColor` | `string` | `#0f172a` | Base text colour within the widget. |
| `backgroundColor` | `string` | `#ffffff` | Panel background colour. |
| `position` | `'bottom-right' \| 'bottom-left'` | `bottom-right` | Floating button position. |
| `defaultOpen` | `boolean` | `false` | Open the chat panel on load. |
| `greeting` | `string` | Friendly welcome message shown once. |
| `maxResults` | `number` | `3` | Number of results/snippets returned per reply. |
| `searchEndpoint` | `string` | `null` | Custom AJAX/REST endpoint (supports `{{query}}` placeholder). |
| `searchMethod` | `'GET' \| 'POST'` | `GET` | HTTP method for the custom endpoint. |
| `searchHeaders` | `object` | `null` | Headers for custom endpoint requests. |
| `searchBodyTemplate` | `string` | `null` | Body template for `POST` requests (use `{{query}}` placeholder). |
| `searchResultsPath` | `string` | `''` | Dot-notation path to array of results in the JSON payload. |
| `searchTitlePath` | `string` | `'title'` | Dot-notation path to each result title. |
| `searchUrlPath` | `string` | `'url'` | Dot-notation path to each result permalink. |
| `searchSnippetPath` | `string` | `'snippet'` | Dot-notation path to each result summary/excerpt. |
| `searchLabel` | `string` | `'site search'` | Label shown when results come from the custom endpoint. |
| `indexSelectors` | `string[]` | Auto-detected | Optional selector override for DOM indexing. |
| `observeDom` | `boolean` | `true` | Re-index automatically when the DOM changes. |
| `minSectionLength` | `number` | `80` | Minimum characters required for a section to be indexed. |

## 2. Search provider integration

The widget tries search sources in order:

1. **Custom AJAX endpoint** (if `searchEndpoint` is provided).
2. **WordPress REST search** (`/wp-json/wp/v2/search`), with automatic excerpt lookups.
3. **SearchWP REST API** (`/wp-json/searchwp/v1/search`).
4. **Local DOM index fallback** (keyword search across page sections).

### 2.1 Custom AJAX/JSON endpoint

If your site already exposes a search API that returns JSON, point the widget to it:

```html
<script
  src="/path/to/chatpress-widget.js"
  data-chatpress-config='{
    "searchEndpoint": "/wp-admin/admin-ajax.php?action=chatpress_search&term={{query}}",
    "searchResultsPath": "data.results",
    "searchTitlePath": "title",
    "searchUrlPath": "permalink",
    "searchSnippetPath": "excerpt",
    "searchLabel": "Live search"
  }'
  defer
></script>
```

### 2.2 WordPress `wp_ajax` handler example

Add the following to your theme’s `functions.php` (or a small plugin) to expose an AJAX endpoint that returns post titles, permalinks and excerpts:

```php
add_action('wp_ajax_nopriv_chatpress_search', 'chatpress_ajax_search');
add_action('wp_ajax_chatpress_search', 'chatpress_ajax_search');

function chatpress_ajax_search() {
    $term = isset($_GET['term']) ? sanitize_text_field(wp_unslash($_GET['term'])) : '';
    $results = [];

    if ($term) {
        $query = new WP_Query([
            's' => $term,
            'posts_per_page' => 5,
        ]);

        foreach ($query->posts as $post) {
            $results[] = [
                'title'    => get_the_title($post),
                'permalink'=> get_permalink($post),
                'excerpt'  => wp_strip_all_tags(get_the_excerpt($post)),
            ];
        }
    }

    wp_send_json(['data' => ['results' => $results]]);
}
```

### 2.3 SearchWP REST integration example

SearchWP (v4+) exposes `/wp-json/searchwp/v1/search`. Configure the widget to consume it directly:

```html
<script
  src="/path/to/chatpress-widget.js"
  data-chatpress-config='{
    "searchWP": {"endpoint": "/wp-json/searchwp/v1/search"},
    "searchLabel": "SearchWP"
  }'
  defer
></script>
```

No additional configuration is required—the widget automatically maps the SearchWP response format.

## 3. WordPress plugin + shortcode

A ready-to-use plugin lives in [`wordpress/chatpress-plugin.php`](wordpress/chatpress-plugin.php). Install it by copying the folder into `wp-content/plugins/chatpress-widget/` and activate it from the admin dashboard.

The plugin:

- Enqueues `chatpress-widget.js` (served from the plugin’s `assets/` directory) on the frontend.
- Localises default options via `window.ChatPressConfig`.
- Registers a `[chatpress_widget]` shortcode so you can control where the script loads.

Example shortcode usage inside a post or template:

```php
echo do_shortcode('[chatpress_widget]');
```

> **Tip:** Because the widget injects itself into the page automatically, the shortcode simply ensures the assets are loaded on that request; it doesn’t output any markup.

## 4. Styling with CSS variables

Override any of the exposed CSS custom properties globally or per-page:

```css
.chatpress-widget {
  --chatpress-brand-color: #f97316;
  --chatpress-text-color: #0f172a;
  --chatpress-background-color: #ffffff;
  --chatpress-bot-bubble: #f1f5f9;
  --chatpress-user-bubble: #111827;
  --chatpress-user-text: #ffffff;
}
```

You can also toggle themes dynamically via `window.ChatPressWidget.updateConfig({ brandColor: '#9333ea' })`.

## 5. How indexing works

- When the page loads, the widget scans `main`, `article`, `section`, `.entry-content`, `.product`, `.site-main`, and other common containers for visible text (minimum length 80 characters).
- Each section is tagged with a unique anchor so responses can link directly to the relevant portion of the page.
- A `MutationObserver` watches for added/removed nodes and rebuilds the index with a debounce, ensuring newly published products or AJAX-injected content are searchable.
- If no remote search results are returned, the assistant falls back to the local index using keyword scoring (term frequency) to surface relevant snippets.

## 6. Hosting / distribution

- **CDN / static hosting:** Upload `dist/chatpress-widget.js` and reference the absolute URL in your embed snippet.
- **WordPress plugin:** Copy `dist/chatpress-widget.js` into `wordpress/assets/chatpress-widget.js` (the plugin expects this path) before activating.
- **Other platforms:** Paste the embed snippet into theme layout files (Shopify), the site footer (Squarespace), or raw HTML (static sites).

## 7. Global API summary

After initialisation `window.ChatPressWidget` exposes:

| Method | Description |
| ------ | ----------- |
| `open()` / `close()` | Toggle the chat panel. |
| `refreshIndex()` | Manually rebuild the local DOM index. Useful after injecting content. |
| `updateConfig(partialConfig)` | Merge new config values (colours, greeting, etc.). |
| `getConfig()` | Retrieve the current effective configuration. |
| `version` | String version identifier of the widget. |

---

Need help or have improvements? Open an issue or PR with your enhancements.
