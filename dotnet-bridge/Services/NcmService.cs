using System.Text.Json;
using NcmStudio.Core.Decoder;
using NcmStudio.Core.Metadata;
using NcmStudio.Core.Models;

namespace CodeXaBridge.Services;

public class NcmService
{
    // ── ncm.list ──
    public Dictionary<string, object?> List(Dictionary<string, object?> p)
    {
        var folder = GetString(p, "folder") ?? "";
        var recursive = GetBool(p, "recursive", true);

        if (string.IsNullOrEmpty(folder) || !Directory.Exists(folder))
            return Error("Folder does not exist: " + folder, "files", Array.Empty<string>());

        var files = Directory.GetFiles(
            folder, "*.ncm",
            recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly);

        Array.Sort(files, (a, b) =>
            string.Compare(Path.GetFileName(a), Path.GetFileName(b),
                StringComparison.OrdinalIgnoreCase));

        return new Dictionary<string, object?> { ["files"] = files, ["count"] = files.Length };
    }

    // ── ncm.get_info ──
    public Dictionary<string, object?> GetInfo(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        if (!File.Exists(filepath)) return Error("File not found");

        try
        {
            using var fs = File.OpenRead(filepath);
            var header = NcmFileParser.Parse(fs);
            var metadata = NcmMetadataParser.Parse(header.MetadataJson, header.CoverImage);

            return new Dictionary<string, object?>
            {
                ["musicId"] = metadata.MusicId,
                ["title"] = metadata.Title,
                ["artist"] = metadata.Artist,
                ["album"] = metadata.Album,
                ["format"] = metadata.Format,
                ["bitrate"] = metadata.Bitrate,
                ["duration"] = metadata.Duration,
                ["hasCover"] = metadata.HasCover,
                ["coverBase64"] = metadata.CoverData is { Length: > 0 }
                    ? Convert.ToBase64String(metadata.CoverData) : null,
                ["fileSize"] = new FileInfo(filepath).Length,
                ["audioOffset"] = header.AudioStartOffset,
            };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    // ── ncm.decode ──
    public Dictionary<string, object?> Decode(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        var outputDir = GetString(p, "outputDir");
        var writeTags = GetBool(p, "writeTags", true);

        if (!File.Exists(filepath)) return Error("File not found");

        try
        {
            var decoder = new NcmDecoder();
            var result = decoder.DecodeAsync(filepath, outputDir, writeTags).GetAwaiter().GetResult();

            return new Dictionary<string, object?>
            {
                ["success"] = result.Success,
                ["outputPath"] = result.OutputPath,
                ["errorMessage"] = result.ErrorMessage,
                ["audioFormat"] = result.AudioFormat.ToString(),
                ["md5"] = result.Md5Hash,
                ["sha256"] = result.Sha256Hash,
                ["originalSize"] = result.OriginalSize,
                ["decryptedSize"] = result.DecryptedSize,
                ["title"] = result.Metadata?.Title ?? "",
                ["artist"] = result.Metadata?.Artist ?? "",
            };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    // ── ncm.batch_decode ──
    public Dictionary<string, object?> BatchDecode(Dictionary<string, object?> p)
    {
        var files = GetStringArray(p, "files");
        var outputDir = GetString(p, "outputDir");
        var writeTags = GetBool(p, "writeTags", true);

        if (files == null || files.Length == 0) return Error("No files specified");

        var results = new List<Dictionary<string, object?>>();
        int successCount = 0;
        int failCount = 0;

        try
        {
            var decoder = new NcmDecoder();
            var batchResults = decoder.DecodeBatchAsync(files, outputDir, writeTags).GetAwaiter().GetResult();

            foreach (var r in batchResults)
            {
                if (r.Success) successCount++;
                else failCount++;

                results.Add(new Dictionary<string, object?>
                {
                    ["success"] = r.Success,
                    ["outputPath"] = r.OutputPath,
                    ["errorMessage"] = r.ErrorMessage,
                    ["audioFormat"] = r.AudioFormat.ToString(),
                });
            }
        }
        catch (Exception ex) { return Error(ex.Message); }

        return new Dictionary<string, object?>
        {
            ["results"] = results,
            ["successCount"] = successCount,
            ["failCount"] = failCount,
        };
    }

    // ── Helpers ──

    private static string? GetString(Dictionary<string, object?> p, string key)
    {
        if (p.TryGetValue(key, out var val) && val is string s) return s;
        if (val is JsonElement je && je.ValueKind == JsonValueKind.String) return je.GetString();
        return null;
    }

    private static string[]? GetStringArray(Dictionary<string, object?> p, string key)
    {
        if (p.TryGetValue(key, out var val))
        {
            if (val is string[] sa) return sa;
            if (val is object?[] oa) return oa.Where(x => x != null).Select(x => x!.ToString()!).ToArray();
            if (val is JsonElement je && je.ValueKind == JsonValueKind.Array)
                return je.EnumerateArray().Select(x => x.GetString() ?? "").ToArray();
        }
        return null;
    }

    private static bool GetBool(Dictionary<string, object?> p, string key, bool defaultValue)
    {
        if (p.TryGetValue(key, out var val))
        {
            if (val is bool b) return b;
            if (val is JsonElement je)
            {
                if (je.ValueKind == JsonValueKind.True) return true;
                if (je.ValueKind == JsonValueKind.False) return false;
            }
        }
        return defaultValue;
    }

    private static Dictionary<string, object?> Error(string msg)
        => new() { ["error"] = msg };

    private static Dictionary<string, object?> Error(string msg, string extraKey, object? extraVal)
        => new() { ["error"] = msg, [extraKey] = extraVal };
}