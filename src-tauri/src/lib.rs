use reqwest::{header, Client, StatusCode};
use serde_json::{json, Value};
use std::process::Command;
use std::time::{Duration, Instant};
use tokio::time::sleep;

fn normalize_base_url(value: &str) -> String {
  value.trim_end_matches('/').to_string()
}

async fn read_error_body(response: reqwest::Response) -> String {
  let status = response.status();
  let text = response.text().await.unwrap_or_default();
  if text.is_empty() {
    return format!("HTTP {}", status);
  }
  if let Ok(parsed) = serde_json::from_str::<Value>(&text) {
    if let Some(message) = parsed.get("error").and_then(Value::as_str) {
      if !message.trim().is_empty() {
        return format!("{}: {}", status, message);
      }
    }
  }
  format!("{}: {}", status, text)
}

fn extract_nested_error(value: &Value) -> Option<String> {
  if let Some(message) = value.get("error").and_then(Value::as_str) {
    if !message.trim().is_empty() {
      return Some(message.to_string());
    }
  }
  if let Some(shutdown_error) = value
    .get("shutdown_room")
    .and_then(Value::as_object)
    .and_then(|shutdown| shutdown.get("error"))
    .and_then(Value::as_str)
  {
    if !shutdown_error.trim().is_empty() {
      return Some(shutdown_error.to_string());
    }
  }
  None
}

fn parse_delete_status(payload: &Value, delete_id: &str) -> (Option<String>, Option<String>) {
  if let Some(status) = payload.get("status").and_then(Value::as_str) {
    return (Some(status.to_string()), extract_nested_error(payload));
  }

  if let Some(results) = payload.get("results").and_then(Value::as_array) {
    let selected_entry = results
      .iter()
      .find(|entry| {
        entry
          .get("delete_id")
          .and_then(Value::as_str)
          .map(|value| value == delete_id)
          .unwrap_or(false)
      })
      .or_else(|| results.first());
    if let Some(entry) = selected_entry {
      let status = entry
        .get("status")
        .and_then(Value::as_str)
        .map(ToString::to_string);
      let error = extract_nested_error(entry);
      return (status, error);
    }
  }

  (None, None)
}

async fn poll_delete_status(
  client: &Client,
  base_url: &str,
  encoded_room_id: &str,
  delete_id: &str,
  auth_header: &str,
) -> Result<(), String> {
  let started = Instant::now();
  let mut use_delete_id_route = true;
  let encoded_delete_id = urlencoding::encode(delete_id);
  while started.elapsed() < Duration::from_secs(90) {
    let status_url = if use_delete_id_route {
      format!("{base_url}/_synapse/admin/v2/rooms/delete_status/{encoded_delete_id}")
    } else {
      format!("{base_url}/_synapse/admin/v2/rooms/{encoded_room_id}/delete_status")
    };
    let response = client
      .get(status_url)
      .header(header::AUTHORIZATION, auth_header)
      .send()
      .await
      .map_err(|error| format!("Network error while polling delete status: {error}"))?;

    if response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::METHOD_NOT_ALLOWED {
      if use_delete_id_route {
        use_delete_id_route = false;
        continue;
      }
      // Older Synapse variants may not expose status routes; rely on room-existence verification.
      return Ok(());
    }
    if !response.status().is_success() {
      return Err(read_error_body(response).await);
    }

    let payload: Value = response
      .json()
      .await
      .unwrap_or_else(|_| json!({}));
    let (status, error) = parse_delete_status(&payload, delete_id);
    if let Some(status) = status {
      if status.eq_ignore_ascii_case("complete") {
        return Ok(());
      }
      if status.eq_ignore_ascii_case("failed") {
        return Err(error.unwrap_or_else(|| "Synapse room deletion failed.".to_string()));
      }
    }

    sleep(Duration::from_millis(1500)).await;
  }

  Err("Timed out waiting for Synapse room purge completion.".to_string())
}

