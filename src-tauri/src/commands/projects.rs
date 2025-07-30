use crate::models::{CreateProjectRequest, Project, UpdateProjectRequest};
use crate::AppState;
use tauri::State;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub path: String,
    pub name: String,
    pub description: Option<String>,
    pub git_repo: Option<String>,
    pub setup_script: Option<String>,
    pub dev_script: Option<String>,
    pub has_git: bool,
    pub has_package_json: bool,
}

#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    request: CreateProjectRequest,
) -> Result<Project, String> {
    state
        .project_service
        .create_project(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_project(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Project>, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .project_service
        .get_project(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_projects(
    state: State<'_, AppState>,
) -> Result<Vec<Project>, String> {
    state
        .project_service
        .list_projects()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, AppState>,
    id: String,
    request: UpdateProjectRequest,
) -> Result<Project, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .project_service
        .update_project(uuid, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_project(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .project_service
        .delete_project(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn refresh_all_git_providers(
    state: State<'_, AppState>,
) -> Result<Vec<Project>, String> {
    // Get all projects
    let projects = state
        .project_service
        .list_projects()
        .await
        .map_err(|e| e.to_string())?;
    
    let mut updated_projects = Vec::new();
    
    // Update each project that has a git_repo but no git_provider
    for project in projects {
        if project.git_repo.is_some() && project.git_provider.is_none() {
            // Create an update request with just the git_repo to trigger provider detection
            let update_req = UpdateProjectRequest {
                name: None,
                description: None,
                path: None,
                git_repo: project.git_repo.clone(),
                setup_script: None,
                dev_script: None,
            };
            
            match state
                .project_service
                .update_project(Uuid::parse_str(&project.id).unwrap(), update_req)
                .await
            {
                Ok(updated_project) => {
                    updated_projects.push(updated_project);
                }
                Err(e) => {
                    log::error!("Failed to update project {}: {}", project.id, e);
                }
            }
        }
    }
    
    Ok(updated_projects)
}

#[tauri::command]
pub async fn update_project_last_opened(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state
        .project_service
        .update_last_opened(uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_projects(
    state: State<'_, AppState>,
    limit: i32,
) -> Result<Vec<Project>, String> {
    state
        .project_service
        .get_recent_projects(limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn select_project_directory(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    
    app_handle
        .dialog()
        .file()
        .set_title("Select Project Directory")
        .pick_folder(move |folder_path| {
            let _ = tx.send(folder_path.map(|path| path.to_string()));
        });
    
    match rx.await {
        Ok(result) => Ok(result),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn read_project_info(path: String) -> Result<ProjectInfo, String> {
    let project_path = PathBuf::from(&path);
    
    if !project_path.exists() || !project_path.is_dir() {
        return Err("Invalid directory path".to_string());
    }
    
    // Extract project name from directory name
    let name = project_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled Project")
        .to_string();
    
    // Check for git
    let git_path = project_path.join(".git");
    let has_git = git_path.exists() && git_path.is_dir();
    
    // Validate git repository
    if !has_git {
        return Err("Selected directory is not a valid Git repository. Please select a directory with an initialized Git repository.".to_string());
    }
    
    // Get git remote URL if available
    let mut git_repo = None;
    if has_git {
        log::info!("Checking git remotes for path: {}", project_path.display());
        
        // First try to get origin remote
        if let Ok(output) = std::process::Command::new("git")
            .arg("remote")
            .arg("get-url")
            .arg("origin")
            .current_dir(&project_path)
            .output()
        {
            if output.status.success() {
                let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
                log::info!("Found origin remote URL: {}", url);
                if !url.is_empty() {
                    git_repo = Some(url);
                }
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                log::warn!("Failed to get origin remote: {}", error);
            }
        } else {
            log::error!("Failed to execute git remote get-url origin command");
        }
        
        // If origin doesn't exist, try to get the first available remote
        if git_repo.is_none() {
            log::info!("Origin not found, checking for other remotes");
            if let Ok(output) = std::process::Command::new("git")
                .arg("remote")
                .current_dir(&project_path)
                .output()
            {
                if output.status.success() {
                    let remotes = String::from_utf8_lossy(&output.stdout);
                    log::info!("Available remotes: {}", remotes.trim());
                    if let Some(first_remote) = remotes.lines().next() {
                        if !first_remote.is_empty() {
                            log::info!("Trying to get URL for remote: {}", first_remote);
                            // Get URL for the first remote
                            if let Ok(url_output) = std::process::Command::new("git")
                                .arg("remote")
                                .arg("get-url")
                                .arg(first_remote)
                                .current_dir(&project_path)
                                .output()
                            {
                                if url_output.status.success() {
                                    let url = String::from_utf8_lossy(&url_output.stdout).trim().to_string();
                                    log::info!("Found remote URL: {}", url);
                                    if !url.is_empty() {
                                        git_repo = Some(url);
                                    }
                                } else {
                                    let error = String::from_utf8_lossy(&url_output.stderr);
                                    log::warn!("Failed to get URL for remote {}: {}", first_remote, error);
                                }
                            }
                        }
                    } else {
                        log::info!("No remotes found");
                    }
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    log::warn!("Failed to list remotes: {}", error);
                }
            } else {
                log::error!("Failed to execute git remote command");
            }
        }
    }
    
    // Check for package.json
    let package_json_path = project_path.join("package.json");
    let has_package_json = package_json_path.exists();
    
    let mut description = None;
    let mut setup_script = None;
    let mut dev_script = None;
    
    // Read package.json if it exists
    if has_package_json {
        if let Ok(content) = fs::read_to_string(&package_json_path) {
            if let Ok(package_json) = serde_json::from_str::<serde_json::Value>(&content) {
                // Get description
                if let Some(desc) = package_json.get("description").and_then(|d| d.as_str()) {
                    description = Some(desc.to_string());
                }
                
                // Get scripts
                if let Some(scripts) = package_json.get("scripts").and_then(|s| s.as_object()) {
                    // Look for install/setup scripts
                    if scripts.contains_key("install") {
                        setup_script = Some("npm install".to_string());
                    } else if scripts.contains_key("setup") {
                        setup_script = Some("npm run setup".to_string());
                    } else {
                        setup_script = Some("npm install".to_string());
                    }
                    
                    // Look for dev scripts
                    if scripts.contains_key("dev") {
                        dev_script = Some("npm run dev".to_string());
                    } else if scripts.contains_key("start") {
                        dev_script = Some("npm start".to_string());
                    } else if scripts.contains_key("serve") {
                        dev_script = Some("npm run serve".to_string());
                    }
                }
            }
        }
    }
    
    // Check for other common project files
    let composer_json = project_path.join("composer.json").exists();
    let cargo_toml = project_path.join("Cargo.toml").exists();
    let pom_xml = project_path.join("pom.xml").exists();
    let build_gradle = project_path.join("build.gradle").exists();
    let requirements_txt = project_path.join("requirements.txt").exists();
    let pipfile = project_path.join("Pipfile").exists();
    let gemfile = project_path.join("Gemfile").exists();
    let go_mod = project_path.join("go.mod").exists();
    
    // Set default scripts based on project type
    if setup_script.is_none() {
        if composer_json {
            setup_script = Some("composer install".to_string());
        } else if cargo_toml {
            setup_script = Some("cargo build".to_string());
        } else if pom_xml {
            setup_script = Some("mvn install".to_string());
        } else if build_gradle {
            setup_script = Some("gradle build".to_string());
        } else if requirements_txt {
            setup_script = Some("pip install -r requirements.txt".to_string());
        } else if pipfile {
            setup_script = Some("pipenv install".to_string());
        } else if gemfile {
            setup_script = Some("bundle install".to_string());
        } else if go_mod {
            setup_script = Some("go mod download".to_string());
        }
    }
    
    if dev_script.is_none() {
        if cargo_toml {
            dev_script = Some("cargo run".to_string());
        } else if pom_xml {
            dev_script = Some("mvn spring-boot:run".to_string());
        } else if build_gradle {
            dev_script = Some("gradle bootRun".to_string());
        } else if requirements_txt || pipfile {
            dev_script = Some("python main.py".to_string());
        } else if gemfile {
            dev_script = Some("bundle exec ruby main.rb".to_string());
        } else if go_mod {
            dev_script = Some("go run .".to_string());
        }
    }
    
    log::info!("Returning ProjectInfo: name={}, has_git={}, git_repo={:?}", name, has_git, git_repo);
    
    Ok(ProjectInfo {
        path,
        name,
        description,
        git_repo,
        setup_script,
        dev_script,
        has_git,
        has_package_json,
    })
}