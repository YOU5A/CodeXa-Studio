using System.Text.Json;

namespace CodeXaBridge.Services;

public class ConfigService
{
    private readonly string _configPath;

    public ConfigService(string dataDir)
    {
        _configPath = System.IO.Path.Combine(dataDir, "config.json");
    }

    public Dictionary<string, object?> Get(Dictionary<string, object?> p)
    {
        try
        {
            if (System.IO.File.Exists(_configPath))
            {
                var json = System.IO.File.ReadAllText(_configPath, System.Text.Encoding.UTF8);
                var cfg = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);
                if (cfg != null)
                {
                    var result = new Dictionary<string, object?>();
                    foreach (var kv in cfg)
                        result[kv.Key] = JsonElementToObject(kv.Value);
                    return result;
                }
            }
        }
        catch (Exception ex) { Console.Error.WriteLine($"[ConfigService.Get] {ex.Message}"); }
        return new Dictionary<string, object?>();
    }

    public Dictionary<string, object?> Set(Dictionary<string, object?> p)
    {
        var cfg = Get(p);
        foreach (var kv in p)
        {
            if (kv.Key == "method" || kv.Key == "id") continue;
            cfg[kv.Key] = kv.Value;
        }

        try
        {
            var json = JsonSerializer.Serialize(cfg, new JsonSerializerOptions
            {
                WriteIndented = true,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            });
            System.IO.File.WriteAllText(_configPath, json, System.Text.Encoding.UTF8);
            return new Dictionary<string, object?> { ["success"] = true };
        }
        catch (Exception ex)
        {
            return new Dictionary<string, object?> { ["error"] = ex.Message };
        }
    }

    private static object? JsonElementToObject(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.String => el.GetString(),
        JsonValueKind.Number => el.TryGetInt64(out var l) ? l : el.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => el.ToString(),
    };
}
