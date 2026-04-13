# ECHO: Enhanced Cognitive Human Operations
```
╭───────────────────────────────────────────────────────────╮
│                                                           │
│  ███████╗  ██████╗ ██╗  ██╗  ██████╗                      │
│  ██╔════╝ ██╔════╝ ██║  ██║ ██╔═══██╗   Enhanced          │
│  █████╗   ██║      ███████║ ██║   ██║   Cognitive         │
│  ██╔══╝   ██║      ██╔══██║ ██║   ██║   Human             │
│  ███████╗ ╚██████╗ ██║  ██║ ╚██████╔╝   Operations        │
│  ╚══════╝  ╚═════╝ ╚═╝  ╚═╝  ╚═════╝                      │
│                                                           │
│              USAARL || FAU                                │
│                                                           │
╰───────────────────────────────────────────────────────────╯
```
**Version:** 0.1.1 — Monitoring Dashboard Beta  

**Date:** 04/12/2026

**Facilitator:** US Army Aeromedical Research Lab (USAARL) || Operator State Monitoring Team (OSM)

**Developer:** Florida Atlantic University (FAU) || Hacking for Defense Program (H4D)

---

## Table of Contents

- [About](#about)
- [What's New in v0.1.1](#whats-new-in-v011)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Dashboard](#dashboard)
- [Sensors](#sensors)
- [Documentation](#documentation)
- [Tech Stack](#tech-stack)
- [References](#references)

---

## About

ECHO is a real-time platform for monitoring the cognitive state of operators. It connects to physiological sensors (EEG, ECG, eye tracking, etc.) via [Lab Streaming Layer (LSL)](https://labstreaminglayer.org), displays live data on a dashboard, and records everything for offline analysis. Future implementations include a machine learning training and development abstraction environment for quick, easy, and intuitive development of models for research testing.

The end goal of this platform is to provide the means to develop the groundwork for systems that aim to enhance operator state management, monitoring, prediction, and support.

---

## What's New in v0.1.1

This release introduces the **Monitoring Dashboard Beta** — the first working frontend for ECHO. Building on the LSL streaming backend from v0.1.0, this version adds a real-time visualization layer and several backend improvements.

**Frontend — Monitoring Dashboard**
- Live oscilloscope-style signal rendering via HTML5 Canvas with per-channel display
- Add, remove, and resize monitor panels to build a custom monitoring layout
- Multi-channel support with individual channel isolation or all-channels overlay view
- Per-channel color coding with a built-in color picker (palette presets + custom hex)
- Automatic stream discovery — monitors populate with all detected LSL streams
- Live refresh to re-scan the network for new streams without restarting the session
- Auto-reconnecting WebSocket connection with online/offline status indicator
- Recording indicator UI (recording backend not yet implemented)
- Navigation scaffolding for Settings, Machine Learning, and Data views (pages stubbed)

**Backend**
- `start_all_dummy.py` — single-command launcher that discovers and starts all dummy sensors with a `default()` classmethod
- Alpha Band Power derived sensor — computes log-scaled alpha-band (8–12 Hz) power from a source EEG stream using Welch's method
- Sensor templates directory (`sensors/templates/`) with ready-to-copy templates for dummy, derived, and physical sensors
- Project structure reorganized from `src/` to `app/` with separate `backend/` and `frontend/` directories

---

## Project Structure

```
echo/
├── app/
│   ├── backend/
│   │   ├── sensors/
│   │   │   ├── sensor.py              # sensor class hierarchy (base, physical, derived, dummy, ML)
│   │   │   ├── dummy/                 # fake sensors for testing
│   │   │   │   ├── fake_ECG.py        # synthetic heartbeat signal
│   │   │   │   ├── fake_eeg.py        # synthetic 8-channel EEG
│   │   │   │   └── hi_low_signal.py   # simple square wave
│   │   │   ├── derived/               # computed metrics from raw streams
│   │   │   │   └── alpha_band_power.py # New! Computes log-scaled alpha power from EEG using Welch's method
│   │   │   └── templates/             # copy-paste starters for new sensors
│   │   │       ├── dummy_sensor_template.py
│   │   │       ├── derived_sensor_template.py
│   │   │       └── physical_sensor_template.py
│   │   ├── session.py                 # FastAPI server, LSL discovery, WebSocket bridge
│   │   ├── start_all_dummy.py         # launch all dummy sensors in one process
│   │   ├── test_monitor.py            # terminal WebSocket client for testing (redundandt with frontend but useful for quick backend tests)
│   │   └── requirements.txt
│   │
│   └── frontend/                      # React + Tailwind dashboard (Vite)
│       ├── src/
│       │   ├── main.jsx               # app entry point
│       │   ├── App.jsx                # router and layout
│       │   ├── App.css                # global styles (Lexend font, Tailwind import thats it really :3 ) 
│       │   └── assets/
│       │       ├── components/
│       │       │   └──  Navbar.jsx     # sidebar navigation
│       │       └── views/
│       │           ├── Dashboard.jsx  # main monitoring view
│       │           ├── Settings.jsx   # (stubbed)
│       │           ├── MachineLearning.jsx  # (stubbed)
│       │           └── Data.jsx       # (stubbed)
│       ├── package.json
│       ├── vite.config.js
│       └── index.html
│
├── docs/
│   ├── sensors/
│   │   ├── ADDING SIMPLE SENSORS.md
│   │   └── ADDING PHYSICAL SENSORS.md
│   └── software specifications/
└── README.md
```

---

## Quick Start

### 1. Start the Backend

```bash
# install backend dependencies
pip install -r app/backend/requirements.txt

# terminal 1 — start all dummy sensors at once
cd app/backend
python start_all_dummy.py

# terminal 2 — start the session manager
cd app/backend
python session.py
```

### 2. Start the Frontend

```bash
# install frontend dependencies
cd app/frontend
npm install

# terminal 3 — start the dev server
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`). The dashboard will auto-connect to the session manager's WebSocket at `ws://localhost:8000/ws`.

### 3. Monitor Signals

1. Click **Add Monitor** to create a monitor panel
2. Select a stream from the dropdown (e.g. `FakeECG`, `FakeEEG`)
3. For multi-channel streams, use the channel dropdown to isolate individual channels or view all overlaid
4. Drag the bottom-right corner to resize any panel
5. Click **Refresh** to re-scan the network if you start new sensors

### Alternative: Terminal-Only Testing

If you just want to verify the backend without the frontend:

```bash
# terminal 3 — watch raw data in the terminal
cd app/backend
python test_monitor.py
```

### Using Real Hardware

For devices with built-in LSL support, open your sensor's LSL app and start streaming before launching the session manager. ECHO discovers any LSL stream on the network automatically. Click **Refresh** in the dashboard to pick up new streams without restarting.

---

## Dashboard

The monitoring dashboard is an oscilloscope-style interface for viewing live sensor streams.

**Monitor Panels** — Each panel connects to a single LSL stream and renders its data in real time on a dark canvas. Panels are independently resizable with a minimum size of 320×220px. Add as many as you need and arrange them freely.

**Multi-Channel Display** — Streams with multiple channels (like the 8-channel FakeEEG) can be viewed as an overlay of all channels with automatic color coding per channel, or you can isolate a single channel via the channel dropdown. A legend in the top-right of the canvas shows channel labels and current values.

**Auto-Scaling** — The Y-axis smoothly adapts to the signal's amplitude range with a dampened scaling algorithm that prevents jitter while still tracking amplitude changes.

**Connection Management** — The dashboard auto-connects to the session manager on load and reconnects automatically if the connection drops. The status indicator in the top bar shows online/offline state.

---

## Sensors

ECHO uses a class hierarchy to treat all data sources uniformly as LSL streams:

| Type | Purpose | Example |
|------|---------|---------|
| **DummySensor** | Fake data for testing | `FakeECG`, `FakeEEG`, `HiLowSensor` |
| **PhysicalSensor** | Wraps non-LSL hardware (serial, BLE, TCP) | Custom device adapters |
| **DerivedSensor** | Computes metrics from other streams | `AlphaBandPower` |
| **MLSensor** | Applies pre-trained models to buffers | *(planned)* |

### Launching Dummy Sensors

You can run individual sensors as standalone scripts or launch all of them at once:

```bash
# all at once (recommended for testing)
cd app/backend
python start_all_dummy.py

# or individually
python -m sensors.dummy.fake_ECG
python -m sensors.dummy.fake_eeg
python -m sensors.dummy.hi_low_signal
```

To make your dummy sensor auto-launchable by `start_all_dummy.py`, add a `default()` classmethod that returns a pre-configured instance.

See the guides in `docs/sensors/` for how to add your own.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Adding Simple Sensors](docs/sensors/ADDING%20SIMPLE%20SENSORS.md) | Guide for dummy and derived sensors |
| [Adding Physical Sensors](docs/sensors/ADDING%20PHYSICAL%20SENSORS.md) | Guide for wrapping real hardware |
| [Technical Specification](docs/software%20specifications/technical-specification.md) | Full system architecture and API contracts |
| [Simplified Specification](docs/software%20specifications/simplified-specification.md) | Plain-English overview for researchers |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Streaming | Lab Streaming Layer (`pylsl`) |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Signal Processing | NumPy, SciPy |
| Frontend | React 19, Tailwind CSS 4, Vite |
| Visualization | HTML5 Canvas (custom oscilloscope renderer) |
| Packaging *(planned)* | Electron |

---

## References

ECHO's streaming backbone is built on Lab Streaming Layer. Thank you to the LSL team for an amazing tool.

> Kothe, C., Shirazi, S. Y., Stenner, T., Medine, D., Boulay, C., Grivich, M. I., Artoni, F., Mullen, T., Delorme, A., & Makeig, S. (2025). The Lab Streaming Layer for Synchronized Multimodal Recording. *Imaging Neuroscience*, 3, IMAG.a.136. https://doi.org/10.1162/IMAG.a.136

<details>
<summary>BibTeX</summary>

```bibtex
@article{kothe2025lab,
  title     = {The Lab Streaming Layer for Synchronized Multimodal Recording},
  author    = {Kothe, Christian and Shirazi, Seyed Yahya and Stenner, Tristan
               and Medine, David and Boulay, Chadwick and Grivich, Matthew I.
               and Artoni, Fiorenzo and Mullen, Tim and Delorme, Arnaud
               and Makeig, Scott},
  journal   = {Imaging Neuroscience},
  volume    = {3},
  pages     = {IMAG.a.136},
  year      = {2025},
  publisher = {MIT Press},
  doi       = {10.1162/IMAG.a.136},
  url       = {https://doi.org/10.1162/IMAG.a.136},
  note      = {Open Access}
}
```

</details>
