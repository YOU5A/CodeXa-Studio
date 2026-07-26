using System.Text.Json;
using System.Text.Json.Serialization;
using CodeXaBridge.Services;

namespace CodeXaBridge;

class Program
{
    private const string BackupDir = @"C:\CodeXaStudio\backups";

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    static void Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding = System.Text.Encoding.UTF8;

        var scriptDir = AppDomain.CurrentDomain.BaseDirectory;
        var dataDir = Path.GetFullPath(Path.Combine(scriptDir, "..", "..", "..", "..", "data"));
        if (args.Length > 0) dataDir = args[0];

        Directory.CreateDirectory(dataDir);

        // Initialize all services
        var systemInfo = new SystemInfoService(dataDir);
        var music = new MusicService();
        var registry = new RegistryService();
        var backup = new BackupService(BackupDir);
        var admin = new AdminService();
        var priority = new PriorityService();
        var config = new ConfigService(dataDir);
        var ncm = new NcmService();

        // JSON-RPC main loop
        string? line;
        while ((line = Console.ReadLine()) != null)
        {
            line = line.Trim();
            if (line.Length == 0) continue;

            JsonElement request;
            try { request = JsonSerializer.Deserialize<JsonElement>(line); }
            catch (JsonException) { continue; }

            int reqId = 0;
            if (request.TryGetProperty("id", out var idProp))
                reqId = idProp.GetInt32();

            var method = request.TryGetProperty("method", out var m) ? m.GetString() ?? "" : "";
            var reqParamsRaw = request.TryGetProperty("params", out var rp) ? rp : default;

            if (method == "__shutdown__")
            {
                var shutdownResponse = new Dictionary<string, object?> { ["id"] = reqId, ["result"] = "ok" };
                Console.WriteLine(JsonSerializer.Serialize(shutdownResponse, _jsonOptions));
                Console.Out.Flush();
                Environment.Exit(0);
            }

            var reqParams = JsonElementToDict(reqParamsRaw);
            object? result = null;
            string? error = null;

            try { result = HandleMethod(method, reqParams, systemInfo, music, registry, backup, admin, priority, config, ncm); }
            catch (Exception ex) { error = ex.Message; }

            var response = new Dictionary<string, object?> { ["id"] = reqId };
            if (error != null) response["error"] = error;
            else response["result"] = result;

            Console.WriteLine(JsonSerializer.Serialize(response, _jsonOptions));
            Console.Out.Flush();
        }
    }

    private static object? HandleMethod(string method, Dictionary<string, object?> p,
        SystemInfoService sys, MusicService music, RegistryService reg, BackupService bak,
        AdminService adm, PriorityService pri, ConfigService cfg, NcmService ncm)
    {
        return method switch
        {
            // System
            "system.info" => sys.GetSystemInfo(),

            // Registry
            "registry.read" => reg.Read(p),
            "registry.write" => reg.Write(p),
            "registry.backup" => reg.Backup(p, BackupDir),

            // Admin
            "admin.check" => adm.Check(p),
            "admin.restart" => adm.Restart(p),

            // Priority
            "priority.list" => pri.List(p),
            "priority.add" => pri.Add(p),
            "priority.edit" => pri.Edit(p),
            "priority.delete" => pri.Delete(p),
            "priority.export" => pri.Export(p, Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "data"))),
            "priority.import_config" => pri.Import(p),

            // Music
            "music.scan" => music.Scan(p),
            "music.get_metadata" => music.GetMetadata(p),
            "music.save_tags" => music.SaveTags(p),
            "music.extract_cover" => music.ExtractCover(p),
            "music.apply_cover" => music.ApplyCover(p),
            "music.remove_cover" => music.RemoveCover(p),
            "music.read_cover_file" => music.ReadCoverFile(p),
            "music.save_cover_file" => music.SaveCoverFile(p),
            "music.rename" => music.Rename(p),
            "music.get_lyrics" => music.GetLyrics(p),

            // NCM
            "ncm.list" => ncm.List(p),
            "ncm.get_info" => ncm.GetInfo(p),
            "ncm.decode" => ncm.Decode(p),
            "ncm.batch_decode" => ncm.BatchDecode(p),

            // Backup
            "backup.list" => bak.List(p),
            "backup.dir" => bak.Dir(p),
            "backup.export" => bak.Export(p),
            "backup.restore" => bak.Restore(p, reg),
            "backup.delete" => bak.Delete(p),
            "backup.clear_all" => bak.ClearAll(p),

            // Config
            "config.get" => cfg.Get(p),
            "config.set" => cfg.Set(p),

            _ => new Dictionary<string, string> { ["error"] = $"Unknown method: {method}" },
        };
    }

    private static Dictionary<string, object?> JsonElementToDict(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object)
            return new Dictionary<string, object?>();

        var dict = new Dictionary<string, object?>();
        foreach (var prop in element.EnumerateObject())
            dict[prop.Name] = JsonElementToObject(prop.Value);
        return dict;
    }

    private static object? JsonElementToObject(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.String => element.GetString(),
        JsonValueKind.Number => element.TryGetInt64(out var l) ? (object)l : element.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        JsonValueKind.Array => element.EnumerateArray().Select(JsonElementToObject).ToArray(),
        JsonValueKind.Object => JsonElementToDict(element),
        _ => null,
    };
}