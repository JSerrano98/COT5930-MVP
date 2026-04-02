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

**Version:** 0.0.1  
**Date:** 04/01/2026

---

## Overview

The United States Army Aeromedical Research Laboratory's (USAARL) Operator State Monitoring (OSM) team researches how cognitive state affects how US Army UH-60 pilots and UAS operators perform in their tasks.

Currently, the OSM team uses an in-house program named Dexter as a data-syncing and dashboard view of real-time data. Dexter is developed within the MATLAB environment and data is streamed into it via a Lab Streaming Layer. While functional, Dexter is tightly coupled to MATLAB, difficult to extend with new sensors, and lacks integrated machine learning capabilities.

There is a need for a novel, modular platform for the OSM team where they can plug and play different sensors, have those output signals extracted and transformed, displayed and synced together in real time for monitoring, with persistent data storage for research purposes as well as for training machine learning models.

The aim of this software specification is to lay the foundations for such a platform: to distinguish the data structures and end-to-end points of inter-communication, define a framework for data integration, handling, and storage, and establish the modularization of class components.

### Goals

- Provide researchers with a unified, time-synchronized view of multi-modal physio streams during live sessions.
- Deliver low-latency ML predictions that flag cognitive states or crash risk in real time.
- Guarantee complete, timestamped session recordings for offline analysis.
- Build a responsive and easy-to-use UI for non-tech-savvy researchers.

---

## System Architecture

The system is organized into three layers:

- **Data Layer:** ingestion, transformation, and routing of sensor data.
- **Frontend:** the researcher-facing dashboard and visualization.
- **Backend:** orchestration, APIs, session management, and the machine learning module.

<!-- TODO: Insert System Diagram -->

## Directory Structure

```
echo/
├── README.md
│
├── src/
│   ├── data/
│   │   ├── extract/
│   │   │   └── adapters/        # one module per sensor type
│   │   ├── transform/
│   │   │   └── steps/           # modular processing steps
│   │   └── load/
|   |       ├── load.py
│   │       ├── lsl_outlet.py
│   │       ├── ml_queue.py
│   │       └── session_buffer.py
│   │
│   ├── backend/
│   │   ├── api/                 # REST endpoints
│   │   ├── session_manager.py
│   │   ├── stream.py
│   │   ├── recording.py
│   │   └── alert.py
│   │
│   ├── frontend/
│   │   └── dashboard/
│   │       └── panels/          # modular UI components
│   │
│   └── models/
│       └── training/            # training environment
│
└──configs/                      # saved session configurations
```

---

## Data Layer

The Data Layer consists of an ETL pipeline that extracts raw data from sensors, transforms it for abstracted use. Example, combining individual alpha-band EEG channels into a single global alpha signal, or deriving a composite heart rate metric from raw ECG, with adjustable filtering dependent on each sensor's superclass. The processed data is then loaded to three destinations: the frontend for visualization on the dashboard, the machine learning module for active model inference, and into persistent memory for saving at session end.

A note on parallelism: the intent is for these three load targets to receive data concurrently, but whether that is achieved through true parallel threads, async dispatch, or sequential-but-fast handoff is an implementation detail to be determined during prototyping.

### Extract

Each sensor type requires a dedicated adapter a small software module that knows how to connect to that specific hardware or its vendor SDK, read raw samples, and emit them in a common internal format. This is what makes the system plug-and-play: to add a new sensor, a researcher (or developer) writes a new adapter that conforms to the common format, and the rest of the pipeline handles it automatically.

Each sample block is tagged with a receive timestamp for latency monitoring.

### Transform

Transformations run as a configurable chain of processing steps. Each step is optional and toggled per stream via session configuration. The exact steps available will depend on the sensor modality. EEG streams may need re-referencing and band-power extraction, while ECG streams may need R-peak detection. The key design principle is that the transform chain is modular: steps can be added, removed, or reordered without modifying the core pipeline.

At a high level, transforms fall into two categories:

- **Signal conditioning:** filtering noise, removing artifacts, downsampling. These clean up the raw signal.
- **Signal abstraction:** deriving higher-level signals from raw channels. For example, computing a global alpha-band power signal from all EEG electrodes, or extracting heart rate variability metrics from raw ECG. These produce the abstracted signals that researchers and ML models consume.

All transforms must be causal (no look-ahead) to preserve real-time capability.

### Load

After transformation, each sample block is dispatched to three consumers:

1. **LSL Outlet:** for live synchronization and observation on the dashboard.
2. **ML Inference Queue:** processed data is buffered into time windows and sent to whichever ML model is active so it can produce predictions.
3. **Session Buffer:** raw and/or transformed data held for saving at session end. Note: LSL's own recording tool (LabRecorder) already captures streams to XDF files. Whether ECHO uses LabRecorder directly, wraps it, or implements its own buffering is an implementation decision. The requirement is that all session data is captured completely regardless of approach.

### Common Message Schema

To decouple sensor-specific logic from downstream processing, all adapters emit data in a shared internal format. The exact schema is still under discussion, but a proposed starting point:

