# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the ECHO backend server.
# Run from the backend/ directory:
#   pyinstaller session.spec --noconfirm

from PyInstaller.utils.hooks import collect_all

block_cipher = None

hidden_imports = [
    # uvicorn internals
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.loops.asyncio',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.protocols.websockets.websockets_impl',
    'uvicorn.lifespan',
    'uvicorn.lifespan.off',
    'uvicorn.lifespan.on',
    # ASGI / HTTP
    'anyio',
    'anyio._backends._asyncio',
    'h11',
    'websockets',
    'starlette',
    'starlette.middleware',
    'starlette.middleware.cors',
    # sklearn internals that get missed
    'sklearn.utils._cython_blas',
    'sklearn.neighbors.typedefs',
    'sklearn.neighbors.quad_tree',
    'sklearn.tree._utils',
    # stdlib items sometimes missed
    'email.mime.text',
    'email.mime.multipart',
    'pkg_resources',
]

datas = []
binaries = []

# Collect all sub-packages from the backend
for pkg in ['dashboard', 'machine_learning', 'sensors', 'data', 'utils']:
    d, b, h = collect_all(pkg)
    datas    += d
    binaries += b
    hidden_imports += h

a = Analysis(
    ['app.py'],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'IPython', 'jupyter'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='session',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # keep console for log output forwarded by main.js
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='session',
)