async fn wait_for_room_removal(
  client: &Client,
  base_url: &str,
  encoded_room_id: &str,
  auth_header: &str,
) -> Result<(), String> {
  let started = Instant::now();
  while started.elapsed() < Duration::from_secs(90) {
    let response = client
      .get(format!("{base_url}/_synapse/admin/v1/rooms/{encoded_room_id}"))
      .header(header::AUTHORIZATION, auth_header)
      .send()
      .await
      .map_err(|error| format!("Network error while verifying room purge: {error}"))?;

    if response.status() == StatusCode::NOT_FOUND {
      return Ok(());
    }
    if !response.status().is_success() {
      return Err(read_error_body(response).await);
    }

    sleep(Duration::from_millis(1500)).await;
  }

  Err("Synapse still reports this room after deletion. Purge did not complete.".to_string())
}

async fn request_synapse_hard_delete(
  base_url: &str,
  access_token: &str,
  room_id: &str,
  requester_user_id: &str,
) -> Result<(), String> {
  let normalized_base_url = normalize_base_url(base_url);
  let encoded_room_id = urlencoding::encode(room_id);
  let auth_header = format!("Bearer {access_token}");
  let request_body = json!({
    "block": true,
    "purge": true,
    "force_purge": true,
    "requester_user_id": requester_user_id
  });

  let client = Client::new();

  let v2_response = client
    .delete(format!(
      "{normalized_base_url}/_synapse/admin/v2/rooms/{encoded_room_id}"
    ))
    .header(header::AUTHORIZATION, &auth_header)
    .header(header::CONTENT_TYPE, "application/json")
    .json(&request_body)
    .send()
    .await
    .map_err(|error| format!("Network error while deleting room: {error}"))?;

  if v2_response.status() != StatusCode::NOT_FOUND && v2_response.status() != StatusCode::METHOD_NOT_ALLOWED {
    if !v2_response.status().is_success() {
      return Err(read_error_body(v2_response).await);
    }
    let payload: Value = v2_response
      .json()
      .await
      .unwrap_or_else(|_| json!({}));
    if let Some(delete_id) = payload.get("delete_id").and_then(Value::as_str) {
      poll_delete_status(
        &client,
        &normalized_base_url,
        &encoded_room_id,
        delete_id,
        &auth_header,
      )
      .await?;
    }
    return wait_for_room_removal(
      &client,
      &normalized_base_url,
      &encoded_room_id,
      &auth_header,
    )
    .await;
  }

  let v1_response = client
    .delete(format!(
      "{normalized_base_url}/_synapse/admin/v1/rooms/{encoded_room_id}"
    ))
    .header(header::AUTHORIZATION, &auth_header)
    .header(header::CONTENT_TYPE, "application/json")
    .json(&request_body)
    .send()
    .await
    .map_err(|error| format!("Network error while deleting room (v1): {error}"))?;

  if v1_response.status() != StatusCode::NOT_FOUND && v1_response.status() != StatusCode::METHOD_NOT_ALLOWED {
    if !v1_response.status().is_success() {
      return Err(read_error_body(v1_response).await);
    }
    return wait_for_room_removal(
      &client,
      &normalized_base_url,
      &encoded_room_id,
      &auth_header,
    )
    .await;
  }

  let legacy_response = client
    .post(format!(
      "{normalized_base_url}/_synapse/admin/v1/rooms/{encoded_room_id}/delete"
    ))
    .header(header::AUTHORIZATION, &auth_header)
    .header(header::CONTENT_TYPE, "application/json")
    .json(&request_body)
    .send()
    .await
    .map_err(|error| format!("Network error while deleting room (legacy): {error}"))?;
  if !legacy_response.status().is_success() {
    return Err(read_error_body(legacy_response).await);
  }

  wait_for_room_removal(
    &client,
    &normalized_base_url,
    &encoded_room_id,
    &auth_header,
  )
  .await
}

