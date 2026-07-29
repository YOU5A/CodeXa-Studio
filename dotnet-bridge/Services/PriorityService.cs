using Microsoft.Win32;
using System.Text.Json;

namespace CodeXaBridge.Services;

public class PriorityService
{
    private const string IfeoBase = @"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options";

    public Dictionary<string, object?> List(Dictionary<string, object?> p)
    {
        var apps = new List<Dictionary<string, object?>>();
        try
        {
            using var baseKey = Registry.LocalMachine.OpenSubKey(IfeoBase);
            if (baseKey == null)
                return new Dictionary<string, object?> { ["applications"] = apps };

            foreach (var subkeyName in baseKey.GetSubKeyNames())
            {
                var perfPath = $@"{IfeoBase}\{subkeyName}\PerfOptions";
                using var perfKey = Registry.LocalMachine.OpenSubKey(perfPath);
                if (perfKey == null) continue;

                var cpuVal = perfKey.GetValue("CpuPriorityClass");
                var ioVal = perfKey.GetValue("IoPriority");

                if (cpuVal != null || ioVal != null)
                {
                    apps.Add(new Dictionary<string, object?>
                    {
                        ["name"] = subkeyName,
                        ["cpu_priority"] = cpuVal?.ToString() ?? "-",
                        ["io_priority"] = ioVal?.ToString() ?? "-",
                    });
                }
            }
        }
        catch (Exception ex) { Console.Error.WriteLine($"[PriorityService.List] {ex.Message}"); }
        return new Dictionary<string, object?> { ["applications"] = apps };
    }

    public Dictionary<string, object?> Add(Dictionary<string, object?> p)
    {
        var name = (GetString(p, "name") ?? "").Trim();
        if (string.IsNullOrEmpty(name))
            return Error("Application name required");
        if (!name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            name += ".exe";

        var cpuPriority = GetString(p, "cpu_priority");
        var ioPriority = GetString(p, "io_priority");

        try
        {
            using var baseKey = Registry.LocalMachine.OpenSubKey(IfeoBase, true)
                ?? Registry.LocalMachine.CreateSubKey(IfeoBase);

            var appKeyPath = $@"{IfeoBase}\{name}";
            using var appKey = Registry.LocalMachine.OpenSubKey(appKeyPath, true)
                ?? Registry.LocalMachine.CreateSubKey(appKeyPath);

            var perfKeyPath = $@"{appKeyPath}\PerfOptions";
            using var perfKey = Registry.LocalMachine.OpenSubKey(perfKeyPath, true)
                ?? Registry.LocalMachine.CreateSubKey(perfKeyPath);

            if (cpuPriority != null && int.TryParse(cpuPriority, out var cpu))
                perfKey.SetValue("CpuPriorityClass", cpu, RegistryValueKind.DWord);
            if (ioPriority != null && int.TryParse(ioPriority, out var io))
                perfKey.SetValue("IoPriority", io, RegistryValueKind.DWord);

            return new Dictionary<string, object?> { ["success"] = true };
        }
        catch (UnauthorizedAccessException)
        {
            return Error("Administrator privileges required. Please restart CodeXa Studio as Administrator.");
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    public Dictionary<string, object?> Edit(Dictionary<string, object?> p) => Add(p);

    public Dictionary<string, object?> Delete(Dictionary<string, object?> p)
    {
        var name = (GetString(p, "name") ?? "").Trim();
        if (string.IsNullOrEmpty(name))
            return Error("Application name required");

        try
        {
            var perfKeyPath = $@"{IfeoBase}\{name}\PerfOptions";
            using (var perfKey = Registry.LocalMachine.OpenSubKey(perfKeyPath, true))
            {
                if (perfKey != null)
                {
                    try { perfKey.DeleteValue("CpuPriorityClass"); } catch (Exception ex) { Console.Error.WriteLine($"[PriorityService.Delete] {ex.Message}"); }
                    try { perfKey.DeleteValue("IoPriority"); } catch (Exception ex) { Console.Error.WriteLine($"[PriorityService.Delete] {ex.Message}"); }
                }
            }

            // Try to delete PerfOptions subkey
            var appKeyPath = $@"{IfeoBase}\{name}";
            using (var appKey = Registry.LocalMachine.OpenSubKey(appKeyPath, true))
            {
                try { appKey?.DeleteSubKey("PerfOptions"); } catch (Exception ex) { Console.Error.WriteLine($"[PriorityService.Delete] {ex.Message}"); }
            }

            return new Dictionary<string, object?> { ["success"] = true };
        }
        catch (UnauthorizedAccessException)
        {
            return Error("Administrator privileges required. Please restart CodeXa Studio as Administrator.");
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    public Dictionary<string, object?> Export(Dictionary<string, object?> p, string dataDir)
    {
        var result = List(p);
        var apps = (result["applications"] as List<Dictionary<string, object?>>) ?? [];

        if (apps.Count == 0)
            return Error("No configurations to export");

        var filepath = GetString(p, "filepath");
        if (string.IsNullOrEmpty(filepath))
            filepath = System.IO.Path.Combine(dataDir, "AppCpuPriority_export.json");

        try
        {
            var json = JsonSerializer.Serialize(apps, new JsonSerializerOptions { WriteIndented = true });
            System.IO.File.WriteAllText(filepath, json, System.Text.Encoding.UTF8);
            return new Dictionary<string, object?> { ["success"] = true, ["filepath"] = filepath, ["count"] = apps.Count };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    public Dictionary<string, object?> Import(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        if (string.IsNullOrEmpty(filepath))
            return Error("Missing 'filepath' parameter");

        try
        {
            var json = System.IO.File.ReadAllText(filepath, System.Text.Encoding.UTF8);
            var apps = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json)
                ?? [];

            int imported = 0, failed = 0;
            foreach (var appInfo in apps)
            {
                var result = Add(new Dictionary<string, object?>
                {
                    ["name"] = GetJsonString(appInfo, "name"),
                    ["cpu_priority"] = GetJsonString(appInfo, "cpu_priority"),
                    ["io_priority"] = GetJsonString(appInfo, "io_priority"),
                });
                if (result.ContainsKey("success")) imported++;
                else failed++;
            }

            return new Dictionary<string, object?> { ["imported"] = imported, ["failed"] = failed };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    private static string? GetJsonString(Dictionary<string, JsonElement> d, string key)
    {
        if (d.TryGetValue(key, out var el) && el.ValueKind == JsonValueKind.String)
            return el.GetString();
        if (d.TryGetValue(key, out el))
            return el.ToString();
        return null;
    }

    private static string? GetString(Dictionary<string, object?> p, string key)
    {
        if (p.TryGetValue(key, out var val) && val != null) return val.ToString();
        return null;
    }

    private static Dictionary<string, object?> Error(string msg)
        => new() { ["error"] = msg };
}
