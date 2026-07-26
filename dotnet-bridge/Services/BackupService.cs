using System.Text.RegularExpressions;

namespace CodeXaBridge.Services;

public class BackupService
{
    private readonly string _backupDir;
    private static readonly Regex BackupPattern = new(
        @"^(\d{8}_\d{6})_(\d+)_0x([0-9A-F]{8})\.reg$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public BackupService(string backupDir)
    {
        _backupDir = backupDir;
    }

    public Dictionary<string, object?> Dir(Dictionary<string, object?> p)
        => new() { ["dir"] = _backupDir };

    public Dictionary<string, object?> List(Dictionary<string, object?> p)
    {
        var backups = new List<Dictionary<string, object?>>();
        if (!System.IO.Directory.Exists(_backupDir))
            return new Dictionary<string, object?> { ["backups"] = backups };

        foreach (var filename in System.IO.Directory.GetFiles(_backupDir, "*.reg"))
        {
            var name = System.IO.Path.GetFileName(filename);
            var match = BackupPattern.Match(name);
            if (!match.Success) continue;

            var timestampStr = match.Groups[1].Value;
            var decimalStr = match.Groups[2].Value;
            var hexStr = match.Groups[3].Value;

            long size = 0;
            try { size = new FileInfo(filename).Length; } catch (Exception ex) { Console.Error.WriteLine($"[BackupService.List] {ex.Message}"); }

            int.TryParse(decimalStr, out var decVal);
            int.TryParse(timestampStr[..4], out var year);
            int.TryParse(timestampStr[4..6], out var month);
            int.TryParse(timestampStr[6..8], out var day);
            int.TryParse(timestampStr[9..11], out var hour);
            int.TryParse(timestampStr[11..13], out var minute);
            int.TryParse(timestampStr[13..15], out var second);

            backups.Add(new Dictionary<string, object?>
            {
                ["filename"] = name,
                ["filepath"] = filename,
                ["timestamp"] = timestampStr,
                ["decimal"] = decVal,
                ["hex"] = $"0x{hexStr}",
                ["date"] = $"{year:D4}-{month:D2}-{day:D2}",
                ["time"] = $"{hour:D2}:{minute:D2}:{second:D2}",
                ["size"] = size,
                ["module"] = "win32",
            });
        }

        backups.Sort((a, b) =>
            string.Compare((string?)b!["timestamp"], (string?)a!["timestamp"], StringComparison.Ordinal));

        return new Dictionary<string, object?> { ["backups"] = backups };
    }

    public Dictionary<string, object?> Export(Dictionary<string, object?> p)
    {
        var src = GetString(p, "filepath") ?? "";
        var dest = GetString(p, "dest") ?? "";
        if (string.IsNullOrEmpty(src) || string.IsNullOrEmpty(dest))
            return Error("Missing filepath or dest parameter");
        if (!System.IO.File.Exists(src))
            return Error("Source file not found");

        try
        {
            System.IO.File.Copy(src, dest, true);
            return new Dictionary<string, object?> { ["success"] = true };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    public Dictionary<string, object?> Restore(Dictionary<string, object?> p, RegistryService registry)
    {
        var filepath = GetString(p, "filepath") ?? "";
        if (string.IsNullOrEmpty(filepath))
            return Error("Missing 'filepath' parameter");
        if (!System.IO.File.Exists(filepath))
            return Error("Backup file not found");

        var filename = System.IO.Path.GetFileName(filepath);
        var match = BackupPattern.Match(filename);
        if (!match.Success)
            return Error("Invalid backup filename format");

        if (!int.TryParse(match.Groups[2].Value, out var decimalValue))
            return Error("Invalid decimal value in backup filename");

        // Backup current value before restoring
        var current = registry.Read(new());
        if (!current.ContainsKey("error"))
        {
            System.IO.Directory.CreateDirectory(_backupDir);
            registry.Backup(new(), _backupDir);
        }

        // Write restored value
        if (!RegistryService.IsAdmin())
            return Error("Administrator privileges required. Please restart CodeXa Studio as Administrator.");

        var writeResult = registry.Write(new Dictionary<string, object?> { ["value"] = decimalValue });
        if (writeResult.ContainsKey("error"))
            return Error("Failed to write restored value to registry");

        return new Dictionary<string, object?> { ["success"] = true, ["value"] = decimalValue };
    }

    public Dictionary<string, object?> Delete(Dictionary<string, object?> p)
    {
        var filename = GetString(p, "filename") ?? "";
        if (string.IsNullOrEmpty(filename))
            return Error("Missing 'filename' parameter");

        var filepath = System.IO.Path.Combine(_backupDir, filename);
        if (System.IO.File.Exists(filepath))
        {
            System.IO.File.Delete(filepath);
            return new Dictionary<string, object?> { ["success"] = true };
        }
        return Error("File not found");
    }

    public Dictionary<string, object?> ClearAll(Dictionary<string, object?> p)
    {
        int deleted = 0;
        if (System.IO.Directory.Exists(_backupDir))
        {
            foreach (var f in System.IO.Directory.GetFiles(_backupDir))
            {
                try { System.IO.File.Delete(f); deleted++; } catch (Exception ex) { Console.Error.WriteLine($"[BackupService.ClearAll] {ex.Message}"); }
            }
        }
        return new Dictionary<string, object?> { ["deleted"] = deleted };
    }

    private static string? GetString(Dictionary<string, object?> p, string key)
    {
        if (p.TryGetValue(key, out var val) && val is string s) return s;
        return null;
    }

    private static Dictionary<string, object?> Error(string msg)
        => new() { ["error"] = msg };
}
