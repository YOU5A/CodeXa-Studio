using NcmStudio.Core.Models;
using System.Security.Cryptography;

namespace NcmStudio.Core.Crypto;

public static class NcmKeyDerivation
{
    private static readonly byte[] NcmCoreKey = {
        0x68, 0x7A, 0x48, 0x52, 0x41, 0x6D, 0x73, 0x6F,
        0x35, 0x6B, 0x49, 0x6E, 0x62, 0x61, 0x78, 0x57
    };

    private static readonly byte[] NeteaseMarker =
        System.Text.Encoding.UTF8.GetBytes("neteasecloudmusic");

    /// <summary>
    /// Derives the AES-128 key used to decrypt NCM audio data.
    /// Key is always 16 bytes, located after the "neteasecloudmusic" marker.
    /// </summary>
    public static byte[] DeriveAesKey(NcmFileHeader header)
    {
        if (header.EncryptedKey.Length == 0)
            throw new InvalidDataException("Encrypted key is empty");

        // Step 1: XOR each byte of encrypted key with 0x64
        var keyData = new byte[header.EncryptedKey.Length];
        for (int i = 0; i < keyData.Length; i++)
            keyData[i] = (byte)(header.EncryptedKey[i] ^ 0x64);

        // Step 2: AES-128-ECB decrypt (truncate to 16-byte boundary)
        var blockAlignedLen = keyData.Length / 16 * 16;
        byte[] decrypted;
        try
        {
            decrypted = AesEcbDecryptNoPadding(NcmCoreKey,
                keyData.AsSpan(0, blockAlignedLen).ToArray());
        }
        catch
        {
            throw new InvalidDataException(
                $"AES-ECB key decryption failed. Key size: {header.EncryptedKey.Length} bytes.");
        }

        // Step 3: Locate "neteasecloudmusic" marker
        var markerPos = IndexOf(decrypted, NeteaseMarker);
        if (markerPos < 0)
        {
            // Legacy fallback: try RC4
            var rc4 = new Rc4Cipher(NcmCoreKey);
            var rc4Result = rc4.ProcessBytes(keyData);
            markerPos = IndexOf(rc4Result, NeteaseMarker);
            if (markerPos < 0)
                throw new InvalidDataException(
                    $"Cannot locate 'neteasecloudmusic' marker. Key size: {header.EncryptedKey.Length} bytes.");
            decrypted = rc4Result;
        }

        // Step 4: Extract 16-byte AES key after marker (skip leading zeros)
        var keyStart = markerPos + NeteaseMarker.Length;
        while (keyStart < decrypted.Length && decrypted[keyStart] == 0)
            keyStart++;

        if (keyStart + 16 > decrypted.Length)
            throw new InvalidDataException(
                $"Not enough data after marker. Need 16 bytes, have {decrypted.Length - keyStart}.");

        var aesKey = new byte[16];
        Array.Copy(decrypted, keyStart, aesKey, 0, 16);
        return aesKey;
    }

    private static byte[] AesEcbDecryptNoPadding(byte[] key, byte[] data)
    {
        using var aes = Aes.Create();
        aes.Key = key;
        aes.Mode = CipherMode.ECB;
        aes.Padding = PaddingMode.None;
        using var decryptor = aes.CreateDecryptor();
        return decryptor.TransformFinalBlock(data, 0, data.Length);
    }

    private static int IndexOf(byte[] haystack, byte[] needle)
    {
        for (int i = 0; i <= haystack.Length - needle.Length; i++)
        {
            bool match = true;
            for (int j = 0; j < needle.Length; j++)
            {
                if (haystack[i + j] != needle[j]) { match = false; break; }
            }
            if (match) return i;
        }
        return -1;
    }
}