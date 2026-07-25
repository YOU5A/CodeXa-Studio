"""
CodeXa Studio - Python Bridge Server
JSON-RPC over stdin/stdout. Imports business logic from three existing tools.
"""

import sys
import os
os.environ["PYGAME_HIDE_SUPPORT_PROMPT"] = "1"
# Suppress pygame welcome message that would pollute JSON-RPC stdout

# Force UTF-8 on Windows stdin/stdout to prevent garbled Chinese characters in JSON-RPC
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")

import json
import importlib.util
import traceback
import base64
import io
import stat
import mutagen

# --- Resolve resource paths relative to this script ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESOURCES_DIR = os.path.join(SCRIPT_DIR, "..", "resources")
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Point sys.argv[0] to DATA_DIR so .pyw config.json resolves to data/config.json
sys.argv[0] = os.path.join(DATA_DIR, "bridge_stub.py")

if RESOURCES_DIR not in sys.path:
    sys.path.insert(0, RESOURCES_DIR)
if DATA_DIR not in sys.path:
    sys.path.insert(0, DATA_DIR)

# --- Module lazy-loading cache ---
_modules = {}
_pending_language = "zh"

def _get_module(name):
    """Lazy-import a .pyw module on first RPC call that needs it."""
    if name in _modules:
        return _modules[name]

    module_map = {
        "w32": "Win32PrioritySeparation.pyw",
        "app": "AppCpuPriorityTools.pyw",
        "fm": "File_Music.pyw",
    }
    if name not in module_map:
        raise ValueError(f"Unknown module: {name}")

    spec_name = module_map[name].replace(".pyw", "")
    spec = importlib.util.spec_from_file_location(
        spec_name,
        os.path.join(RESOURCES_DIR, module_map[name])
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # Apply pending language to newly imported module
    if _pending_language != "zh" and hasattr(mod, "set_language"):
        try:
            mod.set_language(_pending_language, save=False)
        except Exception:
            pass

    _modules[name] = mod
    return mod

def _get_w32():
    return _get_module("w32")

def _get_app():
    return _get_module("app")

def _get_fm():
    return _get_module("fm")

def _get_w32_backup_manager():
    """Lazy-init BackupManager singleton on first backup RPC call."""
    if not hasattr(_get_w32_backup_manager, "_instance"):
        _get_w32_backup_manager._instance = _get_w32().BackupManager(BACKUP_DIR)
    return _get_w32_backup_manager._instance

# --- Bridge-layer music state ---

# --- Backup directory ---
BACKUP_DIR = r"C:\CodeXaStudio\backups"

def _ensure_dir(path):
    """Lazily create directory only when actually needed (write operations)."""
    os.makedirs(path, exist_ok=True)

# ============================================================
# RPC Method Handlers

def handle_system_info(params):
    """Get system information"""
    import platform
    import psutil
    try:
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count()
        cpu_count_physical = psutil.cpu_count(logical=False)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage(DATA_DIR)
        win32 = platform.win32_ver()
        return {
            "cpu_percent": cpu_percent,
            "cpu_count": cpu_count,
            "cpu_count_physical": cpu_count_physical,
            "memory_total": mem.total,
            "memory_used": mem.used,
            "memory_available": mem.available,
            "memory_percent": mem.percent,
            "disk_total": disk.total,
            "disk_used": disk.used,
            "disk_percent": disk.percent,
            "windows_version": platform.version(),
            "windows_release": win32[0] if len(win32) > 0 else "",
            "windows_build": platform.version().rsplit(".", 1)[-1],
            "windows_edition": platform.win32_edition() if hasattr(platform, "win32_edition") else "",
            "hostname": platform.node(),
            "is_admin": _get_w32().AdminChecker.is_admin(),
        }
    except ImportError:
        return {"error": "psutil not installed", "cpu_percent": 0, "memory_percent": 0, "disk_percent": 0}

def handle_registry_read(params):
    """Read Win32PrioritySeparation registry value"""
    value = _get_w32().RegistryManager.read_value()
    if value is None:
        return {"error": "Failed to read registry", "value": None}
    formatter = _get_w32().ValueFormatter()
    return {
        "value": value,
        "decimal": value,
        "hex": f"0x{value:08X}",
        "binary": formatter.format_value(value)["binary"],
    }

def handle_registry_write(params):
    """Write Win32PrioritySeparation registry value"""
    value = params.get("value")
    if value is None:
        return {"error": "Missing 'value' parameter"}
    if not _get_w32().AdminChecker.is_admin():
        return {"error": "Administrator privileges required. Please restart CodeXa Studio as Administrator."}
    success = _get_w32().RegistryManager.write_value(int(value))
    if success:
        return handle_registry_read({})
    return {"error": "Failed to write registry", "success": False}

def handle_registry_backup(params):
    """Create a backup of current registry value"""
    value = _get_w32().RegistryManager.read_value()
    if value is None:
        return {"error": "Failed to read registry value. Administrator privileges may be required."}
    _ensure_dir(BACKUP_DIR)
    filename, filepath = _get_w32().RegistryManager.backup_value(value, BACKUP_DIR)
    if filename:
        return {"filename": filename, "filepath": filepath, "value": value}
    return {"error": "Failed to create backup"}

def handle_backup_dir(params):
    """Return the backup directory path"""
    return {"dir": BACKUP_DIR}

def handle_backup_list(params):
    """List all backups with file size info"""
    backups = _get_w32_backup_manager().list_backups()
    for bp in backups:
        filepath = bp.get("filepath", "")
        if os.path.exists(filepath):
            bp["size"] = os.path.getsize(filepath)
        else:
            bp["size"] = 0
        bp["module"] = "win32"
    return {"backups": backups}

def handle_backup_export(params):
    """Copy a backup file to a destination path"""
    filepath = params.get("filepath")
    dest = params.get("dest")
    if not filepath or not dest:
        return {"error": "Missing filepath or dest parameter"}
    if not os.path.exists(filepath):
        return {"error": "Source file not found"}
    try:
        import shutil
        shutil.copy2(filepath, dest)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

def handle_backup_restore(params):
    """Restore from a backup file"""
    import re
    filepath = params.get("filepath")
    if not filepath:
        return {"error": "Missing 'filepath' parameter"}
    if not os.path.exists(filepath):
        return {"error": "Backup file not found"}
    filename = os.path.basename(filepath)
    # Parse filename to extract decimal value: YYYYMMDD_HHMMSS_DECIMAL_0xHEX.reg
    pattern = re.compile(r"(\d{8}_\d{6})_(\d+)_0x([0-9A-F]{8})\.reg")
    match = pattern.match(filename)
    if not match:
        return {"error": "Invalid backup filename format"}
    try:
        decimal_value = int(match.group(2))
    except ValueError:
        return {"error": "Invalid decimal value in backup filename"}
    # Backup current value before restoring
    current = _get_w32().RegistryManager.read_value()
    if current is not None:
        _ensure_dir(BACKUP_DIR)
        _get_w32().RegistryManager.backup_value(current, BACKUP_DIR)
    # Write the restored value
    if not _get_w32().AdminChecker.is_admin():
        return {"error": "Administrator privileges required. Please restart CodeXa Studio as Administrator."}
    success = _get_w32().RegistryManager.write_value(decimal_value)
    if success:
        return {"success": True, "value": decimal_value}
    return {"error": "Failed to write restored value to registry"}

def handle_backup_delete(params):
    """Delete a backup file"""
    filename = params.get("filename")
    if not filename:
        return {"error": "Missing 'filename' parameter"}
    filepath = os.path.join(BACKUP_DIR, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return {"success": True}
    return {"error": "File not found"}

def handle_admin_check(params):
    """Check if running as administrator"""
    return {"is_admin": _get_w32().AdminChecker.is_admin()}

def handle_admin_restart(params):
    """Signal frontend that admin elevation is needed.
    The original ShellExecuteW("runas") logic is preserved in AdminChecker
    but not called from bridge since we run under Electron."""
    is_admin = _get_w32().AdminChecker.is_admin()
    if is_admin:
        return {"success": True, "already_admin": True}
    return {
        "success": False,
        "requires_admin": True,
        "message": "Administrator privileges required. Please restart CodeXa Studio as Administrator."
    }

def handle_priority_list(params):
    """List all application priority rules"""
    try:
        apps = []
        base_path = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options"
        with _get_app().winreg.OpenKey(_get_app().winreg.HKEY_LOCAL_MACHINE, base_path) as key:
            count = 0
            while True:
                try:
                    subkey_name = _get_app().winreg.EnumKey(key, count)
                    count += 1
                    cpu_val = None
                    io_val = None
                    try:
                        with _get_app().winreg.OpenKey(
                            _get_app().winreg.HKEY_LOCAL_MACHINE,
                            f"{base_path}\\{subkey_name}\\PerfOptions"
                        ) as perf_key:
                            try:
                                cpu_val, _ = _get_app().winreg.QueryValueEx(perf_key, "CpuPriorityClass")
                            except FileNotFoundError:
                                pass
                            try:
                                io_val, _ = _get_app().winreg.QueryValueEx(perf_key, "IoPriority")
                            except FileNotFoundError:
                                pass
                    except FileNotFoundError:
                        pass

                    if cpu_val is not None or io_val is not None:
                        apps.append({
                            "name": subkey_name,
                            "cpu_priority": str(cpu_val) if cpu_val is not None else "-",
                            "io_priority": str(io_val) if io_val is not None else "-",
                        })
                except OSError:
                    break
        return {"applications": apps}
    except Exception as e:
        return {"error": str(e), "applications": []}

def handle_priority_add(params):
    """Add a new application priority rule"""
    name = params.get("name", "").strip()
    cpu_priority = params.get("cpu_priority")
    io_priority = params.get("io_priority")

    if not name:
        return {"error": "Application name required"}
    if not name.lower().endswith(".exe"):
        name += ".exe"

    try:
        base_path = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options"
        # Ensure parent IFEO key exists (CreateKey creates if not present)
        _get_app().winreg.CreateKey(_get_app().winreg.HKEY_LOCAL_MACHINE, f"{base_path}\\{name}")
        # Create or open PerfOptions subkey
        with _get_app().winreg.CreateKey(_get_app().winreg.HKEY_LOCAL_MACHINE, f"{base_path}\\{name}\\PerfOptions") as key:
            if cpu_priority is not None:
                _get_app().winreg.SetValueEx(key, "CpuPriorityClass", 0, _get_app().winreg.REG_DWORD, int(cpu_priority))
            if io_priority is not None:
                _get_app().winreg.SetValueEx(key, "IoPriority", 0, _get_app().winreg.REG_DWORD, int(io_priority))
        return {"success": True}
    except PermissionError:
        return {"error": "Administrator privileges required. Please restart CodeXa Studio as Administrator."}
    except Exception as e:
        return {"error": str(e)}

def handle_priority_edit(params):
    """Edit an application priority rule (same as add but expects existing)"""
    return handle_priority_add(params)

def handle_priority_delete(params):
    """Delete an application priority rule"""
    name = params.get("name", "").strip()
    if not name:
        return {"error": "Application name required"}

    try:
        base_path = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options"
        full_path = f"{base_path}\\{name}\\PerfOptions"
        try:
            with _get_app().winreg.OpenKey(_get_app().winreg.HKEY_LOCAL_MACHINE, full_path, 0, _get_app().winreg.KEY_ALL_ACCESS) as key:
                try:
                    _get_app().winreg.DeleteValue(key, "CpuPriorityClass")
                except FileNotFoundError:
                    pass
                try:
                    _get_app().winreg.DeleteValue(key, "IoPriority")
                except FileNotFoundError:
                    pass
        except FileNotFoundError:
            pass
        # Try to delete the PerfOptions subkey
        try:
            with _get_app().winreg.OpenKey(_get_app().winreg.HKEY_LOCAL_MACHINE, f"{base_path}\\{name}", 0, _get_app().winreg.KEY_ALL_ACCESS) as parent_key:
                _get_app().winreg.DeleteKey(parent_key, "PerfOptions")
        except (FileNotFoundError, OSError):
            pass
        return {"success": True}
    except PermissionError:
        return {"error": "Administrator privileges required. Please restart CodeXa Studio as Administrator."}
    except Exception as e:
        return {"error": str(e)}

def handle_priority_export(params):
    """Export all priority rules to a JSON file"""
    result = handle_priority_list({})
    apps = result.get("applications", [])
    if not apps:
        return {"error": "No configurations to export"}

    filepath = params.get("filepath")
    if not filepath:
        filepath = os.path.join(DATA_DIR, "AppCpuPriority_export.json")

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(apps, f, ensure_ascii=False, indent=2)
    return {"success": True, "filepath": filepath, "count": len(apps)}

def handle_priority_import(params):
    """Import priority rules from a JSON file"""
    filepath = params.get("filepath")
    if not filepath:
        return {"error": "Missing 'filepath' parameter"}

    with open(filepath, "r", encoding="utf-8") as f:
        apps = json.load(f)

    imported = 0
    failed = 0
    for app_info in apps:
        result = handle_priority_add({
            "name": app_info.get("name", ""),
            "cpu_priority": app_info.get("cpu_priority"),
            "io_priority": app_info.get("io_priority"),
        })
        if result.get("success"):
            imported += 1
        else:
            failed += 1

    return {"imported": imported, "failed": failed}

def handle_music_scan(params):
    """Scan a folder for music files"""
    folder = params.get("folder", "")
    extensions = params.get("extensions", ['.mp3', '.flac', '.ogg', '.m4a', '.mp4a', '.wav', '.opus'])
    recursive = params.get("recursive", True)

    if not folder or not os.path.exists(folder):
        return {"error": f"Folder does not exist: {folder}", "files": []}

    files = _get_fm().FileUtils.get_files_by_criteria(folder, extensions, recursive)
    files = _get_fm().FileUtils.sort_files(files, "filename")
    return {"files": files, "count": len(files)}

def handle_music_get_metadata(params):
    """Get metadata for a music file"""
    filepath = params.get("filepath", "")
    if not filepath or not os.path.exists(filepath):
        return {"error": "File not found"}

    metadata = _get_fm().AudioFileProcessor.get_metadata(filepath)
    has_cover = _get_fm().AudioFileProcessor.extract_cover(filepath) is not None
    metadata["has_cover"] = has_cover
    return metadata

def handle_music_save_tags(params):
    """Save tags to a music file"""
    filepath = params.get("filepath", "")
    if not filepath:
        return {"error": "Missing 'filepath' parameter"}

    try:
        if os.path.isfile(filepath):
            os.chmod(filepath, stat.S_IWRITE)
        _get_fm().AudioFileProcessor.save_tags(
            filepath,
            title=params.get("title", ""),
            artist=params.get("artist", ""),
            album=params.get("album", ""),
            year=params.get("year", ""),
            genre=params.get("genre", ""),
            track=params.get("track", ""),
            preserve_title=params.get("preserve_title", False),
        )
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

def handle_music_extract_cover(params):
    """Extract cover image from music file, return as base64"""
    filepath = params.get("filepath", "")
    if not filepath:
        return {"error": "Missing 'filepath' parameter"}

    cover_data = _get_fm().AudioFileProcessor.extract_cover(filepath)
    if cover_data:
        return {"cover": base64.b64encode(cover_data).decode("utf-8")}
    return {"cover": None}

def handle_music_apply_cover(params):
    """Apply cover image to music file"""
    filepath = params.get("filepath", "")
    cover_path = params.get("cover_path", "")
    mime_type = params.get("mime_type", "image/jpeg")

    if not filepath or not cover_path:
        return {"error": "Missing parameters"}

    try:
        if os.path.isfile(filepath):
            os.chmod(filepath, stat.S_IWRITE)
        with open(cover_path, "rb") as f:
            cover_data = f.read()
        _get_fm().AudioFileProcessor.apply_cover(filepath, cover_data, mime_type)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

def handle_music_remove_cover(params):
    """Remove cover from music file"""
    filepath = params.get("filepath", "")
    if not filepath:
        return {"error": "Missing 'filepath' parameter"}

    try:
        if os.path.isfile(filepath):
            os.chmod(filepath, stat.S_IWRITE)
        _get_fm().AudioFileProcessor.remove_cover(filepath)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

def handle_music_rename(params):
    """Rename a music file based on its title"""
    filepath = params.get("filepath", "")
    new_name = params.get("new_name", "")

    if not filepath:
        return {"error": "Missing 'filepath' parameter"}

    dir_path = os.path.dirname(filepath)
    ext = os.path.splitext(filepath)[1]

    if new_name:
        sanitized = _get_fm().FileUtils.sanitize_filename(new_name)
        new_path = os.path.join(dir_path, sanitized + ext)
    else:
        # Try to rename based on title tag
        metadata = _get_fm().AudioFileProcessor.get_metadata(filepath)
        title = metadata.get("title", "")
        if not title:
            return {"error": "No title found"}
        sanitized = _get_fm().FileUtils.sanitize_filename(title)
        new_path = os.path.join(dir_path, sanitized + ext)

    if new_path == filepath:
        return {"error": "New name is same as current name"}

    try:
        os.rename(filepath, new_path)
        return {"success": True, "new_path": new_path}
    except Exception as e:
        return {"error": str(e)}

def handle_music_read_cover_file(params):
    """Read a cover image file and return base64 for preview"""
    filepath = params.get("filepath", "")
    if not filepath or not os.path.isfile(filepath):
        return {"error": "File not found", "cover": None}

    try:
        with open(filepath, "rb") as f:
            data = f.read()
        return {"cover": base64.b64encode(data).decode("utf-8")}
    except Exception as e:
        return {"error": str(e), "cover": None}

def handle_music_save_cover_file(params):
    """Save base64 cover image data to a file on disk"""
    filepath = params.get("filepath", "")
    base64_data = params.get("base64", "")
    ext = params.get("ext", "jpg")

    if not filepath or not base64_data:
        return {"error": "Missing parameters"}

    try:
        data = base64.b64decode(base64_data)
        with open(filepath, "wb") as f:
            f.write(data)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

def handle_music_get_lyrics(params):
    """Get lyrics for a music file.
    Looks for .lrc file alongside audio, then falls back to embedded lyrics."""
    filepath = params.get("filepath", "")
    if not filepath:
        return {"error": "Missing filepath", "lyrics_text": None}

    lyrics_text = None

    # 1. Check for .lrc file alongside the audio file
    base = os.path.splitext(filepath)[0]
    for ext in [".lrc", ".LRC"]:
        lrc_path = base + ext
        if os.path.isfile(lrc_path):
            try:
                with open(lrc_path, "r", encoding="utf-8-sig") as f:
                    lyrics_text = f.read()
                break
            except UnicodeDecodeError:
                pass
            except Exception:
                pass

    # Try fallback encodings for LRC if not yet found
    if not lyrics_text and os.path.isfile(base + ".lrc"):
        for enc in ["gbk", "gb2312", "shift-jis", "euc-kr", "latin-1"]:
            try:
                with open(base + ".lrc", "r", encoding=enc) as f:
                    lyrics_text = f.read()
                break
            except Exception:
                pass

    # 2. Fall back to embedded lyrics via mutagen
    if not lyrics_text:
        try:
            audio = mutagen.File(filepath)
            if audio is not None:
                # MP3: ID3 USLT frame
                if hasattr(audio, "tags") and audio.tags:
                    from mutagen.id3 import USLT
                    uslt_frames = audio.tags.getall("USLT")
                    if uslt_frames:
                        lyrics_text = uslt_frames[0].text
                # FLAC/Vorbis
                if not lyrics_text and hasattr(audio, "tags"):
                    lyrics_tag = audio.tags.get("LYRICS")
                    if lyrics_tag:
                        lyrics_text = lyrics_tag[0] if isinstance(lyrics_tag, list) else str(lyrics_tag)
                # MP4/M4A
                if not lyrics_text and hasattr(audio, "tags"):
                    mp4_lyr = audio.tags.get("©lyr")
                    if mp4_lyr:
                        lyrics_text = mp4_lyr[0] if isinstance(mp4_lyr, list) else str(mp4_lyr)
        except Exception:
            pass

    return {"lyrics_text": lyrics_text}


def handle_backup_clear_all(params):
    """Delete all backup files"""
    deleted = 0
    if os.path.exists(BACKUP_DIR):
        for f in os.listdir(BACKUP_DIR):
            fp = os.path.join(BACKUP_DIR, f)
            if os.path.isfile(fp):
                try:
                    os.remove(fp)
                    deleted += 1
                except OSError:
                    pass
    return {"deleted": deleted}

def handle_config_get(params):
    """Get current configuration"""
    cfg = _get_w32().load_config()
    return cfg

def handle_config_set(params):
    """Set configuration values"""
    cfg = _get_w32().load_config()
    for key, value in params.items():
        cfg[key] = value
    _get_w32().save_config(cfg)
    # Also set language across modules
    if "language" in params:
        _get_w32().set_language(params["language"], save=False)
        _get_app().set_language(params["language"], save=False)
        _get_fm().set_language(params["language"], save=False)
    return {"success": True}
METHODS = {
    # System Info
    "system.info": handle_system_info,

    # Registry
    "registry.read": handle_registry_read,
    "registry.write": handle_registry_write,
    "registry.backup": handle_registry_backup,

    # Admin
    "admin.check": handle_admin_check,
    "admin.restart": handle_admin_restart,

    # Priority Rules
    "priority.list": handle_priority_list,
    "priority.add": handle_priority_add,
    "priority.edit": handle_priority_edit,
    "priority.delete": handle_priority_delete,
    "priority.export": handle_priority_export,
    "priority.import_config": handle_priority_import,

    # Music
    "music.scan": handle_music_scan,
    "music.get_metadata": handle_music_get_metadata,
    "music.save_tags": handle_music_save_tags,
    "music.extract_cover": handle_music_extract_cover,
    "music.apply_cover": handle_music_apply_cover,
    "music.remove_cover": handle_music_remove_cover,
    "music.read_cover_file": handle_music_read_cover_file,
    "music.save_cover_file": handle_music_save_cover_file,
    "music.rename": handle_music_rename,
    "music.get_lyrics": handle_music_get_lyrics,

    # Backups
    "backup.list": handle_backup_list,
    "backup.dir": handle_backup_dir,
    "backup.export": handle_backup_export,
    "backup.restore": handle_backup_restore,
    "backup.delete": handle_backup_delete,
    "backup.clear_all": handle_backup_clear_all,

    # Config
    "config.get": handle_config_get,
    "config.set": handle_config_set,
}

def main():
    # Read language from config without importing heavy modules
    global _pending_language
    try:
        with open(os.path.join(DATA_DIR, "config.json"), "r", encoding="utf-8") as f:
            cfg = json.load(f)
        _pending_language = cfg.get("language", "zh")
    except Exception:
        _pending_language = "zh"

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue

        req_id = request.get("id")
        method = request.get("method", "")
        params = request.get("params", {})

        if method == "__shutdown__":
            sys.exit(0)

        handler = METHODS.get(method)
        if handler is None:
            response = {"id": req_id, "error": f"Unknown method: {method}"}
        else:
            try:
                result = handler(params)
                response = {"id": req_id, "result": result}
            except Exception as e:
                response = {"id": req_id, "error": str(e)}

        sys.stdout.write(json.dumps(response, ensure_ascii=False, default=str) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