#[tauri::command]
async fn synapse_hard_delete_room(
  base_url: String,
  access_token: String,
  room_id: String,
  requester_user_id: String,
) -> Result<(), String> {
  request_synapse_hard_delete(&base_url, &access_token, &room_id, &requester_user_id).await
}

fn shell_escape(value: &str) -> String {
  format!("'{}'", value.replace('\'', "'\"'\"'"))
}

const REMOTE_HEALTH_SCRIPT: &str = r#"import json
import os
import shlex
import subprocess
import time

def run(command: str):
    proc = subprocess.run(command, shell=True, text=True, capture_output=True)
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()

def cpu_percent():
    def read_stat():
        with open("/proc/stat", "r", encoding="utf-8") as handle:
            parts = handle.readline().split()[1:8]
            nums = [int(value) for value in parts]
            total = sum(nums)
            idle = nums[3] + nums[4]
            return total, idle

    t1, i1 = read_stat()
    time.sleep(0.25)
    t2, i2 = read_stat()
    total_delta = max(t2 - t1, 1)
    idle_delta = max(i2 - i1, 0)
    usage = (total_delta - idle_delta) * 100.0 / total_delta
    return max(0.0, min(100.0, usage))

def mem_bytes():
    values = {}
    with open("/proc/meminfo", "r", encoding="utf-8") as handle:
        for line in handle:
            key, _, rest = line.partition(":")
            raw_value = rest.strip().split(" ")[0]
            if raw_value.isdigit():
                values[key] = int(raw_value) * 1024
    total = values.get("MemTotal", 0)
    available = values.get("MemAvailable", 0)
    used = max(total - available, 0)
    return total, used, available

def disk_bytes():
    stats = os.statvfs("/")
    total = stats.f_blocks * stats.f_frsize
    available = stats.f_bavail * stats.f_frsize
    used = max(total - available, 0)
    return total, used, available

def uptime_seconds():
    with open("/proc/uptime", "r", encoding="utf-8") as handle:
        return float(handle.read().split()[0])

def inspect_container(name: str):
    command = (
        "docker inspect -f '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "
        + shlex.quote(name)
    )
    code, out, err = run(command)
    if code != 0:
        return {"name": name, "status": "unknown", "health": "unknown", "error": err}
    parts = out.split("|")
    return {
        "name": name,
        "status": parts[0] if parts else "unknown",
        "health": parts[1] if len(parts) > 1 else "none",
        "error": "",
    }

synapse_container = os.environ.get("SYNAPSE_CONTAINER", "fray-synapse")
postgres_container = os.environ.get("POSTGRES_CONTAINER", "fray-postgres")
postgres_user = os.environ.get("POSTGRES_USER", "synapse")
postgres_db = os.environ.get("POSTGRES_DB", "synapse")

errors = []

load_1m, load_5m, load_15m = os.getloadavg()
memory_total_bytes, memory_used_bytes, memory_available_bytes = mem_bytes()
disk_total_bytes, disk_used_bytes, disk_available_bytes = disk_bytes()

stats_code, stats_out, stats_err = run("docker stats --no-stream --format '{{json .}}'")
container_stats = []
if stats_code == 0 and stats_out:
    for line in stats_out.splitlines():
        try:
            payload = json.loads(line)
            container_stats.append(
                {
                    "name": payload.get("Name", ""),
                    "cpuPercent": payload.get("CPUPerc", ""),
                    "memoryPercent": payload.get("MemPerc", ""),
                    "memoryUsage": payload.get("MemUsage", ""),
                    "networkIo": payload.get("NetIO", ""),
                    "blockIo": payload.get("BlockIO", ""),
                    "pids": payload.get("PIDs", ""),
                }
            )
        except Exception:
            continue
else:
    errors.append(f"docker stats failed: {stats_err or 'unknown error'}")

container_names = set()
if synapse_container:
    container_names.add(synapse_container)
if postgres_container:
    container_names.add(postgres_container)
