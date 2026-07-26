using NcmStudio.Core.Audio;
using NcmStudio.Core.Crypto;
using NcmStudio.Core.Metadata;
using NcmStudio.Core.Models;
using NcmStudio.Core.Utils;

namespace NcmStudio.Core.Decoder;

public class NcmDecoder
{
    private const int ChunkSize = 0x8000; // 32KB, matching yoki123/ncmdump
    private const int DetectSize = 4 * 1024;

    public async Task<DecryptResult> DecodeAsync(
        string filepath, string? outputDir = null, bool writeTags = true,
        IProgress<double>? progress = null, CancellationToken ct = default)
    {
        var result = new DecryptResult { OriginalSize = new FileInfo(filepath).Length };

        try
        {
            ct.ThrowIfCancellationRequested();

            // 1. Parse NCM file header
            NcmFileHeader header;
            await using (var fs = File.OpenRead(filepath))
            {
                header = NcmFileParser.Parse(fs);
            }

            ct.ThrowIfCancellationRequested();

            // 2. Derive AES key
            var aesKey = NcmKeyDerivation.DeriveAesKey(header);

            // 3. Create stream cipher
            var cipher = new NcmStreamCipher(aesKey);

            // 4. Detect audio format from first 4KB
            byte[] sample;
            await using (var fs = File.OpenRead(filepath))
            {
                fs.Seek(header.AudioStartOffset, SeekOrigin.Begin);
                var sampleLen = Math.Min(DetectSize, fs.Length - header.AudioStartOffset);
                var encryptedSample = new byte[sampleLen];
                await fs.ReadExactlyAsync(encryptedSample, ct);
                cipher.ProcessBytes(encryptedSample);
                sample = encryptedSample;
            }
            var format = AudioFormatDetector.Detect(sample);
            result.AudioFormat = format;

            // 5. Build output path
            var ext = format == AudioFormat.Flac ? ".flac" : format == AudioFormat.Mp3 ? ".mp3" : ".bin";
            var baseName = Path.GetFileNameWithoutExtension(filepath);
            var outDir = outputDir ?? Path.GetDirectoryName(filepath) ?? ".";
            Directory.CreateDirectory(outDir);
            var outPath = Path.Combine(outDir, baseName + " [Decoded]" + ext);
            result.OutputPath = outPath;

            ct.ThrowIfCancellationRequested();

            // 6. Decrypt audio stream with NCM stream cipher
            var totalBytes = new FileInfo(filepath).Length - header.AudioStartOffset;
            long processed = 0;

            // Re-create cipher for audio stream (independent state)
            cipher = new NcmStreamCipher(aesKey);

            await using (var inFs = File.OpenRead(filepath))
            await using (var outFs = File.Create(outPath))
            {
                inFs.Seek(header.AudioStartOffset, SeekOrigin.Begin);
                var buffer = new byte[ChunkSize];
                int read;

                while ((read = await inFs.ReadAsync(buffer, ct)) > 0)
                {
                    ct.ThrowIfCancellationRequested();
                    cipher.ProcessBytes(buffer.AsSpan(0, read));
                    await outFs.WriteAsync(buffer.AsMemory(0, read), ct);
                    processed += read;
                    progress?.Report((double)processed / totalBytes * 100);
                }
            }

            result.DecryptedSize = new FileInfo(outPath).Length;
            result.Success = true;

            // 7. Parse metadata
            var metadata = NcmMetadataParser.Parse(header.MetadataJson, header.CoverImage);
            result.Metadata = metadata;

            // 8. Write tags
            if (writeTags)
                TagWriter.Write(outPath, metadata);

            // 9. Hash verification
            var (md5, sha256) = HashVerifier.ComputeHashes(outPath);
            result.Md5Hash = md5;
            result.Sha256Hash = sha256;
        }
        catch (OperationCanceledException)
        {
            result.Success = false;
            result.ErrorMessage = "Operation cancelled.";
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    public async Task<List<DecryptResult>> DecodeBatchAsync(
        IEnumerable<string> filepaths, string? outputDir = null,
        bool writeTags = true,
        IProgress<(int current, int total, string filename)>? progress = null,
        CancellationToken ct = default)
    {
        var results = new List<DecryptResult>();
        var paths = filepaths.ToList();
        int total = paths.Count;

        for (int i = 0; i < total; i++)
        {
            ct.ThrowIfCancellationRequested();
            var filename = Path.GetFileName(paths[i]);
            progress?.Report((i + 1, total, filename));
            var result = await DecodeAsync(paths[i], outputDir, writeTags, null, ct);
            results.Add(result);
        }

        return results;
    }
}