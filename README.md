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
**Version:** 0.1.0 — Backend Prototype  
**Date:** 04/05/2026
**Facilatator:** US Army Aeromedical Research Lab (USAARL) || Operator State Monitoring Team (OSM)
**Developer:** Florida Atlantic University (FAU) || Hacking for Defense Program (H4D) 

---

## Table of Contents

- [About](#about)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Sensors](#sensors)
- [Documentation](#documentation)
- [Tech Stack](#tech-stack)
- [References](#references)

---

## About

ECHO is a real-time platform for monitoring the cognitive state of operators. It connects to physiological sensors (EEG, ECG, eye tracking, etc.) via [Lab Streaming Layer (LSL)](https://labstreaminglayer.org), displays live data on a dashboard, and records everything for offline analysis. Future implementations include a machine learning training and development abstraction environment for quick, easy, and intuitive development of models for research testing.

The end goal of this platform is to provide the means to develop the groundwork for systems that aim to enhance operator state management, monitoring, prediction, and support.

The current release is a **backend skeleton** — a working FastAPI server that acts as the session manager for research recordings via LSL, a sensor abstraction layer for standardized sensor development and integration, and WebSocket streaming for frontend visualization. The frontend is not yet implemented. It is planned to be developed with React.js using Tailwind.css and packaged with Electron.js for desktop use.

---

## Project Structure

```
echo/
├── src/
│   ├── backend/
│   │   ├── sensors/           # sensor class hierarchy + dummy/derived sensors
│   │   ├── session.py         # FastAPI server, LSL discovery, WebSocket bridge
│   │   └── test_monitor.py    # terminal WebSocket client for testing
│   ├── electron/              # (planned) desktop packaging
│   └── frontend/              # (planned) React + Tailwind dashboard
│
├── docs/
│   ├── sensors/               # guides for adding new sensors
│   └── software specifications/
│
├── requirements.txt
└── README.md
```

---

## Quick Start

```bash
# install dependencies
pip install -r requirements.txt

# terminal 1 — start a dummy sensor
cd src/backend
python -m sensors.dummy.fake_ecg

# terminal 2 — start the session manager
cd src/backend
python session.py

# terminal 3 — watch live data
cd src/backend
python test_monitor.py
```

To use hardware with built in LSL support, just open your sensor's LSL app and start streaming before launching the session manager. ECHO discovers any LSL stream on the network automatically.

---

## Sensors

ECHO uses a class hierarchy to treat all data sources uniformly as LSL streams:

| Type | Purpose | Example |
|------|---------|---------|
| **DummySensor** | Fake data for testing | `FakeECG`, `HiLowSensor` |
| **PhysicalSensor** | Wraps non-LSL hardware (serial, BLE, TCP) | Custom device adapters |
| **DerivedSensor** | Computes metrics from other streams | Heart rate from ECG |

See the guides in `docs/sensors/` for how to add your own.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Adding Simple Sensors](docs/sensors/ADDING_SIMPLE_SENSORS.md) | Guide for dummy and derived sensors |
| [Adding Physical Sensors](docs/sensors/ADDING_PHYSICAL_SENSORS.md) | Guide for wrapping real hardware |
| [Technical Specification](docs/software%20specifications/technical-specification.md) | Full system architecture and API contracts |
| [Simplified Specification](docs/software%20specifications/simplified-specification.md) | Plain-English overview for researchers |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Streaming | Lab Streaming Layer (`pylsl`) |
| Backend | Python 3.11+, FastAPI |
| Signal Processing | NumPy, SciPy |
| Frontend *(planned)* | React, Tailwind, Electron |

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