```json
{
  "stream_id": "eeg_openbci_01",
  "modality": "EEG",
  "session_id": "sess_20260401_001",
  "timestamps": [1711843200.001, 1711843200.005],
  "channels": ["Fz", "Cz", "Pz"],
  "data": [[0.12, -0.34, 0.56], [0.11, -0.31, 0.54]],
  "units": "µV",
  "sample_rate_hz": 250
}
```

This schema will be refined as the team evaluates how data actually flows through the system during early prototyping.

---

## Frontend

The frontend consists of a modular, responsive dashboard where researchers can select which sensor components to visualize and which models to run. After the data layer processes incoming signals, the data is streamed via Lab Streaming Layer to the dashboard components.

The frontend technology is under evaluation. Candidates include a React/Tailwind UI packaged in Electron for a native desktop feel, or a more dependency-light approach using a Python-based UI library (e.g., PyQt, Dear PyGui) or a C++ framework for tighter integration with the pipeline. No commitment to web-based or desktop-native has been made yet.

### Lab Streaming Layer

#### LSL Outlets

The system creates one LSL outlet per data stream. Each outlet publishes on the local network so that the dashboard and any other LSL-compatible tool can discover and subscribe to it.

An LSL outlet is essentially a named broadcast channel. When the pipeline creates one, it registers the stream's name, what type of data it carries, how many channels it has, and its sample rate. Any LSL-compatible consumer on the same network can then discover and subscribe to that stream. The configuration for each outlet looks like:

```
Name:           "ECHO_{modality}_{device_id}"
Type:           "{modality}"
Channel count:  n
Sample rate:    native or downsampled rate
Channel format: float32
Source ID:      "{session_id}_{stream_id}"
```

#### Event Markers

A dedicated LSL outlet of type `Markers` publishes event annotations including session start/stop, ML prediction outputs, operator-generated manual markers, and artifact flagging events.

#### Clock Synchronization

All LSL outlets share the same LSL clock (via `lsl_local_clock()`). The pipeline converts device timestamps to LSL clock time to keep all streams aligned. LSL's built-in synchronization should handle streams on the same machine well; cross-machine synchronization and the achievable jitter targets need to be validated during testing.

### Dashboard

The dashboard subscribes to LSL outlets via a bridge (the exact bridging mechanism depends on the chosen frontend technology) and renders modular, researcher-configurable panels. The panels available in a given session depend entirely on what sensors the researchers have connected and what data those sensors produce. Examples of panel types include:

- **Time-Series Traces:** scrolling waveforms for any stream where waveform visualization is appropriate.
- **Numeric Readouts:** live values for derived metrics (the specific metrics depend on the active sensors).
- **ML Prediction Panel:** displays the output of whichever model is active, whether that's a cognitive state score, a crash/no-crash classification, or something else entirely.
- **Alert Banner:** prominent visual and audible alert when the ML model issues a high-risk signal.

The dashboard should be component-based so that researchers can add, remove, or rearrange panels to suit different experimental protocols without modifying code.

**Latency goal:** ≤ 200 ms from sensor sample to screen.

---

## Backend

The backend orchestrates the passing of data between layers via RESTful APIs and manages session lifecycle, configuration, and ML model coordination.

The implementation language is under evaluation. Python is the current frontrunner for rapid prototyping and its strong ecosystem for scientific computing and ML. Go, Rust, or C++ may be adopted for latency-critical paths in future iterations.

### Server Structure

The backend is organized into the following service modules:

| Module | Responsibility |
|---|---|
| **API Server** | RESTful endpoints for session management, configuration, stream metadata, and ML model management. |
| **Session Manager** | Handles session lifecycle (create, start, stop, resume). Coordinates the data layer and recording. |
| **Stream Registry** | Tracks active sensor streams, their configuration, and health status. |
| **Recording Service** | Manages session data capture and flushes data to disk on session end. |
| **Alert Dispatcher** | Receives ML predictions that exceed researcher-configured thresholds and pushes alerts to the dashboard and LSL markers. |

#### Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sessions` | Create a new session with configuration |
| `PUT` | `/api/sessions/{id}/start` | Start data acquisition and recording |
| `PUT` | `/api/sessions/{id}/stop` | Stop session and flush data to disk |
| `GET` | `/api/sessions/{id}/status` | Current session state, active streams, uptime |
| `GET` | `/api/streams` | List all registered and active sensor streams |
| `POST` | `/api/streams/{id}/config` | Update transform chain or filter settings |
| `GET` | `/api/models` | List available ML models |
| `POST` | `/api/models/{id}/activate` | Activate a model for the current session |
| `GET` | `/api/recordings` | List stored session recordings |

### Machine Learning Module

#### Model Integration Framework

The ML module is a framework that defines how models integrate with the rest of the system. Researchers build, train, and select their own models. ECHO provides the scaffolding for plugging them in.

A model that integrates with ECHO must conform to a standard interface:

