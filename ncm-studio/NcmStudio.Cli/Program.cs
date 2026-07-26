using NcmStudio.Core.Decoder;
using NcmStudio.Core.Metadata;
using NcmStudio.Core.Models;
using NcmStudio.Core.Utils;

Console.OutputEncoding = System.Text.Encoding.UTF8;

if (args.Length < 2)
{
    PrintUsage();
    return 1;
}

var command = args[0].ToLowerInvariant();
var target = args[1];

switch (command)
{
    case "info":
        return CmdInfo(target);
    case "decode":
        return await CmdDecode(target, args);
    case "batch":
        return await CmdBatch(target, args);
    case "verify":
        return CmdVerify(target);
    default:
        Console.Error.WriteLine($"Unknown command: {command}");
        PrintUsage();
        return 1;
}

return 0;

// ── info ──
static int CmdInfo(string filepath)
{
    if (!File.Exists(filepath))
    {
        Console.Error.WriteLine($"File not found: {filepath}");
        return 1;
    }

    try
    {
        using var fs = File.OpenRead(filepath);
        var header = NcmFileParser.Parse(fs);
        var meta = NcmMetadataParser.Parse(header.MetadataJson, header.CoverImage);

        Console.WriteLine($"File       : {Path.GetFileName(filepath)}");
        Console.WriteLine($"Size       : {new FileInfo(filepath).Length:N0} bytes");
        Console.WriteLine($"Music ID   : {meta.MusicId}");
        Console.WriteLine($"Title      : {meta.Title}");
        Console.WriteLine($"Artist     : {meta.Artist}");
        Console.WriteLine($"Album      : {meta.Album}");
        Console.WriteLine($"Format     : {meta.Format}");
        Console.WriteLine($"Bitrate    : {meta.Bitrate} bps");
        Console.WriteLine($"Duration   : {meta.Duration} ms");
        Console.WriteLine($"Has Cover  : {meta.HasCover}");
        Console.WriteLine($"Key Length : {header.KeyLength} bytes");
        Console.WriteLine($"Meta Length: {header.MetaLength} bytes");
        Console.WriteLine($"Image Size : {header.ImageSize} bytes");
        Console.WriteLine($"Audio Off  : {header.AudioStartOffset}");
        return 0;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Error: {ex.Message}");
        return 1;
    }
}

// ── decode ──
static async Task<int> CmdDecode(string filepath, string[] args)
{
    if (!File.Exists(filepath))
    {
        Console.Error.WriteLine($"File not found: {filepath}");
        return 1;
    }

    var outputDir = GetOption(args, "-o", "--output-dir");
    var writeTags = !HasOption(args, "--no-tags");
    var verify = HasOption(args, "--verify");

    var decoder = new NcmDecoder();
    var result = await decoder.DecodeAsync(filepath, outputDir, writeTags);

    if (result.Success)
    {
        Console.WriteLine($"Decoded : {result.OutputPath}");
        Console.WriteLine($"Format  : {result.AudioFormat}");
        Console.WriteLine($"Size    : {result.OriginalSize:N0} -> {result.DecryptedSize:N0} bytes");
        if (result.Metadata != null)
        {
            Console.WriteLine($"Title   : {result.Metadata.Title}");
            Console.WriteLine($"Artist  : {result.Metadata.Artist}");
        }
        if (verify)
        {
            Console.WriteLine($"MD5     : {result.Md5Hash}");
            Console.WriteLine($"SHA256  : {result.Sha256Hash}");
        }
        return 0;
    }
    else
    {
        Console.Error.WriteLine($"Decode failed: {result.ErrorMessage}");
        return 1;
    }
}

// ── batch ──
static async Task<int> CmdBatch(string dir, string[] args)
{
    if (!Directory.Exists(dir))
    {
        Console.Error.WriteLine($"Directory not found: {dir}");
        return 1;
    }

    var outputDir = GetOption(args, "-o", "--output-dir");
    var writeTags = !HasOption(args, "--no-tags");
    var pattern = GetOption(args, "-p", "--pattern") ?? "*.ncm";

    var files = Directory.GetFiles(dir, pattern, SearchOption.AllDirectories);
    if (files.Length == 0)
    {
        Console.WriteLine($"No NCM files found in: {dir}");
        return 0;
    }

    Console.WriteLine($"Found {files.Length} NCM file(s)");
    Console.WriteLine();

    var decoder = new NcmDecoder();
    var results = await decoder.DecodeBatchAsync(files, outputDir, writeTags);

    int ok = 0, fail = 0;
    foreach (var r in results)
    {
        if (r.Success)
        {
            Console.WriteLine($"  OK  {Path.GetFileName(r.OutputPath!)}");
            ok++;
        }
        else
        {
            Console.WriteLine($"  FAIL {Path.GetFileName(filepathForError(results, r))}: {r.ErrorMessage}");
            fail++;
        }
    }

    Console.WriteLine();
    Console.WriteLine($"Done: {ok} success, {fail} failed");
    return fail > 0 ? 1 : 0;
}

// ── verify ──
static int CmdVerify(string filepath)
{
    if (!File.Exists(filepath))
    {
        Console.Error.WriteLine($"File not found: {filepath}");
        return 1;
    }

    try
    {
        var (md5, sha256) = HashVerifier.ComputeHashes(filepath);
        Console.WriteLine($"File  : {Path.GetFileName(filepath)}");
        Console.WriteLine($"Size  : {new FileInfo(filepath).Length:N0} bytes");
        Console.WriteLine($"MD5   : {md5}");
        Console.WriteLine($"SHA256: {sha256}");
        return 0;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Error: {ex.Message}");
        return 1;
    }
}

// ── Helpers ──
static void PrintUsage()
{
    Console.WriteLine("NcmStudio.Cli — NCM lossless decoder CLI");
    Console.WriteLine();
    Console.WriteLine("Usage:");
    Console.WriteLine("  NcmStudio.Cli info    <file>             Show NCM file metadata");
    Console.WriteLine("  NcmStudio.Cli decode  <file> [options]   Decode a single NCM file");
    Console.WriteLine("  NcmStudio.Cli batch   <dir>  [options]   Batch decode NCM files");
    Console.WriteLine("  NcmStudio.Cli verify  <file>             Compute MD5/SHA256 hashes");
    Console.WriteLine();
    Console.WriteLine("Options:");
    Console.WriteLine("  -o, --output-dir <dir>   Output directory");
    Console.WriteLine("  --no-tags                Skip writing metadata tags");
    Console.WriteLine("  --verify                 Print hash after decode");
    Console.WriteLine("  -p, --pattern <pattern>  File pattern for batch (default: *.ncm)");
}

static string? GetOption(string[] args, string shortName, string longName)
{
    for (int i = 0; i < args.Length; i++)
    {
        if (args[i] == shortName || args[i] == longName)
        {
            if (i + 1 < args.Length) return args[i + 1];
        }
    }
    return null;
}

static bool HasOption(string[] args, string name)
{
    return args.Contains(name);
}

static string filepathForError(List<DecryptResult> results, DecryptResult r)
{
    return r.OutputPath ?? "(unknown)";
}