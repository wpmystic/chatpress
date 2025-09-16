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

    $defaults = array(
        'brandColor' => '#2563eb',
        'greeting'   => __('Hi there! Ask me anything about this site.', 'chatpress-widget'),
        'position'   => 'bottom-right',
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
