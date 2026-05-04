# Settings

The Settings tab lets you configure application preferences and the default folder locations ECHO uses for saving and loading files.

Navigate to the **Settings** tab in the top navigation bar to access these options.

---

## Application

### Development Mode

Toggles a backend console panel in the sidebar that shows raw log output from the Python server.

- **On** — A terminal panel is visible showing backend activity. Useful for debugging sensor issues or backend errors.
- **Off** — The panel is hidden for a cleaner interface.

This setting is stored per-device and persists across restarts.

---

## Default Paths

These settings tell ECHO where to look for and save files. Each path can be typed manually or selected using the **Browse** button, which opens a folder picker dialog.

Changes take effect immediately and are saved automatically.

---

### Trained Models Directory

**What it is:** The folder where trained machine learning model files (`.pkl`) are saved after a training job completes.

**Default:** `backend/ml_models`

Change this if you want models saved to a shared drive, an organised project folder, or a specific location on your machine.

---

### Session Recordings Directory

**What it is:** The folder where sensor session recordings are saved when you click **Record** on the dashboard.

**Default:** `backend/recordings`

Change this to redirect recordings to an external drive, a dedicated data folder, or wherever your team stores session files.

---

### Cleaned Datasets Directory

**What it is:** The default output folder used by the ML Clean step when saving a cleaned version of your dataset.

**Default:** `backend/data/CSV/cleaned`

If you work with large datasets or have a structured data directory, point this to the appropriate location so cleaned files are automatically saved there.

---

### Dashboard Workspaces Directory

**What it is:** The default folder used when saving or loading dashboard workspace layout files (`.json`).

**Default:** `backend/workspaces`

If you manage multiple experiment setups or share workspaces with colleagues, point this to a shared or organised location.

---

## Notes

- All paths are stored locally on your computer (in the browser's local storage). They are not shared with other users or synced to any server.
- If a path is left blank, ECHO will fall back to the built-in defaults listed above.
- Changing a path does not move files that were already saved to the previous location.
