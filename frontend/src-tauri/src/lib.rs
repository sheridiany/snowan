use tauri::{Manager, RunEvent, WindowEvent};
#[cfg(target_os = "macos")]
use tauri_plugin_decorum::WebviewWindowExt;

mod backend;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(backend::SidecarState::default())
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
            // Launch the Python backend sidecar (dev: uv run from source · release:
            // the bundled PyInstaller binary). Async so setup doesn't block.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(err) = backend::spawn(&handle).await {
                    log::error!("[backend] failed to start: {err}");
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                backend::kill(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                backend::kill(app_handle);
            }
        });
}
