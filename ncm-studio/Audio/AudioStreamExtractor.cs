using NcmStudio.Core.Crypto;

namespace NcmStudio.Core.Audio;

public static class AudioStreamExtractor
{
    public static async Task ExtractAsync(
        Stream ncmStream, long audioStartOffset, byte[] aesKey,
        Stream output, int bufferSize = 65536,
        IProgress<double>? progress = null, CancellationToken ct = default)
    {
        ncmStream.Seek(audioStartOffset, SeekOrigin.Begin);
        long total = ncmStream.Length - audioStartOffset;
        long processed = 0;
        int alignedSize = (bufferSize / 16) * 16;
        var buffer = new byte[alignedSize];

        while (processed < total)
        {
            ct.ThrowIfCancellationRequested();
            int read = ncmStream.Read(buffer, 0, (int)Math.Min(alignedSize, total - processed));
            if (read == 0) break;
            var decrypted = AesEcbDecryptor.Decrypt(aesKey, buffer.AsSpan(0, read).ToArray());
            await output.WriteAsync(decrypted, ct);
            processed += read;
            progress?.Report((double)processed / total * 100);
        }
    }
}