for entry in container_stats:
    name = entry.get("name", "").strip()
    if name:
        container_names.add(name)

container_inspections = {}
for name in sorted(container_names):
    info = inspect_container(name)
    container_inspections[name] = info
    if info.get("error"):
        errors.append(f"{name} inspect failed: {info['error']}")

synapse_info = container_inspections.get(
    synapse_container,
    {"name": synapse_container, "status": "unknown", "health": "unknown", "error": "missing"},
)
postgres_info = container_inspections.get(
    postgres_container,
    {"name": postgres_container, "status": "unknown", "health": "unknown", "error": "missing"},
)

container_stats_by_name = {
    entry.get("name"): entry for entry in container_stats if entry.get("name")
}
container_rows = []
for name in sorted(container_inspections.keys()):
    info = container_inspections.get(name, {})
    stats = container_stats_by_name.get(name, {})
    container_rows.append(
        {
            "name": name,
            "status": info.get("status", "unknown"),
            "health": info.get("health", "none"),
            "cpuPercent": stats.get("cpuPercent"),
            "memoryPercent": stats.get("memoryPercent"),
            "memoryUsage": stats.get("memoryUsage"),
            "networkIo": stats.get("networkIo"),
            "blockIo": stats.get("blockIo"),
            "pids": stats.get("pids"),
        }
    )

synapse_version_code, synapse_version_out, synapse_version_err = run(
    f"docker exec {shlex.quote(synapse_container)} python -c 'import synapse; print(synapse.__version__)'"
)
synapse_version = synapse_version_out if synapse_version_code == 0 else None
if synapse_version_code != 0:
    errors.append(f"Synapse version query failed: {synapse_version_err or 'unknown error'}")

db_query = (
    "SELECT pg_database_size(current_database()),"
    " (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()),"
    " (SELECT count(*) FROM rooms),"
    " (SELECT count(*) FROM users),"
    " (SELECT count(*) FROM local_current_membership WHERE membership='join');"
)
db_code, db_out, db_err = run(
    f"docker exec {shlex.quote(postgres_container)} psql -U {shlex.quote(postgres_user)} "
    f"-d {shlex.quote(postgres_db)} -At -F '|' -c {shlex.quote(db_query)}"
)
database_size_bytes = None
database_connections = None
room_count = None
user_count = None
joined_memberships = None
if db_code == 0 and db_out:
    values = db_out.split("|")
    if len(values) >= 5:
        try:
            database_size_bytes = int(values[0])
            database_connections = int(values[1])
            room_count = int(values[2])
            user_count = int(values[3])
            joined_memberships = int(values[4])
        except Exception:
            errors.append("Unable to parse PostgreSQL health response.")
    else:
        errors.append("PostgreSQL health response was incomplete.")
else:
    errors.append(f"PostgreSQL health query failed: {db_err or 'unknown error'}")

result = {
    "captured_at": int(time.time() * 1000),
    "host": {
        "cpu_percent": round(cpu_percent(), 2),
        "load_1m": round(load_1m, 2),
        "load_5m": round(load_5m, 2),
        "load_15m": round(load_15m, 2),
        "uptime_seconds": int(uptime_seconds()),
        "memory_total_bytes": memory_total_bytes,
        "memory_used_bytes": memory_used_bytes,
        "memory_available_bytes": memory_available_bytes,
        "disk_total_bytes": disk_total_bytes,
        "disk_used_bytes": disk_used_bytes,
        "disk_available_bytes": disk_available_bytes,
    },
    "matrix": {
        "container": synapse_container,
        "status": synapse_info["status"],
        "health": synapse_info["health"],
        "version": synapse_version,
        "room_count": room_count,
        "user_count": user_count,
        "joined_memberships": joined_memberships,
    },
    "database": {
        "container": postgres_container,
        "status": postgres_info["status"],
        "health": postgres_info["health"],
        "database": postgres_db,
        "size_bytes": database_size_bytes,
        "active_connections": database_connections,
    },
    "containers": container_rows,
    "errors": errors,
}
print(json.dumps(result))"#;

