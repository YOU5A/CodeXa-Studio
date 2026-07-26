namespace NcmStudio.Core.Crypto;

public class Rc4Cipher
{
    private readonly byte[] _s = new byte[256];
    private int _i, _j;

    public Rc4Cipher(byte[] key)
    {
        for (int k = 0; k < 256; k++) _s[k] = (byte)k;
        int j = 0;
        for (int k = 0; k < 256; k++)
        {
            j = (j + _s[k] + key[k % key.Length]) % 256;
            (_s[k], _s[j]) = (_s[j], _s[k]);
        }
    }

    public byte NextByte(byte input)
    {
        _i = (_i + 1) % 256;
        _j = (_j + _s[_i]) % 256;
        (_s[_i], _s[_j]) = (_s[_j], _s[_i]);
        return (byte)(input ^ _s[(_s[_i] + _s[_j]) % 256]);
    }

    public byte[] ProcessBytes(byte[] data)
    {
        var result = new byte[data.Length];
        for (int k = 0; k < data.Length; k++)
            result[k] = NextByte(data[k]);
        return result;
    }
}
