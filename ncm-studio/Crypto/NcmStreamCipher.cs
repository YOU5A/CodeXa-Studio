namespace NcmStudio.Core.Crypto;

/// <summary>
/// NCM audio stream cipher based on yoki123/ncmdump reference.
/// Uses RC4-like key scheduling with a custom keystream generator.
/// </summary>
public class NcmStreamCipher
{
    private readonly byte[] _box = new byte[256];

    public NcmStreamCipher(byte[] key)
    {
        // RC4 KSA (Key Scheduling Algorithm)
        for (int i = 0; i < 256; i++) _box[i] = (byte)i;

        byte lastByte = 0;
        int keyOffset = 0;
        for (int i = 0; i < 256; i++)
        {
            var c = (byte)((_box[i] + lastByte + key[keyOffset]) & 0xff);
            keyOffset++;
            if (keyOffset >= key.Length) keyOffset = 0;

            (_box[i], _box[c]) = (_box[c], _box[i]);
            lastByte = c;
        }
    }

    /// <summary>
    /// Decrypts audio data in-place using the NCM stream cipher.
    /// </summary>
    public void ProcessBytes(Span<byte> data)
    {
        for (int i = 0; i < data.Length; i++)
        {
            var j = (i + 1) & 0xff;
            var k = (_box[j] + _box[(_box[j] + j) & 0xff]) & 0xff;
            data[i] ^= _box[k];
        }
    }
}