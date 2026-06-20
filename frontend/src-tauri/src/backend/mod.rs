//! Backend sidecar lifecycle for the Snowan desktop app.
//!
//! The sidecar is a FastAPI/uvicorn server (port 8787) launched either from
//! source via `uv` in development or from a bundled PyInstaller onedir binary in
//! release. It owns `~/.snowan`, so the child must inherit `HOME` — we never
//! clear its environment.

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

mod command;

/// Shared sidecar process handle managed by Tauri.
#[derive(Default)]
pub struct SidecarState {
    child: Mutex<Option<CommandChild>>,
}

/// Best-effort: kill anything bound to our fixed port 8787 before spawning. macOS
/// quit events (CloseRequested/ExitRequested) are unreliable, so a previous run can
/// leave an orphaned backend holding the port; reaping it here makes startup self-heal.
fn free_port() {
    let _ = std::process::Command::new("sh")
        .arg("-c")
        .arg("pids=$(lsof -ti tcp:8787 2>/dev/null); [ -n \"$pids\" ] && kill -9 $pids; exit 0")
        .status();
}

/// Spawns the backend sidecar, stores its handle, and watches its output.
///
/// Emits a `backend-ready` event once the sidecar prints its readiness sentinel
/// (`SNOWAN_READY`) or uvicorn reports the server is up.
pub async fn spawn(app: &AppHandle) -> Result<(), String> {
    free_port();
    let command = command::create(app)?;

    log::info!("[backend] starting sidecar");
    let (mut rx, child) = command
        .spawn()
        .map_err(|err| format!("failed to spawn backend: {err}"))?;

    let pid = child.pid();
    log::info!("[backend] spawned pid={pid}");
    *app.state::<SidecarState>()
        .child
        .lock()
        .expect("sidecar state poisoned") = Some(child);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut ready = false;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    log::info!("[backend] stdout: {}", text.trim_end());
                    if !ready && (text.contains("SNOWAN_READY") || text.contains("Uvicorn running"))
                    {
                        ready = true;
                        log::info!("[backend] ready");
                        let _ = app.emit("backend-ready", ());
                    }
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    log::warn!("[backend] stderr: {}", text.trim_end());
                    if !ready && text.contains("Uvicorn running") {
                        ready = true;
                        log::info!("[backend] ready");
                        let _ = app.emit("backend-ready", ());
                    }
                }
                CommandEvent::Error(message) => {
                    log::error!("[backend] process event error: {message}");
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!("[backend] process terminated: {payload:?}");
                }
                _ => {}
            }
        }
        log::warn!("[backend] process event stream closed");
    });

    Ok(())
}

/// Terminates the current sidecar process, if one is running.
pub fn kill(app: &AppHandle) {
    let child = app
        .state::<SidecarState>()
        .child
        .lock()
        .expect("sidecar state poisoned")
        .take();
    if let Some(child) = child {
        let pid = child.pid();
        log::info!("[backend] stopping process pid={pid}");
        if let Err(err) = child.kill() {
            log::warn!("[backend] failed to stop process: {err}");
        }
    }
}
