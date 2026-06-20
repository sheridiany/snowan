//! Backend command construction for development and packaged builds.

#[cfg(not(debug_assertions))]
use std::path::PathBuf;

#[cfg(not(debug_assertions))]
use tauri::Manager;
use tauri_plugin_shell::{process::Command, ShellExt};

/// Builds the command used to start the Python backend sidecar in development.
///
/// Runs the backend straight from source via `uv` so changes are picked up
/// without a rebuild. The child inherits the ambient environment (notably
/// `HOME`) so it can read and write `~/.snowan`.
#[cfg(debug_assertions)]
pub(super) fn create(app: &tauri::AppHandle) -> Result<Command, String> {
    let backend_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("backend");
    let source_path = backend_dir.join("src");
    log::info!(
        "[backend] dev command: uv run python -m snowan._sidecar --port 8787 cwd={}",
        backend_dir.display(),
    );
    Ok(app
        .shell()
        .command("uv")
        .args(["run", "python", "-m", "snowan._sidecar", "--port", "8787"])
        .current_dir(backend_dir)
        .env("PYTHONPATH", source_path.display().to_string()))
}

/// Builds the command used to start the packaged Python backend sidecar.
///
/// The sidecar is a PyInstaller onedir bundle shipped under the app's resource
/// directory. We run it from inside its own directory so the relative paths
/// PyInstaller bakes in resolve correctly, and we leave the environment intact
/// so the child inherits `HOME` for `~/.snowan`.
#[cfg(not(debug_assertions))]
pub(super) fn create(app: &tauri::AppHandle) -> Result<Command, String> {
    let backend = packaged_backend_executable(app)?;
    let backend_dir = backend
        .parent()
        .ok_or_else(|| format!("backend executable has no parent: {}", backend.display()))?
        .to_path_buf();
    log::info!(
        "[backend] packaged command: {} --port 8787 cwd={}",
        backend.display(),
        backend_dir.display(),
    );
    Ok(app
        .shell()
        .command(backend)
        .args(["--port", "8787"])
        .current_dir(&backend_dir))
}

#[cfg(not(debug_assertions))]
fn packaged_backend_executable(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let executable_name = if cfg!(windows) {
        "snowan-backend.exe"
    } else {
        "snowan-backend"
    };
    let path = app
        .path()
        .resource_dir()
        .map_err(|err| format!("failed to resolve resource directory: {err}"))?
        .join("binaries")
        .join("snowan-backend")
        .join(executable_name);

    if path.is_file() {
        Ok(path)
    } else {
        Err(format!(
            "backend executable not found at {}",
            path.display()
        ))
    }
}
