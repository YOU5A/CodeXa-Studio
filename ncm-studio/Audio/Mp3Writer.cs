namespace NcmStudio.Core.Audio;

public static class Mp3Writer
{
    public static async Task WriteAsync(Stream source, string outputPath, CancellationToken ct = default)
    {
        await using var outFs = File.Create(outputPath);
        await source.CopyToAsync(outFs, ct);
    }
}