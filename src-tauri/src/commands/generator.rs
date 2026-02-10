use tauri::command;
use tauri_plugin_dialog::DialogExt;
use tera::{Context, Tera};

use crate::models::Profile;

const TEMPLATE: &str = include_str!("../../templates/provision.sh.tera");

fn build_tera() -> Result<Tera, String> {
    let mut tera = Tera::default();
    tera.add_raw_template("provision.sh", TEMPLATE)
        .map_err(|e| format!("Template error: {e}"))?;
    Ok(tera)
}

#[command]
pub fn generate_script(profile: Profile) -> Result<String, String> {
    let tera = build_tera()?;
    let mut ctx = Context::new();
    ctx.insert("profile", &profile);
    tera.render("provision.sh", &ctx)
        .map_err(|e| format!("Render error: {e}"))
}

#[command]
pub fn validate_script(profile: Profile) -> Result<Vec<String>, String> {
    let script = generate_script(profile)?;
    let mut warnings: Vec<String> = Vec::new();

    for (i, line) in script.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.contains("rm -rf /") && !trimmed.starts_with('#') {
            warnings.push(format!("Line {}: dangerous 'rm -rf /' detected", i + 1));
        }
        if trimmed.contains("> /dev/sda") {
            warnings.push(format!("Line {}: writing directly to block device", i + 1));
        }
        if trimmed.contains("mkfs.") && !trimmed.starts_with('#') {
            warnings.push(format!("Line {}: filesystem format command detected", i + 1));
        }
        if trimmed.contains("dd if=") && !trimmed.starts_with('#') {
            warnings.push(format!("Line {}: 'dd' command detected — verify target", i + 1));
        }
    }

    if script.lines().count() > 500 {
        warnings.push("Script exceeds 500 lines — consider splitting".into());
    }

    Ok(warnings)
}

#[command]
pub async fn export_script(
    app: tauri::AppHandle,
    script: String,
    default_name: String,
) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("Shell Script", &["sh"])
        .blocking_save_file();

    match path {
        Some(p) => {
            let file_path = p.as_path().ok_or("Invalid path")?;
            std::fs::write(file_path, &script)
                .map_err(|e| format!("Cannot write file: {e}"))?;
            Ok(Some(file_path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}
