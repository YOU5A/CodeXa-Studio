using System.Text.Json;
using System.Text.Json.Serialization;
using CodeXaBridge.Services;

namespace CodeXaBridge;

class Program
{
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    static void Main(string[] args)
    {
        // Force UTF-8 on stdin/stdout (matching Python's reconfigure)
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding = System.Text.Encoding.UTF8;

        // Resolve DATA_DIR relative to this executable or from args
        var scriptDir = AppDomain.CurrentDomain.BaseDirectory;
        var dataDir = Path.GetFullPath(Path.Combine(scriptDir, "..", "..", "..", "..", "data"));
        if (args.Length > 0)
            dataDir = args[0];

        // Ensure data dir exists
        Directory.CreateDirectory(dataDir);

        // Initialize services
        var systemInfo = new SystemInfoService(dataDir);
        var music = new MusicService();

        // JSON-RPC main loop (same protocol as bridge/server.py)
        string? line;
        while ((line = Console.ReadLine()) != null)
        {
            line = line.Trim();
            if (line.Length == 0) continue;

            JsonElement request;
            try
            {
                request = JsonSerializer.Deserialize<JsonElement>(line);
            }
            catch (JsonException)
            {
                continue;
            }

            int reqId = 0;
            if (request.TryGetProperty("id", out var idProp))
                reqId = idProp.GetInt32();

            var method = request.TryGetProperty("method", out var m) ? m.GetString() ?? "" : "";
            var reqParamsRaw = request.TryGetProperty("params", out var rp) ? rp : default;

            if (method == "__shutdown__")
            {
                Environment.Exit(0);
            }

            // Convert JsonElement params to Dictionary<string, object?>
            var reqParams = JsonElementToDict(reqParamsRaw);

            object? result = null;
            string? error = null;

            try
            {
                result = HandleMethod(method, reqParams, systemInfo, music);
            }
            catch (Exception ex)
            {
                error = ex.Message;
            }

            var response = new Dictionary<string, object?>
            {
                ["id"] = reqId,
            };

            if (error != null)
                response["error"] = error;
            else
                response["result"] = result;

            var json = JsonSerializer.Serialize(response, _jsonOptions);
            Console.WriteLine(json);
            Console.Out.Flush();
        }
    }

    private static object? HandleMethod(string method, Dictionary<string, object?> reqParams,
        SystemInfoService systemInfo, MusicService music)
    {
        return method switch
        {
            // System
            "system.info" => systemInfo.GetSystemInfo(),

            // Music (Phase 2: all 10 methods)
            "music.scan" => music.Scan(reqParams),
            "music.get_metadata" => music.GetMetadata(reqParams),
            "music.save_tags" => music.SaveTags(reqParams),
            "music.extract_cover" => music.ExtractCover(reqParams),
            "music.apply_cover" => music.ApplyCover(reqParams),
            "music.remove_cover" => music.RemoveCover(reqParams),
            "music.read_cover_file" => music.ReadCoverFile(reqParams),
            "music.save_cover_file" => music.SaveCoverFile(reqParams),
            "music.rename" => music.Rename(reqParams),
            "music.get_lyrics" => music.GetLyrics(reqParams),

            _ => new Dictionary<string, string> { ["error"] = $"Unknown method: {method}" },
        };
    }

    /// <summary>
    /// Convert JsonElement params to Dictionary for easier typed access in services.
    /// </summary>
    private static Dictionary<string, object?> JsonElementToDict(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object)
            return new Dictionary<string, object?>();

        var dict = new Dictionary<string, object?>();
        foreach (var prop in element.EnumerateObject())
        {
            dict[prop.Name] = JsonElementToObject(prop.Value);
        }
        return dict;
    }

    private static object? JsonElementToObject(JsonElement element)
    {
        return element.ValueKind switch
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
}
