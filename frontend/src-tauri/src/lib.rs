use tauri::Manager;
#[cfg(target_os = "macos")]
use tauri_plugin_decorum::WebviewWindowExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_decorum::init())
        .setup(|app| {
            // Tauri's config `trafficLightPosition` does not reliably apply, so we
            // position the macOS traffic lights at runtime to align their center
            // with the 44px titlebar icons (center y = 22). Per decorum's math the
            // button center = y/2 + button_height/2 + 4; macOS button height is
            // 14–16, so y = 21 centers the lights at ~22 within half a pixel.
            #[cfg(target_os = "macos")]
            {
                let win = app.get_webview_window("main").unwrap();
                win.create_overlay_titlebar().unwrap();
                win.set_traffic_lights_inset(16.0, 21.0).unwrap();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