fn fetch_remote_server_health_blocking(
  host: String,
  username: String,
  password: Option<String>,
  synapse_container: Option<String>,
  postgres_container: Option<String>,
  postgres_user: Option<String>,
  postgres_db: Option<String>,
) -> Result<Value, String> {
  let trimmed_host = host.trim();
  let trimmed_username = username.trim();
  if trimmed_host.is_empty() || trimmed_username.is_empty() {
    return Err("Host and SSH username are required.".to_string());
  }

  let synapse_container = synapse_container
    .unwrap_or_else(|| "fray-synapse".to_string())
    .trim()
    .to_string();
  let postgres_container = postgres_container
    .unwrap_or_else(|| "fray-postgres".to_string())
    .trim()
    .to_string();
  let postgres_user = postgres_user
    .unwrap_or_else(|| "synapse".to_string())
    .trim()
    .to_string();
  let postgres_db = postgres_db
    .unwrap_or_else(|| "synapse".to_string())
    .trim()
    .to_string();

  let remote_command = format!(
    "SYNAPSE_CONTAINER={} POSTGRES_CONTAINER={} POSTGRES_USER={} POSTGRES_DB={} python3 - <<'PY'\n{}\nPY",
    shell_escape(&synapse_container),
    shell_escape(&postgres_container),
    shell_escape(&postgres_user),
    shell_escape(&postgres_db),
    REMOTE_HEALTH_SCRIPT
  );

  let ssh_target = format!("{}@{}", trimmed_username, trimmed_host);
  let password = password.unwrap_or_default();
  let use_password = !password.trim().is_empty();

  let mut command = if use_password {
    let mut command = Command::new("sshpass");
    command.arg("-e");
    command.env("SSHPASS", password);
    command.arg("ssh");
    command
  } else {
    Command::new("ssh")
  };

  command
    .arg("-o")
    .arg("StrictHostKeyChecking=no")
    .arg("-o")
    .arg("UserKnownHostsFile=/dev/null")
    .arg("-o")
    .arg("ConnectTimeout=10")
    .arg("-o")
    .arg("LogLevel=ERROR");
  if !use_password {
    command.arg("-o").arg("BatchMode=yes");
  }
  let output = command.arg(ssh_target).arg(remote_command).output().map_err(|error| {
    if use_password {
      format!(
        "Failed to launch SSH diagnostics command: {error}. Ensure sshpass is installed or use SSH keys."
      )
    } else {
      format!("Failed to launch SSH diagnostics command: {error}")
    }
  })?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if stderr.is_empty() {
      "SSH diagnostics command failed without error output.".to_string()
    } else {
      stderr
    });
  }

  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
  if stdout.is_empty() {
    return Err("SSH diagnostics command returned no output.".to_string());
  }
  serde_json::from_str::<Value>(&stdout)
    .map_err(|error| format!("Unable to parse server health response: {error}"))
}

#[tauri::command]
async fn fetch_remote_server_health(
  host: String,
  username: String,
  password: Option<String>,
  synapse_container: Option<String>,
  postgres_container: Option<String>,
  postgres_user: Option<String>,
  postgres_db: Option<String>,
) -> Result<Value, String> {
  tauri::async_runtime::spawn_blocking(move || {
    fetch_remote_server_health_blocking(
      host,
      username,
      password,
      synapse_container,
      postgres_container,
      postgres_user,
      postgres_db,
    )
  })
  .await
  .map_err(|error| format!("Server health task failed: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      synapse_hard_delete_room,
      fetch_remote_server_health
    ])
    .setup(|app| {
      #[cfg(desktop)]
      {
        app.handle().plugin(tauri_plugin_process::init())?;
        app
          .handle()
          .plugin(tauri_plugin_updater::Builder::new().build())?;
      }
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
