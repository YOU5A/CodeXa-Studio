namespace NcmStudio.Core.Models;

public class DecryptResult
{
    public bool Success { get; set; }
    public string? OutputPath { get; set; }
    public string? ErrorMessage { get; set; }
    public AudioFormat AudioFormat { get; set; }
    public string? Md5Hash { get; set; }
    public string? Sha256Hash { get; set; }
    public NcmMetadata? Metadata { get; set; }
    public long OriginalSize { get; set; }
    public long DecryptedSize { get; set; }
}
