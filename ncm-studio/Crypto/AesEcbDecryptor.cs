using System.Security.Cryptography;

namespace NcmStudio.Core.Crypto;

public static class AesEcbDecryptor
{
    public static byte[] Decrypt(byte[] key, byte[] data)
    {
        using var aes = Aes.Create();
        aes.Key = key;
        aes.Mode = CipherMode.ECB;
        aes.Padding = PaddingMode.PKCS7;
        using var decryptor = aes.CreateDecryptor();
        return decryptor.TransformFinalBlock(data, 0, data.Length);
    }
}
