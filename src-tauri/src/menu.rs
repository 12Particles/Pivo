use tauri::{Emitter, Manager};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

pub fn setup_menu_events(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create custom menu items
    let settings = MenuItemBuilder::new("Settings")
        .id("settings")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
        
    let view_logs = MenuItemBuilder::new("View Logs")
        .id("view_logs")
        .accelerator("CmdOrCtrl+L")
        .build(app)?;
        
    let clear_logs = MenuItemBuilder::new("Clear Logs")
        .id("clear_logs")
        .build(app)?;
    
    // Create File submenu
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&settings)
        .separator()
        .close_window()
        .build()?;
        
    // Create Logs submenu
    let logs_menu = SubmenuBuilder::new(app, "Logs")
        .item(&view_logs)
        .item(&clear_logs)
        .build()?;
    
    // Build the complete menu
    let mut menu_builder = MenuBuilder::new(app);
    
    // On macOS, add app menu
    #[cfg(target_os = "macos")]
    {
        let app_menu = SubmenuBuilder::new(app, "Pivo")
            .about(None)
            .separator()
            .item(&settings.clone())
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others() 
            .show_all()
            .separator()
            .quit()
            .build()?;
        menu_builder = menu_builder.item(&app_menu);
    }
    
    // Add other menus
    menu_builder = menu_builder
        .item(&file_menu)
        .item(&logs_menu);
        
    let menu = menu_builder.build()?;
    
    // Set the menu for the app
    app.set_menu(menu)?;
    
    // Handle menu events
    app.on_menu_event(move |app, event| {
        let window = app.get_webview_window("main");
        
        match event.id().as_ref() {
            "settings" => {
                if let Some(window) = window {
                    window.emit("menu-settings", ()).unwrap();
                }
            }
            "view_logs" => {
                if let Some(window) = window {
                    window.emit("menu-view-logs", ()).unwrap();
                }
            }
            "clear_logs" => {
                if let Err(e) = clear_logs_internal() {
                    log::error!("Failed to clear logs: {}", e);
                } else {
                    if let Some(window) = window {
                        window.emit("menu-logs-cleared", ()).unwrap();
                    }
                }
            }
            _ => {}
        }
    });
    
    log::info!("Menu events setup complete");
    Ok(())
}

// Removed unused functions emit_view_logs and emit_clear_logs

fn clear_logs_internal() -> Result<(), Box<dyn std::error::Error>> {
    let log_path = crate::logging::get_log_file_path();
    if log_path.exists() {
        std::fs::write(&log_path, "")?;
    }
    log::info!("Logs cleared");
    Ok(())
}