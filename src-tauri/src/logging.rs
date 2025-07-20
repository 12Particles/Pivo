use log::LevelFilter;
use log4rs::{
    append::{
        console::{ConsoleAppender, Target},
        file::FileAppender,
    },
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
    filter::threshold::ThresholdFilter,
};
use std::path::PathBuf;
use directories::ProjectDirs;

pub fn get_log_dir() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("com", "living", "pivo") {
        let log_dir = proj_dirs.data_dir().join("logs");
        std::fs::create_dir_all(&log_dir).ok();
        log_dir
    } else {
        // Fallback to current directory
        let log_dir = PathBuf::from("logs");
        std::fs::create_dir_all(&log_dir).ok();
        log_dir
    }
}

pub fn init_logging() -> Result<(), Box<dyn std::error::Error>> {
    let log_dir = get_log_dir();
    let log_file_path = log_dir.join("pivo.log");
    
    // Create a stdout appender
    let stdout = ConsoleAppender::builder()
        .encoder(Box::new(PatternEncoder::new(
            "{d(%Y-%m-%d %H:%M:%S)} | {({l}):5.5} | {f}:{L} — {m}{n}"
        )))
        .target(Target::Stdout)
        .build();

    // Create a file appender
    let logfile = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new(
            "{d(%Y-%m-%d %H:%M:%S)} | {({l}):5.5} | {f}:{L} — {m}{n}"
        )))
        .build(log_file_path)?;

    // Build the configuration
    let config = Config::builder()
        .appender(Appender::builder().build("stdout", Box::new(stdout)))
        .appender(
            Appender::builder()
                .filter(Box::new(ThresholdFilter::new(LevelFilter::Info)))
                .build("logfile", Box::new(logfile)),
        )
        .build(
            Root::builder()
                .appender("stdout")
                .appender("logfile")
                .build(LevelFilter::Debug),
        )?;

    // Initialize log4rs
    log4rs::init_config(config)?;
    
    log::info!("Logging initialized. Log file: {:?}", log_dir.join("pivo.log"));
    
    Ok(())
}

pub fn get_log_file_path() -> PathBuf {
    get_log_dir().join("pivo.log")
}