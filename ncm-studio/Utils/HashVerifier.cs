using System.Security.Cryptography;

namespace NcmStudio.Core.Utils;

public static class HashVerifier
{
    public static (string md5, string sha256) ComputeHashes(string filePath)
    {
        using var md5 = MD5.Create();
        using var sha256 = SHA256.Create();
        using var stream = File.OpenRead(filePath);
        var buffer = new byte[65536];
        int read;
        while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
        {
            md5.TransformBlock(buffer, 0, read, null, 0);
            sha256.TransformBlock(buffer, 0, read, null, 0);
        }
        md5.TransformFinalBlock([], 0, 0);
        sha256.TransformFinalBlock([], 0, 0);
        return (ToHex(md5.Hash!), ToHex(sha256.Hash!));
    }

    private static string ToHex(byte[] hash) =>
        BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
}