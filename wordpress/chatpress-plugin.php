<?php
/**
 * Plugin Name: ChatPress Widget
 * Plugin URI: https://github.com/openai/chatpress
 * Description: Embeds the ChatPress on-site chatbot widget and exposes a shortcode for manual placement.
 * Version: 1.0.0
 * Author: ChatPress
 * License: MIT
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CHATPRESS_WIDGET_VERSION', '1.0.0');
define('CHATPRESS_WIDGET_OPTION_NAME', 'chatpress_widget_settings');

/**
 * Return the default settings stored via the WordPress Settings API.
 *
 * @return array
 */
function chatpress_widget_get_default_settings() {
    return array(
        'openai_api_key' => '',
        'sitemap_url'    => '',
        'model'          => 'gpt-4o-mini',
    );
}

/**
 * Retrieve plugin settings merged with defaults.
 *
 * @return array
 */
function chatpress_widget_get_settings() {
    $settings = get_option(CHATPRESS_WIDGET_OPTION_NAME, array());

    if (!is_array($settings)) {
        $settings = array();
    }

    return wp_parse_args($settings, chatpress_widget_get_default_settings());
}

/**
 * Sanitize Settings API submissions.
 *
 * @param array $input Raw option data.
 * @return array
 */
function chatpress_widget_sanitize_settings($input) {
    $defaults  = chatpress_widget_get_default_settings();
    $sanitized = array();

    if (isset($input['openai_api_key'])) {
        $sanitized['openai_api_key'] = sanitize_text_field(wp_unslash($input['openai_api_key']));
    }

    if (isset($input['sitemap_url'])) {
        $sanitized['sitemap_url'] = esc_url_raw(wp_unslash($input['sitemap_url']));
    }

    if (isset($input['model'])) {
        $sanitized['model'] = sanitize_text_field(wp_unslash($input['model']));
    }

    $sanitized = wp_parse_args($sanitized, $defaults);

    if ('' === $sanitized['model']) {
        $sanitized['model'] = $defaults['model'];
    }

    return $sanitized;
}

/**
 * Register the settings page, sections and fields.
 */
function chatpress_widget_register_settings() {
    register_setting(
        'chatpress_widget',
        CHATPRESS_WIDGET_OPTION_NAME,
        array(
            'type'              => 'array',
            'sanitize_callback' => 'chatpress_widget_sanitize_settings',
            'default'           => chatpress_widget_get_default_settings(),
        )
    );

    add_settings_section(
        'chatpress_widget_main',
        __('Assistant configuration', 'chatpress-widget'),
        'chatpress_widget_settings_section_intro',
        'chatpress_widget'
    );

    add_settings_field(
        'chatpress_openai_api_key',
        __('OpenAI API key', 'chatpress-widget'),
        'chatpress_widget_render_api_key_field',
        'chatpress_widget',
        'chatpress_widget_main'
    );

    add_settings_field(
        'chatpress_sitemap_url',
        __('Sitemap / REST URL', 'chatpress-widget'),
        'chatpress_widget_render_sitemap_field',
        'chatpress_widget',
        'chatpress_widget_main'
    );

    add_settings_field(
        'chatpress_model',
        __('OpenAI model', 'chatpress-widget'),
        'chatpress_widget_render_model_field',
        'chatpress_widget',
        'chatpress_widget_main'
    );
}
add_action('admin_init', 'chatpress_widget_register_settings');

/**
 * Render Settings API section intro copy.
 */
function chatpress_widget_settings_section_intro() {
    echo '<p>' . esc_html__(
        'Provide your ChatPress API credentials and content source so the widget can answer site-specific questions.',
        'chatpress-widget'
    ) . '</p>';
}

/**
 * Render the OpenAI API key field.
 */
function chatpress_widget_render_api_key_field() {
    $settings = chatpress_widget_get_settings();

    printf(
        '<input type="password" id="chatpress_openai_api_key" name="%1$s[openai_api_key]" value="%2$s" class="regular-text" autocomplete="off" />',
        esc_attr(CHATPRESS_WIDGET_OPTION_NAME),
        esc_attr($settings['openai_api_key'])
    );
    echo '<p class="description">' . esc_html__(
        'Used by the frontend widget to call the ChatPress API via OpenAI.',
        'chatpress-widget'
    ) . '</p>';
}

/**
 * Render the sitemap/REST URL field.
 */
