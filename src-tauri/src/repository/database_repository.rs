use crate::db::DbPool;

/// Central repository for database access
pub struct DatabaseRepository {
    pool: DbPool,
}

impl DatabaseRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
    
    pub fn pool(&self) -> &DbPool {
        &self.pool
    }
}