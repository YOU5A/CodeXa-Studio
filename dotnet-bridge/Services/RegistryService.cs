using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32;
using System.Management;

namespace CodeXaBridge.Services;

public class RegistryService
{
    private const string RegPath = @"SYSTEM\CurrentControlSet\Control\PriorityControl";
    private const string ValueName = "Win32PrioritySeparation";

    public Dictionary<string, object?> DetectGpu(Dictionary<string, object?> p)
    {
        var adapters = new List<Dictionary<string, object?>>();
        try
        {
            // WMI gives the active adapter PNP IDs reliably across vendors and Windows builds.
            using var video = new ManagementObjectSearcher("SELECT Name, PNPDeviceID FROM Win32_VideoController");
            foreach (ManagementObject item in video.Get())
            {
                var pnp = item["PNPDeviceID"]?.ToString();
                if (string.IsNullOrWhiteSpace(pnp) || !pnp.StartsWith("PCI\\", StringComparison.OrdinalIgnoreCase)) continue;
                var path = @"SYSTEM\CurrentControlSet\Enum\" + pnp;
                using var instance = Registry.LocalMachine.OpenSubKey(path);
                if (instance == null) continue;
                var desc = instance.GetValue("DeviceDesc")?.ToString() ?? item["Name"]?.ToString() ?? "";
                var displayName = desc.Contains(';') ? desc[(desc.LastIndexOf(';') + 1)..] : desc;
                if (adapters.Any(a => string.Equals(a["path"]?.ToString(), path, StringComparison.OrdinalIgnoreCase))) continue;
                adapters.Add(new Dictionary<string, object?> { ["name"] = displayName, ["deviceDesc"] = desc, ["path"] = path, ["instance"] = pnp });
            }
            // Fallback enumeration for unusual drivers without a WMI PNP ID.
            using var pci = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Enum\PCI");
            if (pci != null)
            {
                foreach (var vendorName in pci.GetSubKeyNames())
                using (var vendor = pci.OpenSubKey(vendorName))
                {
                    if (vendor == null) continue;
                    foreach (var instanceName in vendor.GetSubKeyNames())
                    using (var instance = vendor.OpenSubKey(instanceName))
                    {
                        if (instance == null || !string.Equals(instance.GetValue("Class")?.ToString(), "Display", StringComparison.OrdinalIgnoreCase)) continue;
                        var desc = instance.GetValue("DeviceDesc")?.ToString() ?? "";
                        var displayName = desc.Contains(';') ? desc[(desc.LastIndexOf(';') + 1)..] : desc;
                        if (adapters.Any(a => string.Equals(a["path"]?.ToString(), $@"SYSTEM\CurrentControlSet\Enum\PCI\{vendorName}\{instanceName}", StringComparison.OrdinalIgnoreCase))) continue;
                        adapters.Add(new Dictionary<string, object?> {
                            ["name"] = displayName,
                            ["deviceDesc"] = desc,
                            ["path"] = $@"SYSTEM\CurrentControlSet\Enum\PCI\{vendorName}\{instanceName}",
                            ["instance"] = instanceName,
                        });
                    }
                }
            }
        }
        catch (Exception ex) { return new Dictionary<string, object?> { ["error"] = ex.Message, ["adapters"] = adapters }; }
        var formFactor = DetectFormFactor();
        return new Dictionary<string, object?> { ["adapters"] = adapters, ["formFactor"] = formFactor, ["isLaptop"] = formFactor == "laptop" };
    }

