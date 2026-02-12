use reqwest::{header, Client, StatusCode};
use serde_json::{json, Value};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![synapse_hard_delete_room])
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
