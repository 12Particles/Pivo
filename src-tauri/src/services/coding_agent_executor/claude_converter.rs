use super::message::{AgentOutput, MessageConverter};
use serde_json::Value;
use log::debug;

pub struct ClaudeMessageConverter;

impl MessageConverter for ClaudeMessageConverter {
    fn convert_to_unified(&self, raw_message: &str) -> Option<AgentOutput> {
        // Parse the Claude JSON message
        let json: Value = serde_json::from_str(raw_message).ok()?;
        
        match json["type"].as_str() {
            Some("thinking") => {
                // Handle thinking messages
                let content = json["content"].as_str()?;
                return Some(AgentOutput::thinking(content.to_string()));
            }
            
            Some("assistant") => {
                let message = &json["message"];
                let message_id = message["id"].as_str().map(|s| s.to_string());
                let thinking = message["thinking"].as_str().map(|s| s.to_string());
                let content_array = message["content"].as_array()?;
                
                // Process each content item
                for content_item in content_array {
                    match content_item["type"].as_str() {
                        Some("text") => {
                            let text = content_item["text"].as_str()?;
                            return Some(AgentOutput::assistant_with_details(
                                message_id,
                                text.to_string(),
                                thinking,
                            ));
                        }
                        Some("tool_use") => {
                            let tool_id = content_item["id"].as_str().map(|s| s.to_string());
                            let tool_name = content_item["name"].as_str()?;
                            let tool_input = content_item["input"].clone();
                            return Some(AgentOutput::tool_use_with_id(
                                tool_id,
                                tool_name.to_string(),
                                tool_input,
                            ));
                        }
                        _ => {}
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
                        
                        // Extract tool name from previous context if possible
                        let tool_name = "Tool".to_string(); // Default, could be enhanced
                        
                        return Some(AgentOutput::tool_result_with_id(
                            tool_use_id,
                            tool_name,
                            content.to_string(),
                            is_error,
                        ));
                    }
                }
            }
            
            Some("result") => {
                let subtype = json["subtype"].as_str();
                let success = subtype == Some("success");
                let summary = json["result"].as_str().unwrap_or("").to_string();
                let duration_ms = json["duration_ms"].as_u64().unwrap_or(0);
                let cost_usd = json["total_cost_usd"].as_f64();
                
                return Some(AgentOutput::execution_complete(
                    success,
                    summary,
                    duration_ms,
                    cost_usd,
                ));
            }
            
            Some("system") => {
                if let Some("init") = json["subtype"].as_str() {
                    let _session_id = json["session_id"].as_str()?;
                    // Store session information in raw format
                    return Some(AgentOutput::raw(
                        "claude".to_string(),
                        json.clone(),
                    ));
                } else {
                    // Other system messages - convert to assistant message
                    let content = json["content"].as_str().unwrap_or("System message");
                    return Some(AgentOutput::assistant(content.to_string()));
                }
            }
            
            _ => {
                debug!("Unknown Claude message type: {:?}, preserving as raw", json["type"]);
                // Preserve unknown messages as raw
                return Some(AgentOutput::raw("claude".to_string(), json));
            }
        }
        
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_convert_assistant_text_message() {
        let converter = ClaudeMessageConverter;
        let raw = r#"{
            "type": "assistant",
            "message": {
                "id": "msg_123",
                "content": [{"type": "text", "text": "Hello, how can I help?"}]
            }
        }"#;
        
        let unified = converter.convert_to_unified(raw).unwrap();
        match unified {
            AgentOutput::Assistant { content, id, .. } => {
                assert_eq!(content, "Hello, how can I help?");
                assert_eq!(id, Some("msg_123".to_string()));
            }
            _ => panic!("Expected Assistant message"),
        }
    }
    
    #[test]
    fn test_convert_tool_use_message() {
        let converter = ClaudeMessageConverter;
        let raw = r#"{
            "type": "assistant",
            "message": {
                "content": [{
                    "type": "tool_use",
                    "id": "tool_123",
                    "name": "TodoWrite",
                    "input": {"todos": []}
                }]
            }
        }"#;
        
        let unified = converter.convert_to_unified(raw).unwrap();
        match unified {
            AgentOutput::ToolUse { tool_name, id, .. } => {
                assert_eq!(tool_name, "TodoWrite");
                assert_eq!(id, Some("tool_123".to_string()));
            }
            _ => panic!("Expected ToolUse message"),
        }
    }
    
    #[test]
    fn test_convert_thinking_message() {
        let converter = ClaudeMessageConverter;
        let raw = r#"{
            "type": "thinking",
            "content": "I need to analyze this request..."
        }"#;
        
        let unified = converter.convert_to_unified(raw).unwrap();
        match unified {
            AgentOutput::Thinking { content, .. } => {
                assert_eq!(content, "I need to analyze this request...");
            }
            _ => panic!("Expected Thinking message"),
        }
    }
}