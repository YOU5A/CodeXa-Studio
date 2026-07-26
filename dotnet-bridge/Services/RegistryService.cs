using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32;

namespace CodeXaBridge.Services;

public class RegistryService
{
    private const string RegPath = @"SYSTEM\CurrentControlSet\Control\PriorityControl";
    private const string ValueName = "Win32PrioritySeparation";

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
