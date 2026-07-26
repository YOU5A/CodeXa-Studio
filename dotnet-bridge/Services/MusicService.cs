using System.Text.Json;
using System.Text;
using System.Text.RegularExpressions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using TagLib;
using TagLib.Id3v2;

namespace CodeXaBridge.Services;

public class MusicService
{
    private static readonly string[] DefaultExtensions =
        [".mp3", ".flac", ".ogg", ".m4a", ".mp4a", ".wav", ".opus"];

    // ── music.scan ──────────────────────────────────────────
    public Dictionary<string, object?> Scan(Dictionary<string, object?> p)
    {
        var folder = GetString(p, "folder") ?? "";
        var extensions = GetStringArray(p, "extensions") ?? DefaultExtensions;
        var recursive = GetBool(p, "recursive", true);

        if (string.IsNullOrEmpty(folder) || !System.IO.Directory.Exists(folder))
            return Error("Folder does not exist: " + folder, "files", Array.Empty<string>());

        var files = System.IO.Directory.GetFiles(
            folder, "*.*",
            recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly);

        files = files.Where(f =>
            extensions.Contains(System.IO.Path.GetExtension(f), StringComparer.OrdinalIgnoreCase))
            .ToArray();

        Array.Sort(files, (a, b) =>
            string.Compare(System.IO.Path.GetFileName(a), System.IO.Path.GetFileName(b),
                StringComparison.OrdinalIgnoreCase));

        return new Dictionary<string, object?> { ["files"] = files, ["count"] = files.Length };
    }

