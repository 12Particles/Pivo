use std::path::Path;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use tauri::{AppHandle, Emitter};
use serde::{Serialize, Deserialize};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeEvent {
    pub worktree_path: String,
    pub file_path: String,
    pub kind: String,
}

pub struct FileWatcherService {
    watchers: Arc<Mutex<HashMap<String, notify::RecommendedWatcher>>>,
    app_handle: AppHandle,
}

impl FileWatcherService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    pub async fn watch_worktree(&self, worktree_path: String) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();
        
        if watchers.contains_key(&worktree_path) {
            return Ok(());
        }

        let (tx, mut rx) = mpsc::channel(100);
        let app_handle = self.app_handle.clone();
        let worktree_path_clone = worktree_path.clone();

        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.blocking_send(event);
            }
        }).map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher.watch(Path::new(&worktree_path), RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;

        watchers.insert(worktree_path.clone(), watcher);

        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                let kind = match event.kind {
                    EventKind::Create(_) => "create",
                    EventKind::Modify(_) => "modify",
                    EventKind::Remove(_) => "remove",
                    _ => "other",
                };

                for path in event.paths {
                    if let Some(file_path) = path.to_str() {
                        if !should_ignore_path(file_path) {
                            let file_change_event = FileChangeEvent {
                                worktree_path: worktree_path_clone.clone(),
                                file_path: file_path.to_string(),
                                kind: kind.to_string(),
                            };

                            let _ = app_handle.emit("file-change", &file_change_event);
                        }
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn unwatch_worktree(&self, worktree_path: String) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();
        watchers.remove(&worktree_path);
        Ok(())
    }

    pub async fn unwatch_all(&self) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();
        watchers.clear();
        Ok(())
    }
}

fn should_ignore_path(path: &str) -> bool {
    path.contains("/.git/") || 
    path.contains("/node_modules/") ||
    path.contains("/target/") ||
    path.contains("/.DS_Store") ||
    path.ends_with(".swp") ||
    path.ends_with(".tmp")
}

#[tauri::command]
pub async fn watch_worktree(
    worktree_path: String,
    state: tauri::State<'_, Arc<FileWatcherService>>,
) -> Result<(), String> {
    state.watch_worktree(worktree_path).await
}

#[tauri::command]
pub async fn unwatch_worktree(
    worktree_path: String,
    state: tauri::State<'_, Arc<FileWatcherService>>,
) -> Result<(), String> {
    state.unwatch_worktree(worktree_path).await
}

#[tauri::command]
pub async fn unwatch_all(
    state: tauri::State<'_, Arc<FileWatcherService>>,
) -> Result<(), String> {
    state.unwatch_all().await
}