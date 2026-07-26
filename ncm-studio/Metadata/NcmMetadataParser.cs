using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NcmStudio.Core.Models;

namespace NcmStudio.Core.Metadata;

public static class NcmMetadataParser
{
    /// <summary>
    /// AES-128 key for decrypting the metadata section in newer NCM files.
    /// From yoki123/ncmdump: aesModifyKey.
    /// </summary>
    private static readonly byte[] AesModifyKey = {
        0x23, 0x31, 0x34, 0x6C, 0x6A, 0x6B, 0x5F, 0x21,
        0x5C, 0x5D, 0x26, 0x30, 0x55, 0x3C, 0x27, 0x28
    };

    private const string MetaPrefix = "163 key(Don't modify):";
    private const string MusicPrefix = "music:";

    /// <summary>
    /// Parses NCM metadata from the raw JSON bytes and optional cover data.
    /// Handles both old plain-JSON format and new encrypted format.
    /// </summary>
    public static NcmMetadata Parse(byte[] jsonBytes, byte[]? coverData = null)
    {
        // ── Try old format: plain JSON ──
        if (jsonBytes.Length > 0)
        {
            var jsonStr = Encoding.UTF8.GetString(jsonBytes).TrimStart('\0');
            if (jsonStr.StartsWith("{"))
            {
                return ParsePlainJson(jsonStr, coverData);
            }
        }

        // ── Try new format: encrypted metadata ──
        // New format: XOR(0x63) → "163 key(Don't modify):" + Base64(AES_ECB("music:" + JSON))
        if (jsonBytes.Length > MetaPrefix.Length)
        {
            try
            {
                // XOR each byte with 0x63
                var xored = new byte[jsonBytes.Length];
                for (int i = 0; i < jsonBytes.Length; i++)
                    xored[i] = (byte)(jsonBytes[i] ^ 0x63);

                var xoredStr = Encoding.UTF8.GetString(xored);

                if (xoredStr.StartsWith(MetaPrefix))
                {
                    // Strip prefix, Base64 decode
                    var b64 = xoredStr.Substring(MetaPrefix.Length).TrimEnd('\0', '\n', '\r', ' ');
                    var b64Bytes = Encoding.UTF8.GetBytes(b64);
                    var decoded = Convert.FromBase64String(b64);

                    // AES-128-ECB decrypt
                    var decrypted = AesEcbDecryptNoPadding(AesModifyKey, decoded);

                    // PKCS7 unpad
                    decrypted = Pkcs7Unpad(decrypted);

                    // Strip "music:" prefix
                    var decryptedStr = Encoding.UTF8.GetString(decrypted);
                    if (decryptedStr.StartsWith(MusicPrefix))
                    {
                        var json = decryptedStr.Substring(MusicPrefix.Length);
                        return ParsePlainJson(json, coverData);
                    }
                }
            }
            catch
            {
                // Fall through to empty result
            }
        }

        // ── Fallback: return empty metadata with cover only ──
        var meta = new NcmMetadata
        {
            HasCover = coverData is { Length: > 0 },
            CoverData = coverData,
        };
        return meta;
    }

    /// <summary>
    /// Parses plain JSON metadata (old NCM format or decrypted new format).
    /// </summary>
    private static NcmMetadata ParsePlainJson(string json, byte[]? coverData)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var meta = new NcmMetadata();

        TryGetInt64(root, "musicId", v => meta.MusicId = v);
        TryGetString(root, "musicName", v => meta.Title = v);
        TryGetString(root, "album", v => meta.Album = v);
        TryGetString(root, "albumPic", v => meta.AlbumPicUrl = v);
        TryGetString(root, "format", v => meta.Format = v);
        TryGetInt32(root, "bitrate", v => meta.Bitrate = v);
        TryGetInt32(root, "duration", v => meta.Duration = v);

        // artist is 2D array [[name, id], ...]
        if (root.TryGetProperty("artist", out var artist) && artist.ValueKind == JsonValueKind.Array)
        {
            var names = new List<string>();
            foreach (var item in artist.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Array)
                {
                    var arr = item.EnumerateArray().ToArray();
                    if (arr.Length > 0)
                    {
                        var name = arr[0].ValueKind switch
                        {
                            JsonValueKind.String => arr[0].GetString() ?? "",
                            JsonValueKind.Number => arr[0].ToString(),
                            _ => ""
                        };
                        if (!string.IsNullOrEmpty(name))
                            names.Add(name);
                    }
                }
            }
            meta.Artist = string.Join(", ", names);
        }

        meta.HasCover = coverData is { Length: > 0 };
        meta.CoverData = coverData;
        return meta;
    }

    private static byte[] AesEcbDecryptNoPadding(byte[] key, byte[] data)
    {
        var blockAlignedLen = data.Length / 16 * 16;
        if (blockAlignedLen == 0) return Array.Empty<byte>();

        using var aes = Aes.Create();
        aes.Key = key;
        aes.Mode = CipherMode.ECB;
        aes.Padding = PaddingMode.None;
        using var decryptor = aes.CreateDecryptor();
        return decryptor.TransformFinalBlock(data, 0, blockAlignedLen);
    }

    private static byte[] Pkcs7Unpad(byte[] data)
    {
        if (data.Length == 0) return data;
        var padLen = data[data.Length - 1];
        if (padLen == 0 || padLen > 16 || padLen > data.Length)
            return data;
        return data.AsSpan(0, data.Length - padLen).ToArray();
    }

    private static void TryGetString(JsonElement root, string name, Action<string> setter)
    {
        if (root.TryGetProperty(name, out var elem) && elem.ValueKind == JsonValueKind.String)
            setter(elem.GetString() ?? "");
    }

    private static void TryGetInt32(JsonElement root, string name, Action<int> setter)
    {
        if (root.TryGetProperty(name, out var elem) && elem.ValueKind == JsonValueKind.Number)
            setter(elem.GetInt32());
    }

    private static void TryGetInt64(JsonElement root, string name, Action<long> setter)
    {
        if (root.TryGetProperty(name, out var elem) && elem.ValueKind == JsonValueKind.Number)
            setter(elem.GetInt64());
    }
}