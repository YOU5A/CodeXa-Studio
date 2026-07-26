using System.Management;
using System.Runtime.InteropServices;
using System.Security.Principal;

namespace CodeXaBridge.Services;

public class SystemInfoService
{
    private readonly string _dataDir;

    // Cached previous values for CPU% calculation via GetSystemTimes
    private long _prevIdleTime;
    private long _prevKernelTime;
    private long _prevUserTime;
    private DateTime _prevSampleTime;

    [DllImport("kernel32.dll")]
    private static extern bool GetSystemTimes(out long lpIdleTime, out long lpKernelTime, out long lpUserTime);

    public SystemInfoService(string dataDir)
    {
        _dataDir = dataDir;
        // Prime the first reading
        GetSystemTimes(out _prevIdleTime, out _prevKernelTime, out _prevUserTime);
        _prevSampleTime = DateTime.UtcNow;
    }

    public Dictionary<string, object?> GetSystemInfo()
    {
        var memTotal = GetTotalMemory();
        var memAvailable = GetAvailableMemory();

        return new Dictionary<string, object?>
        {
            ["cpu_percent"] = Math.Round(GetCpuPercent(), 1),
            ["cpu_count"] = Environment.ProcessorCount,
            ["cpu_count_physical"] = GetPhysicalCoreCount(),
            ["memory_total"] = memTotal,
            ["memory_used"] = memTotal - memAvailable,
            ["memory_available"] = memAvailable,
            ["memory_percent"] = memTotal > 0 ? Math.Round((double)(memTotal - memAvailable) / memTotal * 100, 1) : 0,
            ["disk_total"] = GetDiskTotal(),
            ["disk_used"] = GetDiskUsed(),
            ["disk_percent"] = GetDiskPercent(),
            ["windows_version"] = GetWindowsVersion(),
            ["windows_release"] = GetWindowsReleaseNumber(),
            ["windows_build"] = GetWindowsBuild(),
            ["windows_edition"] = GetWindowsEdition(),
            ["hostname"] = Environment.MachineName,
            ["is_admin"] = IsAdministrator() ? 1 : 0,
        };
    }

    private double GetCpuPercent()
    {
        if (!GetSystemTimes(out var idleTime, out var kernelTime, out var userTime))
        {
            // Fallback: try WMI
            return GetCpuPercentWmi();
        }

        var now = DateTime.UtcNow;
        var idleDelta = idleTime - _prevIdleTime;
        var kernelDelta = kernelTime - _prevKernelTime;
        var userDelta = userTime - _prevUserTime;
        var totalDelta = kernelDelta + userDelta;

        // Update cache for next call
        _prevIdleTime = idleTime;
        _prevKernelTime = kernelTime;
        _prevUserTime = userTime;
        _prevSampleTime = now;

        if (totalDelta <= 0) return 0;

        return (1.0 - (double)idleDelta / totalDelta) * 100.0;
    }

    private static double GetCpuPercentWmi()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT LoadPercentage FROM Win32_Processor");
            foreach (var obj in searcher.Get())
            {
                return Convert.ToDouble(obj["LoadPercentage"]);
            }
        }
        catch (Exception ex) { Console.Error.WriteLine($"[SystemInfoService.GetCpuPercentWmi] {ex.Message}"); }
        return 0;
    }

    private static int GetPhysicalCoreCount()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT NumberOfCores FROM Win32_Processor");
            int cores = 0;
            foreach (var obj in searcher.Get())
            {
                cores += Convert.ToInt32(obj["NumberOfCores"]);
            }
            return cores > 0 ? cores : Environment.ProcessorCount;
        }
        catch
        {
            return Environment.ProcessorCount;
        }
    }

    private static long GetTotalMemory()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT TotalVisibleMemorySize FROM Win32_OperatingSystem");
            foreach (var obj in searcher.Get())
            {
                return Convert.ToInt64(obj["TotalVisibleMemorySize"]) * 1024;
            }
        }
        catch (Exception ex) { Console.Error.WriteLine($"[SystemInfoService.GetTotalMemory] {ex.Message}"); }
        return 0;
    }

    private static long GetAvailableMemory()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT FreePhysicalMemory FROM Win32_OperatingSystem");
            foreach (var obj in searcher.Get())
            {
                return Convert.ToInt64(obj["FreePhysicalMemory"]) * 1024;
            }
        }
        catch (Exception ex) { Console.Error.WriteLine($"[SystemInfoService.GetAvailableMemory] {ex.Message}"); }
        return 0;
    }

    private long GetDiskTotal()
    {
        try
        {
            var root = Path.GetPathRoot(_dataDir) ?? "C:\\";
            var drive = new DriveInfo(root);
            return drive.TotalSize;
        }
        catch (Exception ex) { Console.Error.WriteLine($"[SystemInfoService.GetDiskTotal] {ex.Message}"); return 0; }
    }

    private long GetDiskUsed()
    {
        var total = GetDiskTotal();
        var free = GetDiskFree();
        return total > 0 ? total - free : 0;
    }

    private long GetDiskFree()
    {
        try
        {
            var root = Path.GetPathRoot(_dataDir) ?? "C:\\";
            var drive = new DriveInfo(root);
            return drive.TotalFreeSpace;
        }
        catch (Exception ex) { Console.Error.WriteLine($"[SystemInfoService.GetDiskFree] {ex.Message}"); return 0; }
    }

    private double GetDiskPercent()
    {
        var total = GetDiskTotal();
        if (total <= 0) return 0;
        return Math.Round((double)(total - GetDiskFree()) / total * 100, 1);
    }

    private static string GetWindowsVersion()
    {
        var ver = Environment.OSVersion.Version;
        return $"{ver.Major}.{ver.Minor}.{ver.Build}";
    }

    private static string GetWindowsReleaseNumber()
    {
        var build = Environment.OSVersion.Version.Build;
        return build >= 22000 ? "11" : "10";
    }

    private static string GetWindowsBuild()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT BuildNumber FROM Win32_OperatingSystem");
            foreach (var obj in searcher.Get())
            {
                return obj["BuildNumber"]?.ToString() ?? "";
            }
        }
        catch (Exception ex) { Console.Error.WriteLine($"[SystemInfoService.GetWindowsBuild] {ex.Message}"); }
        return Environment.OSVersion.Version.Build.ToString();
    }

    private static string GetWindowsEdition()
    {
        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
            return key?.GetValue("EditionID")?.ToString() ?? "";
        }
        catch (Exception ex) { Console.Error.WriteLine($"[SystemInfoService.GetWindowsEdition] {ex.Message}"); return ""; }
    }

    private static bool IsAdministrator()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            using var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }
        return false;
    }
}
