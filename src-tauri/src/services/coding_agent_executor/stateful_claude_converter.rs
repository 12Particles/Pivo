use super::message::{UnifiedMessage, SystemMessageLevel, MessageConverter};
use super::claude_converter::ClaudeMessageConverter;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use log::debug;

/// A stateful message converter that tracks tool_use messages to provide tool names for tool_result messages
pub struct StatefulClaudeMessageConverter {
    /// Maps tool_use_id to tool_name
    tool_map: Arc<Mutex<HashMap<String, String>>>,
    /// Inner converter for basic conversion
    inner_converter: ClaudeMessageConverter,
}

impl StatefulClaudeMessageConverter {
    pub fn new() -> Self {
        Self {
            tool_map: Arc::new(Mutex::new(HashMap::new())),
            inner_converter: ClaudeMessageConverter,
        }
    }
    
    pub fn convert_to_unified(&self, raw_message: &str) -> Option<UnifiedMessage> {
        // Parse the Claude JSON message
        let json: Value = serde_json::from_str(raw_message).ok()?;
        
        match json["type"].as_str() {
            Some("assistant") => {
                let message = &json["message"];
                let content_array = message["content"].as_array()?;
                
                // Check if this contains a tool_use
                for content_item in content_array {
                    if let Some("tool_use") = content_item["type"].as_str() {
                        if let (Some(tool_id), Some(tool_name)) = (
                            content_item["id"].as_str(),
                            content_item["name"].as_str()
                        ) {
                            // Store the mapping
                            if let Ok(mut map) = self.tool_map.lock() {
                                map.insert(tool_id.to_string(), tool_name.to_string());
                                // Clean up old entries if map gets too large
                                if map.len() > 100 {
                                    map.clear();
                                }
                            }
                        }
                    }
                }
            }
            
            Some("user") => {
                let message = &json["message"];
                let content_array = message["content"].as_array()?;
                
                for content_item in content_array {
                    if let Some("tool_result") = content_item["type"].as_str() {
                        let tool_use_id = content_item["tool_use_id"].as_str().map(|s| s.to_string());
                        let content = content_item["content"].as_str()?;
                        let is_error = content_item["is_error"].as_bool().unwrap_or(false);
                        
                        // Look up the tool name from our map
                        let tool_name = if let Some(ref id) = tool_use_id {
                            self.tool_map.lock().ok()
                                .and_then(|map| map.get(id).cloned())
                                .unwrap_or_else(|| "Unknown".to_string())
                        } else {
                            "Unknown".to_string()
                        };
                        
                        debug!("Tool result for tool: {} (id: {:?})", tool_name, tool_use_id);
                        
                        return Some(UnifiedMessage::tool_result_with_id(
                            tool_use_id,
                            tool_name,
                            content.to_string(),
                            is_error,
                        ));
                    }
                }
            }
            
            _ => {}
        }
        
        // For all other cases, use the inner converter
        self.inner_converter.convert_to_unified(raw_message)
    }
}