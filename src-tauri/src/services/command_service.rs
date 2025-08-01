use crate::models::{Command, CommandSearchResult};
use std::path::Path;
use std::fs;
use walkdir::WalkDir;

pub struct CommandService;

impl CommandService {
    pub fn new() -> Self {
        Self
    }

    /// Search for commands in the given project path
    pub fn search_commands(&self, project_path: &str, query: Option<&str>, limit: usize) -> Result<CommandSearchResult, String> {
        let mut commands = Vec::new();
        
        // First, search for Claude commands in .claude/commands
        let claude_commands_path = Path::new(project_path).join(".claude").join("commands");
        
        if claude_commands_path.exists() && claude_commands_path.is_dir() {
            commands.extend(self.scan_claude_commands(&claude_commands_path)?);
        }
        
        // Filter by query if provided
        if let Some(query) = query {
            let query_lower = query.to_lowercase();
            commands.retain(|cmd| {
                cmd.name.to_lowercase().contains(&query_lower) ||
                cmd.description.as_ref().map_or(false, |desc| desc.to_lowercase().contains(&query_lower))
            });
        }
        
        // Sort by name
        commands.sort_by(|a, b| a.name.cmp(&b.name));
        
        // Limit results
        let total = commands.len();
        commands.truncate(limit);
        
        Ok(CommandSearchResult {
            commands,
            total,
        })
    }
    
    /// Scan Claude commands from .claude/commands directory
    fn scan_claude_commands(&self, commands_path: &Path) -> Result<Vec<Command>, String> {
        let mut commands = Vec::new();
        
        for entry in WalkDir::new(commands_path)
            .max_depth(3) // Limit recursion depth
            .into_iter()
            .filter_map(Result::ok)
            .filter(|e| e.file_type().is_file())
        {
            let path = entry.path();
            
            // Skip non-text files
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if !matches!(ext_str.as_str(), "md" | "txt" | "sh" | "py" | "js" | "ts" | "yaml" | "yml" | "json") {
                    continue;
                }
            }
            
            // Get command name from filename (without extension)
            let name = path.file_stem()
                .and_then(|s| s.to_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| path.file_name().unwrap().to_string_lossy().to_string());
            
            // Read file content for description (first line or first paragraph)
            let content = fs::read_to_string(&path).ok();
            let description = content.as_ref().and_then(|c| {
                // Try to extract description from first line or markdown header
                c.lines()
                    .find(|line| !line.trim().is_empty() && !line.starts_with("#!"))
                    .map(|line| {
                        line.trim_start_matches('#')
                            .trim_start_matches("//")
                            .trim_start_matches("/*")
                            .trim()
                            .to_string()
                    })
            });
            
            commands.push(Command {
                name: format!("/{}", name),
                description,
                path: path.to_string_lossy().to_string(),
                content,
                command_type: "claude".to_string(),
            });
        }
        
        Ok(commands)
    }
    
    /// Get command content by path
    pub fn get_command_content(&self, command_path: &str) -> Result<String, String> {
        fs::read_to_string(command_path)
            .map_err(|e| format!("Failed to read command file: {}", e))
    }
}