use tauri::Manager;
#[cfg(target_os = "macos")]
use tauri_plugin_decorum::WebviewWindowExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // The window already uses titleBarStyle "Overlay" (tauri.conf), so we
            // only need decorum to reposition the native traffic lights — NOT its
            // overlay titlebar, whose injected position:fixed 32px drag <div>
            // (z-index 100) sits over our React titlebar and eats every click on
            // the collapse/back/forward buttons. Our own titlebar carries the
            // drag region, so we skip create_overlay_titlebar() entirely.
            //
            // y = 21 centers the lights on the 44px titlebar icon row; the user
            // prefers them sitting a touch lower, so we inset a few px more.
            #[cfg(target_os = "macos")]
            {
                let win = app.get_webview_window("main").unwrap();
                win.set_traffic_lights_inset(16.0, 23.0).unwrap();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
