<?php
/** Plugin Name: Sudban Catalog Connector */
if (!defined('ABSPATH')) { exit; }

add_action('admin_menu', function () {
    add_submenu_page('woocommerce', 'Sudban', 'Sudban', 'manage_woocommerce', 'sudban', 'sudban_catalog_page');
});

function sudban_catalog_page() {
    if (!current_user_can('manage_woocommerce')) { return; }
    $message = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        check_admin_referer('sudban_catalog');
        $url = esc_url_raw(wp_unslash($_POST['endpoint'] ?? ''));
        $key = sanitize_text_field(wp_unslash($_POST['key'] ?? ''));
        $unit = sanitize_text_field(wp_unslash($_POST['unit'] ?? 'IRR'));
        $page = max(1, absint($_POST['page'] ?? 1));
        if (!wp_http_validate_url($url) || wp_parse_url($url, PHP_URL_SCHEME) !== 'https' || !in_array($unit, array('IRR', 'IRT'), true) || !$key) {
            $message = 'Enter a public HTTPS Sudban endpoint, member API key and valid currency unit.';
        } elseif (!function_exists('wc_get_products')) {
            $message = 'WooCommerce must be active.';
        } else {
            $products = wc_get_products(array('status' => 'publish', 'limit' => 100, 'page' => $page, 'orderby' => 'ID', 'order' => 'ASC', 'type' => array('simple', 'variation')));
            $rows = array();
            foreach ($products as $product) {
                if ($product->get_sku() !== '' && $product->get_price() !== '') {
                    $rows[] = array('sku' => $product->get_sku(), 'name' => $product->get_name(), 'price' => (float) $product->get_price());
                }
            }
            $response = wp_safe_remote_post(rtrim($url, '/') . '/merchant/woocommerce/catalog', array(
                'timeout' => 20, 'redirection' => 0,
                'headers' => array('Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'),
                'body' => wp_json_encode(array('unit' => $unit, 'products' => $rows)),
            ));
            $message = !is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200
                ? count($rows) . ' catalog products synchronized. Advance to the next page for more products.'
                : 'Synchronization failed. Check endpoint and permissions. No external prices were changed.';
        }
    }
    ?>
    <div class="wrap"><h1>Sudban Catalog Connector</h1>
    <p>One-way catalog sync using supported WooCommerce APIs. No scraping or automatic marketplace price changes. Costs must be completed in Sudban.</p>
    <?php if ($message) { ?><div class="notice notice-info"><p><?php echo esc_html($message); ?></p></div><?php } ?>
    <form method="post">
        <?php wp_nonce_field('sudban_catalog'); ?>
        <p><label>Sudban HTTPS base URL <input name="endpoint" type="url" required size="60"></label></p>
        <p><label>Owner/manager API key <input name="key" type="password" required autocomplete="off" size="60"></label></p>
        <p><label>WooCommerce price unit <select name="unit"><option value="IRR">Rial</option><option value="IRT">Toman</option></select></label></p>
        <p><label>Page (100 products per request) <input name="page" type="number" min="1" value="1"></label></p>
        <button class="button button-primary" type="submit">Synchronize this page</button>
    </form></div>
    <?php
}
