use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Get the primary monitor
            if let Some(monitor) = window.current_monitor()? {
                let screen_size = monitor.size();

                // Use configured window size (290x380) instead of outer_size
                // to avoid issues with frameless windows on macOS
                let window_width = 290;
                let window_height = 380;

                // Calculate bottom-right corner position
                // Add padding from edges (20px from right and bottom)
                let x = screen_size.width as i32 - window_width - 200;
                let y = screen_size.height as i32 - window_height + 30;

                // Position window in bottom-right corner
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x,
                    y,
                }))?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