    // ── music.get_metadata ──────────────────────────────────
    public Dictionary<string, object?> GetMetadata(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        if (!System.IO.File.Exists(filepath)) return Error("File not found");

        try
        {
            using var file = TagLib.File.Create(filepath);
            var tag = file.Tag;

            return new Dictionary<string, object?>
            {
                ["title"] = tag.Title ?? "",
                ["artist"] = tag.JoinedPerformers ?? tag.FirstPerformer ?? "",
                ["album"] = tag.Album ?? "",
                ["year"] = tag.Year > 0 ? tag.Year.ToString() : "",
                ["genre"] = tag.JoinedGenres ?? tag.FirstGenre ?? "",
                ["track"] = tag.Track > 0 ? tag.Track.ToString() : "",
                ["cover"] = ExtractCoverBase64(file),
                ["has_cover"] = HasCover(file),
            };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    // ── music.save_tags ─────────────────────────────────────
    public Dictionary<string, object?> SaveTags(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        if (string.IsNullOrEmpty(filepath)) return Error("Missing 'filepath' parameter");

        try
        {
            RemoveReadOnly(filepath);
            var lockErr = CheckFileLock(filepath); if (lockErr != null) return lockErr;
            using var file = TagLib.File.Create(filepath);
            var tag = file.Tag;

            var preserveTitle = GetBool(p, "preserve_title", false);
            var title = GetString(p, "title") ?? "";
            var artist = GetString(p, "artist") ?? "";
            var album = GetString(p, "album") ?? "";
            var year = GetString(p, "year") ?? "";
            var genre = GetString(p, "genre") ?? "";
            var track = GetString(p, "track") ?? "";

            if (!preserveTitle || !string.IsNullOrEmpty(title)) tag.Title = title;
            if (!preserveTitle) tag.Performers = string.IsNullOrEmpty(artist) ? null : [artist];
            tag.Album = album;
            tag.Year = uint.TryParse(year, out var y) ? y : 0;
            tag.Genres = string.IsNullOrEmpty(genre) ? null : [genre];
            tag.Track = uint.TryParse(track, out var t) ? t : 0;

            file.Save();
            return new Dictionary<string, object?> { ["success"] = true };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    // ── music.extract_cover ─────────────────────────────────
    public Dictionary<string, object?> ExtractCover(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        if (string.IsNullOrEmpty(filepath)) return Error("Missing 'filepath' parameter");

        try
        {
            using var file = TagLib.File.Create(filepath);
            var cover = ExtractCoverBase64(file);
            return new Dictionary<string, object?> { ["cover"] = cover };
        }
        catch (Exception ex) { return Error(ex.Message, "cover", null); }
    }

    // ── music.apply_cover ───────────────────────────────────
    public Dictionary<string, object?> ApplyCover(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        var coverPath = GetString(p, "cover_path") ?? "";
        var mimeType = GetString(p, "mime_type") ?? "image/jpeg";

        if (string.IsNullOrEmpty(filepath) || string.IsNullOrEmpty(coverPath))
            return Error("Missing parameters");

        try
        {
            RemoveReadOnly(filepath);
            var lockErr = CheckFileLock(filepath); if (lockErr != null) return lockErr;
            var coverData = System.IO.File.ReadAllBytes(coverPath);
            coverData = ResizeCoverIfNeeded(coverData, 800);

            using var file = TagLib.File.Create(filepath);
            file.Tag.Pictures = new IPicture[]
            {
                new Picture
                {
                    Type = PictureType.FrontCover,
                    MimeType = mimeType,
                    Description = "Cover",
                    Data = coverData,
                },
            };
            file.Save();
            return new Dictionary<string, object?> { ["success"] = true };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    // ── music.remove_cover ──────────────────────────────────
    public Dictionary<string, object?> RemoveCover(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        if (string.IsNullOrEmpty(filepath)) return Error("Missing 'filepath' parameter");

        try
        {
            RemoveReadOnly(filepath);
            var lockErr = CheckFileLock(filepath); if (lockErr != null) return lockErr;
            using var file = TagLib.File.Create(filepath);
            file.Tag.Pictures = Array.Empty<IPicture>();
            file.Save();
            return new Dictionary<string, object?> { ["success"] = true };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    // ── music.read_cover_file ───────────────────────────────
    public Dictionary<string, object?> ReadCoverFile(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        if (string.IsNullOrEmpty(filepath) || !System.IO.File.Exists(filepath))
            return Error("File not found", "cover", null);

        try
        {
            var data = System.IO.File.ReadAllBytes(filepath);
            return new Dictionary<string, object?> { ["cover"] = Convert.ToBase64String(data) };
        }
        catch (Exception ex) { return Error(ex.Message, "cover", null); }
    }

    // ── music.save_cover_file ───────────────────────────────
    public Dictionary<string, object?> SaveCoverFile(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        var base64 = GetString(p, "base64") ?? "";

        if (string.IsNullOrEmpty(filepath) || string.IsNullOrEmpty(base64))
            return Error("Missing parameters");

        try
        {
            System.IO.File.WriteAllBytes(filepath, Convert.FromBase64String(base64));
            return new Dictionary<string, object?> { ["success"] = true };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    // ── music.rename ────────────────────────────────────────
    public Dictionary<string, object?> Rename(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        var newName = GetString(p, "new_name") ?? "";

        if (string.IsNullOrEmpty(filepath)) return Error("Missing 'filepath' parameter");

        var dir = System.IO.Path.GetDirectoryName(filepath) ?? "";
        var ext = System.IO.Path.GetExtension(filepath);

        if (string.IsNullOrEmpty(newName))
        {
            using var f = TagLib.File.Create(filepath);
            newName = f.Tag.Title ?? "";
            if (string.IsNullOrEmpty(newName)) return Error("No title found");
        }

        var sanitized = SanitizeFilename(newName);
        var newPath = System.IO.Path.Combine(dir, sanitized + ext);

        if (string.Equals(newPath, filepath, StringComparison.OrdinalIgnoreCase))
            return Error("New name is same as current name");

        try
        {
            var lockErr = CheckFileLock(filepath); if (lockErr != null) return lockErr;
            System.IO.File.Move(filepath, newPath);
            return new Dictionary<string, object?> { ["success"] = true, ["new_path"] = newPath };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    // ── music.get_lyrics ────────────────────────────────────
    public Dictionary<string, object?> GetLyrics(Dictionary<string, object?> p)
    {
        var filepath = GetString(p, "filepath") ?? "";
        if (string.IsNullOrEmpty(filepath))
            return Error("Missing filepath", "lyrics_text", null);

        // 1. Check for .lrc file alongside audio
        var basePath = System.IO.Path.ChangeExtension(filepath, null);
        foreach (var lrcExt in new[] { ".lrc", ".LRC" })
        {
            var lrcPath = basePath + lrcExt;
            if (System.IO.File.Exists(lrcPath))
            {
                try
                {
                    return new Dictionary<string, object?>
                        { ["lyrics_text"] = System.IO.File.ReadAllText(lrcPath, Encoding.UTF8) };
                }
                catch (Exception ex) { Console.Error.WriteLine($"[MusicService.GetLyrics] {ex.Message}"); }
            }
        }

        // 2. Try fallback encodings for LRC
        var lrcFile = basePath + ".lrc";
        if (System.IO.File.Exists(lrcFile))
        {
            foreach (var encName in new[] { "gbk", "gb2312", "shift_jis", "euc-kr", "iso-8859-1" })
            {
                try
                {
                    var enc = Encoding.GetEncoding(encName);
                    return new Dictionary<string, object?>
                        { ["lyrics_text"] = System.IO.File.ReadAllText(lrcFile, enc) };
                }
                catch (Exception ex) { Console.Error.WriteLine($"[MusicService.GetLyrics] {ex.Message}"); }
            }
        }

        // 3. Fall back to embedded lyrics via TagLib#
        try
        {
            using var file = TagLib.File.Create(filepath);
            var lyrics = file.Tag.Lyrics;
            if (!string.IsNullOrEmpty(lyrics))
                return new Dictionary<string, object?> { ["lyrics_text"] = lyrics };

            // For MP3, also check USLT frame via ID3v2
            if (file is TagLib.Mpeg.AudioFile mp3)
            {
                var id3v2 = mp3.GetTag(TagTypes.Id3v2) as TagLib.Id3v2.Tag;
                if (id3v2 != null)
                {
                    foreach (var frame in id3v2.GetFrames<UnsynchronisedLyricsFrame>())
                    {
                        if (!string.IsNullOrEmpty(frame.Text))
                            return new Dictionary<string, object?> { ["lyrics_text"] = frame.Text };
                    }
                }
            }
        }
        catch (Exception ex) { Console.Error.WriteLine($"[MusicService.GetLyrics] {ex.Message}"); }

        return new Dictionary<string, object?> { ["lyrics_text"] = null };
    }

    // ── File lock detection ─────────────────────────────────

    /// <summary>Returns true if the file is locked by another process.</summary>
    private static bool IsFileLocked(string filepath)
    {
        try
        {
            using var stream = new FileStream(filepath, FileMode.Open,
                FileAccess.Read, FileShare.None);
            return false;
        }
        catch (IOException)
        {
            return true;
        }
    }

    /// <summary>Checks if file is locked and returns an error dict if so.</summary>
    private static Dictionary<string, object?>? CheckFileLock(string filepath)
    {
        if (System.IO.File.Exists(filepath) && IsFileLocked(filepath))
        {
            return Error(
                "File is currently in use by another process (e.g., audio playback). Please stop playback and try again.",
                "file_locked", true);
        }
        return null;
    }

    // ── Helpers ─────────────────────────────────────────────

    private static string? ExtractCoverBase64(TagLib.File file)
    {
        try
        {
            var pics = file.Tag.Pictures;
            if (pics != null && pics.Length > 0 && pics[0].Data != null)
                return Convert.ToBase64String(pics[0].Data.Data);
        }
        catch (Exception ex) { Console.Error.WriteLine($"[MusicService.ExtractCoverBase64] {ex.Message}"); }
        return null;
    }

    private static bool HasCover(TagLib.File file)
    {
        try { return file.Tag.Pictures?.Length > 0; }
        catch (Exception ex) { Console.Error.WriteLine($"[MusicService.HasCover] {ex.Message}"); return false; }
    }

    private static byte[] ResizeCoverIfNeeded(byte[] data, int maxSize)
    {
        try
        {
            using var img = Image.Load(data);
            if (img.Width <= maxSize && img.Height <= maxSize) return data;

            var ratio = Math.Min((double)maxSize / img.Width, (double)maxSize / img.Height);
            img.Mutate(x => x.Resize((int)(img.Width * ratio), (int)(img.Height * ratio)));
            using var ms = new MemoryStream();
            img.SaveAsJpeg(ms);
            return ms.ToArray();
        }
        catch (Exception ex) { Console.Error.WriteLine($"[MusicService.ResizeCoverIfNeeded] {ex.Message}"); return data; }
    }

    private static void RemoveReadOnly(string filepath)
    {
        try
        {
            var attr = System.IO.File.GetAttributes(filepath);
            if ((attr & FileAttributes.ReadOnly) != 0)
                System.IO.File.SetAttributes(filepath, attr & ~FileAttributes.ReadOnly);
        }
        catch (Exception ex) { Console.Error.WriteLine($"[MusicService.RemoveReadOnly] {ex.Message}"); }
    }

    private static string SanitizeFilename(string name)
    {
        var invalid = System.IO.Path.GetInvalidFileNameChars();
        var sb = new StringBuilder(name.Length);
        foreach (var c in name)
            sb.Append(Array.IndexOf(invalid, c) >= 0 ? '_' : c);
        var result = sb.ToString().Trim();
        if (string.IsNullOrEmpty(result)) result = "Untitled";
        return Regex.Replace(result, @"\.+$", "");
    }

    // ── Parameter helpers ───────────────────────────────────

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