    public Dictionary<string, object?> WriteGpuName(Dictionary<string, object?> p)
    {
        if (!IsAdmin()) return new Dictionary<string, object?> { ["error"] = "Administrator privileges required. Please restart CodeXa Studio as Administrator." };
        var path = p.TryGetValue("path", out var rawPath) ? rawPath?.ToString() : null;
        var name = p.TryGetValue("name", out var rawName) ? rawName?.ToString()?.Trim() : null;
        if (string.IsNullOrWhiteSpace(path) || string.IsNullOrWhiteSpace(name) || name.Length > 128)
            return new Dictionary<string, object?> { ["error"] = "Invalid GPU name or registry path." };
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(path, true);
            if (key == null) return new Dictionary<string, object?> { ["error"] = "GPU registry device was not found." };
            var current = key.GetValue("DeviceDesc")?.ToString() ?? "";
            var prefix = current.Contains(';') ? current[..(current.LastIndexOf(';') + 1)] : "";
            key.SetValue("DeviceDesc", prefix + name, RegistryValueKind.String);
            return new Dictionary<string, object?> { ["success"] = true, ["name"] = name };
        }
        catch (Exception ex) { return new Dictionary<string, object?> { ["error"] = ex.Message, ["success"] = false }; }
    }

    private static string DetectFormFactor()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT ChassisTypes FROM Win32_SystemEnclosure");
            foreach (ManagementObject item in searcher.Get())
            foreach (var value in item["ChassisTypes"] as ushort[] ?? Array.Empty<ushort>())
                if (new ushort[] { 8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32 }.Contains(value)) return "laptop";
            using var battery = new ManagementObjectSearcher("SELECT Name FROM Win32_Battery");
            if (battery.Get().Count > 0) return "laptop";
        }
        catch { }
        return "desktop";
    }

    public Dictionary<string, object?> Read(Dictionary<string, object?> p)
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(RegPath);
            var value = key?.GetValue(ValueName);
            if (value is int v)
            {
                return new Dictionary<string, object?>
                {
                    ["value"] = v,
                    ["decimal"] = v,
                    ["hex"] = $"0x{v:X08}",
                    ["binary"] = FormatBinary(v),
                };
            }
        }
        catch (Exception ex) { Console.Error.WriteLine($"[RegistryService.Read] {ex.Message}"); }
        return new Dictionary<string, object?> { ["error"] = "Failed to read registry", ["value"] = null };
    }

    public Dictionary<string, object?> Write(Dictionary<string, object?> p)
    {
        if (!TryGetInt(p, "value", out var value))
            return new Dictionary<string, object?> { ["error"] = "Missing 'value' parameter" };

        if (!IsAdmin())
            return new Dictionary<string, object?> { ["error"] = "Administrator privileges required. Please restart CodeXa Studio as Administrator." };

        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(RegPath, true);
            if (key == null)
            {
                using var created = Registry.LocalMachine.CreateSubKey(RegPath);
                created?.SetValue(ValueName, value, RegistryValueKind.DWord);
            }
            else
            {
                key.SetValue(ValueName, value, RegistryValueKind.DWord);
            }
            return Read(p);
        }
        catch (Exception ex)
        {
            return new Dictionary<string, object?> { ["error"] = ex.Message, ["success"] = false };
        }
    }

    public Dictionary<string, object?> Backup(Dictionary<string, object?> p, string backupDir)
    {
        var readResult = Read(p);
        if (readResult.ContainsKey("error"))
            return new Dictionary<string, object?> { ["error"] = "Failed to read registry value. Administrator privileges may be required." };

        var value = (int)(readResult["value"] ?? 0);
        var now = DateTime.Now;
        var timestamp = now.ToString("yyyyMMdd_HHmmss");
        var hexStr = $"{value:X08}";
        var filename = $"{timestamp}_{value}_0x{hexStr}.reg";
        var filepath = System.IO.Path.Combine(backupDir, filename);

        System.IO.Directory.CreateDirectory(backupDir);
        var content = $"Windows Registry Editor Version 5.00\n\n" +
                     $"[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl]\n" +
                     $"\"Win32PrioritySeparation\"=dword:{hexStr}\n";

        System.IO.File.WriteAllText(filepath, content, System.Text.Encoding.UTF8);
        return new Dictionary<string, object?> { ["filename"] = filename, ["filepath"] = filepath, ["value"] = value };
    }

    public static string FormatBinary(int value)
    {
        var bits = Convert.ToString(value, 2).PadLeft(32, '0');
        return $"{bits[..8]} {bits[8..16]} {bits[16..24]} {bits[24..32]}";
    }

    public static bool IsAdmin()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            using var identity = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        }
        return false;
    }

    private static bool TryGetInt(Dictionary<string, object?> p, string key, out int value)
    {
        value = 0;
        if (p.TryGetValue(key, out var val))
        {
            if (val is int i) { value = i; return true; }
            if (val is long l) { value = (int)l; return true; }
            if (val is double d) { value = (int)d; return true; }
            if (val is string s && int.TryParse(s, out var parsed)) { value = parsed; return true; }
        }
        return false;
    }
}
