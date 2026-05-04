# Using the Dashboard

The Dashboard is the main screen in ECHO. It shows live data from connected sensors in real time and lets you record sessions for later analysis.

---

## Overview

The dashboard has two main areas:

- **Left panel** — Lists all active sensor streams and controls for adding monitors
- **Canvas** — The main workspace where you place and arrange monitor panels

---

## Connecting to Sensors

When you open the dashboard, the connection status is shown in the top-left corner of the left panel.

- **Green dot + "Connected"** — ECHO is receiving data from the backend
- **Red dot + "No Signal"** — ECHO cannot reach the backend server

If you see "No Signal", make sure the backend server and sensors are running (see [GETTING_STARTED.md](GETTING_STARTED.md)).

Click **Refresh** in the left panel to re-scan for new streams at any time. Use this after starting new sensors mid-session.

---

## The Stream Panel (Left Side)

The left panel lists every active sensor stream grouped by type (ECG, EEG, EDA, etc.).

Each stream entry has buttons to add different monitor types:

| Button | What it adds |
|--------|-------------|
| **Wave** | Oscilloscope-style waveform for that stream |
| **Stats** | Rolling statistics table (mean, min, max, std) |
| **BPM** | Heart rate display (HeartRate streams only) |
| **EDA** | Skin conductance display (EDA streams only) |
| **EMG** | Muscle signal display (EMG streams only) |
| **Resp** | Respiration display (Respiration streams only) |
| **Temp** | Temperature display (Temperature streams only) |

Click any button to add that monitor to the canvas.

### Collapsing the Panel

Click the **‹** button at the top of the panel to collapse it into a narrow strip, giving your monitors more room. Click **›** to expand it again.

---

## Working with Monitors on the Canvas

### Moving Monitors

Click and drag the **header bar** of any monitor to move it anywhere on the canvas.

### Resizing Monitors

Drag the **grip handle in the bottom-right corner** of any monitor to resize it.

### Removing a Monitor

Click the **×** button in the top-right corner of the monitor header to close it.

### Navigating the Canvas

- **Pan** — Middle-click drag, or right-click drag
- **Zoom** — Scroll wheel

---

## Monitor Types

### Waveform Monitor

Displays a scrolling oscilloscope-style view of the raw sensor signal.

- **Channel selector** — Use the dropdown in the monitor header to view a single channel or all channels overlaid
- **Color picker** — Click a channel's color square to change its color
- **Latency dot** — The colored dot in the monitor footer shows how recently data arrived:
  - Green — less than 100 ms ago (good)
  - Yellow — less than 300 ms ago (acceptable)
  - Red — 300 ms or more ago (potential issue)

### Stats Monitor

Shows rolling statistics for the stream: mean, standard deviation, minimum, and maximum.

- **Time window selector** — Set how much recent data the stats are calculated over
  - Units: `ms` (milliseconds), `s` (seconds), `min` (minutes), or `samples`
  - Change the number and unit; stats update live

### BPM Monitor

Displays the current heart rate in beats per minute from a HeartRate-type stream.

### Specialty Monitors (EDA, EMG, Resp, Temp)

Purpose-built displays for specific physiological signals. Each shows a formatted readout tailored to that signal type.

---

## Adding an ML Model Monitor

The ML Model Monitor runs a trained machine learning model in real time and shows its prediction live on the dashboard.

1. Click the **+ ML** button in the left panel
2. A new ML monitor panel appears on the canvas
3. Configure it:
   - **Model file** — Browse to or type the path of a `.pkl` model file
   - **Source stream** — Select which sensor stream to feed into the model
   - **Buffer window** — How many seconds of data to keep in the buffer for the model
   - **Process interval** — How often (in seconds) the model runs a prediction
   - **Feature aliases** — Map model feature names to the channel labels in the stream (use the alias editor if names do not match)
4. Click **Start** to begin live inference
5. The monitor will show the current prediction and confidence score
6. Click **Stop** to stop the model

> The model must be trained first. See [MACHINE_LEARNING.md](MACHINE_LEARNING.md).

---

## CSV Replay Monitor

Lets you replay a previously recorded CSV file as if it were a live stream.

> This feature is only visible in **Development Mode** (see [SETTINGS.md](SETTINGS.md)).

1. Click **+ CSV** in the left panel
2. Browse to a CSV recording file
3. Click **Start** — the file plays back as a live stream
4. A progress bar shows how far through the file you are
5. Click **Stop** to end playback

---

## Recording a Session

Recording saves all active sensor data to a CSV file for later analysis.

1. Make sure the dashboard shows **Connected**
2. Click the **Record** button in the left panel (or in the top bar)
3. A dialog will appear — choose a save location and file name
4. Click **Start Recording** — the button turns red and pulses while recording is active
5. Click **Stop** (or **Stop Recording**) when you are done

Recordings are saved to the **Session Recordings Directory** set in Settings (default: `backend/recordings`).

> If a sensor disconnects mid-recording, ECHO will show a warning alert automatically.

---

## Saving and Loading a Dashboard Workspace

You can save your entire monitor layout — positions, sizes, and configurations — to a file, and reload it later.

### Saving

1. Click **Save Workspace** (if visible in the header or menu)
2. Choose a location and file name — the file is saved as `.json`

### Loading

1. Click **Load Workspace**
2. Browse to a previously saved `.json` workspace file
3. The layout restores — any running ML or replay sessions are stopped first

The default save/load folder is set in [SETTINGS.md](SETTINGS.md).

---

## Alerts

ECHO shows alert notifications in the **top-right corner** of the screen. They appear on every tab.

| Alert color | What it means |
|------------|---------------|
| Red (error) | A sensor or session disconnected unexpectedly |
| Yellow (warning) | A recording stopped due to a connection issue |
| Green (info) | Informational message (e.g., reconnected) |

Alerts auto-dismiss after 8 seconds. Duplicate alerts are suppressed.

---

## Tips

- You can have multiple monitors for the same stream (e.g., a waveform and a stats view side by side)
- Start sensors and click **Refresh** to pick them up without restarting the app
- Save your workspace so you do not need to re-arrange monitors every session
