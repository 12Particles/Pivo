use super::*;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub struct ClaudeExecutor {
    base: BaseExecutor,
}

impl ClaudeExecutor {
    pub fn new(config: ExecutorConfig) -> Self {
        Self {
            base: BaseExecutor::new(config),
        }
    }
}

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    messages: Vec<ClaudeMessage>,
    max_tokens: i32,
    temperature: Option<f32>,
    tools: Option<Vec<ClaudeTool>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ClaudeTool {
    name: String,
    description: String,
    input_schema: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
    usage: Option<ClaudeUsage>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
    name: Option<String>,
    input: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ClaudeUsage {
    input_tokens: i32,
    output_tokens: i32,
}

#[async_trait]
impl AIExecutor for ClaudeExecutor {
    fn executor_type(&self) -> &str {
        "claude"
    }

    async fn init_session(
        &self,
        task_id: &str,
        initial_prompt: &str,
    ) -> Result<ExecutorSession, String> {
        let mut session = self.base.create_session(task_id);
        
        // Add system message
        self.base.add_message(
            &mut session,
            MessageRole::System,
            "You are an AI assistant helping with software development tasks.".to_string(),
            None,
        );
        
        // Add initial user message
        self.base.add_message(
            &mut session,
            MessageRole::User,
            initial_prompt.to_string(),
            None,
        );
        
        Ok(session)
    }

    async fn send_message(
        &self,
        session: &mut ExecutorSession,
        message: &str,
    ) -> Result<ExecutorResponse, String> {
        // Add user message to session
        self.base.add_message(
            session,
            MessageRole::User,
            message.to_string(),
            None,
        );

        // Convert messages to Claude format
        let claude_messages: Vec<ClaudeMessage> = session
            .messages
            .iter()
            .filter(|m| m.role != MessageRole::System)
            .map(|m| ClaudeMessage {
                role: match m.role {
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "assistant".to_string(),
                    _ => "user".to_string(),
                },
                content: m.content.clone(),
            })
            .collect();

        // Build request
        let request = ClaudeRequest {
            model: self.base.config.model.clone(),
            messages: claude_messages,
            max_tokens: self.base.config.max_tokens.unwrap_or(4096),
            temperature: self.base.config.temperature,
            tools: Some(self.get_available_tools().iter().map(|t| ClaudeTool {
                name: t.name.clone(),
                description: t.description.clone(),
                input_schema: t.parameters.clone(),
            }).collect()),
        };

        // Make API call
        let api_key = self.base.config.api_key.as_ref()
            .ok_or_else(|| "API key not configured".to_string())?;
        
        let base_url = self.base.config.base_url.as_ref()
            .map(|s| s.as_str())
            .unwrap_or("https://api.anthropic.com");

        let response = self.base.client
            .post(format!("{}/v1/messages", base_url))
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("API error: {}", error_text));
        }

        let claude_response: ClaudeResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Process response
        let mut content = String::new();
        let mut tool_calls = Vec::new();

        for item in claude_response.content {
            match item.content_type.as_str() {
                "text" => {
                    if let Some(text) = item.text {
                        content.push_str(&text);
                    }
                }
                "tool_use" => {
                    if let (Some(name), Some(input)) = (item.name, item.input) {
                        tool_calls.push(ToolCall {
                            id: Uuid::new_v4().to_string(),
                            name,
                            arguments: input.as_object()
                                .map(|o| o.iter()
                                    .map(|(k, v)| (k.clone(), v.clone()))
                                    .collect())
                                .unwrap_or_default(),
                        });
                    }
                }
                _ => {}
            }
        }

        // Add assistant message to session
        self.base.add_message(
            session,
            MessageRole::Assistant,
            content.clone(),
            None,
        );

        Ok(ExecutorResponse {
            content,
            tool_calls,
            usage: claude_response.usage.map(|u| Usage {
                prompt_tokens: u.input_tokens,
                completion_tokens: u.output_tokens,
                total_tokens: u.input_tokens + u.output_tokens,
            }),
        })
    }

    async fn resume_session(
        &self,
        session: &ExecutorSession,
    ) -> Result<ExecutorSession, String> {
        Ok(session.clone())
    }

    fn get_available_tools(&self) -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "read_file".to_string(),
                description: "Read the contents of a file".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "The path to the file to read"
                        }
                    },
                    "required": ["path"]
                }),
            },
            ToolDefinition {
                name: "write_file".to_string(),
                description: "Write content to a file".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "The path to the file to write"
                        },
                        "content": {
                            "type": "string",
                            "description": "The content to write to the file"
                        }
                    },
                    "required": ["path", "content"]
                }),
            },
            ToolDefinition {
                name: "run_command".to_string(),
                description: "Run a shell command".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "The command to run"
                        },
                        "args": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Command arguments"
                        }
                    },
                    "required": ["command"]
                }),
            },
        ]
    }
}