- **Input contract:** what data the model expects (which streams, what features, what window size).
- **Output contract:** what the model returns (a continuous score, a classification label with confidence, or a custom schema).
- **Alert rules:** researcher-configurable thresholds that determine when a model's output triggers an alert on the dashboard. These are not hard-coded; they are set per model, per session, and can be adjusted on the fly.

The system provides a model registry where researchers can register new models, configure their input/output contracts, and activate them for live sessions.

#### Integrated Training Environment

The system provides a training environment where researchers can point at stored session recordings, select feature sets, configure train/validation splits, and launch training runs. Preset model architectures with adjustable hyperparameters are available for quick experimentation, but researchers can also bring their own model code. Trained models are versioned and can be deployed into the inference service for live evaluation.

If the active model becomes unreachable during a session, the pipeline continues recording and streaming. The dashboard displays a "model offline" indicator.

---

## Session Recording and Data Persistence

### Recording Lifecycle

1. **Session Start:** Researcher initiates a session, providing metadata (participant ID, condition label, notes). The system begins capturing data.
2. **During Session:** All data is captured continuously. LSL already provides its own recording capability via LabRecorder, which saves all streams to XDF files. Whether ECHO leverages LabRecorder directly or implements additional buffering (e.g., for crash recovery) is an implementation decision.
3. **Session Stop:** Researcher ends the session. All captured data is finalized to the output file(s) along with session metadata.

### Output Formats

| Format | Contents | Primary Use |
|---|---|---|
| **XDF** | All LSL streams, markers, and clock offsets in one file | LSL-native replay and analysis (EEGLAB, MNE) |
| **HDF5** | Structured datasets per stream, feature vectors, ML predictions, metadata | Programmatic analysis (Python / MATLAB) |
| **CSV (optional)** | Flat export of selected streams | Quick inspection, spreadsheet import |

### File Structure

Researchers select an output folder on their machine through the dashboard UI. Session data is organized within that folder as follows:

```
{user_selected_folder}/{session_id}/
  ├── session_meta.json          # participant info, config, timing
  ├── raw_streams.xdf            # all raw streams + markers
  ├── processed_streams.hdf5     # filtered data + features + predictions
  └── ml_predictions.csv         # timestamp, mode, label, confidence
```

---

## Session Configuration

Sessions are configured through the dashboard UI before starting. The UI provides forms for setting up participant metadata, selecting active sensor streams and their transform chains, choosing and configuring an ML model, and selecting the output folder and file formats.

Internally, these settings are stored in a structured format (the specific serialization JSON, YAML, TOML, or otherwise is an implementation detail). The key requirement is that session configurations can be saved, loaded, and reused so that researchers can quickly set up recurring experimental protocols.

---

## Non-Functional Requirements

| Requirement | Target |
|---|---|
| End-to-end pipeline latency (sensor to dashboard) | ≤ 200 ms |
| ML inference latency | Model-dependent; the framework should add minimal overhead beyond the model's own compute time |
| Alert dispatch latency (prediction to researcher) | ≤ 300 ms |
| Session duration | Up to 8 hours continuous |
| Data loss on clean stop | 0 samples |
| Dashboard refresh rate | ≥ 30 FPS for traces |

---

## Technology Candidates

| Component | Current Thinking | Notes |
|---|---|---|
| Pipeline core | Python 3.11+ | C++ may be needed for latency-critical paths |
| LSL | pylsl / liblsl | LSL is a fixed requirement, not a candida:te it is the synchronization and streaming backbone of the system |
| Signal processing | MNE-Python, SciPy | Used within the Transform stage of the ETL pipeline for filtering, feature extraction, and signal abstraction |
| ML inference | To be determined | The framework needs to support loading and running researcher-provided models. ONNX Runtime is one option that can run models from multiple training frameworks (PyTorch, TensorFlow, etc.) without requiring those frameworks at runtime |
| Dashboard frontend | React + Tailwind (Electron) | PyQt and Dear PyGui are alternatives if a native desktop approach is preferred |
| Dashboard backend | FastAPI | Serves the REST API; alternatives include Flask or Tornado |
| Data storage | XDF (via LSL), HDF5 (h5py) | XDF for LSL-native recording, HDF5 for structured programmatic access |

---

## Glossary

| Term | Definition |
|---|---|
| **LSL** | Lab Streaming Lay:er a protocol and library for synchronized streaming of time-series data in research settings |
| **XDF** | Extensible Data Form:at the native file format for LSL recordings |
| **ETL** | Extract, Transform, Lo:ad the data processing pipeline pattern |
| **EDA / GSR** | Electrodermal Activity / Galvanic Skin Response |
| **HRV** | Heart Rate Variability |
| **PERCLOS** | Percentage of Eye Closu:re a drowsiness metric from eye tracking |
| **UAS** | Unmanned Aircraft System |
| **UH-60** | Black Hawk utility helicopter |
| **USAARL** | United States Army Aeromedical Research Laboratory |
| **OSM** | Operator State Monitoring |
