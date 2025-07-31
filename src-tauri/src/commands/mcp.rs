use crate::services::mcp_server::{
    McpServer, McpServerManager, McpCapabilities, McpServerStatus
};
use std::sync::Arc;
use tauri::State;
use serde_json::Value;

pub struct McpState {
    pub manager: Arc<McpServerManager>,
}

#[tauri::command]
pub async fn register_mcp_server(
    state: State<'_, McpState>,
    name: String,
    command: String,
    args: Vec<String>,
    env: std::collections::HashMap<String, String>,
) -> Result<String, String> {
    let server = McpServer {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        command,
        args,
        env,
        capabilities: McpCapabilities {
            tools: true,
            resources: true,
            prompts: true,
        },
        status: McpServerStatus::Stopped,
    };

    state.manager.register_server(server)
}

#[tauri::command]
pub async fn start_mcp_server(
    state: State<'_, McpState>,
    server_id: String,
) -> Result<(), String> {
    state.manager.start_server(&server_id)
}

#[tauri::command]
pub async fn stop_mcp_server(
    state: State<'_, McpState>,
    server_id: String,
) -> Result<(), String> {
    state.manager.stop_server(&server_id)
}

#[tauri::command]
pub async fn list_mcp_servers(
    state: State<'_, McpState>,
) -> Result<Vec<McpServer>, String> {
    Ok(state.manager.list_servers())
}

#[tauri::command]
pub async fn get_mcp_server(
    state: State<'_, McpState>,
    server_id: String,
) -> Result<Option<McpServer>, String> {
    Ok(state.manager.get_server(&server_id))
}

#[tauri::command]
pub async fn send_mcp_request(
    state: State<'_, McpState>,
    server_id: String,
    method: String,
    params: Option<Value>,
) -> Result<String, String> {
    state.manager.send_request(&server_id, &method, params)
}

#[tauri::command]
pub async fn list_mcp_tools(
    state: State<'_, McpState>,
    server_id: String,
) -> Result<String, String> {
    state.manager.send_request(&server_id, "tools/list", None)
}


#[tauri::command]
pub async fn list_mcp_resources(
    state: State<'_, McpState>,
    server_id: String,
) -> Result<String, String> {
    state.manager.send_request(&server_id, "resources/list", None)
}

#[tauri::command]
pub async fn read_mcp_resource(
    state: State<'_, McpState>,
    server_id: String,
    uri: String,
) -> Result<String, String> {
    state.manager.send_request(
        &server_id,
        "resources/read",
        Some(serde_json::json!({ "uri": uri })),
    )
}

#[tauri::command]
pub async fn list_mcp_prompts(
    state: State<'_, McpState>,
    server_id: String,
) -> Result<String, String> {
    state.manager.send_request(&server_id, "prompts/list", None)
}

#[tauri::command]
pub async fn get_mcp_prompt(
    state: State<'_, McpState>,
    server_id: String,
    name: String,
    arguments: Value,
) -> Result<String, String> {
    state.manager.send_request(
        &server_id,
        "prompts/get",
        Some(serde_json::json!({
            "name": name,
            "arguments": arguments,
        })),
    )
}