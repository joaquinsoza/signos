use tauri::Manager;

#[cfg(target_os = "macos")]
use tauri_nspanel::{tauri_panel, CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt};

#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(SignosPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init());

    // Add nspanel plugin only on macOS
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                // Set activation policy to Accessory to prevent dock icon
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            let window = app.get_webview_window("main").unwrap();

            // Convert window to panel on macOS for fullscreen support
            #[cfg(target_os = "macos")]
            {
                let panel = window.to_panel::<SignosPanel>().unwrap();

                // Set panel level to floating (appears above fullscreen apps)
                panel.set_level(PanelLevel::Floating.value());

                // Ensures the panel cannot activate the app
                panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());

                // Allows the panel to:
                // - display on the same space as the full screen window
                // - join all spaces
                panel.set_collection_behavior(
                    CollectionBehavior::new()
                        .full_screen_auxiliary()
                        .can_join_all_spaces()
                        .into(),
                );
            }

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
