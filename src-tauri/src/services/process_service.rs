use crate::db::DbPool;
use crate::models::{ExecutionProcess, ProcessStatus, ProcessType};
use std::process::Stdio;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct ProcessService {
    pool: DbPool,
    running_processes: Arc<Mutex<std::collections::HashMap<Uuid, tokio::process::Child>>>,
}

impl ProcessService {
    pub fn new(pool: DbPool) -> Self {
        Self {
            pool,
            running_processes: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub async fn spawn_process(
        &self,
        task_attempt_id: Uuid,
        process_type: ProcessType,
        command: String,
        args: Vec<String>,
        working_directory: String,
        app_handle: tauri::AppHandle,
    ) -> Result<Uuid, Box<dyn std::error::Error>> {
        let id = Uuid::new_v4();

        // Insert process record
        sqlx::query(
            r#"
            INSERT INTO execution_processes (id, task_attempt_id, process_type, status, command, args, working_directory, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            "#,
        )
        .bind(id.to_string())
        .bind(task_attempt_id.to_string())
        .bind(format!("{:?}", process_type).to_lowercase())
        .bind(format!("{:?}", ProcessStatus::Running).to_lowercase())
        .bind(&command)
        .bind(serde_json::to_string(&args)?)
        .bind(&working_directory)
        .execute(&self.pool)
        .await?;

        // Spawn the actual process
        let mut cmd = Command::new(&command);
        cmd.args(&args)
            .current_dir(&working_directory)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::piped());

        let mut child = cmd.spawn()?;

        // Handle stdout
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let pool = self.pool.clone();
            let process_id = id;
            let app = app_handle.clone();
            
            tokio::spawn(async move {
                let mut lines = reader.lines();
                let mut buffer = String::new();
                
                while let Ok(Some(line)) = lines.next_line().await {
                    buffer.push_str(&line);
                    buffer.push('\n');
                    
                    // Emit output event
                    let _ = app.emit("process-output", serde_json::json!({
                        "process_id": process_id,
                        "type": "stdout",
                        "data": line
                    }));
                    
                    // Update database periodically
                    if buffer.len() > 1024 {
                        sqlx::query("UPDATE execution_processes SET stdout = stdout || ? WHERE id = ?")
                            .bind(&buffer)
                            .bind(process_id.to_string())
                            .execute(&pool)
                            .await
                            .ok();
                        buffer.clear();
                    }
                }
                
                // Final update
                if !buffer.is_empty() {
                    sqlx::query("UPDATE execution_processes SET stdout = stdout || ? WHERE id = ?")
                        .bind(&buffer)
                        .bind(process_id.to_string())
                        .execute(&pool)
                        .await
                        .ok();
                }
            });
        }

        // Handle stderr
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let pool = self.pool.clone();
            let process_id = id;
            let app = app_handle.clone();
            
            tokio::spawn(async move {
                let mut lines = reader.lines();
                let mut buffer = String::new();
                
                while let Ok(Some(line)) = lines.next_line().await {
                    buffer.push_str(&line);
                    buffer.push('\n');
                    
                    // Emit output event
                    let _ = app.emit("process-output", serde_json::json!({
                        "process_id": process_id,
                        "type": "stderr",
                        "data": line
                    }));
                    
                    // Update database periodically
                    if buffer.len() > 1024 {
                        sqlx::query("UPDATE execution_processes SET stderr = stderr || ? WHERE id = ?")
                            .bind(&buffer)
                            .bind(process_id.to_string())
                            .execute(&pool)
                            .await
                            .ok();
                        buffer.clear();
                    }
                }
                
                // Final update
                if !buffer.is_empty() {
                    sqlx::query("UPDATE execution_processes SET stderr = stderr || ? WHERE id = ?")
                        .bind(&buffer)
                        .bind(process_id.to_string())
                        .execute(&pool)
                        .await
                        .ok();
                }
            });
        }

        // Store the child process
        self.running_processes.lock().await.insert(id, child);

        // Monitor process completion
        let running_processes = self.running_processes.clone();
        let pool = self.pool.clone();
        let process_id = id;
        
        tokio::spawn(async move {
            let mut processes = running_processes.lock().await;
            if let Some(mut child) = processes.remove(&process_id) {
                match child.wait().await {
                    Ok(status) => {
                        let exit_code = status.code();
                        let final_status = if status.success() {
                            ProcessStatus::Completed
                        } else {
                            ProcessStatus::Failed
                        };
                        
                        sqlx::query(
                            "UPDATE execution_processes SET status = ?, exit_code = ?, completed_at = datetime('now') WHERE id = ?"
                        )
                        .bind(format!("{:?}", final_status).to_lowercase())
                        .bind(exit_code)
                        .bind(process_id.to_string())
                        .execute(&pool)
                        .await
                        .ok();
                        
                        let _ = app_handle.emit("process-completed", serde_json::json!({
                            "process_id": process_id,
                            "exit_code": exit_code,
                            "status": final_status
                        }));
                    }
                    Err(e) => {
                        eprintln!("Error waiting for process: {}", e);
                    }
                }
            }
        });

        Ok(id)
    }

    pub async fn kill_process(&self, process_id: Uuid) -> Result<(), Box<dyn std::error::Error>> {
        let mut processes = self.running_processes.lock().await;
        
        if let Some(mut child) = processes.remove(&process_id) {
            child.kill().await?;
            
            sqlx::query(
                "UPDATE execution_processes SET status = ?, completed_at = datetime('now') WHERE id = ?"
            )
            .bind(format!("{:?}", ProcessStatus::Killed).to_lowercase())
            .bind(process_id.to_string())
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    pub async fn get_process(&self, id: Uuid) -> Result<Option<ExecutionProcess>, sqlx::Error> {
        use crate::models::ExecutionProcessRow;
        
        let row = sqlx::query_as::<_, ExecutionProcessRow>(
            "SELECT * FROM execution_processes WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(ExecutionProcess::from))
    }

    pub async fn list_processes_for_attempt(&self, task_attempt_id: Uuid) -> Result<Vec<ExecutionProcess>, sqlx::Error> {
        use crate::models::ExecutionProcessRow;
        
        let rows = sqlx::query_as::<_, ExecutionProcessRow>(
            "SELECT * FROM execution_processes WHERE task_attempt_id = ? ORDER BY started_at DESC"
        )
        .bind(task_attempt_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(ExecutionProcess::from).collect())
    }
}