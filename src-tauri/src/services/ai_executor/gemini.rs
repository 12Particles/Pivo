use super::*;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub struct GeminiExecutor {
    base: BaseExecutor,
}

impl GeminiExecutor {
    pub fn new(config: ExecutorConfig) -> Self {
        Self {
            base: BaseExecutor::new(config),
        }
    }
}

#[derive(Debug, Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    generation_config: Option<GenerationConfig>,
    tools: Option<Vec<GeminiTool>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiPart {
    text: Option<String>,
    function_call: Option<FunctionCall>,
    function_response: Option<FunctionResponse>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FunctionCall {
    name: String,
    args: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct FunctionResponse {
    name: String,
    response: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct GenerationConfig {
    temperature: Option<f32>,
    max_output_tokens: Option<i32>,
}

#[derive(Debug, Serialize)]
struct GeminiTool {
    function_declarations: Vec<FunctionDeclaration>,
}

#[derive(Debug, Serialize)]
struct FunctionDeclaration {
    name: String,
    description: String,
    parameters: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
    usage_metadata: Option<UsageMetadata>,
}

#[derive(Debug, Deserialize)]
struct Candidate {
    content: GeminiContent,
    #[allow(dead_code)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsageMetadata {
    prompt_token_count: i32,
    candidates_token_count: i32,
    total_token_count: i32,
}

#[async_trait]
impl AIExecutor for GeminiExecutor {

    async fn init_session(
        &self,
        task_id: &str,
        initial_prompt: &str,
    ) -> Result<ExecutorSession, String> {
        let mut session = self.base.create_session(task_id);
        
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

        // Convert messages to Gemini format
        let contents: Vec<GeminiContent> = session
            .messages
            .iter()
            .map(|m| GeminiContent {
                role: match m.role {
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "model".to_string(),
                    _ => "user".to_string(),
                },
                parts: vec![GeminiPart {
                    text: Some(m.content.clone()),
                    function_call: None,
                    function_response: None,
                }],
            })
            .collect();

        // Build request
        let request = GeminiRequest {
            contents,
            generation_config: Some(GenerationConfig {
                temperature: self.base.config.temperature,
                max_output_tokens: self.base.config.max_tokens,
            }),
            tools: Some(vec![GeminiTool {
                function_declarations: self.get_available_tools().iter().map(|t| {
                    FunctionDeclaration {
                        name: t.name.clone(),
                        description: t.description.clone(),
                        parameters: t.parameters.clone(),
                    }
                }).collect(),
            }]),
        };

        // Make API call
        let api_key = self.base.config.api_key.as_ref()
            .ok_or_else(|| "API key not configured".to_string())?;
        
        let base_url = self.base.config.base_url.as_ref()
            .map(|s| s.as_str())
            .unwrap_or("https://generativelanguage.googleapis.com");

        let model = &self.base.config.model;
        let url = format!(
            "{}/v1beta/models/{}:generateContent?key={}",
            base_url, model, api_key
        );

        let response = self.base.client
            .post(&url)
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("API error: {}", error_text));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Process response
        let candidate = gemini_response.candidates
            .first()
            .ok_or_else(|| "No response candidate".to_string())?;

        let mut content = String::new();
        let mut tool_calls = Vec::new();

        for part in &candidate.content.parts {
            if let Some(text) = &part.text {
                content.push_str(text);
            }
            if let Some(function_call) = &part.function_call {
                tool_calls.push(ToolCall {
                    id: Uuid::new_v4().to_string(),
                    name: function_call.name.clone(),
                    arguments: function_call.args.as_object()
                        .map(|o| o.iter()
                            .map(|(k, v)| (k.clone(), v.clone()))
                            .collect())
                        .unwrap_or_default(),
                });
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
            usage: gemini_response.usage_metadata.map(|u| Usage {
                prompt_tokens: u.prompt_token_count,
                completion_tokens: u.candidates_token_count,
                total_tokens: u.total_token_count,
            }),
        })
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