function chatpress_widget_render_sitemap_field() {
    $settings = chatpress_widget_get_settings();

    printf(
        '<input type="url" id="chatpress_sitemap_url" name="%1$s[sitemap_url]" value="%2$s" class="regular-text" placeholder="https://example.com/wp-json/wp/v2/search" />',
        esc_attr(CHATPRESS_WIDGET_OPTION_NAME),
        esc_attr($settings['sitemap_url'])
    );
    echo '<p class="description">' . esc_html__(
        'Optional. Point to a sitemap or JSON endpoint used to fetch additional context for answers.',
        'chatpress-widget'
    ) . '</p>';
}

/**
 * Render the OpenAI model field.
 */
function chatpress_widget_render_model_field() {
    $settings = chatpress_widget_get_settings();

    printf(
        '<input type="text" id="chatpress_model" name="%1$s[model]" value="%2$s" class="regular-text" placeholder="gpt-4o-mini" />',
        esc_attr(CHATPRESS_WIDGET_OPTION_NAME),
        esc_attr($settings['model'])
    );
    echo '<p class="description">' . esc_html__(
        'Defaults to gpt-4o-mini. Override to use a different OpenAI model identifier.',
        'chatpress-widget'
    ) . '</p>';
}

/**
 * Register the settings page in the WordPress admin.
 */
function chatpress_widget_add_settings_page() {
    add_options_page(
        __('ChatPress Widget', 'chatpress-widget'),
        __('ChatPress Widget', 'chatpress-widget'),
        'manage_options',
        'chatpress-widget',
        'chatpress_widget_render_settings_page'
    );
}
add_action('admin_menu', 'chatpress_widget_add_settings_page');

/**
 * Output the settings page markup.
 */
function chatpress_widget_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    echo '<div class="wrap">';
    echo '<h1>' . esc_html__('ChatPress Widget settings', 'chatpress-widget') . '</h1>';

    settings_errors('chatpress_widget');

    echo '<form action="options.php" method="post">';
    settings_fields('chatpress_widget');
    do_settings_sections('chatpress_widget');
    submit_button();
    echo '</form>';
    echo '</div>';
}

/**
 * Register the widget script so it can be enqueued when needed.
 */
function chatpress_widget_register_assets() {
    $handle = 'chatpress-widget';
    $src    = plugin_dir_url(__FILE__) . 'assets/chatpress-widget.js';

    wp_register_script($handle, $src, array(), CHATPRESS_WIDGET_VERSION, true);
}
add_action('wp_enqueue_scripts', 'chatpress_widget_register_assets');

/**
 * Enqueue the script and push default configuration to the frontend.
 *
 * Stored settings from the admin screen are merged into the defaults before localisation.
 *
 * @param array $overrides Optional configuration overrides passed from the shortcode or theme.
 */
function chatpress_widget_enqueue($overrides = array()) {
    static $enqueued = false;
    if ($enqueued) {
        return;
    }
    $enqueued = true;

    if (!wp_script_is('chatpress-widget', 'registered')) {
        chatpress_widget_register_assets();
    }

    $settings = chatpress_widget_get_settings();

    $defaults = array(
        'brandColor' => '#2563eb',
        'greeting'   => __('Hi there! Ask me anything about this site.', 'chatpress-widget'),
        'position'   => 'bottom-right',
        'openAiApiKey' => $settings['openai_api_key'],
        'sitemapUrl'   => $settings['sitemap_url'],
        'model'        => $settings['model'],
    );

    $config = wp_parse_args($overrides, apply_filters('chatpress_widget_default_config', $defaults));

    wp_localize_script('chatpress-widget', 'ChatPressConfig', $config);
    wp_enqueue_script('chatpress-widget');
}

/**
 * Shortcode handler to ensure the assets load on specific pages.
 * Usage: [chatpress_widget brandColor="#111827" greeting="Ask about our products"]
 *
 * @param array $atts
 * @return string Empty placeholder (widget renders itself automatically)
 */
function chatpress_widget_shortcode($atts = array()) {
    $atts = shortcode_atts(array(
        'brandColor' => null,
        'greeting'   => null,
        'position'   => null,
    ), $atts, 'chatpress_widget');

    $overrides = array_filter($atts);
    chatpress_widget_enqueue($overrides);

    return '<!-- ChatPress widget assets enqueued -->';
}
add_shortcode('chatpress_widget', 'chatpress_widget_shortcode');

/**
 * Auto-enqueue the widget on every frontend page. Developers can disable this
 * behaviour via the `chatpress_widget_auto_enqueue` filter.
 */
function chatpress_widget_maybe_enqueue() {
    $should_enqueue = apply_filters('chatpress_widget_auto_enqueue', true);
    if ($should_enqueue) {
        chatpress_widget_enqueue();
    }
}
add_action('wp_footer', 'chatpress_widget_maybe_enqueue', 5);
