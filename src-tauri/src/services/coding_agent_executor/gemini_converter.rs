use super::message::{AgentOutput, MessageConverter};

pub struct GeminiMessageConverter;

impl MessageConverter for GeminiMessageConverter {
    fn convert_to_unified(&self, raw_message: &str) -> Option<AgentOutput> {
        // For now, Gemini outputs plain text, so we'll treat everything as assistant messages
        // In the future, if Gemini CLI adds structured output, we can parse it here
        
        // Skip empty lines
        if raw_message.trim().is_empty() {
            return None;
        }
        
        // Check for common patterns in Gemini output
        if raw_message.starts_with("Error:") || raw_message.starts_with("ERROR:") {
            return Some(AgentOutput::assistant_with_details(
                None,
                raw_message.to_string(),
                None,
            ));
        }
        
        if raw_message.starts_with("Warning:") || raw_message.starts_with("WARN:") {
            return Some(AgentOutput::assistant_with_details(
                None,
                raw_message.to_string(),
                None,
            ));
        }
        
        // Check for completion patterns
        if raw_message.contains("Task completed") || raw_message.contains("Execution finished") {
            return Some(AgentOutput::execution_complete(
                true,
                raw_message.to_string(),
                0, // Duration not available from plain text
                None, // Cost not available
            ));
        }
        
        // Default: treat as assistant message
        Some(AgentOutput::assistant(raw_message.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_convert_plain_text_message() {
        let converter = GeminiMessageConverter;
        let raw = "Hello, I'm analyzing your code.";
        
        let unified = converter.convert_to_unified(raw).unwrap();
        match unified {
            AgentOutput::Assistant { content, .. } => {
                assert_eq!(content, "Hello, I'm analyzing your code.");
            }
            _ => panic!("Expected Assistant message"),
        }
    }
    
    #[test]
    fn test_convert_error_message() {
        let converter = GeminiMessageConverter;
        let raw = "Error: Failed to access file";
        
        let unified = converter.convert_to_unified(raw).unwrap();
        match unified {
            AgentOutput::Assistant { content, .. } => {
                assert_eq!(content, "Error: Failed to access file");
            }
            _ => panic!("Expected Assistant message"),
        }
    }
    
    #[test]
    fn test_skip_empty_lines() {
        let converter = GeminiMessageConverter;
        let raw = "   ";
        
        assert!(converter.convert_to_unified(raw).is_none());
    }
}