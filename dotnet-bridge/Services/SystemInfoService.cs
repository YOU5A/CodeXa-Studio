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

    [StructLayout(LayoutKind.Sequential)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll")]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto)]
    private static extern bool GetDiskFreeSpaceEx(
        string lpDirectoryName,
        out ulong lpFreeBytesAvailableToCaller,
        out ulong lpTotalNumberOfBytes,
        out ulong lpFreeBytesOnDisk);

    public SystemInfoService(string dataDir)
    {
        _dataDir = dataDir;
        // Prime the first reading
        GetSystemTimes(out _prevIdleTime, out _prevKernelTime, out _prevUserTime);
        _prevSampleTime = DateTime.UtcNow;
    }

    public Dictionary<string, object?> GetSystemInfo()
    {
        // Memory via GlobalMemoryStatusEx (kernel32) ??? ullAvailPhys matches Task Manager
        var memStatus = new MEMORYSTATUSEX();
        memStatus.dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>();
        long memTotal = 0;
        long memAvailable = 0;
        if (GlobalMemoryStatusEx(ref memStatus))
        {
            memTotal = (long)memStatus.ullTotalPhys;
            memAvailable = (long)memStatus.ullAvailPhys;
        }

        // Disk via GetDiskFreeSpaceEx (kernel32) ??? consistent with memory approach
        long diskTotal = 0;
        long diskUsed = 0;
        double diskPercent = 0;
        var root = Path.GetPathRoot(_dataDir) ?? "C:\\";
        if (GetDiskFreeSpaceEx(root, out _, out var diskTotalBytes, out var diskFreeBytes))
        {
            diskTotal = (long)diskTotalBytes;
            diskUsed = diskTotal - (long)diskFreeBytes;
            diskPercent = diskTotal > 0 ? Math.Round((double)diskUsed / diskTotal * 100, 1) : 0;
        }

        return new Dictionary<string, object?>
        {
            ["cpu_percent"] = Math.Round(GetCpuPercent(), 1),
            ["cpu_count"] = Environment.ProcessorCount,
            ["cpu_count_physical"] = GetPhysicalCoreCount(),
            ["memory_total"] = memTotal,
            ["memory_used"] = memTotal - memAvailable,
            ["memory_available"] = memAvailable,
            ["memory_percent"] = memTotal > 0 ? Math.Round((double)(memTotal - memAvailable) / memTotal * 100, 1) : 0,
            ["disk_total"] = diskTotal,
            ["disk_used"] = diskUsed,
            ["disk_percent"] = diskPercent,
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
            return GetCpuPercentWmi();
        }

        var idleDelta = idleTime - _prevIdleTime;
        var kernelDelta = kernelTime - _prevKernelTime;
        var userDelta = userTime - _prevUserTime;
        var totalDelta = kernelDelta + userDelta;

        _prevIdleTime = idleTime;
        _prevKernelTime = kernelTime;
        _prevUserTime = userTime;
        _prevSampleTime = DateTime.UtcNow;

        // Sampling window < 500ms ??? fall back to WMI LoadPercentage
        if (totalDelta < 5_000_000) return GetCpuPercentWmi();

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
