use std::process::{Command, Output};
use std::path::Path;

/// Execute a command with proper environment on macOS
/// This ensures that commands have access to the user's full PATH,
/// including tools installed via Homebrew
pub fn execute_command(program: &str, args: &[&str], current_dir: Option<&Path>) -> Result<Output, std::io::Error> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, we need to run commands through a login shell to get the user's PATH
        let mut shell_command = String::new();
        
        // Escape the program name
        shell_command.push_str(&shell_escape::escape(program.into()));
        
        // Add arguments
        for arg in args {
            shell_command.push(' ');
            shell_command.push_str(&shell_escape::escape((*arg).into()));
        }
        
        let mut cmd = Command::new("/bin/bash");
        cmd.arg("-l") // Login shell to load user's environment
           .arg("-c")
           .arg(&shell_command);
        
        if let Some(dir) = current_dir {
            cmd.current_dir(dir);
        }
        
        cmd.output()
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        // On other platforms, execute directly
        let mut cmd = Command::new(program);
        cmd.args(args);
        
        if let Some(dir) = current_dir {
            cmd.current_dir(dir);
        }
        
        cmd.output()
    }
}

/// Create a Command configured with proper environment
/// This is useful when you need more control over the command execution
#[allow(unused_variables)]
pub fn create_command(program: &str) -> Command {
    #[cfg(target_os = "macos")]
    {
        // On macOS, prepare to run through login shell
        let mut cmd = Command::new("/bin/bash");
        cmd.arg("-l")
           .arg("-c");
        // Note: caller needs to build the full command string including the program
        cmd
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Command::new(program)
    }
}

/// Helper to build a shell command string for macOS
#[cfg(target_os = "macos")]
pub fn build_shell_command(program: &str, args: &[&str]) -> String {
    let mut shell_command = String::new();
    shell_command.push_str(&shell_escape::escape(program.into()));
    
    for arg in args {
        shell_command.push(' ');
        shell_command.push_str(&shell_escape::escape((*arg).into()));
    }
    
    shell_command
}

/// Execute git command with proper environment
pub fn execute_git(args: &[&str], current_dir: &Path) -> Result<Output, std::io::Error> {
    execute_command("git", args, Some(current_dir))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_execute_command() {
        // Test basic command execution
        let result = execute_command("echo", &["hello"], None);
        assert!(result.is_ok());
        
        let output = result.unwrap();
        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "hello");
    }
    
    #[test]
    fn test_execute_git() {
        // Test git command
        let result = execute_git(&["--version"], Path::new("."));
        assert!(result.is_ok());
        
        let output = result.unwrap();
        assert!(output.status.success());
        assert!(String::from_utf8_lossy(&output.stdout).contains("git version"));
    }
}