use tauri::{Emitter, Manager};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

pub fn setup_menu_events(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create custom menu items
    let open_project = MenuItemBuilder::new("Open Project")
        .id("open_project")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
        
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
    
    // Create Recent Projects submenu
    let recent_projects_menu = create_recent_projects_submenu(app)?;
    
    // Create File submenu
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&open_project)
        .item(&recent_projects_menu)
        .separator()
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
            "open_project" => {
                if let Some(window) = window {
                    window.emit("menu-open-project", ()).unwrap();
                }
            }
            event_id if event_id.starts_with("recent_project_") => {
                if let Some(window) = window {
                    // Extract project ID from menu item ID
                    let project_id = event_id.strip_prefix("recent_project_").unwrap_or("");
                    window.emit("menu-open-recent-project", project_id).unwrap();
                }
            }
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

fn create_recent_projects_submenu(app: &tauri::App) -> Result<tauri::menu::Submenu<tauri::Wry>, Box<dyn std::error::Error>> {
    let mut submenu_builder = SubmenuBuilder::new(app, "Recent Projects");
    
    // Get recent projects from the database
    let app_handle = app.handle();
    let _db_path = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("pivo.db");
    
    // Get app state to access project service
    if let Some(state) = app.try_state::<crate::AppState>() {
        log::info!("AppState found, fetching recent projects");
        // Get recent projects synchronously for menu creation
        let projects = tauri::async_runtime::block_on(async {
            state.project_service.get_recent_projects(10).await.unwrap_or_default()
        });
        
        log::info!("Found {} recent projects", projects.len());
        
        if projects.is_empty() {
            let empty_item = MenuItemBuilder::new("No recent projects")
                .id("no_recent_projects")
                .enabled(false)
                .build(app)?;
            submenu_builder = submenu_builder.item(&empty_item);
        } else {
            for project in projects {
                let menu_item = MenuItemBuilder::new(&project.name)
                    .id(&format!("recent_project_{}", project.id))
                    .build(app)?;
                submenu_builder = submenu_builder.item(&menu_item);
            }
        }
    } else {
        // Fallback if app state is not available yet
        log::warn!("AppState not available when creating menu");
        let empty_item = MenuItemBuilder::new("No recent projects")
            .id("no_recent_projects")
            .enabled(false)
            .build(app)?;
        submenu_builder = submenu_builder.item(&empty_item);
    }
    
    Ok(submenu_builder.build()?)
}